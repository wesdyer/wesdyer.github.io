#!/usr/bin/env python3
"""Generate portraits through the OpenAI Images API, in bulk.

    export OPENAI_API_KEY=sk-proj-...            # a key scoped to the project
    python3 regatta/art/batch_generate.py submit --collisions --dry-run
    python3 regatta/art/batch_generate.py submit --collisions
    python3 regatta/art/batch_generate.py status
    python3 regatta/art/batch_generate.py fetch

`sync` does the same work without the Batch API when you want one or two back now:

    python3 regatta/art/batch_generate.py sync breeze fathom

WHY gpt-image-1.5 AND NOT gpt-image-2: only the 1.5 line honours
`background: "transparent"` and returns a real alpha channel. gpt-image-2 accepts
`auto` and `opaque` only. `ingest.py` hard-fails on non-transparent corners, and
every hand-run this pipeline has done so far lost time to a background-removal
step that repainted the matte instead of cutting it. Native alpha removes that
step entirely, so the model choice is load-bearing rather than a preference.

THE PROMPT IS NOT WRITTEN HERE. It comes from `prompt.py.build()`, the same
assembly the manual flow uses, so the two can never drift. The Images API has no
separate negative-prompt field, so the negative list is appended as an "Avoid:"
sentence — that is the one difference from what `prompt.py` prints.

WHAT COMES BACK IS NOT READY TO INGEST. Every generation is normalised on the way
in: floating alpha stripped (keeping outline antialiasing), cropped to content,
and re-centred at span 0.86 / (0.51, 0.50) to match the shipped roster. That is
the same hand-treatment the whole 100-portrait batch received; doing it here means
`ingest.py` can run unattended.
"""
import argparse
import base64
import io
import json
import os
import pathlib
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import requests
from PIL import Image, ImageFilter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import prompt as P  # noqa: E402  — the single source of prompt text

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
MANIFEST = ROOT / "manifest.json"
INBOX = ROOT / "inbox"
CANDIDATES = ROOT / "candidates"
STATE = ROOT / ".batch_state.json"
API = "https://api.openai.com/v1"

MODEL = "gpt-image-1.5"          # the only current model that returns true alpha
SIZE = "1024x1024"
QUALITY = "high"                 # transparency is unreliable below medium
# high / medium / low per 1024x1024 image; Batch API is half price.
UNIT_COST = {"high": 0.133, "medium": 0.034, "low": 0.009}

SPAN, CX, CY = 0.86, 0.51, 0.50  # roster framing, measured off the shipped set

# A SQUARE FRAME IS A CHOICE, NOT A CONSTRAINT, and for a long subject it is the
# wrong one. The model also takes 1024x1536 and 1536x1024, and the long axis is the
# only one that limits how big a sprite can be drawn: the master holds
# `master * fillTo` px of subject, ingest bakes down from that, and everything past
# it is invented. A container ship in a square frame spends three quarters of the
# frame on empty water and comes out capped at 8.6 boat lengths; the same ship in a
# portrait frame is capped at 12.8. Per-asset via `gen` in the manifest, because
# this is a question about the SUBJECT's shape — most assets are genuinely square
# and should stay that way.
GEN_SIZES = {"1024x1024", "1024x1536", "1536x1024"}


def size_for(asset):
    size = asset.get("gen", SIZE)
    if size not in GEN_SIZES:
        sys.exit(f"{asset['key']}: gen {size!r} is not one of {sorted(GEN_SIZES)}")
    return size


def cost_of(size, quality, batched):
    """UNIT_COST is quoted per 1024x1024; the API bills output area, so scale by it."""
    w, h = (int(v) for v in size.split("x"))
    return UNIT_COST[quality] * (w * h) / (1024 * 1024) * (0.5 if batched else 1.0)


KEYFILE = pathlib.Path.home() / ".config" / "openai" / "regatta-key"


def auth_headers():
    # Prefer the env var; fall back to a mode-600 file so the key never has to be
    # typed anywhere it might be captured — a shell history, a transcript, a diff.
    key = os.environ.get("OPENAI_API_KEY")
    if not key and KEYFILE.exists():
        if KEYFILE.stat().st_mode & 0o077:
            sys.exit(f"{KEYFILE} is readable by others — chmod 600 it first")
        key = KEYFILE.read_text().strip()
    if not key:
        sys.exit(
            "No API key found. Either put one in your shell profile:\n"
            "    echo 'export OPENAI_API_KEY=sk-proj-...' >> ~/.zshrc\n"
            "or write it to a private file:\n"
            f"    mkdir -p {KEYFILE.parent} && printf %s 'sk-proj-...' > {KEYFILE}\n"
            f"    chmod 600 {KEYFILE}\n"
            "Use a key scoped to the Regatta Game project so its spend is capped there.")
    h = {"Authorization": f"Bearer {key}"}
    # Optional: only needed when the key is a user key rather than a project key.
    if os.environ.get("OPENAI_PROJECT"):
        h["OpenAI-Project"] = os.environ["OPENAI_PROJECT"]
    if os.environ.get("OPENAI_ORG_ID"):
        h["OpenAI-Organization"] = os.environ["OPENAI_ORG_ID"]
    return h


def load():
    m = json.loads(MANIFEST.read_text())
    return m, {a["key"]: a for a in m["assets"]}


def full_prompt(asset, profiles):
    """prompt.py's text, with the negatives folded in — the API takes one string."""
    pos = P.build(asset, profiles, "transparent")
    if asset["class"] == "portrait":
        neg = P.NEGATIVE.replace("perspective view, ", "") + P.PORTRAIT_NEGATIVE
    else:
        neg = P.NEGATIVE if asset.get("allowSymmetry") else P.NEGATIVE + P.ARRANGEMENT_NEGATIVE
    return pos + "\n\nAvoid entirely: " + neg.lstrip(", ")


def body_for(asset, profiles, quality):
    return {
        "model": MODEL,
        "prompt": full_prompt(asset, profiles),
        "n": 1,
        "size": size_for(asset),
        "quality": quality,
        "background": "transparent",
        "output_format": "png",
    }


# ── colour maths, shared with the audit ────────────────────────────────────────
def _lab(h):
    h = h.lstrip("#")
    v = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda x: x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    r, g, b = [f(x) for x in v]
    X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    k = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    X, Y, Z = k(X), k(Y), k(Z)
    return np.array([116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)])


def dE(a, b):
    return float(np.linalg.norm(_lab(a) - _lab(b)))


def collision_keys(by_key, threshold=25):
    """Portraits whose subject dresses the animal in its own colour."""
    import re
    out = []
    for k, a in by_key.items():
        if a.get("class") != "portrait":
            continue
        o = re.search(r"ITS OWN COLOUR is [^(#]*\(?(#[0-9A-Fa-f]{6})\)?", a["subject"])
        sh = re.search(r"main body of the jacket is [^(]*\((#[0-9A-Fa-f]{6})\)", a["subject"])
        pa = re.search(r"shoulder straps are [^(]*\((#[0-9A-Fa-f]{6})\)", a["subject"])
        if not (o and sh and pa):
            continue
        worst = min(dE(o.group(1), sh.group(1)), dE(o.group(1), pa.group(1)))
        if worst < threshold:
            out.append((worst, k))
    return [k for _, k in sorted(out)]


# ── what comes back needs the same treatment every hand-run applied ────────────
def normalise(png_bytes, master=1024):
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    a = np.array(im)
    al = a[..., 3]
    # Strip free-floating semi-transparent pixels (backdrop residue) but keep the
    # antialiasing that hugs the outline — a blunt threshold eats the contour.
    solid = Image.fromarray(((al > 201) * 255).astype("uint8"))
    near = np.array(solid.filter(ImageFilter.MaxFilter(7))) > 0
    floating = (al > 8) & (al <= 201) & ~near
    a[..., 3][floating] = 0
    a[..., 3][a[..., 3] < 9] = 0
    im = Image.fromarray(a)
    bbox = im.split()[-1].getbbox()
    if bbox is None:
        raise ValueError("generation is fully transparent")
    # ⚠️ An opaque generation would otherwise SAIL THROUGH. Cropping to a full-frame
    # bbox and insetting it to span 0.86 manufactures a transparent margin, so the
    # corners read clear and both this script and ingest.py accept a picture that is
    # really a rectangle of backdrop. Catch it on coverage instead of on corners.
    h, w = a.shape[:2]
    covers_frame = ((bbox[2] - bbox[0]) > 0.99 * w) and ((bbox[3] - bbox[1]) > 0.99 * h)
    if covers_frame and (al > 250).mean() > 0.92:
        raise ValueError("background was not removed — the frame is opaque edge to edge "
                         "(check that background='transparent' was honoured; gpt-image-2 "
                         "cannot do it)")
    im = im.crop(bbox)
    f = SPAN * master / max(im.size)
    im = im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)
    canvas = Image.new("RGBA", (master, master), (0, 0, 0, 0))
    canvas.alpha_composite(im, (round(CX * master - im.width / 2),
                                round(CY * master - im.height / 2)))
    return canvas, int(floating.sum()), im.width / im.height


def master_of(asset, profiles):
    """The square canvas this asset's master is written on. Mirrors ingest's
    master_for: per-asset override, else the profile's. A portrait generation is
    letterboxed into it — the master stays square because ingest, fillTo and the
    anchor all assume that, and only the LONG axis was ever the limit."""
    if not asset:
        return 1024
    return asset.get("master", profiles[asset["class"]]["master"])


def save(key, png_bytes, dest_dir=None, asset=None, profiles=None):
    dest_dir = dest_dir or CANDIDATES
    dest_dir.mkdir(exist_ok=True)
    m = master_of(asset, profiles)
    canvas, stripped, aspect = normalise(png_bytes, m)
    dest = dest_dir / f"{key}.png"
    canvas.save(dest)
    corners = [canvas.split()[-1].getpixel(p) for p in
               ((2, 2), (m - 3, 2), (2, m - 3), (m - 3, m - 3))]
    warn = "  <-- CORNERS NOT CLEAR, ingest will reject" if max(corners) > 8 else ""
    print(f"  {key:12s} -> {dest.parent.name}/{key}.png   {m}px   aspect {aspect:.2f}   "
          f"stripped {stripped}{warn}")
    return dest


def select(args, by_key):
    if args.collisions:
        keys = collision_keys(by_key, args.threshold)
        print(f"{len(keys)} portraits whose jacket is within dE {args.threshold} "
              f"of the animal, worst first")
    elif args.all_portraits:
        keys = [k for k, a in by_key.items() if a.get("class") == "portrait"]
    else:
        keys = args.keys
    unknown = [k for k in keys if k not in by_key]
    if unknown:
        sys.exit(f"unknown key(s): {', '.join(unknown)}")
    if not keys:
        sys.exit("nothing selected — pass keys, --collisions or --all-portraits")
    return keys


def estimate(keys, quality, batched, by_key=None):
    """Total and a per-size breakdown — a portrait frame is 1.5x the area, so a
    mixed selection no longer has one unit price."""
    sizes = [size_for(by_key[k]) if by_key else SIZE for k in keys]
    per = {s: cost_of(s, quality, batched) for s in set(sizes)}
    return sum(per[s] for s in sizes), per


# ── commands ───────────────────────────────────────────────────────────────────
def cmd_submit(args):
    m, by_key = load()
    keys = select(args, by_key)
    total, per = estimate(keys, args.quality, batched=True, by_key=by_key)
    breakdown = ", ".join(f"{s} ~${c:.3f} each" for s, c in sorted(per.items()))
    print(f"\n{len(keys)} image(s), {MODEL} {args.quality}, Batch API "
          f"({breakdown}) = ~${total:.2f}\n")
    lines = []
    for k in keys:
        lines.append(json.dumps({
            "custom_id": k,
            "method": "POST",
            "url": "/v1/images/generations",
            "body": body_for(by_key[k], m["profiles"], args.quality),
        }))
    jsonl = "\n".join(lines) + "\n"
    path = ROOT / "batch_input.jsonl"
    path.write_text(jsonl)
    print(f"wrote {path.relative_to(REPO.parent)}  ({len(lines)} requests, "
          f"{len(jsonl)/1024:.0f} KB)")
    if args.dry_run:
        print("\n--dry-run: nothing uploaded. Inspect the JSONL above, then re-run "
              "without --dry-run.")
        return
    h = auth_headers()
    up = requests.post(f"{API}/files", headers=h,
                       files={"file": ("batch_input.jsonl", jsonl, "application/jsonl")},
                       data={"purpose": "batch"}, timeout=120)
    up.raise_for_status()
    fid = up.json()["id"]
    b = requests.post(f"{API}/batches", headers={**h, "Content-Type": "application/json"},
                      json={"input_file_id": fid,
                            "endpoint": "/v1/images/generations",
                            "completion_window": "24h"}, timeout=60)
    b.raise_for_status()
    batch = b.json()
    STATE.write_text(json.dumps({"batch_id": batch["id"], "keys": keys,
                                 "quality": args.quality}, indent=1))
    print(f"\nbatch {batch['id']} submitted, status {batch['status']}")
    print("  poll with:  python3 regatta/art/batch_generate.py status")


def _batch_id(args):
    if getattr(args, "batch_id", None):
        return args.batch_id
    if STATE.exists():
        return json.loads(STATE.read_text())["batch_id"]
    sys.exit("no batch id — pass one, or run submit first")


def cmd_status(args):
    r = requests.get(f"{API}/batches/{_batch_id(args)}", headers=auth_headers(), timeout=60)
    r.raise_for_status()
    b = r.json()
    c = b.get("request_counts", {})
    print(f"{b['id']}  {b['status']}   completed {c.get('completed',0)}/"
          f"{c.get('total',0)}   failed {c.get('failed',0)}")
    if b["status"] == "completed":
        print("  fetch with:  python3 regatta/art/batch_generate.py fetch")
    return b


def cmd_fetch(args):
    man, by_key = load()          # needed for each asset's master size
    h = auth_headers()
    bid = _batch_id(args)
    r = requests.get(f"{API}/batches/{bid}", headers=h, timeout=60)
    r.raise_for_status()
    b = r.json()
    if b["status"] != "completed":
        sys.exit(f"batch is {b['status']}, not completed")
    if b.get("error_file_id"):
        err = requests.get(f"{API}/files/{b['error_file_id']}/content", headers=h, timeout=300)
        for line in err.text.strip().splitlines():
            e = json.loads(line)
            print(f"  FAILED {e.get('custom_id')}: "
                  f"{(e.get('response') or {}).get('body', {}).get('error', {}).get('message', e)}")
    out = requests.get(f"{API}/files/{b['output_file_id']}/content", headers=h, timeout=600)
    out.raise_for_status()
    n = 0
    print()
    for line in out.text.strip().splitlines():
        rec = json.loads(line)
        key = rec["custom_id"]
        body = (rec.get("response") or {}).get("body") or {}
        data = body.get("data") or []
        if not data or "b64_json" not in data[0]:
            print(f"  {key:12s} no image in response")
            continue
        try:
            save(key, base64.b64decode(data[0]["b64_json"]),
                 asset=by_key.get(key), profiles=man["profiles"])
            n += 1
        except Exception as exc:                                   # noqa: BLE001
            print(f"  {key:12s} FAILED to normalise: {exc}")
    print(f"\n{n} image(s) in art/candidates/. Nothing shipped has been touched.")
    print("  python3 regatta/art/review.py sheet")


def cmd_sync(args):
    m, by_key = load()
    keys = select(args, by_key)
    total, per = estimate(keys, args.quality, batched=False, by_key=by_key)
    breakdown = ", ".join(f"{s} ~${c:.3f} each" for s, c in sorted(per.items()))
    print(f"\n{len(keys)} image(s), {MODEL} {args.quality}, direct "
          f"({breakdown}) = ~${total:.2f}\n")
    if args.dry_run:
        print("--dry-run: nothing sent.")
        return
    h = {**auth_headers(), "Content-Type": "application/json"}

    def one(k):
        last = None
        for attempt in range(6):
            try:
                r = requests.post(f"{API}/images/generations", headers=h,
                                  json=body_for(by_key[k], m["profiles"], args.quality),
                                  timeout=900)
                if r.status_code == 429 or r.status_code >= 500:
                    # Honour Retry-After when the server sends one; image endpoints
                    # rate-limit on images-per-minute, which 6 workers hit easily.
                    wait = float(r.headers.get("retry-after", 0)) or min(90, 2 ** attempt * 8)
                    last = f"{r.status_code} (waited {wait:.0f}s)"
                    time.sleep(wait)
                    continue
                if r.status_code >= 400:
                    try:
                        msg = r.json().get("error", {}).get("message") or r.text[:600]
                    except ValueError:
                        msg = r.text[:600]
                    return k, RuntimeError(f"{r.status_code}: {msg}")
                return k, base64.b64decode(r.json()["data"][0]["b64_json"])
            except requests.RequestException as exc:
                # Record it. "gave up after retries" with no reason is not a diagnosis.
                last = f"{type(exc).__name__}: {str(exc)[:160]}"
                time.sleep(min(90, 2 ** attempt * 8))
        return k, RuntimeError(f"gave up after 6 attempts — last: {last}")

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        for k, res in ex.map(one, keys):
            if isinstance(res, Exception):
                print(f"  {k:12s} FAILED: {res}")
            else:
                try:
                    save(k, res, asset=by_key.get(k), profiles=m["profiles"])
                except Exception as exc:                            # noqa: BLE001
                    print(f"  {k:12s} FAILED to normalise: {exc}")
    print("\nNothing shipped was touched. Next: python3 regatta/art/review.py sheet")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("keys", nargs="*")
        p.add_argument("--collisions", action="store_true",
                       help="portraits whose jacket collides with the animal's colour")
        p.add_argument("--all-portraits", action="store_true")
        p.add_argument("--threshold", type=float, default=25.0)
        p.add_argument("--quality", choices=["low", "medium", "high"], default=QUALITY)
        p.add_argument("--dry-run", action="store_true")

    s = sub.add_parser("submit", help="queue a Batch API job (half price, up to 24h)")
    common(s)
    s.set_defaults(fn=cmd_submit)

    s = sub.add_parser("status")
    s.add_argument("batch_id", nargs="?")
    s.set_defaults(fn=cmd_status)

    s = sub.add_parser("fetch", help="download a finished batch into art/inbox/")
    s.add_argument("batch_id", nargs="?")
    s.set_defaults(fn=cmd_fetch)

    s = sub.add_parser("sync", help="generate now, no batch (full price)")
    common(s)
    s.add_argument("--workers", type=int, default=4)
    s.set_defaults(fn=cmd_sync)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()

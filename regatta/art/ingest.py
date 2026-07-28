#!/usr/bin/env python3
"""Validate a generated master and emit the game-ready asset.

    python3 regatta/art/ingest.py bayou-cypress
    python3 regatta/art/ingest.py --all            # everything sitting in inbox/
    python3 regatta/art/ingest.py bayou-cypress --check   # validate only, write nothing

Drop the generated master at regatta/art/inbox/<key>.png. This checks it against
its manifest profile, archives it to masters/, writes the game-ready bake into
assets/images/, records the computed anchor, and flips status to "art".

The anchor is seeded from the alpha bounding-box center. That is right for most
floating props and wrong for anything whose contact point is off-center (a leaning
tree, an L-shaped dock). Check it on the contact sheet — contact.py draws a
crosshair at the anchor — and correct anchorPx in the manifest by hand.
"""
import argparse
import json
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
MANIFEST = ROOT / "manifest.json"
INBOX = ROOT / "inbox"
MASTERS = ROOT / "masters"


class Fail(Exception):
    pass


def check_master(img, prof, key):
    """Structural checks that are cheap now and expensive after 80 files."""
    notes = []
    m = prof["master"]
    if img.width != img.height:
        raise Fail(f"not square: {img.width}x{img.height}")
    if img.width != m:
        notes.append(f"master is {img.width}px, profile wants {m}px — will resample")

    if prof["background"] == "transparent":
        if img.mode != "RGBA":
            raise Fail(f"needs alpha, got mode {img.mode}")
        alpha = img.getchannel("A")
        lo, hi = alpha.getextrema()
        if hi == 0:
            raise Fail("fully transparent")
        if lo == 255:
            raise Fail("fully opaque — background was not removed")

        # Corners must be clear, or the model painted a backdrop.
        w, h = img.size
        corners = [alpha.getpixel(p) for p in
                   ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3))]
        if max(corners) > 8:
            raise Fail(f"corners not transparent (alpha {corners}) — backdrop present")

        bbox = alpha.getbbox()
        margin = prof.get("safeMargin", 0.0)
        if margin:
            pad = int(min(img.size) * margin)
            if (bbox[0] < pad or bbox[1] < pad
                    or bbox[2] > img.width - pad or bbox[3] > img.height - pad):
                notes.append(
                    f"content reaches within {margin:.0%} of the edge (bbox {bbox}) — "
                    "no room for rotation or a contact shadow"
                )
        # Straight alpha: a dark matte halo shows as mid-alpha pixels that are
        # much darker than their opaque neighbours.
        return bbox, notes

    if img.mode not in ("RGB", "RGBA"):
        raise Fail(f"unexpected mode {img.mode}")
    if img.mode == "RGBA" and img.getchannel("A").getextrema()[0] < 255:
        notes.append("has transparency but profile wants opaque — will flatten")
    return None, notes


def ingest(asset, profiles, check_only=False):
    key = asset["key"]
    prof = profiles[asset["class"]]
    src = INBOX / f"{key}.png"
    if not src.exists():
        raise Fail(f"no master at {src.relative_to(REPO.parent)}")

    img = Image.open(src)
    bbox, notes = check_master(img, prof, key)

    for n in notes:
        print(f"    warn: {n}")

    if check_only:
        print(f"    ok (check only, nothing written)")
        return None

    m = prof["master"]
    if img.size != (m, m):
        img = img.resize((m, m), Image.LANCZOS)

    MASTERS.mkdir(exist_ok=True)
    img.save(MASTERS / f"{key}.png")

    outdir = REPO / prof["out"]
    outdir.mkdir(parents=True, exist_ok=True)

    if prof["track"] == "sprite":
        size = asset["world"] * prof["bake"]
        game = img.resize((size, size), Image.LANCZOS)
        game.save(outdir / f"{key}.png")
        print(f"    -> {prof['out']}/{key}.png  ({size}px bake for {asset['world']}px display)")
        if bbox:
            anchor = [round((bbox[0] + bbox[2]) / 2 / m, 4),
                      round((bbox[1] + bbox[3]) / 2 / m, 4)]
            if "anchorPx" not in asset:
                asset["anchorPx"] = anchor
                print(f"    anchor seeded at {anchor} (bbox center) — verify on the contact sheet")
            else:
                print(f"    anchor kept at {asset['anchorPx']} (bbox center would be {anchor})")
    else:
        out = img.convert("RGB") if prof["background"] == "opaque" else img
        out.save(outdir / f"{key}.png")
        print(f"    -> {prof['out']}/{key}.png")
        if prof.get("thumb"):
            t = prof["thumb"]
            thumbdir = outdir / "thumbs"
            thumbdir.mkdir(exist_ok=True)
            out.resize((t, t), Image.LANCZOS).save(thumbdir / f"{key}.png")
            print(f"    -> {prof['out']}/thumbs/{key}.png  ({t}px)")

    asset["status"] = "art"
    return asset


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keys", nargs="*")
    ap.add_argument("--all", action="store_true", help="ingest every master in inbox/")
    ap.add_argument("--check", action="store_true", help="validate only")
    args = ap.parse_args()

    m = json.loads(MANIFEST.read_text())
    by_key = {a["key"]: a for a in m["assets"]}

    if args.all:
        INBOX.mkdir(exist_ok=True)
        keys = sorted(p.stem for p in INBOX.glob("*.png"))
        unknown = [k for k in keys if k not in by_key]
        for k in unknown:
            print(f"{k}: skipped — not in manifest (declare the slot first)")
        keys = [k for k in keys if k in by_key]
    else:
        keys = args.keys
        unknown = [k for k in keys if k not in by_key]
        if unknown:
            sys.exit(f"unknown key(s): {', '.join(unknown)}")

    if not keys:
        sys.exit("nothing to ingest (inbox is empty)")

    changed = False
    failed = 0
    for k in keys:
        print(f"{k}:")
        try:
            if ingest(by_key[k], m["profiles"], args.check):
                changed = True
        except Fail as e:
            print(f"    FAIL: {e}")
            failed += 1

    if changed:
        MANIFEST.write_text(json.dumps(m, indent=2) + "\n")
        print("\nmanifest updated")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

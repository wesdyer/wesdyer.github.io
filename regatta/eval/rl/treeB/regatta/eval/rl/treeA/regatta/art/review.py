#!/usr/bin/env python3
"""Triage a batch of regenerated portraits: contact sheets + a feedback file.

    python3 regatta/art/review.py sheet          # build sheets + feedback.txt
    ...edit art/review/feedback.txt...
    python3 regatta/art/review.py apply          # ingest the approved ones
    python3 regatta/art/review.py apply --dry-run

WHY A FILE AND NOT AN EYEBALL: judging 100 portraits is the real cost of a full
regeneration, not the $7 of generation. Most of the calls made by hand during the
100-portrait build came down to four numbers, all of which can be computed:
whether the silhouette is in the roster's aspect range, whether the vest separates
from the animal, whether the vest agrees with the profile band the portrait is
drawn on, and whether the outline ink is as heavy as the roster's. The sheet puts
those next to the pair so the eye is only spent on genuine judgement calls.

VERDICTS, one per line in feedback.txt:
    ingest   take the new one, overwrite the shipped portrait
    keep     the shipped one is better, discard the new one
    reroll   neither is right — notes say why, and the notes become SUBJECT edits

Anything left as `?` is treated as undecided and skipped.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
INBOX = ROOT / "inbox"
CAND = ROOT / "candidates"
SHIPPED = REPO / "assets" / "images" / "competitors"
OUT = ROOT / "review"
FEEDBACK = OUT / "feedback.md"
MANIFEST = ROOT / "manifest.json"
SCRIPT = REPO / "js" / "script.js"

ASPECT_LO, ASPECT_HI = 0.78, 1.37     # measured across the shipped roster


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


def lum(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def hx(c):
    return "#%02X%02X%02X" % tuple(int(round(v)) for v in c)


def config():
    s = SCRIPT.read_text()
    out = {}
    for n, h, sp in re.findall(r"\{ name: '(\w+)'.*?hull: '(#\w+)', spinnaker: '(#\w+)'", s):
        out[n.lower()] = (h, sp)
    return out


def band_colour(hull, spin):
    """competitorProfileHTML: the hull unless its luma is extreme, then the kite."""
    return hull if 50 <= lum(hull) <= 200 else spin


def measure(path, subject_own=None):
    """The four numbers that decided most calls during the 100-portrait build."""
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    al = a[..., 3]
    op = al > 200
    bb = im.split()[-1].point(lambda v: 255 if v > 8 else 0).getbbox()
    aspect = (bb[2] - bb[0]) / (bb[3] - bb[1])
    H = a.shape[0]
    inner = np.array(Image.fromarray((op * 255).astype("uint8")).filter(ImageFilter.MinFilter(11))) > 0
    # animal: the dominant tone of the head, outline eroded away
    head = inner.copy()
    head[int(0.40 * H):] = False
    if head.sum() < 400:
        head = inner
    q = (a[..., :3].astype(int) // 12 * 12)
    cols, cnt = np.unique(q[head].reshape(-1, 3), axis=0, return_counts=True)
    top = [(cols[i], cnt[i]) for i in np.argsort(-cnt)[:3]]
    w = np.array([n for _, n in top], float)
    w /= w.sum()
    animal = hx(sum(c * wi for (c, _), wi in zip(top, w)))
    # vest: the dominant saturated tone of the lower torso
    vest = inner.copy()
    vest[:int(0.50 * H)] = False
    picks = []
    if vest.sum() > 400:
        c2, n2 = np.unique(q[vest].reshape(-1, 3), axis=0, return_counts=True)
        for i in np.argsort(-n2):
            c = c2[i]
            if lum(hx(c)) < 30 or lum(hx(c)) > 246:
                continue
            if int(max(c)) - int(min(c)) < 35:
                continue
            picks.append(hx(c))
            break
    vestc = picks[0] if picks else None
    # contour: how dark is the band just inside the silhouette
    edge = op & ~np.array(Image.fromarray((op * 255).astype("uint8"))
                          .filter(ImageFilter.MinFilter(9))) > 0
    edge = op & ~(np.array(Image.fromarray((op * 255).astype("uint8"))
                           .filter(ImageFilter.MinFilter(9))) > 0)
    el = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])[edge]
    contour = float((el < 70).mean()) if el.size else 0.0
    return dict(aspect=aspect, animal=animal, vest=vestc, contour=contour)


def row_for(key, cfg):
    ship = SHIPPED / f"{key}.png"
    new = CAND / f"{key}.png"
    if not new.exists():
        return None
    m = measure(new)
    o = measure(ship) if ship.exists() else None
    hull, spin = cfg.get(key, (None, None))
    band = band_colour(hull, spin) if hull else None
    d_animal = dE(m["vest"], m["animal"]) if m["vest"] else None
    d_band = dE(m["vest"], band) if (m["vest"] and band) else None
    flags = []
    if not (ASPECT_LO <= m["aspect"] <= ASPECT_HI):
        flags.append("ASPECT")
    if d_animal is not None and d_animal < 25:
        flags.append("VEST=ANIMAL")
    # NOT flagged: vest-vs-band. The vest sample is unreliable whenever a limb
    # covers the torso (Bixby's folded paws, Latch's fins), so it fired on four
    # portraits that are fine. The number is still printed as advisory.
    if o and m["contour"] < o["contour"] - 0.15:
        flags.append("THIN-INK")
    return dict(key=key, new=m, old=o, d_animal=d_animal, d_band=d_band, flags=flags)


def cmd_sheet(args):
    OUT.mkdir(exist_ok=True)
    cfg = config()
    keys = sorted(p.stem for p in CAND.glob("*.png")
                  if (SHIPPED / p.name).exists() or args.include_new)
    rows = [r for r in (row_for(k, cfg) for k in keys) if r]
    if not rows:
        sys.exit("nothing in art/candidates/ to review")
    # ── contact sheets: shipped above, candidate below ────────────────────────
    CELL, PER_ROW, PER_PAGE = 190, 6, 24
    pages = [rows[i:i + PER_PAGE] for i in range(0, len(rows), PER_PAGE)]
    for pi, page in enumerate(pages, 1):
        nrows = (len(page) + PER_ROW - 1) // PER_ROW
        img = Image.new("RGB", (PER_ROW * CELL, nrows * (CELL + 46)), (250, 250, 252))
        d = ImageDraw.Draw(img)
        for i, r in enumerate(page):
            cx, cy = (i % PER_ROW) * CELL, (i // PER_ROW) * (CELL + 46)
            for j, p in enumerate([SHIPPED / f"{r['key']}.png", CAND / f"{r['key']}.png"]):
                if not p.exists():
                    continue
                x = Image.open(p).convert("RGBA")
                x = x.crop(x.split()[-1].point(lambda v: 255 if v > 8 else 0).getbbox())
                s = (CELL // 2 - 10) / max(x.size)
                x = x.resize((max(1, int(x.width * s)), max(1, int(x.height * s))), Image.LANCZOS)
                img.paste(x, (cx + j * (CELL // 2) + (CELL // 2 - x.width) // 2,
                              cy + (CELL - x.height) // 2), x)
            d.text((cx + 6, cy + CELL + 2), f"{r['key']}", fill=(20, 20, 24))
            bits = [f"a{r['new']['aspect']:.2f}"]
            if r["d_animal"] is not None:
                bits.append(f"vA{r['d_animal']:.0f}")
            if r["d_band"] is not None:
                bits.append(f"vB{r['d_band']:.0f}")
            bits.append(f"ink{100*r['new']['contour']:.0f}%")
            d.text((cx + 6, cy + CELL + 16), "  ".join(bits), fill=(90, 90, 100))
            if r["flags"]:
                d.text((cx + 6, cy + CELL + 30), " ".join(r["flags"]), fill=(190, 30, 30))
            d.line([(cx + CELL // 2, cy + 8), (cx + CELL // 2, cy + CELL - 8)], fill=(215, 215, 222))
        p = OUT / f"sheet{pi}.png"
        img.save(p)
        print(f"  {p.relative_to(REPO.parent)}   ({len(page)} pairs)  left = shipped, right = new")
    # ── feedback file, markdown ───────────────────────────────────────────────
    # Regenerating must never discard review already done: carry over any verdict
    # and notes already present for a key.
    prior = {}
    if FEEDBACK.exists():
        for k, v, n in parse_feedback():
            if v != "?" or n:
                prior[k] = (v, n)
    # Carry the previous round's note alongside, so a reroll can be judged against
    # what was actually asked for rather than from memory.
    said = {}
    for arch in sorted(OUT.glob("feedback-round*.md")):
        for ln in arch.read_text().splitlines():
            ln = ln.strip()
            if not ln.startswith("|"):
                continue
            c = [x.strip() for x in ln.strip("|").split("|")]
            if len(c) < 8 or c[0] in ("key", "verdict") or set(c[0]) <= set("-: "):
                continue
            if c[7]:
                said[c[0]] = c[7]
    md = [
        "# Portrait review",
        "",
        f"{len(rows)} candidates in `regatta/art/candidates/`. Nothing shipped has been touched.",
        "",
        "Set **verdict** on each row to one of:",
        "",
        "| verdict | effect |",
        "|---|---|",
        "| `ingest` | take the new one — overwrites the shipped portrait |",
        "| `keep` | shipped one is better; the candidate is discarded |",
        "| `reroll` | neither is right — put why in notes; notes become SUBJECT edits |",
        "| `?` | undecided, skipped |",
        "",
        "Columns: **a** aspect (roster 0.78–1.37) · **vA** dE vest vs animal "
        "(under 25 = the vest vanishes) · **vB** dE vest vs profile band (advisory) · "
        "**ink** % of outline that is dark (roster 61–81%).",
        "",
        "Flagged rows are listed first.",
        "",
        "| key | verdict | a | vA | vB | ink | auto | notes | previously said |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for r in sorted(rows, key=lambda r: (not r["flags"], r["key"])):
        vA = f"{r['d_animal']:.0f}" if r["d_animal"] is not None else "-"
        vB = f"{r['d_band']:.0f}" if r["d_band"] is not None else "-"
        pv, pn = prior.get(r["key"], ("?", ""))
        md.append(f"| {r['key']} | {pv} | {r['new']['aspect']:.2f} | {vA} | {vB} | "
                  f"{100*r['new']['contour']:.0f}% | {' '.join(r['flags']) or ''} | {pn} | "
                  f"{said.get(r['key'],'')} |")
    FEEDBACK.write_text("\n".join(md) + "\n")
    print(f"\n  {FEEDBACK.relative_to(REPO.parent)}   ({len(rows)} rows, flagged first"
          f"{f'; carried over {len(prior)} verdict(s)' if prior else ''})")
    flagged = sum(1 for r in rows if r["flags"])
    print(f"\n{len(rows)} pairs, {flagged} auto-flagged. Edit the verdicts, then:")
    print("  python3 regatta/art/review.py apply")


def parse_feedback():
    if not FEEDBACK.exists():
        sys.exit(f"no {FEEDBACK} — run `review.py sheet` first")
    out = []
    for ln in FEEDBACK.read_text().splitlines():
        ln = ln.strip()
        if not ln.startswith("|"):
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) < 8 or cells[0] in ("key", "verdict") or set(cells[0]) <= set("-: "):
            continue
        out.append((cells[0], cells[1].strip("`").lower(), cells[7]))
    return out


def cmd_apply(args):
    # ⚠️ Archive, never delete. Round 1's candidates were cleared between rounds and
    # then seven reviews came back saying "last round was better" — with nothing left
    # to go back to. Every round's stage is kept.
    import shutil
    n = 1 + max([int(p.name.split("round")[-1] or 0) for p in OUT.glob("candidates-round*")] or [0])
    if CAND.exists() and any(CAND.iterdir()):
        shutil.copytree(CAND, OUT / f"candidates-round{n}", dirs_exist_ok=True)
        print(f"  archived this round's candidates to art/review/candidates-round{n}/")
    rows = parse_feedback()
    buckets = {"ingest": [], "keep": [], "reroll": [], "?": []}
    for key, verdict, notes in rows:
        buckets.setdefault(verdict, []).append((key, notes))
    for v in ("ingest", "keep", "reroll", "?"):
        print(f"  {v:8s} {len(buckets.get(v, []))}")
    ing = [k for k, _ in buckets.get("ingest", [])]
    if ing and not args.dry_run:
        # ingest.py reads from inbox/, so an approved candidate is copied across only
        # once it has been approved. Nothing in inbox/ is disturbed before that.
        import shutil
        for k in ing:
            shutil.copy2(CAND / f"{k}.png", INBOX / f"{k}.png")
        print(f"\ningesting {len(ing)}...")
        subprocess.run([sys.executable, str(ROOT / "ingest.py"), *ing], cwd=REPO, check=False)
    elif ing:
        print(f"\n--dry-run: would ingest {' '.join(ing)}")
    for k, _ in buckets.get("keep", []):
        p = CAND / f"{k}.png"
        if p.exists() and not args.dry_run:
            p.unlink()
    if buckets.get("keep"):
        print(f"discarded {len(buckets['keep'])} candidate(s) from inbox")
    rr = buckets.get("reroll", [])
    if rr:
        print(f"\n{len(rr)} for reroll — these notes need turning into SUBJECT edits "
              f"before regenerating:")
        for k, n in rr:
            print(f"  {k:14s} {n or '(no note given)'}")
        (OUT / "reroll.txt").write_text("\n".join(f"{k}\t{n}" for k, n in rr) + "\n")
        print(f"\nwritten to {(OUT/'reroll.txt').relative_to(REPO.parent)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sheet")
    s.add_argument("--include-new", action="store_true",
                   help="also review candidates with no shipped counterpart")
    s.set_defaults(fn=cmd_sheet)
    s = sub.add_parser("apply")
    s.add_argument("--dry-run", action="store_true")
    s.set_defaults(fn=cmd_apply)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()

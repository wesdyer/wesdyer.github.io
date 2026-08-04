#!/usr/bin/env python3
"""Build a group sprite by scattering copies of a single-element master.

    python3 regatta/art/compose.py arctic-penguin-huddle
    python3 regatta/art/compose.py arctic-penguin-huddle --seed 12 --preview

Writes regatta/art/inbox/<key>.png, ready for ingest.py.

WHY THIS EXISTS. Image models are strongly drawn to symmetry. Asked for "seven
penguins in a loose huddle" they return a rosette — birds evenly spaced in a ring,
facing inward, with a hole in the middle — and they keep returning one after the
negative prompt is hardened. A radial arrangement reads as a snowflake at race
scale, not as animals.

Irregular scatter is trivial for a PRNG and apparently very hard for a diffusion
model, so generate ONE good element and let this place it. Side benefits: every
member is literally the same accepted art, so the group cannot drift in style; and
new variants cost a seed rather than a generation.

The element lives under the `element` profile and never ships on its own — it is
too small to read at race scale, which is why groups are the shipping unit.

Manifest contract, on the group asset:

    "compose": {
      "from":   "arctic-penguin-emperor",   # element key
      "count":  7,
      "spread": 0.60,        # cluster diameter as a fraction of the frame
      "scale":  [0.26, 0.30],# element size as a fraction of the frame
      "rotate": [0, 360],    # degrees; use a narrow range for aligned groups
      "minGap": 0.55,        # min centre distance, in element widths
      "seed":   7
    }
"""
import argparse
import json
import math
import pathlib
import random
import sys

from PIL import Image

import paths

ROOT = pathlib.Path(__file__).resolve().parent
MANIFEST = ROOT / "manifest.json"
INBOX = ROOT / "inbox"
ELEMENTS = ROOT / "elements"
PREFIXES = {}


def scatter(n, spread, min_gap, rng, tries=4000):
    """Points in a disc, denser at the centre, with a minimum separation.

    r = R * u**0.62 biases inward, so the middle of the huddle is its densest
    part — the specific thing the generated rosettes always got backwards.
    """
    pts = []
    for _ in range(tries):
        if len(pts) == n:
            break
        a = rng.uniform(0, math.tau)
        r = (spread / 2) * (rng.random() ** 0.62)
        p = (math.cos(a) * r, math.sin(a) * r)
        if all(math.dist(p, q) >= min_gap for q in pts):
            pts.append(p)
    if len(pts) < n:
        print(f"    note: fit {len(pts)}/{n} at minGap={min_gap:.2f} — "
              "raise spread or lower minGap for a tighter pack")
    # Paint back-to-front so overlaps look like depth rather than collage.
    pts.sort(key=lambda p: p[1])
    return pts


def track(n, spread, rng):
    """Single file up the frame, on a gentle curve, with slightly uneven spacing.

    Vertical because the engine treats sprite-up as the direction of travel — a
    diagonal line would walk sideways across its own heading.
    """
    bow = rng.uniform(-0.10, 0.10)      # how much the file curves
    pts = []
    for i in range(n):
        t = (i / max(1, n - 1)) - 0.5                   # -0.5 (rear) .. +0.5 (leader)
        t += rng.uniform(-0.04, 0.04)                   # one bird lags, one presses
        pts.append((bow * (0.25 - t * t) * 4, -t * spread))
    return pts


def compose(asset, size, rng, elements):
    cfg = asset["compose"]
    el_asset = elements.get(cfg["from"], {"key": cfg["from"], "venue": asset.get("venue")})
    src = paths.store(ELEMENTS, el_asset, PREFIXES)
    if not src.exists():
        raise SystemExit(f"no element at {src} — "
                         f"generate it first: python3 regatta/art/prompt.py {cfg['from']}")
    el = Image.open(src).convert("RGBA")

    lo, hi = cfg.get("scale", [0.28, 0.32])
    rot_lo, rot_hi = cfg.get("rotate", [0, 360])
    min_gap = cfg.get("minGap", 0.55) * ((lo + hi) / 2)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if cfg.get("layout") == "line":
        pts = track(cfg["count"], cfg.get("spread", 0.7), rng)
    else:
        pts = scatter(cfg["count"], cfg.get("spread", 0.6), min_gap, rng)
    for px, py in pts:
        s = int(size * rng.uniform(lo, hi))
        piece = el.resize((s, s), Image.LANCZOS).rotate(
            rng.uniform(rot_lo, rot_hi), resample=Image.BICUBIC, expand=False)
        canvas.alpha_composite(
            piece, (int(size / 2 + px * size - s / 2), int(size / 2 + py * size - s / 2)))
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("--seed", type=int, help="override the manifest seed")
    ap.add_argument("--preview", action="store_true", help="write nothing")
    args = ap.parse_args()

    m = json.loads(MANIFEST.read_text())
    PREFIXES.update(paths.venue_prefixes(m["assets"]))
    by_key = {a["key"]: a for a in m["assets"]}
    if args.key not in by_key:
        sys.exit(f"unknown key: {args.key}")
    asset = by_key[args.key]
    if "compose" not in asset:
        sys.exit(f"{args.key} has no `compose` block in the manifest")

    size = m["profiles"][asset["class"]]["master"]
    seed = args.seed if args.seed is not None else asset["compose"].get("seed", 0)
    elements = {a["key"]: a for a in m["assets"] if a.get("class") == "element"}
    out = compose(asset, size, random.Random(seed), elements)

    bbox = out.getchannel("A").getbbox()
    print(f"{args.key}: {asset['compose']['count']} x {asset['compose']['from']}  seed={seed}")
    print(f"    content bbox {bbox} in {size}px frame")
    margin = min(bbox[0], bbox[1], size - bbox[2], size - bbox[3]) / size
    print(f"    tightest margin {margin:.1%}" + ("  (want >=8%)" if margin < 0.08 else ""))

    if args.preview:
        return
    INBOX.mkdir(exist_ok=True)
    out.save(INBOX / f"{args.key}.png")
    print(f"    -> art/inbox/{args.key}.png")
    print(f"    next: python3 regatta/art/ingest.py {args.key}")


if __name__ == "__main__":
    main()

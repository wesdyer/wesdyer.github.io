#!/usr/bin/env python3
"""Cut an accepted master into draw-time parts along a horizontal hinge.

    python3 regatta/art/split.py arctic-orca --at 0.93 --parts body flukes
    python3 regatta/art/split.py arctic-orca --at 0.93 --preview

Writes regatta/art/parts/<venue>/<name>-<part>.png, each keeping the FULL master
frame so the parts stay in register — composite them at the same position and
scale and they reassemble exactly.

WHY CUTTING, NOT GENERATING. An orca seen from directly overhead barely shows that
it is swimming: cetaceans beat vertically, so the body undulation happens in the
plane perpendicular to the camera. What does read is the FLUKES foreshortening as
they tilt — measured at 11.4px chord at race scale, dropping to 8.1px at a 45
degree beat, a 29% change. drawImage scales the whole sprite, so that cannot be
faked with a single-sprite transform.

Generating separate frames would give N independently-drawn orcas; any difference
between them reads as flicker rather than motion. Cutting guarantees every frame is
the same animal, and lets the beat be continuous rather than stepped.

The hinge sits at the tail stock — the narrowest point of the rear body, found
automatically unless --at is given. The lower part is drawn FIRST with a vertical
scale of cos(tilt) about the hinge, then the upper part over it, so the body hides
the seam exactly as a boat's sails overlay its hull.
"""
import argparse
import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image

import paths

ROOT = pathlib.Path(__file__).resolve().parent
MASTERS = ROOT / "masters"
PARTS = ROOT / "parts"


def find_hinge(solid, top, bot):
    """Narrowest row in the rear quarter of the body — the tail stock."""
    lo, hi = top + int(0.70 * (bot - top)), top + int(0.94 * (bot - top))
    widths = [(solid[y].sum(), y) for y in range(lo, hi)]
    return min(widths)[1]


def split(img, hinge, overlap):
    """Two full-frame layers. The lower one keeps `overlap` rows above the hinge
    so the upper layer has something to cover the seam with."""
    a = np.array(img.getchannel("A"))
    upper = img.copy(); lo = np.array(upper.getchannel("A"))
    lo[hinge:, :] = 0; upper.putalpha(Image.fromarray(lo))
    lower = img.copy(); hi = np.array(lower.getchannel("A"))
    hi[: max(0, hinge - overlap), :] = 0; lower.putalpha(Image.fromarray(hi))
    return upper, lower


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("--at", type=float, help="hinge as a fraction of content height (default: auto)")
    ap.add_argument("--parts", nargs=2, default=["body", "flukes"])
    ap.add_argument("--overlap", type=int, default=28, help="master px the lower part keeps above the hinge")
    ap.add_argument("--preview", action="store_true")
    args = ap.parse_args()

    m = json.loads((ROOT / "manifest.json").read_text())
    by = {a["key"]: a for a in m["assets"]}
    if args.key not in by:
        sys.exit(f"unknown key: {args.key}")
    asset = by[args.key]
    pref = paths.venue_prefixes(m["assets"])

    src = paths.store(MASTERS, asset, pref)
    if not src.exists():
        sys.exit(f"no master at {src}")
    img = Image.open(src).convert("RGBA")

    solid = np.array(img.getchannel("A")) > 8
    ys = np.where(solid.any(axis=1))[0]
    top, bot = ys.min(), ys.max()
    hinge = top + int(args.at * (bot - top)) if args.at else find_hinge(solid, top, bot)

    upper, lower = split(img, hinge, args.overlap)
    uc = np.array(upper.getchannel("A")) > 8
    lc = np.array(lower.getchannel("A")) > 8
    print(f"{args.key}: content y {top}-{bot}, hinge at y={hinge} "
          f"({(hinge-top)/(bot-top):.0%} down the body)")
    print(f"  {args.parts[0]:8} {uc.sum():7} px   {args.parts[1]:8} {lc.sum():7} px "
          f"({100*lc.sum()/solid.sum():.0f}% of the animal)")
    print(f"  hinge as a fraction of the frame: {hinge/img.height:.4f}  <- pivot for the lower part")

    if args.preview:
        return
    out = paths.store(PARTS, asset, pref).parent
    out.mkdir(parents=True, exist_ok=True)
    stem = paths.rel(asset, pref).name
    for part, layer in zip(args.parts, (upper, lower)):
        f = out / f"{stem}-{part}.png"
        layer.save(f)
        print(f"  -> {f.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Cut an accepted whole-tree master into its trunk and canopy halves.

    python3 regatta/art/treesplit.py bayou-oak
    python3 regatta/art/treesplit.py bayou-oak --cut 0.17 --preview

Writes regatta/art/inbox/<key>-trunk.png and <key>-canopy.png, ready for ingest.py.

WHY CUTTING, NOT GENERATING — the same argument split.py makes for the orca. The pair
exists so a hull can pass UNDER a crown and hit a stem, which needs two sprites drawn in
two planes. Drawing them as two separate generations gives two different trees: the crown
that covers the boat is not the crown the trunk belongs to, and no amount of prompting
makes a canopy match a trunk it never grew on. Cutting guarantees they are one tree, and
it drops the art bill from three masters per species to one.

BOTH PARTS KEEP THE FULL MASTER FRAME, which is the whole trick and the reason this is
better than the hand-drawn pairs it replaces. Same frame, same `world`, same anchor: place
them at one point and they reassemble into exactly the delivered tree, with no chance of
the halves drifting apart. The old pairs were world 26 and world 90 and lined up only
because a designer put them there carefully.

    !! DERIVED PARTS MUST NOT SET fillTo !!

fillTo crops to content and rescales it to a fixed fraction of the frame. Run that on two
parts of one picture and each is scaled by a different factor — the trunk, being small,
blows up to fill the frame — and the halves no longer register. The full tree keeps its
fillTo; the parts must not have one.

THE CUT IS RADIAL, not by colour. Keying the wood out by hue is the obvious idea and it
is wrong: from directly above a tree's limbs RADIATE, so the wood pixels run out to 0.7 of
the crown radius, and a colour cut hands you a sprite of branches to draw at water level.
What belongs under the boat is the compact mass at the stem, so the cut is a disc.

The two alphas are complementary by construction — trunk gets a*(1-t), canopy gets a*t for
the same falloff t — so compositing one over the other returns the original alpha exactly,
and the seam cannot show as a ring of doubled or missing coverage.
"""
import argparse
import json
import pathlib
import sys

import numpy as np
from PIL import Image

import paths

ROOT = pathlib.Path(__file__).resolve().parent
MANIFEST = ROOT / "manifest.json"
MASTERS = ROOT / "masters"
INBOX = ROOT / "inbox"

# Trunk radius as a fraction of the crown's radius, so the trunk's DIAMETER is cut*world.
# 0.20 puts the oak's stem at 22u against the 30u of the hand-drawn trunk it replaces —
# deliberately a little tighter. The cut is radial and takes whatever falls inside it, so
# past about 0.24 it starts scooping inner foliage and the trunk sprite reads as a small
# bush rather than a stem. It costs nothing visually: the canopy's hole and the trunk are
# always placed together and reassemble into the delivered tree at any cut.
CUT = 0.20
BAND = 0.35          # transition width as a fraction of the cut radius; softens the seam


def split_tree(img, cut=CUT, band=BAND):
    """Return (trunk, canopy), both on the full frame, alphas summing to the original."""
    arr = np.array(img.convert("RGBA")).astype(np.float32)
    a = arr[:, :, 3]
    H, W = a.shape
    ys, xs = np.nonzero(a > 128)
    if len(xs) == 0:
        raise SystemExit("master has no opaque pixels")
    cy, cx = (ys.min() + ys.max()) / 2.0, (xs.min() + xs.max()) / 2.0
    radius = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2.0

    yy, xx = np.mgrid[0:H, 0:W]
    r = np.hypot(yy - cy, xx - cx) / max(radius, 1e-6)

    r0 = cut * (1.0 - band / 2.0)
    r1 = cut * (1.0 + band / 2.0)
    t = np.clip((r - r0) / max(r1 - r0, 1e-6), 0.0, 1.0)   # 0 at the stem, 1 out in the crown

    trunk = arr.copy()
    canopy = arr.copy()
    trunk[:, :, 3] = a * (1.0 - t)
    canopy[:, :, 3] = a * t
    return (Image.fromarray(trunk.astype("uint8"), "RGBA"),
            Image.fromarray(canopy.astype("uint8"), "RGBA"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key", help="the WHOLE-TREE manifest key, e.g. bayou-oak")
    ap.add_argument("--cut", type=float, default=CUT,
                    help="trunk radius as a fraction of the crown radius")
    ap.add_argument("--band", type=float, default=BAND, help="seam softness")
    ap.add_argument("--preview", action="store_true", help="write nothing")
    args = ap.parse_args()

    assets = json.loads(MANIFEST.read_text())["assets"]
    asset = next((a for a in assets if a["key"] == args.key), None)
    if asset is None:
        sys.exit(f"no such key: {args.key}")
    prefixes = paths.venue_prefixes(assets)
    master = (MASTERS / paths.rel(asset, prefixes)).with_suffix(".png")
    if not master.exists():
        sys.exit(f"no master at {master} — ingest the whole tree first")

    img = Image.open(master).convert("RGBA")
    trunk, canopy = split_tree(img, args.cut, args.band)

    a0 = np.array(img.getchannel("A")).astype(np.int64).sum()
    a1 = (np.array(trunk.getchannel("A")).astype(np.int64).sum()
          + np.array(canopy.getchannel("A")).astype(np.int64).sum())
    print(f"{args.key}: cut at {args.cut:.2f} of crown radius, seam band {args.band:.2f}")
    print(f"    alpha conserved: {100.0 * a1 / max(1, a0):.2f}% (100% means the halves reassemble exactly)")
    for part, im in (("trunk", trunk), ("canopy", canopy)):
        frac = np.array(im.getchannel("A")).astype(float).sum() / max(1, a0)
        print(f"    {part:6} carries {100 * frac:5.1f}% of the tree's ink")
        if not args.preview:
            dest = INBOX / f"{args.key}-{part}.png"
            im.save(dest)
            print(f"       -> {dest.relative_to(ROOT.parent)}")
    if args.preview:
        print("    (preview: nothing written)")
    else:
        print(f"    next: python3 regatta/art/ingest.py {args.key}-trunk {args.key}-canopy")


if __name__ == "__main__":
    main()

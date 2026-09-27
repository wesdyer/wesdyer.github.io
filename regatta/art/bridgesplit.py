#!/usr/bin/env python3
"""Cut a bridge's BAKE into its towers and its deck, so a hull can sail under the deck.
    python3 regatta/art/bridgesplit.py bay-cove-bridge-suspension
    python3 regatta/art/bridgesplit.py --all [--preview]
Writes assets/images/props/<venue>/<key>-towers.png and <key>-deck.png, both on the bake's
full frame, alphas summing to the original — archsplit.py's trick for an arch, with the
parts the other way round. The TOWERS (each portal beam with its corner blocks and legs, the
pier under it) draw on the surface plane, stay solid, and are what prop_outlines.py traces
into the collider and what casts the lee (the kind's `height`). The DECK draws on the canopy
plane, over the fleet, and fades for the player's hull like a crown — the trees' rule, not
the arches' (an arch span is `opaque`; a deck is not).

WHERE THE CUT IS. The bridge runs up the frame (the manifest brief), so a tower is a band of
rows across the full width. archsplit's automatic neck finder has nothing to find here — a
deck is one long even strip with two or four towers on it — so the bands are READ OFF THE BAKE
by eye and recorded below, in bake px from the top. Re-read them after any re-ingest.

THE SEAM IS HARD, and the deck overlaps each tower by OVERLAP px, for archsplit's reason: an
exact partition leaves a hairline where the antialiased pixel is part-opaque in both halves.
"""
import argparse, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
PROPS = REPO / "assets" / "images" / "props"
OVERLAP = 2

# key -> (venue dir, [(y0, y1), ...] tower bands in bake px). Read off the Sep 26 2026 bakes.
BANDS = {
    # four portals: the flared end pair and the two inner piers
    "bay-cove-bridge-truss": ("bay", [(280, 342), (628, 684), (1036, 1092), (1360, 1440)]),
    # two towers: portal + corner blocks + the raked legs under the deck
    "bay-cove-bridge-suspension": ("bay", [(278, 460), (1402, 1532)]),
    # the Bay Bridge silver: X-braced portal + corner blocks + legs (1800px bake)
    "bay-cove-bridge-skyway": ("bay", [(356, 566), (1272, 1442)]),
}


def split(img, bands, overlap=OVERLAP):
    arr = np.array(img.convert("RGBA")).astype(np.float32)
    a = arr[:, :, 3]; H = a.shape[0]
    rows = np.arange(H)[:, None]
    t = np.zeros((H, 1), np.float32); td = np.zeros((H, 1), np.float32)
    for y0, y1 in bands:
        t[(rows >= y0) & (rows < y1)] = 1
        td[(rows >= y0 + overlap) & (rows < y1 - overlap)] = 1
    towers = arr.copy(); deck = arr.copy()
    towers[:, :, 3] = a * t
    deck[:, :, 3] = a * (1 - td)
    return (Image.fromarray(towers.astype("uint8"), "RGBA"), Image.fromarray(deck.astype("uint8"), "RGBA"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key", nargs="?"); ap.add_argument("--all", action="store_true")
    ap.add_argument("--preview", action="store_true", help="write nothing")
    args = ap.parse_args()
    keys = list(BANDS) if args.all else [args.key]
    for key in keys:
        if key not in BANDS: sys.exit(f"no bands recorded for {key}")
        venue, bands = BANDS[key]
        src = PROPS / venue / f"{key}.png"
        if not src.exists(): sys.exit(f"no bake at {src} — ingest the bridge first")
        img = Image.open(src)
        towers, deck = split(img, bands)
        a0 = np.array(img.getchannel("A")).astype(float).sum()
        print(f"{key}: {len(bands)} tower band(s) on a {img.width}px bake")
        for part, im in (("towers", towers), ("deck", deck)):
            frac = np.array(im.getchannel("A")).astype(float).sum() / max(1, a0)
            print(f"    {part:6} carries {100 * frac:5.1f}% of the ink")
            if not args.preview:
                dest = PROPS / venue / f"{key}-{part}.png"; im.save(dest); print(f"       -> {dest.relative_to(REPO.parent)}")
    if not args.preview: print("next: python3 regatta/art/prop_outlines.py")


if __name__ == "__main__":
    main()

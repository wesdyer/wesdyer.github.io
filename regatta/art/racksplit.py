#!/usr/bin/env python3
"""Cut an antlered animal's master into body, head and rack — the head can dip, the rack stays up.

    python3 regatta/art/racksplit.py lake-moose --neck 0.395

Writes art/parts/<venue>/<name>-{body,head,rack}.png and the same, resampled to the asset's bake size, into
its assets/images/props/<venue>/ folder — full-frame, in register.

WHY (Wes, Oct 13: a bull moose). A feeding moose puts its head under — and the RACK STAYS OUT, the palms lying
on the surface with the water ringing them. So the face must be able to go under the water while the antlers,
which move with it, stay crisp on top.

HOW. The antlers are the warm-tan pixels lighter than the fur (luma > 88, red >= green >= blue) above the shoulders,
the pieces of it that reach well out to the side, grown by GROW px to take their dark outline. The head is everything else above the --neck row (a fraction of the frame); the body is everything
else from COLLAR above that row down, so the body keeps a collar of neck under the head (the sea lion's lesson:
a head that moves must never open a gap at its base).
"""
import argparse
import json
import pathlib

import numpy as np
from PIL import Image
from scipy import ndimage

import paths

ROOT = pathlib.Path(__file__).resolve().parent
GROW, COLLAR = 5, 0.035


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("--neck", type=float, required=True)
    args = ap.parse_args()
    m = json.loads((ROOT / "manifest.json").read_text())
    asset = {a["key"]: a for a in m["assets"]}[args.key]
    pref = paths.venue_prefixes(m["assets"])
    img = np.array(Image.open(paths.store(ROOT / "masters", asset, pref)).convert("RGBA"))
    n = img.shape[0]
    a = img.astype(float)
    al = img[:, :, 3] > 8
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    # the antler: warm tan, lighter than the fur (the palms' pale tan AND the beams' darker tan), above the shoulders.
    # Of its connected pieces only those reaching well out to the side are the rack (an ear's pale inside is not), and
    # each is grown by GROW px to take its dark outline.
    ys, xs = np.where(img[:, :, 3] > 40)
    cx = (xs.min() + xs.max()) / 2
    rows, cols = np.arange(n)[:, None], np.arange(n)[None, :]
    tan = al & (lum > 88) & (r >= g) & (g >= b) & (r - b > 18) & (rows < int(args.neck * n) + int(0.04 * n))
    lab, k = ndimage.label(tan)
    keep = [i for i in range(1, k + 1) if (np.abs(np.where(lab == i)[1] - cx).max() > 0.15 * n)]
    big = np.isin(lab, keep)
    big = ndimage.binary_fill_holes(big)
    rack = al & ndimage.binary_dilation(big, iterations=GROW)
    neck = int(args.neck * n)
    head = al & ~rack & (rows < neck + int(0.01 * n))
    body = al & ~rack & ((rows >= neck) | ((rows >= neck - int(COLLAR * n)) & (np.abs(cols - cx) < 0.05 * n)))   # the collar: the neck only, not the ears
    # loose specks of the rack's outline the grow missed go with the rack, not floating on the head
    hl, hk = ndimage.label(head)
    if hk > 1:
        main = hl == 1 + int(np.argmax(ndimage.sum(head, hl, range(1, hk + 1))))
        rack |= head & ~main; head &= main
    parts = {}
    for nm, mk in (("body", body), ("head", head), ("rack", rack)):
        layer = np.zeros_like(img); layer[mk] = img[mk]; parts[nm] = layer
    stem = paths.rel(asset, pref).name
    pdir = paths.store(ROOT / "parts", asset, pref).parent
    pdir.mkdir(parents=True, exist_ok=True)
    adir = ROOT.parent / m["profiles"][asset["class"]]["out"] / asset["venue"]
    bake = asset["world"] * m["profiles"][asset["class"]]["bake"]
    for nm, arr in parts.items():
        im = Image.fromarray(arr)
        im.save(pdir / f"{stem}-{nm}.png")
        im.resize((bake, bake), Image.LANCZOS).save(adir / f"{stem}-{nm}.png")
        print(f"  -> {stem}-{nm}.png ({(arr[:, :, 3] > 8).sum()} px)")


if __name__ == "__main__":
    main()

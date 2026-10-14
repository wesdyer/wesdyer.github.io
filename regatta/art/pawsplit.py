#!/usr/bin/env python3
"""Cut an animal's two folded PAWS out of an accepted master, and fill the chest under them.

    python3 regatta/art/pawsplit.py otter-sea-otter 0.465,0.393,0.044,0.03 0.544,0.393,0.044,0.03

Each paw is an ellipse  cx,cy,rx,ry  in fractions of the master frame (left paw first). Writes
art/parts/<venue>/<name>-{body,paw-l,paw-r}.png and the same three, resampled to the asset's bake
size, into its assets/images/props/<venue>/ folder — all full-frame, so they reassemble in register.

WHY. The sea otter is painted with its forepaws folded on its chest, but it GROOMS (paws up at its
face, rubbing) and taps its food — the paws have to move (Wes, Oct 13). They are cut along a soft
ellipse round each fist, and the hole they leave is filled from the surrounding fur (OpenCV's TELEA
inpainting), because a raised paw uncovers chest that was never painted. The fill only shows while a
paw is away, under it the rest of the time.
"""
import json
import pathlib
import sys

import cv2
import numpy as np
from PIL import Image

import paths

ROOT = pathlib.Path(__file__).resolve().parent
FEATHER = 2   # px of soft edge on each paw at the 1024 master


def ellipse_mask(n, cx, cy, rx, ry):
    yy, xx = np.mgrid[0:n, 0:n]
    d = ((xx - cx * n) / (rx * n)) ** 2 + ((yy - cy * n) / (ry * n)) ** 2
    # 1 inside, falling to 0 across FEATHER px at the rim
    edge = (1 - np.sqrt(d)) * min(rx, ry) * n / FEATHER
    return np.clip(edge, 0, 1)


def main():
    key = sys.argv[1]
    paws = [tuple(float(v) for v in a.split(",")) for a in sys.argv[2:4]]
    m = json.loads((ROOT / "manifest.json").read_text())
    asset = {a["key"]: a for a in m["assets"]}[key]
    pref = paths.venue_prefixes(m["assets"])
    img = np.array(Image.open(paths.store(ROOT / "masters", asset, pref)).convert("RGBA"))
    n = img.shape[0]

    masks = [ellipse_mask(n, *p) for p in paws]
    hole = np.maximum(*masks) > 0.02
    # the chest under the paws, filled from the fur round them (inpaint the colour; keep the alpha whole)
    rgb = cv2.cvtColor(img[:, :, :3], cv2.COLOR_RGB2BGR)
    filled = cv2.inpaint(rgb, (hole * 255).astype(np.uint8), 9, cv2.INPAINT_TELEA)
    body = img.copy()
    body[:, :, :3] = np.where(hole[:, :, None], cv2.cvtColor(filled, cv2.COLOR_BGR2RGB), img[:, :, :3])

    parts = {"body": body}
    for side, mk in zip("lr", masks):
        p = img.copy()
        p[:, :, 3] = (img[:, :, 3] * mk).astype(np.uint8)
        parts["paw-" + side] = p

    stem = paths.rel(asset, pref).name
    pdir = paths.store(ROOT / "parts", asset, pref).parent
    pdir.mkdir(parents=True, exist_ok=True)
    adir = ROOT.parent / m["profiles"][asset["class"]]["out"] / asset["venue"]
    bake = asset["world"] * m["profiles"][asset["class"]]["bake"]
    for name, arr in parts.items():
        im = Image.fromarray(arr)
        im.save(pdir / f"{stem}-{name}.png")
        im.resize((bake, bake), Image.LANCZOS).save(adir / f"{stem}-{name}.png")
        print(f"  -> {stem}-{name}.png")
    print(json.dumps({"paws": [list(p) for p in paws]}))


if __name__ == "__main__":
    main()

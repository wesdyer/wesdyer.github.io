#!/usr/bin/env python3
"""Cut a four-limbed animal's master into its parts: the four flippers, the head and neck, the body.

    python3 regatta/art/limbsplit.py otter-sea-lion-cow --neck 0.2
    python3 regatta/art/limbsplit.py otter-sea-lion-bull --neck 0.17

Writes art/parts/<venue>/<name>-{body,head,fore-l,fore-r,hind-l,hind-r}.png and the same, resampled to
the asset's bake size, into its assets/images/props/<venue>/ folder — all full-frame, so drawn at the
same place and scale they reassemble exactly. Prints the numbers wildlife.js's SL_SPR table wants:
the ink's top and bottom, the spine's x, the neck cut, and each flipper's root (its pivot) — all as
fractions of the frame.

WHY (Wes, Oct 13: "cut the fins so that you can make them move correctly"). A sea lion WALKS on land
(the hind flippers turned forward under the pelvis, a lateral-sequence walk — left hind, left fore, right
hind, right fore — the hind flippers moving independently) and GALLOPS to the water (the hinds together,
the fores nearly together, the spine flexing; the head bobbing), swinging its head and neck as it goes
(Kerr et al. 2022, J Exp Biol 225 jeb244163; English 1976, J Zool 178; Beentjes 1990). Every flipper has
to swing on its own root, and the head on its neck.

HOW. The flippers are near-black and grey (low saturation), the fur warm brown even in shadow, so a
flipper is one of the four biggest components of  luma < 64 and saturation < 0.42 , opened to drop
specks; each takes its outline (a 3 px grow outside the fur). Classified by where it sits: the upper two
are the fore flippers (they sit near the middle of the frame), the lower two the hinds; left or right of
the spine. Like finsplit.py, each flipper is
extended under the body by STUB px along its root, so a swing never opens a gap — the body is drawn
over it. The head is everything above the neck cut (a fraction of the ink's length), keeping OVERLAP
rows below it; the body is everything below the cut, so the body covers the seam.
"""
import argparse
import json
import pathlib

import numpy as np
from PIL import Image
from scipy import ndimage

import paths

ROOT = pathlib.Path(__file__).resolve().parent
STUB, OVERLAP, GROW = 0.03, 0.025, 3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("--neck", type=float, required=True, help="the neck cut, as a fraction of the ink's length from the nose")
    args = ap.parse_args()
    m = json.loads((ROOT / "manifest.json").read_text())
    asset = {a["key"]: a for a in m["assets"]}[args.key]
    pref = paths.venue_prefixes(m["assets"])
    img = np.array(Image.open(paths.store(ROOT / "masters", asset, pref)).convert("RGBA"))
    n = img.shape[0]
    a = img.astype(float)
    alpha = a[:, :, 3] > 40
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    sat, luma = (mx - mn) / np.maximum(mx, 1), 0.299 * r + 0.587 * g + 0.114 * b

    ys, xs = np.where(alpha)
    top, bot = ys.min(), ys.max()
    cx = int(round((xs.min() + xs.max()) / 2))

    dark = ndimage.binary_opening(alpha & (luma < 64) & (sat < 0.42), iterations=2)
    lab, k = ndimage.label(dark)
    sizes = ndimage.sum(dark, lab, range(1, k + 1))
    comps = [1 + int(i) for i in np.argsort(sizes)[::-1][:4]]
    fins = {}
    cents = sorted(((ndimage.center_of_mass(dark, lab, c), c) for c in comps))   # by height: the upper two are the fores
    for i, ((cy, cxx), c) in enumerate(cents):
        name = ("fore" if i < 2 else "hind") + "-" + ("l" if cxx < cx else "r")
        fins[name] = lab == c
    assert len(fins) == 4, f"expected four flippers, found {sorted(fins)}"

    # Each contested pixel (the dark outlines where a flipper meets the body) goes to whichever is nearer:
    # the flipper's own dark core, or the warm fur. So a swinging flipper never carries a tab of the body's
    # outline off the shoulder, and the body keeps its whole edge.
    furcore = alpha & ~ndimage.binary_dilation(dark, iterations=1) & ((sat >= 0.42) | (luma >= 64))
    dfur = ndimage.distance_transform_edt(~furcore)
    out = {"key": args.key, "top": round(top / n, 4), "bot": round(bot / n, 4), "cx": round(cx / n, 4)}
    parts, masks, roots = {}, {}, {}
    allfin = np.zeros_like(alpha)
    for name, f in fins.items():
        mask = alpha & ndimage.binary_dilation(f, iterations=GROW + 3) & (ndimage.distance_transform_edt(~f) < dfur)
        ml, mk = ndimage.label(mask)   # only the flipper itself: stray flecks of outline left loose would swing with it
        if mk > 1: mask = ml == 1 + int(np.argmax(ndimage.sum(mask, ml, range(1, mk + 1))))
        masks[name] = mask; allfin |= mask
    fur = alpha & ~allfin
    # the body is one piece: any fleck of outline the nearest-wins rule left to it but cut off from the body
    # (the flippers' own rims) goes back to the flipper beside it, or it would float when the flipper swings
    fl, fk = ndimage.label(ndimage.binary_opening(fur, iterations=1))
    main = fl == 1 + int(np.argmax(ndimage.sum(fur, fl, range(1, fk + 1))))
    loose = fur & ~ndimage.binary_dilation(main, iterations=1)
    ll, lk = ndimage.label(loose)
    dist = {name: ndimage.distance_transform_edt(~mk2) for name, mk2 in masks.items()}
    for i in range(1, lk + 1):
        piece = ll == i
        near = min(masks, key=lambda nm: dist[nm][piece].min())
        masks[near] |= piece
    fur &= ~loose
    for name, mask in masks.items():
        touch = mask & ndimage.binary_dilation(fur, iterations=2)
        ty, tx = np.where(touch)
        roots[name] = (tx.mean(), ty.mean(), tx, ty)
    # the art is drawn symmetric, so the roots are too: mirror-average each pair about the spine
    for pair in (("fore-l", "fore-r"), ("hind-l", "hind-r")):
        (lx, ly, *_), (rx_, ry_, *_) = roots[pair[0]], roots[pair[1]]
        d, yy = (abs(lx - cx) + abs(rx_ - cx)) / 2, (ly + ry_) / 2
        roots[pair[0]] = (cx - d, yy) + roots[pair[0]][2:]
        roots[pair[1]] = (cx + d, yy) + roots[pair[1]][2:]
    stub = int(STUB * n)
    for name, mask in masks.items():
        layer = np.zeros_like(img)
        layer[mask] = img[mask]
        rx, ry, tx, ty = roots[name]
        fy, fx = np.where(mask)
        far = np.argmax((fx - rx) ** 2 + (fy - ry) ** 2)
        dx, dy = rx - fx[far], ry - fy[far]                    # from the tip toward the root, into the body
        dl = max(1e-6, np.hypot(dx, dy)); dx, dy = dx / dl, dy / dl
        # the hidden stub: each root pixel carried STUB px on into the body — and only where the body is,
        # so the body always covers it and it can never poke out past the outline as a needle
        for y, x in zip(ty, tx):
            for k2 in range(1, stub):
                X, Y = int(round(x + dx * k2)), int(round(y + dy * k2))
                if 0 <= X < n and 0 <= Y < n and fur[Y, X] and layer[Y, X, 3] == 0:
                    layer[Y, X, :3] = img[y, x, :3]; layer[Y, X, 3] = 255
        parts[name] = layer
        out[name] = {"root": [round(rx / n, 4), round(ry / n, 4)], "tip": [round(fx[far] / n, 4), round(fy[far] / n, 4)]}

    body = img.copy()
    body[~fur] = 0
    cut = int(top + args.neck * (bot - top))
    head = body.copy()
    head[cut + int(OVERLAP * n):] = 0
    # (NOT feathered: a soft base let the sea show through as a pale ring wherever the head turned — Wes:
    # 'the head sometimes separates from the body'. It is drawn solid, over a collar of neck the body keeps.)
    # the body keeps a collar of neck above the cut, under the head: turned to watch a boat, the head swings its
    # base aside and the neck must still be there under it
    body[:cut - int(0.045 * n)] = 0
    parts["head"], parts["body"] = head, body
    out["neck"] = round(cut / n, 4)

    stem = paths.rel(asset, pref).name
    pdir = paths.store(ROOT / "parts", asset, pref).parent
    pdir.mkdir(parents=True, exist_ok=True)
    adir = ROOT.parent / m["profiles"][asset["class"]]["out"] / asset["venue"]
    bake = asset["world"] * m["profiles"][asset["class"]]["bake"]
    for name, arr in parts.items():
        im = Image.fromarray(arr)
        im.save(pdir / f"{stem}-{name}.png")
        im.resize((bake, bake), Image.LANCZOS).save(adir / f"{stem}-{name}.png")
    print(json.dumps(out))


if __name__ == "__main__":
    main()

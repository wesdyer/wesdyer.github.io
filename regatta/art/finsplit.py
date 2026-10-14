#!/usr/bin/env python3
"""Cut a whale master into its two FLIPPERS and the rest of the animal.

    python3 regatta/art/finsplit.py ocean-humpback
    python3 regatta/art/finsplit.py ocean-humpback-calf

Writes art/parts/<venue>/<name>-{body,flipper-l,flipper-r}.png and the same three,
resampled to the asset's bake size, into its assets/images/props/<venue>/ folder.
Every part keeps the FULL master frame, so drawn at the same place and scale they
reassemble exactly. Prints the numbers wildlife.js's HUMP_SPR table wants.

WHY. A humpback's flippers move on their own — they scull as it swims and one swings
out and up in a pec slap — and split.py's horizontal hinge cannot separate them: they
sit in the same rows as the body. They separate by COLOUR instead. The flippers are
white (luma > 180) and the body is dark slate (< 140 even on the calf's highlights),
so a flipper is a bright component off the side of the body, plus the thin grey
outline round it. The body's own span is found row by row by walking out from the
spine until the first flipper pixel or the first clear pixel, and nothing inside it
ever goes to a flipper, so the body's edge stays whole where the flipper meets it.

THE STUB. In the art the flipper's root is hidden under the body. Rotate the flipper
about its root and a sliver of that hidden root would open up as a gap. So the
flipper layer is extended under the body: each root row's edge colour is carried
inward STUB px. The body is drawn over it, so the stub only ever shows when a
rotation brings it out, and then it reads as more flipper.

The flukes are NOT cut here: wildlife.js hinges them at draw time with a clip at the
tail stock (the same split split.py makes, done with a clip instead of two files),
which also lets the rear body flex as one piece with them.
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

import paths

ROOT = pathlib.Path(__file__).resolve().parent
LIGHT, STUB, GROW = 165, 0.035, 0.008   # luma of a flipper; stub depth and outline grow as fractions of the frame


def dilate(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r:
                continue
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def main():
    key = sys.argv[1]
    m = json.loads((ROOT / "manifest.json").read_text())
    by = {a["key"]: a for a in m["assets"]}
    asset = by[key]
    pref = paths.venue_prefixes(m["assets"])
    img = Image.open(paths.store(ROOT / "masters", asset, pref)).convert("RGBA")
    a = np.array(img)
    n = a.shape[0]
    alpha = a[:, :, 3] > 8
    luma = a[:, :, :3].astype(float) @ [0.299, 0.587, 0.114]
    bright = alpha & (luma > LIGHT)

    ys = np.where(alpha.any(axis=1))[0]
    cx = int(round(np.where(alpha[(ys.min() + ys.max()) // 2])[0].mean()))
    # a flipper is the BIGGEST bright patch on its side; a gloss highlight on the back is not one
    lab, k = ndimage.label(bright)
    core = np.zeros_like(bright)
    for sel in (np.arange(n) < cx, np.arange(n) >= cx):
        sizes = ndimage.sum(bright & sel[None, :], lab, range(1, k + 1))
        core |= (lab == 1 + int(np.argmax(sizes))) & sel[None, :]

    top, bot = ys.min(), ys.max()

    # the body's span, row by row: out from the spine to the first flipper or clear pixel
    body = np.zeros_like(alpha)
    for y in range(top, bot + 1):
        if not alpha[y, cx]:
            continue
        x0 = cx
        while x0 > 0 and alpha[y, x0 - 1] and not core[y, x0 - 1]:
            x0 -= 1
        x1 = cx
        while x1 < n - 1 and alpha[y, x1 + 1] and not core[y, x1 + 1]:
            x1 += 1
        body[y, x0:x1 + 1] = True

    fin = dilate(core, max(1, int(GROW * n))) & alpha & ~body
    rest = alpha & ~fin
    stub = int(STUB * n)
    out = {"key": key, "frame": n, "top": round(top / n, 4), "bot": round(bot / n, 4)}

    parts = {}
    for side, sel in (("l", np.arange(n) < cx), ("r", np.arange(n) >= cx)):
        mask = fin & sel[None, :]
        layer = np.zeros_like(a)
        layer[mask] = a[mask]
        roots = []
        for y in np.where(mask.any(axis=1))[0]:
            xs = np.where(mask[y])[0]
            # the flipper pixel touching the body on this row
            edge = xs.max() if side == "l" else xs.min()
            nxt = edge + (1 if side == "l" else -1)
            if not body[y, nxt]:
                continue
            roots.append((edge, y))
            rng = range(nxt, min(n, nxt + stub)) if side == "l" else range(max(0, nxt - stub + 1), nxt + 1)
            for x in rng:
                layer[y, x, :3] = a[y, edge, :3]
                layer[y, x, 3] = 255
        parts["flipper-" + side] = layer
        rx, ry = np.mean(roots, axis=0)
        fy, fx = np.where(mask)
        far = np.argmax((fx - rx) ** 2 + (fy - ry) ** 2)                    # the tip: the flipper pixel farthest from the root
        ang = float(np.degrees(np.arctan2(abs(fx[far] - rx), fy[far] - ry)))   # off the tail-ward axis
        out["flipper_" + side] = {"root": [round(rx / n, 4), round(ry / n, 4)], "tip": [round(fx[far] / n, 4), round(fy[far] / n, 4)],
                                  "angleFromTailDeg": round(ang, 1), "lenOfBody": round(float(np.hypot(fx[far] - rx, fy[far] - ry)) / (bot - top), 3)}

    b = a.copy()
    b[~rest] = 0
    parts["body"] = b

    # the tail stock, for the fluke hinge: the narrowest row of the body in its rear quarter
    lo, hi = top + int(0.70 * (bot - top)), top + int(0.94 * (bot - top))
    hinge = min((rest[y].sum(), y) for y in range(lo, hi))[1]
    out["hinge"] = round(hinge / n, 4)
    w = rest.sum(axis=1)
    out["maxHalfWidthOfBody"] = round(float(w[top:hinge].max()) / 2 / (bot - top), 4)

    stem = paths.rel(asset, pref).name
    pdir = paths.store(ROOT / "parts", asset, pref).parent
    pdir.mkdir(parents=True, exist_ok=True)
    adir = ROOT.parent / m["profiles"][asset["class"]]["out"] / asset["venue"]
    bake = asset["world"] * m["profiles"][asset["class"]]["bake"]
    for name, arr in parts.items():
        im = Image.fromarray(arr)
        im.save(pdir / f"{stem}-{name}.png")
        im.resize((bake, bake), Image.LANCZOS).save(adir / f"{stem}-{name}.png")
        print(f"  -> {stem}-{name}.png  ({(arr[:, :, 3] > 8).sum()} px)", file=sys.stderr)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()

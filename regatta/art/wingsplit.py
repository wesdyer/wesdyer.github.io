#!/usr/bin/env python3
"""Cut a flying fish's master into its body and its four fins (the pectoral 'wings', the pelvics).

    python3 regatta/art/wingsplit.py ocean-flying-fish

Writes art/parts/<venue>/<name>-{body,wing-l,wing-r,pelvic-l,pelvic-r}.png and the same, resampled to the
asset's bake size, into its assets/images/props/<venue>/ folder — full-frame, in register. Prints the
numbers wildlife.js's FLYFISH_SPR table wants (fractions of the frame).

WHY (Wes, Oct 13: "make sure to animate ... the flying fish flying"). A flying fish taxis with its fins spread,
glides with them held stiff, and FOLDS them back along its body as it drops into the sea — the fins have to
move on their own roots.

HOW. The body is a narrow run of intensely saturated blue down the spine (saturation > 0.6), edged on each
side by a white flank stripe and a dark outline; past that is the pale fin. So, row by row, the body is that
saturated run plus RIM px either side; everything else is fin, and the four biggest fin pieces are the two
wings (the upper pair) and the two pelvics. Each fin's pivot is the FRONT of its root — where its leading
edge meets the body — because a folding wing swings back about its leading root.
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

import paths

ROOT = pathlib.Path(__file__).resolve().parent
RIM = 0.013   # the white flank stripe and the outline, either side of the blue core (frame)


def main():
    key = sys.argv[1]
    m = json.loads((ROOT / "manifest.json").read_text())
    asset = {a["key"]: a for a in m["assets"]}[key]
    pref = paths.venue_prefixes(m["assets"])
    img = np.array(Image.open(paths.store(ROOT / "masters", asset, pref)).convert("RGBA"))
    n = img.shape[0]
    a = img.astype(float)
    alpha = img[:, :, 3] > 8
    mx, mn = a[:, :, :3].max(2), a[:, :, :3].min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    ys, xs = np.where(img[:, :, 3] > 40)
    top, bot = ys.min(), ys.max()
    cx = int(round((xs.min() + xs.max()) / 2))
    rim = int(RIM * n)

    body = np.zeros_like(alpha)
    for y in range(top, bot + 1):
        core = np.where(alpha[y] & (sat[y] > 0.6) & (np.abs(np.arange(n) - cx) < 0.06 * n))[0]
        if len(core):
            body[y, max(0, core.min() - rim):core.max() + rim + 1] = alpha[y, max(0, core.min() - rim):core.max() + rim + 1]
        else:   # the tail and the snout tip: all of it is body
            body[y] = alpha[y] & (np.abs(np.arange(n) - cx) < 0.03 * n)
    fin = alpha & ~body
    lab, k = ndimage.label(fin)
    sizes = ndimage.sum(fin, lab, range(1, k + 1))
    comps = [1 + int(i) for i in np.argsort(sizes)[::-1][:4]]
    cents = sorted((ndimage.center_of_mass(fin, lab, c), c) for c in comps)
    out = {"key": key, "top": round(top / n, 4), "bot": round(bot / n, 4), "cx": round(cx / n, 4)}
    parts = {}
    for i, ((cy, cxx), c) in enumerate(cents):
        name = ("wing" if i < 2 else "pelvic") + "-" + ("l" if cxx < cx else "r")
        mk = lab == c
        layer = np.zeros_like(img); layer[mk] = img[mk]
        # the pivot: the front of the root, where the fin's leading edge meets the body
        touch = mk & ndimage.binary_dilation(body, iterations=2)
        ty, tx = np.where(touch)
        j = np.argmin(ty)
        parts[name] = layer
        out[name] = [round(tx[j] / n, 4), round(ty[j] / n, 4)]
    # the pieces left over (specks the four did not take) stay with the body
    rest = fin & ~np.isin(lab, comps)
    b = np.zeros_like(img); keep = body | rest; b[keep] = img[keep]
    parts["body"] = b
    # mirror-average each pair's pivot about the spine (the art is drawn symmetric)
    for pair in (("wing-l", "wing-r"), ("pelvic-l", "pelvic-r")):
        (lx, ly), (rx, ry) = out[pair[0]], out[pair[1]]
        d, yy = (abs(lx - cx / n) + abs(rx - cx / n)) / 2, (ly + ry) / 2
        out[pair[0]], out[pair[1]] = [round(cx / n - d, 4), round(yy, 4)], [round(cx / n + d, 4), round(yy, 4)]

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

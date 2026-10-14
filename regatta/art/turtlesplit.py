#!/usr/bin/env python3
"""Cut a sea turtle's master into its shell-and-head body and its four flippers, so the flippers can stroke.

    python3 regatta/art/turtlesplit.py lagoon-sea-turtle

Writes art/parts/<venue>/<name>-{body,front-l,front-r,rear-l,rear-r}.png and the same, resampled to the asset's bake
size, into its assets/images/props/<venue>/ folder — full-frame, in register — and prints each flipper's root (its
pivot) as fractions of the frame.

HOW. The shell is the convex hull of the big WARM piece (red minus blue > 75: the amber plates; the skin is olive and
its seams cream, both far less warm), grown by RIM px to take the ring of marginal plates — olive like the skin, which
is why it has to be a hull and not a colour. Everything else is skin: the front flippers
are the skin well out to each side above FRONT_BOT (a fraction of the frame), the rear flippers the skin below it off
the spine; the head stays with the body. As in finsplit.py each flipper carries a hidden STUB under the shell (its root
pixels carried inward), so a stroke never opens a gap at the shoulder.
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

import paths

ROOT = pathlib.Path(__file__).resolve().parent
FRONT_BOT, STUB, RIM = 0.66, 0.05, 30


def main():
    key = sys.argv[1]
    m = json.loads((ROOT / "manifest.json").read_text())
    asset = {a["key"]: a for a in m["assets"]}[key]
    pref = paths.venue_prefixes(m["assets"])
    img = np.array(Image.open(paths.store(ROOT / "masters", asset, pref)).convert("RGBA"))
    n = img.shape[0]
    a = img.astype(float)
    al = img[:, :, 3] > 8
    warm = al & (a[:, :, 0] - a[:, :, 2] > 75)
    lab, k = ndimage.label(warm)
    shell = lab == 1 + int(np.argmax(ndimage.sum(warm, lab, range(1, k + 1))))
    # the shell is CONVEX: its outer ring of marginal plates is olive like the skin, so take the hull of the warm plates
    # and grow it by the rim's width
    from scipy.spatial import ConvexHull
    from PIL import ImageDraw
    py, px = np.where(shell)
    hull = ConvexHull(np.c_[px, py])
    hm = Image.new("L", (n, n), 0)
    ImageDraw.Draw(hm).polygon([(float(px[i]), float(py[i])) for i in hull.vertices], fill=255)
    shell = ndimage.binary_dilation(np.array(hm) > 0, iterations=RIM) & al
    ys, xs = np.where(img[:, :, 3] > 40)
    cx = (xs.min() + xs.max()) / 2
    sx = np.where(shell.any(axis=0))[0]
    shalf = (sx.max() - sx.min()) / 2
    X, Y = np.arange(n)[None, :], np.arange(n)[:, None]
    # a sliver of the shell's own amber just outside the hull stays with the shell (the flippers' cream seams, farther out, do not)
    near = ndimage.binary_dilation(shell, iterations=12)
    skin = al & ~shell & ~(ndimage.binary_dilation(warm & (a[:, :, 0] - a[:, :, 2] > 95), iterations=3) & near)
    masks = {
        "front-l": skin & (X < cx - shalf * 0.55) & (Y < FRONT_BOT * n),
        "front-r": skin & (X > cx + shalf * 0.55) & (Y < FRONT_BOT * n),
        "rear-l": skin & (X < cx - 0.02 * n) & (Y >= FRONT_BOT * n),
        "rear-r": skin & (X > cx + 0.02 * n) & (Y >= FRONT_BOT * n),
    }
    out, parts, stub = {"key": key}, {}, int(STUB * n)
    taken = np.zeros_like(al)
    for name, mk in masks.items():
        layer = np.zeros_like(img); layer[mk] = img[mk]; taken |= mk
        sd = -1 if name.endswith("l") else 1
        touch = mk & ndimage.binary_dilation(shell, iterations=2)
        ty, tx = np.where(touch)
        rx, ry = tx.mean(), ty.mean()
        # the stub: carried in under the shell toward its centre
        dx, dy = cx - rx, (n * 0.5) - ry
        dl = np.hypot(dx, dy) or 1; dx, dy = dx / dl, dy / dl
        for y, x in zip(ty, tx):
            for s in range(1, stub):
                X2, Y2 = int(round(x + dx * s)), int(round(y + dy * s))
                if 0 <= X2 < n and 0 <= Y2 < n and shell[Y2, X2] and layer[Y2, X2, 3] == 0:
                    layer[Y2, X2] = img[y, x]
        parts[name] = layer
        out[name] = [round(rx / n, 4), round(ry / n, 4)]
    body = al & ~taken
    b = np.zeros_like(img); b[body] = img[body]; parts["body"] = b
    out.update({"top": round(ys.min() / n, 4), "bot": round(ys.max() / n, 4), "x0": round(xs.min() / n, 4), "x1": round(xs.max() / n, 4), "cx": round(cx / n, 4)})
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

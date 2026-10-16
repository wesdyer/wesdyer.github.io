#!/usr/bin/env python3
"""Cut a bird seen from above into its body and its two wings, with a straight column cut at the shoulders.

    python3 regatta/art/colsplit.py bay-pelican-flying --half 0.06

Writes art/parts/<venue>/<name>-{body,wing-l,wing-r}.png and the same, resampled to the asset's bake size,
into its assets/images/props/<venue>/ folder — full-frame, in register — and prints the numbers the engine's
table wants (fractions of the frame): the ink's bounds, the spine's x, and each wing's shoulder pivot.

WHY. A bird's body seen from above is a narrow column (head, back, tail) and its wings stand out to the sides,
so everything further than --half (a fraction of the frame) from the spine is wing. The albatross was cut this way
by hand first; this is that cut as a tool. Each wing carries a hidden STUB under the body (its root column carried
inward), so a wing that swings back or shortens through a beat never opens a gap at the shoulder.

--tail ROW (a fraction of the frame): below that row, pixels LIGHTER than the wing (luma > 150) stay with the body even
outside the column — a bald eagle's white tail fan is wider than its body, and must not go with the wings.
"""
import argparse
import json
import pathlib

import numpy as np
from PIL import Image

import paths

ROOT = pathlib.Path(__file__).resolve().parent
STUB = 0.03


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("--half", type=float, required=True, help="the body column's half-width, as a fraction of the frame")
    ap.add_argument("--tail", type=float, default=None, help="below this row (fraction), light pixels stay with the body")
    args = ap.parse_args()
    m = json.loads((ROOT / "manifest.json").read_text())
    asset = {a["key"]: a for a in m["assets"]}[args.key]
    pref = paths.venue_prefixes(m["assets"])
    img = np.array(Image.open(paths.store(ROOT / "masters", asset, pref)).convert("RGBA"))
    n = img.shape[0]
    al = img[:, :, 3] > 8
    ys, xs = np.where(img[:, :, 3] > 40)
    cx = (xs.min() + xs.max()) / 2
    X = np.arange(n)[None, :]
    half = args.half * n
    body = al & (np.abs(X - cx) <= half)
    if args.tail is not None:
        a = img.astype(float); lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
        Y = np.arange(n)[:, None]
        body |= al & (Y >= args.tail * n) & (lum > 150)
    out = {"key": args.key, "x0": round(xs.min() / n, 4), "x1": round(xs.max() / n, 4), "top": round(ys.min() / n, 4), "bot": round(ys.max() / n, 4), "cx": round(cx / n, 4)}
    parts, stub = {}, int(STUB * n)
    for nm, sd in (("wing-l", -1), ("wing-r", 1)):
        mk = al & ~body & ((X - cx) * sd > 0)
        layer = np.zeros_like(img); layer[mk] = img[mk]
        ex = int(round(cx + sd * (half + 1)))
        rows = np.where(mk[:, ex])[0]
        for y in rows:
            for k in range(1, stub):
                x = ex - sd * k
                if body[y, x]: layer[y, x] = img[y, ex]
        parts[nm] = layer
        out[nm] = [round((cx + sd * half) / n, 4), round(float(rows.mean()) / n, 4)]
    b = np.zeros_like(img); b[body] = img[body]; parts["body"] = b
    stem = paths.rel(asset, pref).name
    pdir = paths.store(ROOT / "parts", asset, pref).parent
    pdir.mkdir(parents=True, exist_ok=True)
    adir = ROOT.parent / m["profiles"][asset["class"]]["out"] / asset["venue"]
    bake = asset["world"] * m["profiles"][asset["class"]]["bake"]
    for nm, arr in parts.items():
        im = Image.fromarray(arr)
        im.save(pdir / f"{stem}-{nm}.png")
        im.resize((bake, bake), Image.LANCZOS).save(adir / f"{stem}-{nm}.png")
    print(json.dumps(out))


if __name__ == "__main__":
    main()

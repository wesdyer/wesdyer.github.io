#!/usr/bin/env python3
"""Cut a SWIMMING sea lion's master into its body and its four flippers, by shape.

    python3 regatta/art/swimsplit.py otter-sea-lion-swim --hinge 0.85

Writes art/parts/<venue>/<name>-{body,fore-l,fore-r,hind-l,hind-r}.png and the same, resampled to the
asset's bake size, into its assets/images/props/<venue>/ folder — full-frame, in register. Prints the
numbers wildlife.js's SL_SWIM table wants (fractions of the frame).

WHY BY SHAPE. Ashore the flippers are near-black against warm fur and limbsplit.py cuts them by colour.
Wet and swimming they are a dark brown against a dark brown body — the two overlap in both brightness
and saturation — but the SHAPE separates them: the fore flippers hang beside the body with a clear gap
below the shoulder, and past the tail stock (--hinge, a fraction of the ink's length) there is nothing
but the two hind flippers. So, row by row, the body is the run of pixels out from the spine to the first
gap; where a fore flipper joins the shoulder (no gap) the body's edge is interpolated across the join;
everything else above the hinge is fore flipper, everything below it hind, split at the spine. As in
finsplit.py each flipper carries a hidden STUB under the body so a swing never opens its root.
"""
import argparse
import json
import pathlib

import numpy as np
from PIL import Image

import paths

ROOT = pathlib.Path(__file__).resolve().parent
STUB, JOIN = 0.03, 0.11   # stub depth (frame); how far above the first gap row the shoulder join reaches (ink)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("--hinge", type=float, required=True, help="the tail stock, as a fraction of the ink's length from the nose")
    args = ap.parse_args()
    m = json.loads((ROOT / "manifest.json").read_text())
    asset = {a["key"]: a for a in m["assets"]}[args.key]
    pref = paths.venue_prefixes(m["assets"])
    img = np.array(Image.open(paths.store(ROOT / "masters", asset, pref)).convert("RGBA"))
    n = img.shape[0]
    alpha = img[:, :, 3] > 8
    ys, xs = np.where(img[:, :, 3] > 40)
    top, bot = ys.min(), ys.max()
    cx = int(round((xs.min() + xs.max()) / 2))
    hinge = int(top + args.hinge * (bot - top))

    # the body's half-width, row by row: out from the spine to the first gap
    walk = np.zeros(n); gap = np.zeros(n, bool)
    for y in range(top, hinge):
        x0 = x1 = cx
        while x0 > 0 and alpha[y, x0 - 1]: x0 -= 1
        while x1 < n - 1 and alpha[y, x1 + 1]: x1 += 1
        walk[y] = (x1 - x0) / 2
        gap[y] = alpha[y, :x0].any() or alpha[y, x1 + 1:].any()
    # the first row below the head with a flipper standing clear (the ear flaps stand clear of the head too,
    # so the search starts a third of the way down)
    s0 = int(top + 0.3 * (bot - top))
    g0 = int(np.argmax(gap[s0:hinge])) + s0
    j0 = max(top, g0 - int(JOIN * (bot - top)))        # the shoulder join: interpolate the body's edge across it
    hb = walk.copy()
    for y in range(j0, g0):
        hb[y] = walk[j0] + (walk[g0] - walk[j0]) * (y - j0) / max(1, g0 - j0)

    X = np.arange(n)[None, :]
    body = np.zeros((n, n), bool)
    for y in range(top, hinge):
        body[y] = alpha[y] & (np.abs(np.arange(n) - cx) <= hb[y] + 0.5)
    fore = alpha & ~body
    fore[hinge:] = False
    fore[:j0] = False                                  # above the shoulder join it is all head and neck (and the ears)
    body[:j0] = alpha[:j0]
    hind = alpha.copy(); hind[:hinge] = False
    masks = {"fore-l": fore & (X < cx), "fore-r": fore & (X >= cx), "hind-l": hind & (X < cx), "hind-r": hind & (X >= cx)}
    # each fore flipper is one piece: loose fringe (the body edge's antialiasing past the walk) goes to the body
    from scipy import ndimage
    for nm in ("fore-l", "fore-r"):
        lab, k = ndimage.label(masks[nm])
        if k > 1:
            keep = lab == 1 + int(np.argmax(ndimage.sum(masks[nm], lab, range(1, k + 1))))
            body |= masks[nm] & ~keep; masks[nm] = keep

    out = {"key": args.key, "top": round(top / n, 4), "bot": round(bot / n, 4), "cx": round(cx / n, 4), "hinge": round(hinge / n, 4)}
    stub = int(STUB * n)
    parts = {}
    for name, mk in masks.items():
        layer = np.zeros_like(img); layer[mk] = img[mk]
        sd = -1 if name.endswith("l") else 1
        if name.startswith("fore"):
            # the root: the shoulder join's rows, at the body's edge — and a ROUND joint there, a disc of the
            # flipper's own colour under the body, so a flipper swung out meets the shoulder with a rounded
            # dark base rather than opening a wedge (a row-by-row stub showed as blocks once it swung)
            rows = [y for y in range(j0, g0) if mk[y].any()]
            ry = float(np.mean(rows)) if rows else float(g0)
            rx = cx + sd * float(np.mean([hb[y] for y in rows])) if rows else cx + sd * hb[g0]
            rad = 0.5 * (g0 - j0) * 0.9
            yy, xx = np.mgrid[0:n, 0:n]
            near = mk & ((xx - rx) ** 2 + (yy - ry) ** 2 < (rad * 2.2) ** 2)
            col = np.median(img[near][:, :3], axis=0) if near.any() else np.median(img[mk][:, :3], axis=0)
            dcx = rx - sd * rad * 0.55                       # set in under the body: hidden at rest, the swung flipper's rounded base
            disc = ((xx - dcx) ** 2 + (yy - ry) ** 2 < (rad * 0.85) ** 2) & (layer[:, :, 3] == 0)
            layer[disc, :3] = col.astype(np.uint8); layer[disc, 3] = 255
        else:
            # the root: the tail stock; the stub carried up under the body
            for x in np.where(mk[hinge])[0]:
                for k in range(1, stub):
                    y = hinge - k
                    if body[y, x] and layer[y, x, 3] == 0: layer[y, x] = img[hinge, x]; layer[y, x, 3] = 255
            cols = np.where(mk[hinge])[0]
            rx, ry = (float(cols.mean()) if len(cols) else cx + sd * 2), float(hinge)
        parts[name] = layer
        out[name] = [round(rx / n, 4), round(ry / n, 4)]
    b = np.zeros_like(img); b[body] = img[body]
    parts["body"] = b

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

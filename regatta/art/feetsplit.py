#!/usr/bin/env python3
"""Cut a swimming animal's four feet out of its master, so they can paddle.

    python3 regatta/art/feetsplit.py river-otter --fore 0.29,0.41,0.088 --hind 0.665,0.79,0.056

Writes art/parts/<venue>/<name>-{body,fore-l,fore-r,hind-l,hind-r}.png and the same, resampled to the asset's bake
size, into its assets/images/props/<venue>/ folder — full-frame, in register — and prints each foot's root (its pivot)
as fractions of the frame.

WHY (Wes, Oct 15, of the river otters: "How are they swimming? With their tails? With their feet? I don't see anything
moving"). A river otter at the surface paddles — the webbed hind feet stroking back alternately, the fore feet
smaller — and the feet are painted into the body, so they have to come out to move.

HOW. By place, not colour (the feet are the body's own brown): each foot is the ink in a band of rows (y0..y1, fractions
of the frame) further than `half` (a fraction of the frame) from the spine, split left and right. Its root is the
middle of its inner edge at the band's top. In the HIND band, where each foot stands clear of the tail with water
between, a row's central run (the one through the spine) is the tail and everything else in the row is foot, so a toe
that reaches in past `half` still goes with its foot (and where foot and haunch join with no gap, `half` decides).

--dark LUMA (the bear; FORE band only — a grizzly's dark saddle is as dark as its paws, so the hinds would take a
stripe of rump): a foot that sits ON the body's outline (a grizzly's forepaws lie at the corners of its shoulders)
is cut by colour instead — the biggest connected patch DARKER than LUMA in its band that reaches out past `half`, with
the pale claws that touch it — so the shoulder fur around it stays with the body. As in finsplit.py each foot carries a hidden STUB carried inward under the
body, so a stroke never opens a gap at its root.
"""
import argparse
import json
import pathlib

import numpy as np
from PIL import Image
from scipy import ndimage

import paths

ROOT = pathlib.Path(__file__).resolve().parent
STUB = 0.025


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("--fore", required=True, help="y0,y1,half")
    ap.add_argument("--hind", required=True, help="y0,y1,half")
    ap.add_argument("--dark", type=float, default=None, help="cut each foot as the dark patch (luma below this) instead")
    ap.add_argument("--hoof", default=None, help="LO,HI: BOTH bands — each foot is the patch with luma in LO..HI reaching past `half`, with its own outline")
    args = ap.parse_args()
    m = json.loads((ROOT / "manifest.json").read_text())
    asset = {a["key"]: a for a in m["assets"]}[args.key]
    pref = paths.venue_prefixes(m["assets"])
    img = np.array(Image.open(paths.store(ROOT / "masters", asset, pref)).convert("RGBA"))
    n = img.shape[0]
    al = img[:, :, 3] > 8
    ys, xs = np.where(img[:, :, 3] > 40)
    cx = (xs.min() + xs.max()) / 2
    X, Y = np.arange(n)[None, :], np.arange(n)[:, None]
    out, parts, taken, stub = {"key": args.key, "cx": round(cx / n, 4), "top": round(ys.min() / n, 4), "bot": round(ys.max() / n, 4)}, {}, np.zeros_like(al), int(STUB * n)
    for which, spec in (("fore", args.fore), ("hind", args.hind)):
        y0, y1, half = (float(v) for v in spec.split(","))
        for sd, nm in ((-1, "l"), (1, "r")):
            mk = al & (Y >= y0 * n) & (Y <= y1 * n) & ((X - cx) * sd > half * n)
            if which == "hind":
                c0 = int(round(cx))
                for y in range(int(y0 * n), int(y1 * n) + 1):
                    if not al[y, c0]: continue
                    l = c0
                    while l > 0 and al[y, l - 1]: l -= 1
                    r = c0
                    while r < n - 1 and al[y, r + 1]: r += 1
                    row = al[y].copy(); row[l:r + 1] = False
                    mk[y] |= row & (((np.arange(n) - cx) * sd) > 0)   # (as well as past `half`: a row with no gap keeps the rule)
            if args.dark is not None and which == "fore":
                a = img.astype(float); lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
                band = al & (Y >= y0 * n) & (Y <= y1 * n) & ((X - cx) * sd > 0)
                dark = band & (lum < args.dark)
                lab, k = ndimage.label(dark)
                out_ = [i for i in range(1, k + 1) if (((np.where(lab == i)[1] - cx) * sd) > half * n).any()]
                if out_:
                    big = max(out_, key=lambda i: (lab == i).sum())
                    paw = ndimage.binary_fill_holes(lab == big)
                    claws = band & (lum > 120) & ndimage.binary_dilation(paw, iterations=4)
                    mk = ndimage.binary_dilation(paw | claws, iterations=1) & band
            if args.hoof is not None:
                # (the bighorn, Oct 17: a hoof sits ON the outline of a flank as wide as it, so neither place nor plain
                # darkness separates it — the black ink line is darker still. A hoof is the dark-brown patch BETWEEN the
                # ink (luma < LO) and the coat (luma > HI), taken with the ink that rings it.)
                lo, hi = (float(v) for v in args.hoof.split(","))
                a = img.astype(float); lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
                band = al & (Y >= y0 * n) & (Y <= y1 * n) & ((X - cx) * sd > 0)
                lab, k = ndimage.label(band & (lum > lo) & (lum < hi))
                out_ = [i for i in range(1, k + 1) if (((np.where(lab == i)[1] - cx) * sd) > half * n).any()]
                mk = np.zeros_like(al)
                if out_:
                    big = max(out_, key=lambda i: (lab == i).sum())
                    hoof = ndimage.binary_fill_holes(lab == big)
                    ink = al & (lum <= lo) & ndimage.binary_dilation(hoof, iterations=5)
                    mk = ndimage.binary_dilation(hoof, iterations=1) & al | ink
            if not mk.any(): continue   # (a band given as empty: that pair stays in the body)
            layer = np.zeros_like(img); layer[mk] = img[mk]; taken |= mk
            ex = int(round(cx + sd * (half * n + 1)))
            rows = np.where(mk[:, ex])[0] if mk[:, ex].any() else np.where(mk.any(axis=1))[0]
            for y in rows:   # the stub: the root column carried in under the body
                for k in range(1, stub):
                    x = ex - sd * k
                    if 0 <= x < n and al[y, x] and layer[y, x, 3] == 0: layer[y, x] = img[y, ex]
            parts[f"{which}-{nm}"] = layer
            out[f"{which}-{nm}"] = [round((cx + sd * half * n) / n, 4), round(float(rows.min() + rows.max()) / 2 / n if which == "fore" else rows.min() / n, 4)]
    body = al & ~taken
    b = np.zeros_like(img); b[body] = img[body]; parts["body"] = b
    stem = paths.rel(asset, pref).name
    pdir = paths.store(ROOT / "parts", asset, pref).parent
    pdir.mkdir(parents=True, exist_ok=True)
    prof = m["profiles"][asset["class"]]
    if "bake" in prof: adir, bake = ROOT.parent / prof["out"] / asset["venue"], asset["world"] * prof["bake"]
    else: adir, bake = ROOT.parent / "assets/images/props" / asset["venue"], asset["world"] * 4   # a shipped element (ships:true): baked 4x, as ingest does
    for nm, arr in parts.items():
        im = Image.fromarray(arr)
        im.save(pdir / f"{stem}-{nm}.png")
        im.resize((bake, bake), Image.LANCZOS).save(adir / f"{stem}-{nm}.png")
    print(json.dumps(out))


if __name__ == "__main__":
    main()

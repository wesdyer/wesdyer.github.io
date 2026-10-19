#!/usr/bin/env python3
"""Cut the painted Sally Lightfoot crab into its body and limbs, so the game can work the legs and claws.

    python3 regatta/art/crab_parts.py

Reads art/masters/volcanic/sally-lightfoot.png and writes, beside the asset, two atlases of CELL-px cells, every cell
the whole frame with one piece in it (so the pieces stay in register and the game draws a cell where the frame goes):
    sally-lightfoot-parts.png       the adult (cell 0 the body, then the limbs)
    sally-lightfoot-juv-parts.png   the same cut, recoloured to the juvenile (dark purple-black, dark red legs)
and prints the pieces as JSON for js/wildlife.js (CRAB_SPR): each limb's kind, side, pivot (frame fractions: where it
leaves the shell) and its angle off the body's axis.

HOW: outside a ring round the carapace the eight legs and the two claw tips are separate shapes in the paint, so each
connected piece of ink out there is one limb; inside the ring is the body. (Oct 18 2026, the Emberfall crabs: a crab at
rest is a sprite, but a crab running sideways is its legs rippling — the drawn crab's best read — and a picking crab is
its claws going to its mouth one after the other.)
"""
import json
import pathlib

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent
CELL = 96
RING = 0.2     # the carapace and the legs' bases inside this radius (a fraction of the frame) stay with the body
CX, CY = 0.5004, 0.5144   # the manifest's anchorPx: the carapace's middle


def premul_resize(a, size):
    p = a.astype(float) / 255
    p[..., :3] *= p[..., 3:4]
    planes = [Image.fromarray(p[..., i].astype(np.float32), "F").resize((size, size), Image.LANCZOS) for i in range(4)]
    P = np.stack([np.array(q) for q in planes], -1).clip(0, 1)
    al = P[..., 3:4]
    rgb = np.where(al > 1e-4, P[..., :3] / np.maximum(al, 1e-4), 0)
    return (np.concatenate([rgb, al], -1) * 255).clip(0, 255).astype(np.uint8)


def juvenile(a):
    """Dark purple-black shell, dark red legs, the pale joints dulled to a dusky yellow (the references' young crabs)."""
    f = a.astype(float) / 255
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    yellow = (g > 0.45) & (r > 0.7)               # the shell's orange-yellow middle and the joints' bands
    red = (~yellow) & (r > 0.45) & (g < 0.45)     # the red legs and the red marbling
    out = f.copy()
    shell = np.array([0.23, 0.14, 0.2])           # #3b2434
    leg = np.array([0.43, 0.15, 0.19])            # #6d2531
    speck = np.array([0.89, 0.76, 0.29])          # #e3c24a
    k = (0.55 + lum * 0.6)[..., None]
    out[..., :3] = np.where(yellow[..., None], shell * k * 1.15, np.where(red[..., None], leg * k, shell * k))
    # a few pale flecks survive where the joints' bands were brightest
    fleck = yellow & (lum > 0.78)
    out[..., :3] = np.where(fleck[..., None], speck * 0.8, out[..., :3])
    return (out * 255).clip(0, 255).astype(np.uint8)


def main():
    src = ROOT / "masters/volcanic/sally-lightfoot.png"
    A = np.array(Image.open(src).convert("RGBA"))
    N = A.shape[0]
    yy, xx = np.mgrid[0:N, 0:N]
    dx, dy = xx / N - CX, yy / N - CY
    r = np.hypot(dx, dy)
    ink = A[..., 3] > 24
    out_ring = ink & (r > RING)
    lab, n = ndimage.label(out_ring)
    sizes = ndimage.sum(out_ring, lab, range(1, n + 1))
    pieces = []
    for i, sz in enumerate(sizes, 1):
        if sz < 0.0004 * N * N:
            continue
        m = lab == i
        # the pivot: where it leaves the ring
        base = m & (r < RING + 0.02)
        ys, xs = np.nonzero(base if base.any() else m)
        px, py = xs.mean() / N, ys.mean() / N
        ang = float(np.degrees(np.arctan2(px - CX, -(py - CY))))
        kind = "claw" if abs(ang) < 40 else "leg"
        pieces.append({"mask": m, "pivot": [round(px, 4), round(py, 4)], "ang": round(ang, 1), "kind": kind, "side": 1 if ang > 0 else -1})
    # legs numbered front to back on each side
    for sd in (-1, 1):
        legs = sorted([p for p in pieces if p["kind"] == "leg" and p["side"] == sd], key=lambda p: abs(p["ang"]))
        for j, p in enumerate(legs):
            p["n"] = j
    pieces.sort(key=lambda p: (p["kind"] != "claw", p["side"], p.get("n", 0)))
    # each piece's mask grown a pixel or two (the soft edge), the body everything else
    taken = np.zeros_like(ink)
    for p in pieces:
        p["mask"] = ndimage.binary_dilation(p["mask"], iterations=3) & (r > RING - 0.004)
        taken |= p["mask"]
    body = A.copy()
    body[..., 3] = np.where(taken & (r > RING), 0, body[..., 3])
    cells = [body] + [np.where(p["mask"][..., None], A, 0).astype(np.uint8) for p in pieces]
    dst = ROOT.parent / "assets/images/props/volcanic"
    for name, f in (("sally-lightfoot-parts.png", lambda x: x), ("sally-lightfoot-juv-parts.png", juvenile)):
        sheet = np.zeros((CELL, CELL * len(cells), 4), np.uint8)
        for i, c in enumerate(cells):
            sheet[:, i * CELL:(i + 1) * CELL] = premul_resize(f(c), CELL)
        Image.fromarray(sheet).save(dst / name)
    print(json.dumps({"cell": CELL, "n": len(cells), "parts": [{k: v for k, v in p.items() if k != "mask"} for p in pieces]}))


if __name__ == "__main__":
    main()

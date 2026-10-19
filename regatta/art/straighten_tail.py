#!/usr/bin/env python3
"""Lay a painted animal's curled tail out straight, down the frame, so the game can bend it itself.

    python3 regatta/art/straighten_tail.py volcanic/marine-iguana 0.70
    python3 regatta/art/straighten_tail.py volcanic/marine-iguana-swim 0.62

Reads art/masters/<name>.png and writes assets/images/props/<name>-straight.png at the asset's own scale
(a square frame: the asset's width, grown to the straight tail's reach, the animal centred across it). Everything above the
`from` row (a fraction of the frame) is copied as painted; from there the tail's centreline is traced
down its curve and resampled across it, so each step along the tail becomes one row and the tail runs
straight down the middle, its true length kept.

WHY (Oct 18 2026, the marine iguanas): both iguanas were painted with the tail curled off to one side
and the tip running sideways. A curve baked into the paint would sit there while the swimming wave moved
round it, and per-row straightening (the hammerhead's) can't undo a tail that runs across the rows. The
game lays its own curve on the straight tail: each basking animal's own lazy curl, the walk's sway, the
swim's sculling wave.
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, gaussian_filter1d

ROOT = pathlib.Path(__file__).resolve().parent


def trace(alpha, y0, cx0):
    """The tail's centreline from row y0 down: march a pixel at a time, re-centring across the tail."""
    H, W = alpha.shape
    p, d, pts = np.array([cx0, y0], float), np.array([0.0, 1.0]), []
    for _ in range(4 * H):
        pts.append(p.copy())
        n = np.array([-d[1], d[0]])
        u = np.arange(-40, 41, 0.5)
        xs, ys = p[0] + n[0] * u, p[1] + n[1] * u
        a = map_coordinates(alpha, [ys, xs], order=1, cval=0)
        if (a[len(u) // 2] < 0.25 and len(pts) > 20) or p[1] < y0 - 4:   # (or it has turned back up the body)
            break   # (off the tip: no ink under the centre any more)
        # the centre of the ink across the tail, only the run touching the current centre (not a leg beside it)
        i0 = len(u) // 2
        on = a > 0.25
        if not on[i0]:
            i0 = int(np.argmax(a))
        lo = i0
        while lo > 0 and on[lo - 1]:
            lo -= 1
        hi = i0
        while hi < len(u) - 1 and on[hi + 1]:
            hi += 1
        c = (u[lo:hi + 1] * a[lo:hi + 1]).sum() / a[lo:hi + 1].sum()
        q = p + n * np.clip(c, -3, 3)   # (eased toward the centre: a fat wide run never yanks it sideways)
        if len(pts) > 12:   # (heading from the line's own last dozen pixels: steady, and it follows the curl)
            e = q - pts[-12]
            d = 0.7 * d + 0.3 * e / max(1e-6, np.hypot(*e))
            d /= np.hypot(*d)
        p = q + d
    return np.array(pts)


def main():
    name, frm = sys.argv[1], float(sys.argv[2])
    m = Image.open(ROOT / "masters" / f"{name}.png").convert("RGBA")
    A = np.array(m).astype(float) / 255
    H, W = A.shape[:2]
    pre = A.copy()
    pre[..., :3] *= pre[..., 3:4]
    y0 = int(frm * H)
    # the tail's start: the run of ink across row y0 nearest the frame's middle
    on = A[y0, :, 3] > 0.25
    xs0 = np.nonzero(on)[0]
    c0 = xs0[np.argmin(abs(xs0 - W / 2))]
    lo, hi = c0, c0
    while lo > 0 and on[lo - 1]:
        lo -= 1
    while hi < W - 1 and on[hi + 1]:
        hi += 1
    cx0 = (lo + hi) / 2
    pts = trace(A[..., 3], y0, cx0)
    # smooth the line (a jagged centre shears the tail), then resample it at one pixel per step
    pts[:, 0] = gaussian_filter1d(pts[:, 0], 6, mode="nearest")
    pts[:, 1] = gaussian_filter1d(pts[:, 1], 6, mode="nearest")
    seg = np.hypot(*np.diff(pts, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    S = np.arange(0, s[-1] + 12)
    cx_, cy_ = np.interp(S, s, pts[:, 0]), np.interp(S, s, pts[:, 1])
    k0 = np.searchsorted(S, s[-1] - 6)
    ex, ey = (cx_[k0 + 6] - cx_[k0]) / 6 if k0 + 6 < len(S) else 0, (cy_[k0 + 6] - cy_[k0]) / 6 if k0 + 6 < len(S) else 1
    past = S > s[-1]
    cx_[past], cy_[past] = pts[-1, 0] + ex * (S[past] - s[-1]), pts[-1, 1] + ey * (S[past] - s[-1])
    # (past the traced tip, carry on along the last direction, so the very tip isn't clipped)
    dx, dy = np.gradient(cx_), np.gradient(cy_)
    L = np.maximum(np.hypot(dx, dy), 1e-6)
    dx, dy = dx / L, dy / L
    nx, ny = dy, -dx
    # the copied body keeps its frame x; the straight tail runs down the column of its first point
    half = 64
    u = np.arange(-half, half + 1)
    out_h = y0 + len(S)
    out = np.zeros((max(H, out_h), W, 4))
    out[:y0] = pre[:y0]
    X0 = int(round(cx0))
    xs = cx_[:, None] - nx[:, None] * u[None, :]
    ys = cy_[:, None] - ny[:, None] * u[None, :]
    band = np.stack([map_coordinates(pre[..., c], [ys, xs], order=1, cval=0) for c in range(4)], -1)
    out[y0:y0 + len(S), X0 - half:X0 + half + 1] = band
    # (anything off the tail beside the band in the copied rows — a hind foot — stays where it was painted)
    rest = pre[y0:].copy()
    rest_mask = np.ones(rest.shape[:2], bool)
    # blank the tail's own pixels out of the rest: everything within half the band of the traced line
    yy, xx = np.mgrid[y0:H, 0:W]
    for i in range(0, len(cx_), 2):
        rest_mask &= (xx - cx_[i]) ** 2 + (yy - cy_[i]) ** 2 > 50 ** 2
    rest[~rest_mask] = 0
    reg = out[y0:H]
    reg[:] = rest + reg * (1 - rest[..., 3:4])
    # back to straight alpha, and down to the asset's scale
    a = out[..., 3:4]
    rgb = np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0)
    img = Image.fromarray((np.concatenate([rgb, a], -1) * 255).clip(0, 255).astype(np.uint8))
    asset = ROOT.parent / "assets/images/props" / f"{name}.png"
    aw = Image.open(asset).size[0]
    k = aw / W
    pre2 = np.array(img).astype(float) / 255
    pre2[..., :3] *= pre2[..., 3:4]
    size = (aw, int(np.ceil(img.size[1] * k)))
    planes = [Image.fromarray(pre2[..., i].astype(np.float32), "F").resize(size, Image.LANCZOS) for i in range(4)]
    P = np.stack([np.array(p) for p in planes], -1).clip(0, 1)
    al = P[..., 3:4]
    rgb = np.where(al > 1e-4, P[..., :3] / np.maximum(al, 1e-4), 0)
    res = Image.fromarray((np.concatenate([rgb, al], -1) * 255).clip(0, 255).astype(np.uint8))
    # square again (the game's mip chain halves a square frame), the animal centred across it
    side = max(res.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(res, ((side - res.size[0]) // 2, 0))
    ox, res = (side - res.size[0]) // 2, sq
    dst = asset.with_name(asset.stem + "-straight.png")
    res.save(dst)
    al = np.array(res)[..., 3]
    ys_, xs_ = np.nonzero(al > 40)
    print(json.dumps({"out": str(dst.relative_to(ROOT.parent)), "size": res.size, "from": frm, "tailLen": round(float(s[-1]) / H, 4),
                      "top": round(ys_.min() / side, 4), "bot": round((ys_.max() + 1) / side, 4), "cx": round((cx0 * k + ox) / side, 4),
                      "tail": round(y0 * k / side, 4)}))


if __name__ == "__main__":
    main()

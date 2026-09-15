#!/usr/bin/env python3
"""Cut an arch's BAKE into its piers and its span, so a hull can sail under the span.
    python3 regatta/art/archsplit.py otter-sea-arch
    python3 regatta/art/archsplit.py otter-centre-arch-point --ratio 1.4 --feather 6 --preview
Writes assets/images/props/<venue>/<name>-piers.png and <name>-span.png, both on the bake's
full frame, alphas summing to the original — the same trick treesplit.py plays for a trunk
and its crown, and for the same reason: two sprites in two planes that reassemble into the
one delivered rock. The PIERS draw on the surface plane and are what the tracer turns into
the collider (prop_outlines.py follows `parts.surface`); the SPAN draws on the canopy plane,
over the fleet, so a boat between the piers is under the arch.

WHY THE BAKE AND NOT THE MASTER. The whole-rock bake went through ingest with a fillTo
crop-and-rescale; a part cut from the master and baked on its own would land in a different
frame and the halves would not register with the whole sprite the editor draws (nor with the
`paint` silhouette traced from it). Partitioning the finished bake's alpha is exact.

WHERE THE CUT IS. From above an arch is an isthmus: two lobes joined by a neck, with a notch
of water either side. The neck is the top of the span. The tool finds it as the narrowest
cross-section along the rock's principal axis and takes the run of sections narrower than
RATIO x that minimum as the span; everything else is pier. The run's length along the axis is
the PASSAGE WIDTH a hull has to fit through (its beam, ~20u — it sails through lengthwise),
and the neck's thickness is how far the hull travels under rock. The cut is a straight band,
so the passage is a straight tunnel of that width; the span drawn over the hull hides the
band's edges where they cross the lobes' shoulders. --s0/--s1 override the run in bake px
along the axis from the centroid when the automatic pick is wrong.

THE SEAM IS HARD (feather 1 px). treesplit.py softens its cut, and that is right for foliage,
but here the two halves are the same opaque rock composited one over the other, and a wide
feather leaves a band where neither is opaque — a 6 px feather showed as a translucent
streak across the neck with the water reading through. One pixel is enough to hide the
antialiasing; the span drawn over the piers hides the line itself.
"""
import argparse, json, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
MANIFEST = ROOT / "manifest.json"
ALPHA = 96


def bake_path(key):
    i = key.find("-")
    return REPO / "assets" / "images" / "props" / key[:i] / f"{key[i + 1:]}.png"


def find_neck(a, ratio):
    """(axis, normal, centroid, s0, s1, neck_px, s_lo, s_hi) along the principal axis of alpha mask `a`."""
    ys, xs = np.nonzero(a)
    pts = np.stack([xs, ys], 1).astype(float); c = pts.mean(0); p = pts - c
    ev, evec = np.linalg.eigh(np.cov(p.T)); ax = evec[:, 1]; nrm = evec[:, 0]
    s = p @ ax; t = p @ nrm
    lo, hi = np.percentile(s, [0.5, 99.5]); N = 120; bins = np.linspace(lo, hi, N + 1)
    prof = np.zeros(N)
    for i, (b0, b1) in enumerate(zip(bins[:-1], bins[1:])):
        m = (s >= b0) & (s < b1)
        if m.sum() >= 5: prof[i] = t[m].max() - t[m].min()
    i = int(np.argmin(prof[12:-12])) + 12; neck = prof[i]
    run = prof < neck * ratio; j0 = j1 = i
    while j0 > 0 and run[j0 - 1]: j0 -= 1
    while j1 < N - 1 and run[j1 + 1]: j1 += 1
    return ax, nrm, c, bins[j0], bins[j1 + 1], neck, lo, hi


def split_arch(img, ratio, feather, s0=None, s1=None, overlap=2.0):
    arr = np.array(img.convert("RGBA")).astype(np.float32)
    a = arr[:, :, 3]; H, W = a.shape
    ax, nrm, c, a0, a1, neck, lo, hi = find_neck(a > ALPHA, ratio)
    if s0 is None: s0 = a0
    if s1 is None: s1 = a1
    yy, xx = np.mgrid[0:H, 0:W]
    s = (xx - c[0]) * ax[0] + (yy - c[1]) * ax[1]
    # 1 inside the band, 0 outside, a smoothstep `feather` px wide either side of each edge
    def ss(u): u = np.clip(u, 0, 1); return u * u * (3 - 2 * u)
    band = lambda lo, hi: ss((s - (lo - feather)) / (2 * feather)) * (1 - ss((s - (hi - feather)) / (2 * feather)))
    # THE SPAN OVERLAPS THE PIERS by `overlap` px each side: partitioning alpha exactly leaves a
    # hairline at the seam (the antialiased pixel is part-opaque in BOTH halves and composites
    # short of solid). With the span a little wider than the piers' cut, its opaque pixels sit
    # over the piers' fading edge and the join is invisible. The piers' cut is unchanged, so the
    # collider the tracer reads off them does not move.
    t_p = band(s0, s1); t_s = band(s0 - overlap, s1 + overlap)
    piers = arr.copy(); span = arr.copy()
    piers[:, :, 3] = a * (1 - t_p); span[:, :, 3] = a * t_s
    info = dict(axis=ax.tolist(), centre=c.tolist(), s0=float(s0), s1=float(s1), neck_px=float(neck), span_px=float(s1 - s0), frame=W)
    return (Image.fromarray(piers.astype("uint8"), "RGBA"), Image.fromarray(span.astype("uint8"), "RGBA"), info)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key", help="the whole-rock kind, e.g. otter-sea-arch")
    ap.add_argument("--ratio", type=float, default=1.4, help="span = sections narrower than ratio x the neck")
    ap.add_argument("--feather", type=float, default=1.0, help="seam softness, bake px — keep it hard, see the docstring")
    ap.add_argument("--s0", type=float); ap.add_argument("--s1", type=float)
    ap.add_argument("--overlap", type=float, default=2.0, help="span overlaps the piers by this many px each side")
    ap.add_argument("--preview", action="store_true", help="write nothing")
    args = ap.parse_args()
    assets = json.loads(MANIFEST.read_text())["assets"]
    asset = next((x for x in assets if x["key"] == args.key), None)
    if asset is None: sys.exit(f"no such key: {args.key}")
    src = bake_path(args.key)
    if not src.exists(): sys.exit(f"no bake at {src} — ingest the whole rock first")
    img = Image.open(src).convert("RGBA")
    piers, span, info = split_arch(img, args.ratio, args.feather, args.s0, args.s1, args.overlap)
    u = asset["world"] / info["frame"]
    a0 = np.array(img.getchannel("A")).astype(np.int64).sum()
    a1 = np.array(piers.getchannel("A")).astype(np.int64).sum() + np.array(span.getchannel("A")).astype(np.int64).sum()
    print(f"{args.key}: bake {info['frame']}px, world {asset['world']} ({u:.3f} u/px at scale 1)")
    print(f"    span band s0={info['s0']:.0f} s1={info['s1']:.0f} px along axis ({info['axis'][0]:.2f},{info['axis'][1]:.2f})")
    print(f"    passage width {info['span_px'] * u:.0f}u, rock overhead {info['neck_px'] * u:.0f}u  (x the placement's scale)")
    print(f"    alpha: {100.0 * a1 / max(1, a0):.2f}% of the whole (a little over 100 is the overlap)")
    for part, im in (("piers", piers), ("span", span)):
        frac = np.array(im.getchannel("A")).astype(float).sum() / max(1, a0)
        print(f"    {part:5} carries {100 * frac:5.1f}% of the ink")
        if not args.preview:
            dest = bake_path(f"{args.key}-{part}"); im.save(dest); print(f"       -> {dest.relative_to(REPO.parent)}")
    if args.preview: print("    (preview: nothing written)")
    else: print(f"    next: PROP_KINDS rows for {args.key}-piers / -span and `parts` on {args.key}; python3 regatta/art/prop_outlines.py")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Knock a flat or checkerboard background out of a generated master.

    python3 regatta/art/dekey.py ~/Desktop/raw.png arctic-orca
    python3 regatta/art/dekey.py raw.png arctic-orca --thresh 70
    python3 regatta/art/dekey.py raw.png arctic-orca --inspect
    python3 regatta/art/dekey.py raw.png cove-cargo-ship --gradient

Writes regatta/art/inbox/<key>.png ready for ingest.py.

Some generators (Gemini in particular) return an RGBA file that is 100% opaque
with a transparency *checkerboard painted into the pixels* — it looks transparent
in a viewer and is not. Others return a flat chroma background. Both are the same
problem: a background connected to the image border that must become real alpha.

Flood fill from the four corners handles both. Two known limits, measured on the
arctic-orca master:

1. It erodes roughly a pixel of the original antialiased edge, because the fill
   produces a binary mask and the boundary lands mid-blend. Invisible at race
   scale; a dedicated background remover keeps a softer edge (2.0% partial alpha
   against this tool's 1.1%). Prefer a real remover when you have one — this is
   the no-round-trip fallback.
2. It protects FULLY ENCLOSED light areas (a marking ringed by dark body is
   unreachable) but not a light marking that TOUCHES the silhouette edge, which
   the fill can walk into from outside. That risk is specific to white and
   checkerboard backgrounds, whose tones sit close to pale markings.

Hence --bg magenta wherever you can choose it: magenta is 255 RGB units from
white, so no threshold that clears the key can reach a pale marking.

--gradient is the third case: a backdrop that is not one tone at all. See
flood_gradient — the seed-relative fill cannot key a vignette or a glow at ANY
threshold, and the --inspect sweep says so by never reaching a plateau.
"""
import argparse
import pathlib
import sys
from collections import Counter

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent
INBOX = ROOT / "inbox"
KEY = (255, 0, 255)


def flood_gradient(img, step):
    """Border-connected flood whose tolerance is measured against the NEIGHBOUR
    already accepted as background, not against the seed pixel.

    A generation that comes back on a vignette, a glow or any lit backdrop has no
    single background tone for the seed-relative fill to match, so that fill has no
    correct threshold — not a hard-to-find one, none. Measured on the cove-cargo-ship
    master: the backdrop runs 140 at the corners down to 68 where it meets the hull,
    so clearing it needs a seed tolerance past 216 summed across RGB, while the
    graphite hull sits only 303 from the same seed. Every value either stops partway
    and leaves a grey halo or opens wide enough to start eating the ship, which is
    why its --inspect sweep walks the bbox inward monotonically and never plateaus.

    Neighbour-relative separates them by two orders of magnitude, because a backdrop
    is smooth by construction and a silhouette is not. On that same master adjacent
    backdrop pixels differ by at most 6 summed across RGB; the hull contour steps by
    350-520. Anything in between works, so the default is deliberately far from both.

    Returns a bool array, True where background.
    """
    a = np.asarray(img.convert("RGB"), dtype=np.int16)
    h, w, _ = a.shape
    # Step magnitude to the right and down neighbour, computed once.
    passx = np.abs(np.diff(a, axis=1)).sum(2) <= step   # (h, w-1)
    passy = np.abs(np.diff(a, axis=0)).sum(2) <= step   # (h-1, w)

    bg = np.zeros((h, w), dtype=bool)
    bg[0, :] = bg[-1, :] = bg[:, 0] = bg[:, -1] = True
    # Grow one pixel per direction per pass. Bounded by the image diagonal, but it
    # converges when the frontier stops moving, which is as soon as the flood has
    # wrapped the silhouette — a few hundred passes on a 1024 master, under a second.
    for _ in range(h + w):
        n = int(bg.sum())
        bg[:, :-1] |= bg[:, 1:] & passx
        bg[:, 1:] |= bg[:, :-1] & passx
        bg[:-1, :] |= bg[1:, :] & passy
        bg[1:, :] |= bg[:-1, :] & passy
        if int(bg.sum()) == n:
            break
    return bg


def dekey(img, thresh, feather, step=None):
    rgb = img.convert("RGB")
    w, h = rgb.size
    if step is not None:
        mask = Image.fromarray(
            np.where(flood_gradient(img, step), 0, 255).astype(np.uint8), "L")
        mp = mask.load()
        hit = int((np.asarray(mask) == 0).sum())
    else:
        # Fill from every corner: a checkerboard's two tones are both border-connected,
        # and a gradient backdrop may differ corner to corner.
        for xy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
            ImageDraw.floodfill(rgb, xy, KEY, thresh=thresh)

        px = rgb.load()
        mask = Image.new("L", (w, h), 255)
        mp = mask.load()
        hit = 0
        for y in range(h):
            for x in range(w):
                if px[x, y] == KEY:
                    mp[x, y] = 0
                    hit += 1
    # Leak detection by COLOR, not geometry. A real background is a handful of flat
    # tones (one for a chroma key, two for a checkerboard). If the fill also swallowed
    # colors that belong to no such tone, it walked through a marking that touches the
    # silhouette edge. Geometry cannot tell this apart: the gaps between an orca's
    # pectoral fins and its body are legitimately background, so "inside the bounding
    # box" flags every concave shape.
    #
    # It does not apply in gradient mode and is skipped there rather than left to
    # fire on every run: "the background is a handful of flat tones" is the exact
    # premise --gradient exists because the image violates, so the check would
    # report ~100% leak on a correct key and train the reader to ignore it.
    src = img.convert("RGB")
    removed = [] if step is not None else [
        src.getpixel((x, y))
        for y in range(0, h, 4) for x in range(0, w, 4) if not mp[x, y]]
    leak = None if step is not None else 0.0
    if removed:
        common = [c for c, _ in Counter(removed).most_common(4)]
        off = sum(1 for c in removed
                  if min(sum(abs(a - b) for a, b in zip(c, k)) for k in common) > 24)
        leak = off / len(removed)

    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))

    out = img.convert("RGBA")
    out.putalpha(mask)
    return out, hit / (w * h), leak


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("key", nargs="?", help="manifest key; omit with --inspect")
    ap.add_argument("--thresh", type=int, default=160,
                    help="flood tolerance, summed across RGB; 160 clears a "
                         "transparency checkerboard (its two tones differ by 132). "
                         "Sweep with --inspect: the right value sits on a plateau "
                         "where removed%% and bbox stop changing.")
    ap.add_argument("--feather", type=float, default=0.6,
                    help="edge softening in px; 0 for a hard cut")
    ap.add_argument("--gradient", action="store_true",
                    help="key a backdrop that is NOT one tone — a vignette, a glow, "
                         "any lit background. Measures tolerance neighbour to "
                         "neighbour instead of against the seed. Reach for this when "
                         "an --inspect sweep never finds a plateau.")
    ap.add_argument("--step", type=int, default=16,
                    help="--gradient only: largest per-pixel step, summed across RGB, "
                         "the flood may cross. Backdrop noise sits near 6 and a "
                         "silhouette contour near 400, so this is not delicate: the "
                         "cove-cargo-ship master holds the same bbox from 10 to 24 "
                         "and only starts eroding the antialiased edge past 40.")
    ap.add_argument("--inspect", action="store_true",
                    help="report what would happen, write nothing")
    args = ap.parse_args()

    src = pathlib.Path(args.src).expanduser()
    if not src.exists():
        sys.exit(f"no such file: {src}")

    img = Image.open(src)
    print(f"{src.name}: {img.mode} {img.width}x{img.height}")
    step = args.step if args.gradient else None
    out, frac, leak = dekey(img, args.thresh, args.feather, step)
    bbox = out.getchannel("A").getbbox()
    print(f"  mode {'gradient (step %d)' % step if step else 'flat (thresh %d)' % args.thresh}")
    print(f"  removed {frac:.1%} as background")
    print(f"  content bbox {bbox}")

    if frac < 0.05:
        print("  WARNING: almost nothing removed — the background may not be "
              "border-connected, or --thresh is too low")
    if frac > 0.97:
        print("  WARNING: nearly everything removed — --thresh is too high")
    # Unproven guard: sound in principle, but no true-positive case has been
    # produced against it yet. Treat a hit as "go look", not as a verdict.
    if leak is not None and leak > 0.01:
        print(f"  WARNING: {leak:.1%} of removed pixels match no flat background "
              "tone — the fill may have walked into a marking that touches the "
              "silhouette edge. Inspect the result; lower --thresh, regenerate "
              "with --bg magenta, or use a dedicated background remover.")

    if args.inspect:
        return
    if not args.key:
        sys.exit("need a manifest key (or use --inspect)")

    INBOX.mkdir(exist_ok=True)
    dst = INBOX / f"{args.key}.png"
    out.save(dst)
    print(f"  -> art/inbox/{args.key}.png")
    print(f"  next: python3 regatta/art/ingest.py {args.key}")


if __name__ == "__main__":
    main()

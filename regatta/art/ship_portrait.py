#!/usr/bin/env python3
"""Ship a NEW character's portrait that Wes delivered to the Desktop, in one step:

    python3 regatta/art/ship_portrait.py <key>                 # reads ~/Desktop/<key>.png
    python3 regatta/art/ship_portrait.py <key> <delivered.png>
    python3 regatta/art/ship_portrait.py <key> --check         # validate + measure, ship nothing
    python3 regatta/art/ship_portrait.py <key> --peel          # peel a light sticker halo first

It chains the tools that already exist, so nothing re-implements the pipeline:
  1. HALO CHECK. A delivery with a light rim round the dark outline (Wake's did) reads as
     a sticker on the navy profile band. The share of light, unsaturated rim pixels is
     printed; above ~25% it refuses and asks for --peel, which clears the rim from the
     outside in (the same peel used by hand on Wake, Sep 25 2026).
  2. prep_master.prep: strip specks, crop, pad to square at the roster framing (span
     0.86, CX 0.51 / CY 0.50), write art/inbox/<key>.png, record `master` in the
     manifest. Under --check the manifest is put back and the inbox file removed.
  3. ingest.py <key> (or --check): validate against the portrait profile, archive the
     master, bake assets/images/competitors/<key>.png at 500, flip status to art.
  4. review.measure: silhouette aspect against the roster's range, the animal's and the
     vest's colours, their separation (dE < 25 = vest reads as fur), and outline ink. The
     VEST colour is the proposed hull or spinnaker for the roster record. The vest flag is
     ADVISORY: the sample reads the lower torso, so a vest hidden by folded limbs or hooves
     (Timber, Bixby) measures as fur. Look at the sheet before believing it.
  5. A sheet, art/review/ship_<key>.png: the new portrait at 128 and 64 px beside four
     shipped ones on the profile navy, the size the picker and the fleet list show.

The character still needs its roster record, SPIN_LOOKS pattern and quotes: see the
ship-character skill.
"""
import argparse
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
sys.path.insert(0, str(ROOT))
import prep_master  # noqa: E402
import review       # noqa: E402

SHIPPED = REPO / "assets" / "images" / "competitors"
COMPARE = ["ripple", "snap", "paddle", "wake"]
HALO_LIMIT = 0.25


def rim_light(im):
    """Share of the silhouette's outermost pixels that are light and unsaturated."""
    a = np.array(im.convert("RGBA")).astype(float)
    m = a[..., 3] > 16
    inner = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
    rim = m & ~inner
    if not rim.any():
        return 0.0
    c = a[rim][:, :3]
    lum = c @ [0.299, 0.587, 0.114]
    sat = c.max(1) - c.min(1)
    return float(((lum > 120) & (sat < 45)).mean())


def peel(im, passes=20):
    """Clear light, unsaturated pixels from the silhouette's edge inward until the rim is dark."""
    a = np.array(im.convert("RGBA")).astype(np.float32)
    lum = a[..., :3] @ [0.299, 0.587, 0.114]
    sat = a[..., :3].max(2) - a[..., :3].min(2)
    m = a[..., 3] > 8
    halo = (lum > 120) & (sat < 45)
    for it in range(passes):
        inner = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
        kill = (m & ~inner) & halo
        if not kill.any():
            break
        m[kill] = False
    a[..., 3] = np.where(m, a[..., 3], 0)
    print(f"  peeled the halo in {it} pass(es)")
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def sheet(key, path):
    out = Image.new("RGBA", (5 * 140 + 10, 250), (22, 40, 70, 255))
    x = 10
    for p in [path] + [SHIPPED / f"{n}.png" for n in COMPARE]:
        if not pathlib.Path(p).exists():
            continue
        im = Image.open(p).convert("RGBA")
        out.alpha_composite(im.resize((128, 128), Image.LANCZOS), (x, 10))
        out.alpha_composite(im.resize((64, 64), Image.LANCZOS), (x + 32, 160))
        x += 140
    dest = ROOT / "review" / f"ship_{key}.png"
    dest.parent.mkdir(exist_ok=True)
    out.convert("RGB").save(dest)
    return dest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("src", nargs="?")
    ap.add_argument("--check", action="store_true", help="validate and measure only; ship nothing")
    ap.add_argument("--peel", action="store_true", help="peel a light halo off the outline first")
    args = ap.parse_args()
    src = pathlib.Path(args.src or pathlib.Path.home() / "Desktop" / f"{args.key}.png")
    if not src.exists():
        sys.exit(f"{src}: not found")

    im = Image.open(src).convert("RGBA")
    light = rim_light(im)
    print(f"{args.key}: rim light {light:.0%} (limit {HALO_LIMIT:.0%})")
    if light > HALO_LIMIT and not args.peel:
        sys.exit("  a light halo rings the outline; re-run with --peel, or ask for the outline "
                 "straight onto transparency")
    if args.peel:
        im = peel(im)
        print(f"  rim light now {rim_light(im):.0%}")
        tmp = pathlib.Path(tempfile.mkdtemp()) / f"{args.key}.png"
        im.save(tmp)
        src = tmp

    manifest_text = prep_master.MANIFEST.read_text()
    prep_master.prep(src, args.key)
    cmd = [sys.executable, str(ROOT / "ingest.py"), args.key] + (["--check"] if args.check else [])
    failed = subprocess.run(cmd, cwd=REPO).returncode
    if args.check:
        prep_master.MANIFEST.write_text(manifest_text)
    if failed:
        sys.exit("ingest failed")

    shown = ROOT / "inbox" / f"{args.key}.png" if args.check else SHIPPED / f"{args.key}.png"
    m = review.measure(shown)
    lo, hi = review.ASPECT_LO, review.ASPECT_HI
    flags = []
    if not lo <= m["aspect"] <= hi:
        flags.append(f"ASPECT outside {lo}-{hi}")
    sep = review.dE(m["vest"], m["animal"]) if m["vest"] else None
    if sep is not None and sep < 25:
        flags.append("vest reads as fur (dE < 25; advisory, check the sheet)")
    print(f"  aspect {m['aspect']:.2f} · animal {m['animal']} · vest {m['vest']} "
          f"(dE {sep:.0f})" if sep is not None else f"  aspect {m['aspect']:.2f} · animal {m['animal']} · vest ?")
    print(f"  outline ink {m['contour']:.2f}" + ("   FLAGS: " + "; ".join(flags) if flags else "   no flags"))
    print(f"  sheet: {sheet(args.key, shown).relative_to(REPO.parent)}")
    if args.check:
        shown.unlink(missing_ok=True)


if __name__ == "__main__":
    main()

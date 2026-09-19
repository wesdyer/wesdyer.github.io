#!/usr/bin/env python3
"""Take a generation delivered to the Desktop (2816x1536 RGBA, or any frame) and make it
the square master ingest.py expects — the three steps from the hand-prep note, as a tool:

  1. strip free-floating alpha specks (batch_generate.normalise's rule: a pixel at alpha
     9..201 not within a MaxFilter(7) of solid alpha is backdrop residue), then alpha<9 -> 0
  2. crop to the alpha bbox, rotate if asked (--rotate 90 = clockwise: a bow drawn to the
     left comes to the top, the engine's sprite-up), and PAD — never resample — to a square
     of round(max(w, h) / 0.86) with the subject at CX 0.51 / CY 0.50 (the roster framing)
  3. write it to regatta/art/inbox/<key>.png and record the square size as the asset's
     `master` in art/manifest.json (else ingest downsamples the archive to 1024)

    python3 regatta/art/prep_master.py <key> <delivered.png> [--rotate 90|-90|180] [--span 0.86]

Then: python3 regatta/art/ingest.py <key>
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "manifest.json"
INBOX = ROOT / "inbox"
CX, CY = 0.51, 0.50

def prep(src, key, rotate=0, span=0.86):
    im = Image.open(src).convert("RGBA")
    a = np.array(im)
    al = a[..., 3]
    solid = Image.fromarray(((al > 201) * 255).astype("uint8"))
    near = np.array(solid.filter(ImageFilter.MaxFilter(7))) > 0
    floating = (al > 8) & (al <= 201) & ~near
    a[..., 3][floating] = 0
    a[..., 3][a[..., 3] < 9] = 0
    im = Image.fromarray(a)
    bbox = im.split()[-1].getbbox()
    if bbox is None:
        sys.exit(f"{src}: fully transparent")
    im = im.crop(bbox)
    if rotate:
        im = im.rotate(-rotate, expand=True)          # PIL rotates counter-clockwise; --rotate 90 is clockwise
    side = int(round(max(im.size) / span))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(im, (round(CX * side - im.width / 2), round(CY * side - im.height / 2)))
    INBOX.mkdir(exist_ok=True)
    out = INBOX / f"{key}.png"
    canvas.save(out)
    m = json.loads(MANIFEST.read_text())
    asset = next((x for x in m["assets"] if x.get("key") == key), None)
    if asset is None:
        sys.exit(f"{key}: not in the manifest")
    asset["master"] = side
    MANIFEST.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n")
    print(f"{key}: specks {int(floating.sum())}, content {im.width}x{im.height} (aspect {im.width / im.height:.2f}), "
          f"master {side}px at span {span:.2f} -> {out.relative_to(ROOT.parent)}; manifest master={side}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("key"); ap.add_argument("src")
    ap.add_argument("--rotate", type=int, default=0, help="degrees clockwise")
    ap.add_argument("--span", type=float, default=0.86)
    args = ap.parse_args()
    prep(args.src, args.key, args.rotate, args.span)

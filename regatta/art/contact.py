#!/usr/bin/env python3
"""Composite candidate art onto real race frames at true race scale.

    python3 regatta/art/contact.py bayou-cypress
    python3 regatta/art/contact.py --venue swamp
    python3 regatta/art/contact.py bayou-driftlog --plates lagoon arctic swamp

Writes regatta/art/sheets/<key>.png. This is the acceptance gate: the master
always looks good at 1024px, and the only question that matters is whether the
thing reads at the ~40-130px it actually occupies, over both the brightest and
darkest water in the game.

Needs plates first:  node regatta/art/plates.js swamp lagoon arctic
"""
import argparse
import json
import pathlib
import sys

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
MANIFEST = ROOT / "manifest.json"
PLATES = ROOT / "plates"
SHEETS = ROOT / "sheets"
MASTERS = ROOT / "masters"
INBOX = ROOT / "inbox"

BAND_H = 260          # height of each water band
SLOTS = (0.16, 0.5, 0.84)   # where along the band the prop is dropped
ZOOMS = (1, 2, 4)


def source_image(asset, profiles):
    """Prefer the shipped bake, fall back to master, then inbox."""
    prof = profiles[asset["class"]]
    for p in (REPO / prof["out"] / f"{asset['key']}.png",
              MASTERS / f"{asset['key']}.png",
              INBOX / f"{asset['key']}.png"):
        if p.exists():
            return Image.open(p).convert("RGBA"), p
    return None, None


def label(draw, xy, text, fill=(255, 255, 255), shadow=True):
    x, y = xy
    if shadow:
        draw.text((x + 1, y + 1), text, fill=(0, 0, 0, 200))
    draw.text((x, y), text, fill=fill)


def band(plate, art, world, anchor, venue, show_anchor):
    """One venue band: a strip of real water with the prop dropped in at size."""
    w = plate.width
    top = max(0, (plate.height - BAND_H) // 2)
    strip = plate.crop((0, top, w, top + BAND_H)).convert("RGBA")

    scaled = art.resize((world, world), Image.LANCZOS)
    ax, ay = anchor
    for i, frac in enumerate(SLOTS):
        cx, cy = int(w * frac), BAND_H // 2
        # Place so the declared anchor lands on (cx, cy) — that is what the
        # engine will do, so that is what we should be looking at.
        ox = cx - int(ax * world)
        oy = cy - int(ay * world)
        strip.alpha_composite(scaled, (ox, oy))
        if show_anchor and i == 0:
            d = ImageDraw.Draw(strip)
            d.line((cx - 7, cy, cx + 7, cy), fill=(255, 0, 128, 255))
            d.line((cx, cy - 7, cx, cy + 7), fill=(255, 0, 128, 255))

    d = ImageDraw.Draw(strip)
    label(d, (10, 8), f"{venue}  ·  {world}px on the water")
    return strip


def zoom_strip(art, world, width):
    """Reduction ladder on neutral, so detail loss is visible without water noise."""
    h = world * max(ZOOMS) + 40
    strip = Image.new("RGBA", (width, h), (28, 34, 48, 255))
    x = 24
    d = ImageDraw.Draw(strip)
    for z in ZOOMS:
        s = world * z
        strip.alpha_composite(art.resize((s, s), Image.LANCZOS), (x, 20))
        label(d, (x, 4), f"{z}x  ({s}px)")
        x += s + 32
    return strip


def build_sheet(asset, profiles, plate_names):
    key = asset["key"]
    art, src = source_image(asset, profiles)
    if art is None:
        return f"{key}: no art found (looked in assets/, masters/, inbox/)"

    world = asset.get("world", 96)
    anchor = asset.get("anchorPx", [0.5, 0.5])

    bands = []
    for v in plate_names:
        p = PLATES / f"{v}.png"
        if not p.exists():
            print(f"    skip plate '{v}' — run: node regatta/art/plates.js {v}")
            continue
        bands.append(band(Image.open(p), art, world, anchor, v, show_anchor=True))
    if not bands:
        return f"{key}: no plates available — run plates.js first"

    width = bands[0].width
    zs = zoom_strip(art, world, width)
    header = 34
    total = header + sum(b.height for b in bands) + zs.height

    sheet = Image.new("RGBA", (width, total), (18, 22, 33, 255))
    d = ImageDraw.Draw(sheet)
    label(d, (12, 10),
          f"{key}   {asset['class']}/{asset.get('role','-')}   world={world}px   "
          f"anchor={anchor}   src={src.name}")

    y = header
    for b in bands:
        sheet.paste(b, (0, y))
        y += b.height
    sheet.paste(zs, (0, y))

    SHEETS.mkdir(exist_ok=True)
    out = SHEETS / f"{key}.png"
    sheet.convert("RGB").save(out)
    return f"{key}: -> art/sheets/{key}.png"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keys", nargs="*")
    ap.add_argument("--venue")
    ap.add_argument("--plates", nargs="*", default=None)
    args = ap.parse_args()

    m = json.loads(MANIFEST.read_text())
    by_key = {a["key"]: a for a in m["assets"]}

    if args.venue:
        sel = [a for a in m["assets"] if a.get("venue") == args.venue]
    else:
        unknown = [k for k in args.keys if k not in by_key]
        if unknown:
            sys.exit(f"unknown key(s): {', '.join(unknown)}")
        sel = [by_key[k] for k in args.keys]
    if not sel:
        sys.exit("no assets matched")

    for a in sel:
        # The rubric requires both contrast extremes; the prop's own venue is
        # where it will actually live.
        if args.plates:
            names = args.plates
        else:
            names = {"lagoon", "arctic"}
            if a.get("venue"):
                names.add(a["venue"])
            names = sorted(names)
        print(build_sheet(a, m["profiles"], names))


if __name__ == "__main__":
    main()

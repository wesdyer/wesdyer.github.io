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

import paths

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
MANIFEST = ROOT / "manifest.json"
PLATES = ROOT / "plates"
SHEETS = ROOT / "sheets"
MASTERS = ROOT / "masters"
INBOX = ROOT / "inbox"
PREFIXES = {}

BAND_H = 260          # height of each water band
SLOTS = (0.16, 0.5, 0.84)   # where along the band the prop is dropped
ZOOMS = (1, 2, 4)


def source_image(asset, profiles):
    """Prefer the shipped bake, fall back to master, then inbox."""
    prof = profiles[asset["class"]]
    for p in (paths.store(REPO / prof["out"], asset, PREFIXES),
              paths.store(MASTERS, asset, PREFIXES),
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


def compare_band(plate, cands, world, anchor, venue):
    """One venue band with every candidate side by side, for model bake-offs."""
    w = plate.width
    top = max(0, (plate.height - BAND_H) // 2)
    strip = plate.crop((0, top, w, top + BAND_H)).convert("RGBA")
    d = ImageDraw.Draw(strip)
    ax, ay = anchor
    n = len(cands)
    for i, (lab, art) in enumerate(cands):
        cx = int(w * (i + 1) / (n + 1))
        cy = BAND_H // 2
        scaled = art.resize((world, world), Image.LANCZOS)
        strip.alpha_composite(scaled, (cx - int(ax * world), cy - int(ay * world)))
        label(d, (cx - world // 2, cy + world // 2 + 8), lab)
    label(d, (10, 8), f"{venue}  ·  {world}px on the water")
    return strip


def build_compare(asset, plate_names, cand_paths):
    """Same asset, several candidate files — one sheet, judged at race scale."""
    key = asset["key"]
    cands = []
    for p in cand_paths:
        lab, _, fp = p.rpartition(":") if ":" in p else ("", "", p)
        f = pathlib.Path(fp)
        if not f.exists():
            print(f"    skip {fp} — not found")
            continue
        cands.append((lab or f.stem[:24], Image.open(f).convert("RGBA")))
    if not cands:
        return f"{key}: no candidate files found"

    world = asset.get("world", 96)
    anchor = asset.get("anchorPx", [0.5, 0.5])

    bands = []
    for v in plate_names:
        pl = PLATES / f"{v}.png"
        if not pl.exists():
            print(f"    skip plate '{v}' — run: node regatta/art/plates.js {v}")
            continue
        bands.append(compare_band(Image.open(pl), cands, world, anchor, v))
    if not bands:
        return f"{key}: no plates available"

    # Detail row at 1.5x so construction differences are visible too.
    dw = int(world * 1.5)
    width = bands[0].width
    row = Image.new("RGBA", (width, dw + 40), (28, 34, 48, 255))
    dr = ImageDraw.Draw(row)
    for i, (lab, art) in enumerate(cands):
        cx = int(width * (i + 1) / (len(cands) + 1))
        row.alpha_composite(art.resize((dw, dw), Image.LANCZOS), (cx - dw // 2, 28))
        label(dr, (cx - dw // 2, 6), f"{lab}  ({dw}px)")

    header = 34
    total = header + sum(b.height for b in bands) + row.height
    sheet = Image.new("RGBA", (width, total), (18, 22, 33, 255))
    label(ImageDraw.Draw(sheet), (12, 10),
          f"{key}  ·  {len(cands)} candidates  ·  world={world}px")
    y = header
    for b in bands:
        sheet.paste(b, (0, y)); y += b.height
    sheet.paste(row, (0, y))

    out = paths.store(SHEETS, asset, PREFIXES).with_name(
        paths.rel(asset, PREFIXES).name + "_compare.png")
    sheet.convert("RGB").save(out)
    return f"{key}: -> {out.relative_to(REPO)}"


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

    out = paths.store(SHEETS, asset, PREFIXES)
    sheet.convert("RGB").save(out)
    return f"{key}: -> {out.relative_to(REPO)}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keys", nargs="*")
    ap.add_argument("--venue")
    ap.add_argument("--plates", nargs="*", default=None)
    ap.add_argument("--compare", nargs="*", default=None,
                    help="candidate files for one key, as label:path or path")
    args = ap.parse_args()

    m = json.loads(MANIFEST.read_text())
    PREFIXES.update(paths.venue_prefixes(m["assets"]))
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

    if args.compare and len(sel) != 1:
        sys.exit("--compare takes exactly one asset key")

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
        if args.compare:
            print(build_compare(a, names, args.compare))
        else:
            print(build_sheet(a, m["profiles"], names))


if __name__ == "__main__":
    main()

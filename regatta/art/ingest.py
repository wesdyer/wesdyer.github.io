#!/usr/bin/env python3
"""Validate a generated master and emit the game-ready asset.

    python3 regatta/art/ingest.py bayou-cypress
    python3 regatta/art/ingest.py --all            # everything sitting in inbox/
    python3 regatta/art/ingest.py bayou-cypress --check   # validate only, write nothing

Drop the generated master at regatta/art/inbox/<key>.png. This checks it against
its manifest profile, archives it to masters/, writes the game-ready bake into
assets/images/, records the computed anchor, and flips status to "art".

The anchor is seeded from the alpha bounding-box center. That is right for most
floating props and wrong for anything whose contact point is off-center (a leaning
tree, an L-shaped dock). Check it on the contact sheet — contact.py draws a
crosshair at the anchor — and correct anchorPx in the manifest by hand.
"""
import argparse
import json
import pathlib
import sys

from PIL import Image

import paths

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
MANIFEST = ROOT / "manifest.json"
INBOX = ROOT / "inbox"
MASTERS = ROOT / "masters"


ALL_ASSETS = []          # filled in main(); lets ingest report who uses an element
PREFIXES = {}            # venue -> strippable key prefix, see paths.py


class Fail(Exception):
    pass


def check_master(img, prof, key):
    """Structural checks that are cheap now and expensive after 80 files."""
    notes = []
    m = prof["master"]
    if img.width != img.height:
        raise Fail(f"not square: {img.width}x{img.height}")
    if img.width != m:
        notes.append(f"master is {img.width}px, profile wants {m}px — will resample")

    if prof["background"] == "transparent":
        if img.mode != "RGBA":
            raise Fail(f"needs alpha, got mode {img.mode}")
        alpha = img.getchannel("A")
        lo, hi = alpha.getextrema()
        if hi == 0:
            raise Fail("fully transparent")
        if lo == 255:
            raise Fail("fully opaque — background was not removed")

        # Corners must be clear, or the model painted a backdrop.
        w, h = img.size
        corners = [alpha.getpixel(p) for p in
                   ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3))]
        if max(corners) > 8:
            raise Fail(f"corners not transparent (alpha {corners}) — backdrop present")

        # Threshold before measuring. alpha.getbbox() counts ANY non-zero pixel, and
        # generations routinely leave residue at alpha 1-2 from a removed backdrop —
        # invisible, but it inflated the mark's measured height from 506px to 793px,
        # which then mis-sized fill normalization and mis-seeded the anchor.
        solid = alpha.point(lambda v: 255 if v > 8 else 0)
        bbox = solid.getbbox()
        if bbox is None:
            raise Fail("no pixels above alpha 8 — effectively empty")
        margin = prof.get("safeMargin", 0.0)
        if margin:
            pad = int(min(img.size) * margin)
            if (bbox[0] < pad or bbox[1] < pad
                    or bbox[2] > img.width - pad or bbox[3] > img.height - pad):
                notes.append(
                    f"content reaches within {margin:.0%} of the edge (bbox {bbox}) — "
                    "no room for rotation or a contact shadow"
                )
        # Straight alpha: a dark matte halo shows as mid-alpha pixels that are
        # much darker than their opaque neighbours.
        return bbox, notes

    if img.mode not in ("RGB", "RGBA"):
        raise Fail(f"unexpected mode {img.mode}")
    if img.mode == "RGBA" and img.getchannel("A").getextrema()[0] < 255:
        notes.append("has transparency but profile wants opaque — will flatten")
    return None, notes


def ingest(asset, profiles, check_only=False):
    key = asset["key"]
    prof = profiles[asset["class"]]
    src = INBOX / f"{key}.png"
    if not src.exists():
        raise Fail(f"no master at {src.relative_to(REPO.parent)}")

    img = Image.open(src)
    bbox, notes = check_master(img, prof, key)

    for n in notes:
        print(f"    warn: {n}")

    if check_only:
        print(f"    ok (check only, nothing written)")
        return None

    # Normalize the bbox against the size it was MEASURED at, before any resample.
    # Dividing by the profile master instead silently corrupts the anchor whenever
    # the delivered master is a different size (a 2048px file lands the anchor at 1.0).
    src_w = img.width
    m = prof["master"]
    if img.size != (m, m):
        img = img.resize((m, m), Image.LANCZOS)

    MASTERS.mkdir(exist_ok=True)
    img.save(paths.store(MASTERS, asset, PREFIXES))

    outdir = REPO / prof["out"]
    dest = paths.store(outdir, asset, PREFIXES)
    shown = dest.relative_to(REPO)

    if prof["track"] == "element":
        # No bake and no anchor: compose.py scales the element into the group, and
        # the anchor belongs to the composed sprite, not to its parts.
        #
        # NORMALIZE THE FILL. Elements are interchangeable by design — compose.py
        # scales them all by the same fraction — so a member that happens to sit at
        # 77% of its frame scatters 20% smaller than one at 96%. That difference is
        # an authoring accident, not intent, so it is removed here rather than left
        # for every compose block to compensate for. Species size differences belong
        # in the group's `scale` range, where they are visible and deliberate.
        fill_before = max(bbox[2] - bbox[0], bbox[3] - bbox[1]) / src_w if bbox else 0
        target = prof.get("elementFill", 0.88)
        if bbox:
            k = src_w / m
            crop = img.crop(tuple(int(v / k) for v in bbox))
            f = target * m / max(crop.size)
            crop = crop.resize((max(1, round(crop.width * f)),
                                max(1, round(crop.height * f))), Image.LANCZOS)
            img = Image.new("RGBA", (m, m), (0, 0, 0, 0))
            img.alpha_composite(crop, ((m - crop.width) // 2, (m - crop.height) // 2))
        img.save(dest)
        print(f"    -> {shown}  ({m}px master, unbaked)")
        print(f"    fill normalized {fill_before:.0%} -> {target:.0%}, recentred")
        used = [g["key"] for g in ALL_ASSETS if g.get("compose", {}).get("from") == key]
        print(f"    used by: {', '.join(used) if used else 'NOTHING — no group composes this'}")
    elif prof["track"] == "sprite":
        # Optional fill normalization. A generation that centres a small shape in a big
        # frame makes `world` a lie — the mark came back filling 55% of its master, so
        # world:60 drew a 33px object. fillTo rescales the content to occupy the size it
        # declares.
        #
        # Fitted on the BOUNDING BOX, not the circumscribed circle. Engine rotation goes
        # through ctx.rotate() + drawImage, which transforms the coordinate system rather
        # than sampling a fixed frame, so nothing clips at any angle and padding buys
        # nothing. (The 8% margin the prompts ask for is for BAKED rotation — compose.py
        # rotates with expand=False, where corners genuinely can be lost.)
        if asset.get("fillTo") and bbox:
            k = m / src_w
            box = tuple(int(v * k) for v in bbox)
            crop = img.crop(box)
            f = asset["fillTo"] * m / max(crop.size)
            crop = crop.resize((max(1, round(crop.width * f)), max(1, round(crop.height * f))),
                               Image.LANCZOS)
            img = Image.new("RGBA", (m, m), (0, 0, 0, 0))
            img.alpha_composite(crop, ((m - crop.width) // 2, (m - crop.height) // 2))
            bbox = img.getchannel("A").getbbox(); src_w = m
            fw, fh = (bbox[2] - bbox[0]) / m, (bbox[3] - bbox[1]) / m
            print(f"    fill normalized to {asset['fillTo']:.0%} — content {fw:.0%}x{fh:.0%} "
                  f"of frame, visible at {round(asset['world']*fw)}x{round(asset['world']*fh)}px")
        size = asset["world"] * prof["bake"]
        game = img.resize((size, size), Image.LANCZOS)
        game.save(dest)
        print(f"    -> {shown}  ({size}px bake for {asset['world']}px display)")
        if bbox:
            anchor = [round((bbox[0] + bbox[2]) / 2 / src_w, 4),
                      round((bbox[1] + bbox[3]) / 2 / src_w, 4)]
            if "anchorPx" not in asset:
                asset["anchorPx"] = anchor
                print(f"    anchor seeded at {anchor} (bbox center) — verify on the contact sheet")
            else:
                print(f"    anchor kept at {asset['anchorPx']} (bbox center would be {anchor})")
    else:
        out = img.convert("RGB") if prof["background"] == "opaque" else img
        out.save(dest)
        print(f"    -> {shown}")
        if prof.get("thumb"):
            t = prof["thumb"]
            thumb = dest.parent / "thumbs" / dest.name
            thumb.parent.mkdir(parents=True, exist_ok=True)
            out.resize((t, t), Image.LANCZOS).save(thumb)
            print(f"    -> {thumb.relative_to(REPO)}  ({t}px)")

    asset["status"] = "art"
    return asset


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keys", nargs="*")
    ap.add_argument("--all", action="store_true", help="ingest every master in inbox/")
    ap.add_argument("--check", action="store_true", help="validate only")
    args = ap.parse_args()

    m = json.loads(MANIFEST.read_text())
    ALL_ASSETS[:] = m["assets"]
    PREFIXES.update(paths.venue_prefixes(m["assets"]))
    by_key = {a["key"]: a for a in m["assets"]}

    if args.all:
        INBOX.mkdir(exist_ok=True)
        keys = sorted(p.stem for p in INBOX.glob("*.png"))
        unknown = [k for k in keys if k not in by_key]
        for k in unknown:
            print(f"{k}: skipped — not in manifest (declare the slot first)")
        keys = [k for k in keys if k in by_key]
    else:
        keys = args.keys
        unknown = [k for k in keys if k not in by_key]
        if unknown:
            sys.exit(f"unknown key(s): {', '.join(unknown)}")

    if not keys:
        sys.exit("nothing to ingest (inbox is empty)")

    changed = False
    failed = 0
    for k in keys:
        print(f"{k}:")
        try:
            if ingest(by_key[k], m["profiles"], args.check):
                changed = True
        except Fail as e:
            print(f"    FAIL: {e}")
            failed += 1

    if changed:
        MANIFEST.write_text(json.dumps(m, indent=2) + "\n")
        print("\nmanifest updated")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

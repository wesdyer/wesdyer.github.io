#!/usr/bin/env python3
"""Re-sort a venue's VEGETATION into height order without moving anything else.

    python3 regatta/art/reorder_veg_z.py bay ocean --dry
    python3 regatta/art/reorder_veg_z.py bay ocean

drawProps paints within a plane in DOCUMENT ORDER, so a venue's prop array IS its z-order.
The planters emit in height order, but a venue that has been hand-edited since — or one
planted before the rule existed — can hold vegetation in any order at all.

⚠️ WHY THIS EXISTS RATHER THAN JUST RE-RUNNING THE PLANTER. Re-planting regenerates every
plant from the seed, which is correct for a venue nobody has touched and wrong for one that
has been edited in editor.html: it would silently discard those edits. This does the minimum
instead — it takes the index slots the vegetation ALREADY occupies, sorts the vegetation
props by height x scale, and writes them back into those same slots. Nothing else in the
array moves, so buildings, piers, boats and buoys keep their exact positions in the paint
order relative to everything around them, and no plant changes position, scale or kind.

⚠️ HEIGHT IS NOT CROWN WIDTH and the table below is deliberately hand-written rather than
derived from `world`. A red cedar is a narrow 9 m spire drawn 42u wide; a scrub oak is a
broad 4.5 m thicket drawn 36u wide. Ranking by sprite size would put the scrub oak and the
cedar the wrong way round.
"""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
VENUES = ROOT.parent / "assets" / "venues"
VENUEDOC = ROOT.parent / "js" / "venuedoc.js"

sys.path.insert(0, str(ROOT))
from plant_cove import compact_props            # noqa: E402  (same one-line-per-prop format)

HEIGHT = {
    # Stillwater Lake — matches plant_lake.py SPECIES
    "lake-pine-white": 32.0, "lake-pine-red": 27.0, "lake-aspen-quaking": 19.0,
    "lake-birch-paper": 17.0, "lake-fir-balsam": 15.0, "lake-alder-speckled": 4.0,
    "lake-fern-bracken": 1.2, "lake-blueberry-lowbush": 0.4,
    # Bluewater Bonanza — matches plant_ocean.py SPECIES
    "ocean-palm-coconut": 26.0, "ocean-almond-tropical": 16.0, "ocean-pandanus": 6.0,
    "ocean-naupaka": 2.4, "ocean-grass-coastal": 0.9, "ocean-morning-glory": 0.15,
    # Lighthouse Cove — matches plant_cove.py SPECIES
    "bay-cove-oak-black": 20.0, "bay-cove-pine-pitch": 14.0, "bay-cove-cedar-red": 9.0,
    "bay-cove-oak-scrub": 4.5, "bay-cove-bayberry-northern": 2.5, "bay-cove-plum-beach": 2.0,
    # Glowtide Strait — matches plant_glowtide.py SPECIES. ⚠️ THE FOUR PALMS SHARE ONE HEIGHT
    # and that is correct rather than lazy: they are four drawings of the same tree, and the
    # ladder between them is CROWN WIDTH (world 60-84), which is not what z-order asks about.
    # Within that class the sort still separates them, because the key is height x this
    # individual's scale.
    "ocean-palm-coconut": 26.0, "glowtide-palm": 22.0, "glowtide-palm-dense": 22.0,
    "glowtide-palm-leaning": 22.0, "glowtide-palm-fan": 22.0,
    "glowtide-laurel-amanu": 18.0, "ocean-pandanus": 6.0, "glowtide-hibiscus-sea": 5.0,
    "ocean-naupaka": 2.4, "glowtide-pemphis": 2.0,
}


def planes():
    src = VENUEDOC.read_text(encoding="utf-8")
    return {m.group(1): m.group(2)
            for m in re.finditer(r"'([a-z0-9-]+)':\s*\{[^}]*plane:\s*'([a-z]+)'", src)}


def run(venue, plane_of, dry):
    path = VENUES / f"{venue}.venue.js"
    src = path.read_text(encoding="utf-8")
    prefix = f'window.VENUE_DOC["{venue}"] = '
    if prefix not in src:
        print(f"  {venue}: no document"); return
    i = src.index(prefix)
    start, end = src.index("{", i), src.rindex("}") + 1
    doc = json.loads(src[start:end])
    props = doc.get("props", [])

    # One pass per PLANE: order only matters between props the renderer paints together.
    total_bad = total_moved = 0
    for plane in sorted({plane_of.get(p["kind"], "?") for p in props}):
        slots = [n for n, p in enumerate(props)
                 if plane_of.get(p["kind"]) == plane and p["kind"] in HEIGHT]
        if len(slots) < 2:
            continue
        key = lambda p: HEIGHT[p["kind"]] * p.get("scale", 1)
        cur = [props[n] for n in slots]
        bad = sum(1 for a, b in zip(cur, cur[1:]) if key(b) < key(a) - 1e-9)
        new = sorted(cur, key=key)                      # stable: ties keep their order
        moved = sum(1 for a, b in zip(cur, new) if a is not b)
        for n, p in zip(slots, new):
            props[n] = p
        total_bad += bad
        total_moved += moved
        print(f"  {venue:8s} plane {plane:8s} {len(slots):5d} plants, "
              f"{bad:5d} out of order -> 0, {moved} moved")
    if not total_bad:
        print(f"  {venue}: already in height order, nothing written")
        return
    if dry:
        print(f"  {venue}: (dry run: nothing written)")
        return
    body = compact_props(json.dumps(doc, indent=2, ensure_ascii=False))
    path.write_text(src[:start] + body + src[end:], encoding="utf-8")
    print(f"  -> {path.name}  ({total_moved} plants re-slotted, {path.stat().st_size/1024:.0f} KB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("venues", nargs="+")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()
    plane_of = planes()
    for v in args.venues:
        run(v, plane_of, args.dry)


if __name__ == "__main__":
    main()

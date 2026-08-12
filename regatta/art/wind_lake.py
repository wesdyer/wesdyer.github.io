#!/usr/bin/env python3
"""Re-cut Stillwater Lake's three main wind regions so they TILE the lake instead of stacking.

    python3 regatta/art/wind_lake.py           # rewrite the regions in lake.venue.js
    python3 regatta/art/wind_lake.py --dry     # print what it would write, change nothing

WHAT WAS WRONG. The authored intent was already right and is preserved exactly: a softer,
left-shifted west side (7 kt from 306 deg) against a stronger, right-shifted east side
(9 kt from 334 deg), with a mean day breeze between them (8 kt from 320 deg). That 27.6
degree and 2 knot split IS the venue's question — "which side of the island has the
breeze?" (venues.md 2).

What was broken was purely geometric. All three polygons covered nearly the same water:

    wind-west  bbox  -2457,-1481 .. 1729,2527
    wind-east  bbox  -2362,-1606 .. 2844,2527
    wind-day   bbox  -2457,-1606 .. 2844,2527

regionWindAt AVERAGES overlapping regions, so where all three lay on top of one another
the west's 306 and the east's 334 averaged straight back into the day's 320. Measured over
8,028 samples of sailable water, the west half of the lake read 325.5 deg and the east half
326.0 deg — half a degree apart, with directional spread |R| = 1.000. The whole lake blew
one way. The choice the venue is built around did not exist in the field.

And the same geometry starved the shore. regionWeight ramps across `falloff` CENTRED on the
outline, so a region reads full strength only from falloff/2 = 397u inside its own polygon,
and every one of these stopped at or before the waterline. regionWindAt gives the leftover
weight (1 - wsum) to CALM rather than to a venue breeze, so the rim fell off a cliff:
coverage ran 0.00 to 3.11 (triple-stacked in the middle, nothing at the edges), 11.4% of
sailable water sat under 3 knots and 3.5% was dead.

⚠️ THE `no-wind` CHECK DOES NOT CATCH THIS, which is why it shipped. venuecheck samples the
sailable PATH — the rhumb line between marks — so dead water off the direct route passes.
Lake reports 0 errors with a tenth of its racing area becalmed. Anything that cares about
where the fleet can actually go has to sample the arena, not the path (see eval/_lakewind.js).

HOW IT IS CUT NOW

1. `wind-day` is a rectangle over the whole arena plus 900u — comfortably past falloff/2 —
   so every piece of sailable water sits at full weight and no hole can open at the shore.
   It carries the slow day-scale oscillation (period 460) that both sides ride on.

2. `wind-west` and `wind-east` are that same rectangle CUT ALONG THE BEAT'S RHUMB LINE, from
   the start gate's midpoint to mark-3. That line is the decision: leg 1 bears 319.6 deg into
   a wind from 320 deg, a dead beat, so left and right of it are exactly the two sides a boat
   chooses between. A north-south cut was the obvious alternative and is wrong here — the
   beat crosses x=0 only a quarter of the way up, so ~72% of it would sit in one region and
   the fleet would have no choice to make.

3. Their authored speeds and directions are pushed to TWICE their deviation from the day
   mean, because the day layer blends with them 50/50 and would otherwise halve the split.
   west 6 kt/292 deg and east 10 kt/348 deg blend against day 8 kt/320 deg to give exactly
   the 7/306 and 9/334 the venue was authored for. Along the seam both sides weigh 0.5 and
   cancel to the day mean, which is what the middle of a beat should read.

The two shore lulls are NOT touched. They are the venue's "glass patches" and they are
authored design, not a defect — the difference between a readable lull you can sail out of
and a hole you park in is the whole point of this file.
"""
import argparse
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
DOC = ROOT.parent / "assets" / "venues" / "lake.venue.js"
PREFIX = 'window.VENUE_DOC["lake"] = '

MARGIN = 900.0        # how far past the arena the rectangle runs; falloff/2 is 397
FALLOFF = 793.8       # kept from the authored regions — an ~800u transition across the seam

# The day mean, and the two sides as the water should READ them. The values written to the
# doc are derived from these, not these themselves — see the docstring's point 3.
DAY = dict(speed=8.0, deg=320.0, dirVar=0.30, speedVar=1.0, period=460)
WEST = dict(speed=7.0, deg=306.0, dirVar=0.42, speedVar=2.5, period=95)
EAST = dict(speed=9.0, deg=334.0, dirVar=0.42, speedVar=2.5, period=150)


def clip_halfplane(poly, ax, ay, dx, dy, keep_positive):
    """Sutherland-Hodgman against the line through (ax,ay) with direction (dx,dy)."""
    def side(p):
        return (p[0] - ax) * dy - (p[1] - ay) * dx

    out = []
    n = len(poly)
    for i in range(n):
        cur, prv = poly[i], poly[(i - 1) % n]
        sc, sp = side(cur), side(prv)
        if not keep_positive:
            sc, sp = -sc, -sp
        if sc >= 0:
            if sp < 0:
                t = sp / (sp - sc)
                out.append([prv[0] + (cur[0] - prv[0]) * t, prv[1] + (cur[1] - prv[1]) * t])
            out.append(list(cur))
        elif sp >= 0:
            t = sp / (sp - sc)
            out.append([prv[0] + (cur[0] - prv[0]) * t, prv[1] + (cur[1] - prv[1]) * t])
    return out


def bisect_from(day_deg, want_deg):
    """The direction a side must state so that its 50/50 blend with DAY reads `want_deg`.

    Directions average as UNIT VECTORS in regionWindAt, so the blend of two headings is
    their bisector: state twice the deviation and the water reads the intended one.
    """
    d = (want_deg - day_deg + 540) % 360 - 180
    return (day_deg + 2 * d) % 360


def build(doc):
    b = doc["world"]["boundary"]["poly"]
    x0 = min(p[0] for p in b) - MARGIN
    x1 = max(p[0] for p in b) + MARGIN
    y0 = min(p[1] for p in b) - MARGIN
    y1 = max(p[1] for p in b) + MARGIN
    rect = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

    marks = {m["id"]: m for m in doc["course"]["marks"]}
    line = doc["course"]["lines"][0]["marks"]
    ax = (marks[line[0]]["x"] + marks[line[1]]["x"]) / 2
    ay = (marks[line[0]]["y"] + marks[line[1]]["y"]) / 2
    wm = marks["mark-3"]                       # the windward mark: leg 1 is the beat
    dx, dy = wm["x"] - ax, wm["y"] - ay
    L = math.hypot(dx, dy)
    dx, dy = dx / L, dy / L

    # Which half is which: mark-5, the eastern mark, defines the east side, so the sign is
    # measured rather than reasoned about — the same move surfOutwardSign makes.
    def side(px, py):
        return (px - ax) * dy - (py - ay) * dx
    east_positive = side(marks["mark-5"]["x"], marks["mark-5"]["y"]) > 0

    west_poly = clip_halfplane(rect, ax, ay, dx, dy, not east_positive)
    east_poly = clip_halfplane(rect, ax, ay, dx, dy, east_positive)

    def rad(d):
        return round(math.radians(d % 360), 6)

    def reg(rid, poly, spec, stated_deg, stated_speed):
        return {
            "id": rid,
            "poly": [[round(p[0], 1), round(p[1], 1)] for p in poly],
            "falloff": FALLOFF,
            "direction": rad(stated_deg),
            "dirVar": spec["dirVar"],
            "speed": round(stated_speed, 2),
            "speedVar": spec["speedVar"],
            "period": spec["period"],
        }

    return {
        "wind-day": reg("wind-day", rect, DAY, DAY["deg"], DAY["speed"]),
        "wind-west": reg("wind-west", west_poly, WEST,
                         bisect_from(DAY["deg"], WEST["deg"]),
                         2 * WEST["speed"] - DAY["speed"]),
        "wind-east": reg("wind-east", east_poly, EAST,
                         bisect_from(DAY["deg"], EAST["deg"]),
                         2 * EAST["speed"] - DAY["speed"]),
    }, (ax, ay, dx, dy)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    src = DOC.read_text()
    i = src.index(PREFIX)
    doc = json.loads(src[src.index("{", i):src.rindex("}") + 1])

    fresh, (ax, ay, dx, dy) = build(doc)
    print(f"beat rhumb: ({ax:.0f},{ay:.0f}) -> mark-3, bearing "
          f"{math.degrees(math.atan2(dx, -dy)) % 360:.1f} deg")
    for rid, r in fresh.items():
        print(f"  {rid:11} states {r['speed']:5.1f} kt @ {math.degrees(r['direction']):5.1f} deg"
              f"   {len(r['poly'])} pts")
    print("  -> blended against wind-day the water reads: "
          f"west {WEST['speed']:.0f} kt @ {WEST['deg']:.0f}, "
          f"east {EAST['speed']:.0f} kt @ {EAST['deg']:.0f}, seam {DAY['speed']:.0f} kt @ {DAY['deg']:.0f}")

    kept = [r for r in doc["wind"]["regions"] if r["id"] not in fresh]
    doc["wind"]["regions"] = [fresh["wind-west"], fresh["wind-east"], fresh["wind-day"]] + kept
    print(f"  kept untouched: {[r['id'] for r in kept]}")

    if args.dry:
        print("  (dry run: nothing written)")
        return
    out = src[:src.index("{", i)] + json.dumps(doc, indent=2, ensure_ascii=False) + src[src.rindex("}") + 1:]
    DOC.write_text(out)
    print(f"  -> {DOC.relative_to(ROOT.parent.parent)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Plant Gatorgrass Bayou's trees — cypress, tupelo, oak and cypress knees.

    python3 regatta/art/plant_trees.py            # write into the venue doc
    python3 regatta/art/plant_trees.py --dry      # report only, write nothing
    python3 regatta/art/plant_trees.py --seed 12

Deterministic: same seed, same forest. Re-run it after editing the map and the trees
follow the new terrain instead of being hand-patched.

WHAT THIS IS SOLVING. A swamp scattered with uniform random trees reads as noise, and a
swamp laid out to a real ecology reads as a swamp you cannot race in. The brief is both:
follow the hydrology closely enough that the place feels grown, then bend it wherever the
racing needs to stay legible.

THE THREE RULES THAT DO THE MOST WORK

1. SPECIES FOLLOW THE GROUND, not a global ratio. Oak wants raised dry land — bank, hummock,
   levee, the shack's yard — and never standing water. Cypress wants flooded margin and open
   channel edge. Tupelo wants the dense wet interior. The 17:12:1 population ratio in the
   research is an OUTCOME of those preferences over this particular map, not a quota applied
   on top of them, so it is reported at the end rather than enforced.

2. DENSITY FOLLOWS THE COURSE. Canopy over water is targeted per zone — main channel thin,
   backwater near-closed — and the zone is decided by distance from the racing corridor. This
   is the deliberate departure from ecology: a real bayou does not thin its canopy because a
   start line is nearby. It is also the whole reason the venue stays raceable.

3. TRUNKS ONLY COLLIDE NEAR NAVIGABLE WATER. Every hard-contact prop compiles to a hidden
   collider that also enters the bot's nav grid, and script.js records the river's 82 hidden
   banks causing multi-hundred-ms replan spikes. A forest of 300 colliders is not a thing to
   find out about in a race. Trees the player can actually reach are solid; deep-backwater
   trees are canopy, and carry `contact: none` on the placement.

CLUSTERED, NOT SCATTERED. Trees are placed around cluster seeds with a minority of loners,
because uniform sampling gives an even wash with no openings, and openings are what make a
channel read as a channel. Same lesson compose.py learned about penguins.
"""
import argparse
import json
import math
import pathlib
import random

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent
DOC = ROOT.parent / "assets" / "venues" / "swamp.venue.js"
PREFIX = 'window.VENUE_DOC["swamp"] = '

# ── terrain vocabulary ──────────────────────────────────────────────────────
DRY = ("mud", "swampgrass")          # raised ground: bank, hummock, levee
MARSH = ("marsh",)                    # sward margin — kept mostly treeless
AWASH = ("mudflat", "weedbed", "lilybed", "weedmat", "duckweed")
WEEDY = ("weedbed", "weedmat", "duckweed")   # the dense wet interior tupelo prefers

# ── the four zones, by distance from the racing corridor ────────────────────
# Canopy-over-water targets straight from the research; the ranges there are collapsed to
# their midpoints because the spread is already supplied by clustering.
MAIN_R, SIDE_R = 520.0, 1150.0
TARGET = {"main": 0.15, "side": 0.40, "slough": 0.60, "backwater": 0.82}

# THE RESEARCH'S PERCENTAGES DO NOT SURVIVE THIS MAP'S SCALE, and pretending otherwise is how
# you end up with a venue that cannot be drawn. The figures there describe a real bayou of
# ~10 m trees; this map is a kilometre square holding 49M u^2 of water, so 40% canopy at life
# size is several thousand trees. Scaling crowns to 20-48 m buys back an order of magnitude
# and still lands near a thousand — and every tree is two draw calls (trunk plane, canopy
# plane) plus a cull test, every frame.
#
# So the BUDGET is the fixed quantity and the percentages are the outcome. What is preserved
# is the SHAPE of the research: the relative density between zones, main < side < slough <
# backwater. At 1500 the venue actually reaches the research band anyway — 41.3% overall
# against 35-45%, and 12.4 / 32.6 / 49.0 / 64.2 by zone against 15 / 40 / 60 / 82.
#
# MEASURED COST at this budget, against the same map with no trees (headless, software
# canvas, so the draw figure is pessimistic against a real GPU):
#     update p95   1.90 -> 2.20 ms      <- the one that mattered; see rule 3
#     resetGame      54 -> 89 ms        one-off nav-grid rebuild
#     compile       8.2 -> 12.9 ms
#     draw avg     23.4 -> 32.8 ms
# The collider fear did not materialise: 197 hidden colliders moved the router by 0.3 ms.
# Lower this number first if the venue ever feels heavy — canopy is the cheap thing to give
# up, and the zone ladder holds at any budget because allocation is by progress, not area.
BUDGET = 1500

# A tree may overhang the lane; its TRUNK may not stand in it. 210u keeps the stem clear of
# a beating boat while letting crowns up to 440u across shade the water she sails over —
# which is exactly the 10-20% the research asks for on a main channel.
LANE_CLEAR = 210.0
MARK_CLEAR = 240.0
SHACK_CLEAR = 300.0
COLLIDE_R = 1250.0        # trunks solid within this of the corridor

SPECIES = {
    "cypress": dict(kind="swamp-cypress", world=90,  scale=(1.40, 2.80), old=3.40),
    "tupelo":  dict(kind="swamp-tupelo",  world=70,  scale=(1.35, 2.70), old=None),
    "oak":     dict(kind="swamp-oak",     world=110, scale=(2.00, 4.00), old=None),
}
KNEE = dict(kind="swamp-cypress-knee", world=26, scale=(0.80, 1.80))

CELL = 40.0               # raster resolution for coverage accounting


def poly_mask(poly, X, Y):
    """Even-odd point-in-polygon over a grid, vectorised, bbox-limited."""
    p = np.asarray(poly, dtype=float)
    inside = np.zeros(X.shape, dtype=bool)
    x0, y0, x1, y1 = p[:, 0].min(), p[:, 1].min(), p[:, 0].max(), p[:, 1].max()
    box = (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1)
    if not box.any():
        return inside
    xs, ys = X[box], Y[box]
    acc = np.zeros(xs.shape, dtype=bool)
    n = len(p)
    for i in range(n):
        ax, ay = p[i]
        bx, by = p[(i + 1) % n]
        cond = ((ay > ys) != (by > ys))
        with np.errstate(divide="ignore", invalid="ignore"):
            xint = (bx - ax) * (ys - ay) / np.where(by - ay == 0, np.nan, by - ay) + ax
        acc ^= cond & (xs < xint)
    inside[box] = acc
    return inside


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    L2 = vx * vx + vy * vy
    t = np.clip(((px - ax) * vx + (py - ay) * vy) / max(L2, 1e-9), 0.0, 1.0)
    return np.hypot(px - (ax + t * vx), py - (ay + t * vy))


def build(doc):
    """Raster of the map: habitat, zone, and distance to the corridor."""
    b = np.array(doc["world"]["boundary"]["poly"], dtype=float)
    x0, y0, x1, y1 = b[:, 0].min(), b[:, 1].min(), b[:, 0].max(), b[:, 1].max()
    xs = np.arange(x0, x1, CELL)
    ys = np.arange(y0, y1, CELL)
    X, Y = np.meshgrid(xs, ys)

    inb = poly_mask(b, X, Y)
    kinds = {}
    for k in DRY + MARSH + AWASH:
        m = np.zeros(X.shape, dtype=bool)
        for s in doc["shapes"]:
            if s["kind"] == k:
                m |= poly_mask(s["outer"], X, Y)
        kinds[k] = m

    dry = np.zeros(X.shape, bool)
    for k in DRY:
        dry |= kinds[k]
    marsh = kinds["marsh"]
    weedy = np.zeros(X.shape, bool)
    for k in WEEDY:
        weedy |= kinds[k]
    awash = np.zeros(X.shape, bool)
    for k in AWASH:
        awash |= kinds[k]

    # water = anything inside the limit that is not raised ground or marsh sward
    water = inb & ~dry & ~marsh

    marks = {m["id"]: m for m in doc["course"]["marks"]}
    sf = ((marks["sf-pin"]["x"] + marks["sf-boat"]["x"]) / 2,
          (marks["sf-pin"]["y"] + marks["sf-boat"]["y"]) / 2)
    wg = ((marks["wg-port"]["x"] + marks["wg-stbd"]["x"]) / 2,
          (marks["wg-port"]["y"] + marks["wg-stbd"]["y"]) / 2)
    D = seg_dist(X, Y, sf[0], sf[1], wg[0], wg[1])

    # ZONES ARE NOT JUST DISTANCE BANDS. An earlier pass called everything past the side
    # channel "backwater" and 58% of the map's water fell into the densest bracket, which is
    # both wrong about swamps and fatal to the tree count. A backwater is WEEDY AND REMOTE; a
    # slough is water pinched between banks; open water far from the course is still just a
    # side channel, however far out it lies.
    near_land = np.zeros(X.shape, bool)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        near_land |= np.roll(np.roll(dry, dy * 6, 0), dx * 6, 1)
    zone = np.full(X.shape, "side", dtype=object)
    zone[(D >= SIDE_R) & near_land & ~weedy] = "slough"
    zone[(D >= SIDE_R) & weedy] = "backwater"
    zone[D < SIDE_R] = "side"
    zone[D < MAIN_R] = "main"
    return dict(X=X, Y=Y, inb=inb, dry=dry, marsh=marsh, weedy=weedy, awash=awash,
                water=water, zone=zone, D=D, sf=sf, wg=wg, x0=x0, y0=y0, xs=xs, ys=ys)


def cell_of(g, x, y):
    i = int((y - g["y0"]) / CELL)
    j = int((x - g["x0"]) / CELL)
    if 0 <= i < g["X"].shape[0] and 0 <= j < g["X"].shape[1]:
        return i, j
    return None


def plant(doc, seed=7, dry_run=False):
    rng = random.Random(seed)
    nprng = np.random.RandomState(seed)
    g = build(doc)
    X, Y = g["X"], g["Y"]

    marks = [(m["x"], m["y"]) for m in doc["course"]["marks"]]
    shack = [(p["x"], p["y"]) for p in doc.get("props", []) if p["kind"] == "swamp-shack"]

    # canopy accounting, per zone, over WATER only (the research states it that way)
    covered = np.zeros(X.shape, bool)
    water_cells = {z: int((g["water"] & (g["zone"] == z)).sum()) for z in TARGET}
    need = {z: TARGET[z] * water_cells[z] for z in TARGET}

    props = []
    trees = []

    def ok(x, y, species):
        if seg_dist(np.array(x), np.array(y), *g["sf"], *g["wg"]) < LANE_CLEAR:
            return False
        for mx, my in marks:
            if math.hypot(x - mx, y - my) < MARK_CLEAR:
                return False
        for sx, sy in shack:
            if math.hypot(x - sx, y - sy) < SHACK_CLEAR:
                return False
        c = cell_of(g, x, y)
        if c is None or not g["inb"][c]:
            return False
        if g["marsh"][c]:                       # marsh stays mostly treeless
            return rng.random() < 0.04
        if species == "oak":
            return bool(g["dry"][c])            # oak only on raised ground
        return not g["dry"][c]                  # cypress/tupelo stand in water

    def species_for(x, y):
        c = cell_of(g, x, y)
        if c is None:
            return None
        if g["dry"][c]:
            return "oak" if rng.random() < 0.80 else "cypress"
        if g["weedy"][c]:
            return "tupelo" if rng.random() < 0.62 else "cypress"
        return "cypress" if rng.random() < 0.72 else "tupelo"

    def place(x, y, species):
        spec = SPECIES[species]
        lo, hi = spec["scale"]
        sc = rng.uniform(lo, hi)
        if spec["old"] and rng.random() < 0.06:
            sc = rng.uniform(hi, spec["old"])
        r = spec["world"] * sc / 2.0
        d = float(seg_dist(np.array(x), np.array(y), *g["sf"], *g["wg"]))
        p = {"id": f"tree-{len(trees) + 1}", "kind": spec["kind"],
             "x": round(x, 1), "y": round(y, 1),
             "heading": round(rng.uniform(0, 2 * math.pi), 3),
             "scale": round(sc, 3)}
        if d > COLLIDE_R:
            p["contact"] = "none"               # decoration: keeps the nav grid light
        trees.append((x, y, r, species, d))
        props.append(p)
        # mark the canopy footprint
        i, j = cell_of(g, x, y)
        rad = int(r / CELL) + 1
        i0, i1 = max(0, i - rad), min(X.shape[0], i + rad + 1)
        j0, j1 = max(0, j - rad), min(X.shape[1], j + rad + 1)
        sub = ((X[i0:i1, j0:j1] - x) ** 2 + (Y[i0:i1, j0:j1] - y) ** 2) <= r * r
        covered[i0:i1, j0:j1] |= sub

    # ── how the budget is split ─────────────────────────────────────────────
    # Each zone's share is its water area times its target density, so the RATIO between
    # zones is exactly what the research asks for even though the absolute percentages are
    # not reachable at this map size. Oaks come out of the budget separately: they stand on
    # dry ground, so they contribute almost nothing to canopy-over-water and would distort
    # the split if they competed for the same allocation.
    oak_n = max(6, round(BUDGET / 24))
    w_alloc = BUDGET - oak_n

    # ALLOCATE BY PROGRESS, NOT BY AREA. Splitting the budget up front in proportion to
    # area x target looks right and is not: a tree in a dense zone lands on canopy already
    # placed, so it buys less new coverage than one in a thin zone, and the zones arrive at
    # different fractions of their targets. Measured that way the research's 1 : 2.7 : 4 :
    # 5.5 density ladder came out as 1 : 2.6 : 2.4 : 3.4 — the two densest zones flattened
    # into each other, which is exactly the distinction that makes a backwater feel unlike a
    # side channel. So instead: repeatedly plant in whichever zone is furthest behind ITS OWN
    # target, and the ladder holds whatever the overlap does.
    idx_by_zone = {z: np.argwhere((g["zone"] == z) & g["water"]) for z in TARGET}

    def progress(z):
        w = water_cells[z]
        if not w or not TARGET[z]:
            return 1.0
        have = int((covered & g["water"] & (g["zone"] == z)).sum())
        return (have / w) / TARGET[z]

    guard = 0
    while len(trees) < w_alloc and guard < w_alloc * 80 + 2000:
        guard += 1
        z = min((zz for zz in TARGET if len(idx_by_zone[zz])), key=progress, default=None)
        if z is None:
            break
        idx = idx_by_zone[z]
        i, j = idx[nprng.randint(len(idx))]
        cx, cy = float(X[i, j]), float(Y[i, j])
        # one seed grows a small stand; a fifth stay single trees. Openings matter as much
        # as trees — an even wash of trunks reads as texture, not as forest.
        n = 1 if rng.random() < 0.20 else rng.randint(3, 9)
        spread = rng.uniform(150, 430)
        for _ in range(n):
            if len(trees) >= w_alloc:
                break
            a, rr = rng.uniform(0, 2 * math.pi), spread * math.sqrt(rng.random())
            x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
            sp = species_for(x, y)
            if sp and sp != "oak" and ok(x, y, sp):
                place(x, y, sp)

    # ── oaks on raised ground ───────────────────────────────────────────────
    # Rare but prominent, marking high ground: the research's 1-in-30 by count, which at
    # these crown sizes still reads as the biggest thing in the venue wherever one stands.
    dryidx = np.argwhere(g["dry"] & g["inb"])
    got = 0
    guard = 0
    while got < oak_n and guard < oak_n * 200 + 500 and len(dryidx):
        guard += 1
        i, j = dryidx[nprng.randint(len(dryidx))]
        x, y = float(X[i, j]) + rng.uniform(-60, 60), float(Y[i, j]) + rng.uniform(-60, 60)
        if ok(x, y, "oak"):
            place(x, y, "oak")
            got += 1

    # ── knees: cypress roots, so they follow cypress that stand in reachable water ──
    knees = 0
    for (x, y, r, sp, d) in list(trees):
        if sp != "cypress" or d > COLLIDE_R:
            continue
        if rng.random() > 0.42:
            continue
        for _ in range(rng.randint(1, 3)):
            a, rr = rng.uniform(0, 2 * math.pi), rng.uniform(r * 0.55, r * 1.15)
            kx, ky = x + rr * math.cos(a), y + rr * math.sin(a)
            c = cell_of(g, kx, ky)
            if c is None or not g["inb"][c] or g["dry"][c] or g["marsh"][c]:
                continue
            if float(seg_dist(np.array(kx), np.array(ky), *g["sf"], *g["wg"])) < LANE_CLEAR:
                continue
            knees += 1
            props.append({"id": f"knee-{knees}", "kind": KNEE["kind"],
                          "x": round(kx, 1), "y": round(ky, 1),
                          "heading": round(rng.uniform(0, 2 * math.pi), 3),
                          "scale": round(rng.uniform(*KNEE["scale"]), 3)})

    # ── report ──────────────────────────────────────────────────────────────
    counts = {}
    for (_, _, _, sp, _) in trees:
        counts[sp] = counts.get(sp, 0) + 1
    solid = sum(1 for p in props if p.get("contact") != "none")
    print(f"seed {seed}: {len(trees)} trees + {knees} knees = {len(props)} props")
    print("  species  " + "  ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    if counts.get("oak"):
        print(f"  ratio    {counts.get('cypress',0)/counts['oak']:.0f} cypress : "
              f"{counts.get('tupelo',0)/counts['oak']:.0f} tupelo : 1 oak   (research 17:12:1)")
    print("  canopy over water, by zone (target in brackets):")
    for z in ("main", "side", "slough", "backwater"):
        w = water_cells[z]
        have = int((covered & g["water"] & (g["zone"] == z)).sum())
        print(f"    {z:10} {100*have/max(1,w):5.1f}%  [{100*TARGET[z]:.0f}%]   water {w*CELL*CELL/1e6:5.2f}M u^2")
    tot_w = int(g["water"].sum())
    tot_c = int((covered & g["water"]).sum())
    print(f"    {'OVERALL':10} {100*tot_c/max(1,tot_w):5.1f}%  [35-45%]")
    print(f"  colliders {solid} of {len(props)} props   (Pearl Lagoon ships 37)")

    if dry_run:
        print("  (dry run: nothing written)")
        return None
    return props


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    src = DOC.read_text()
    i = src.index(PREFIX)
    body = src[src.index("{", i):src.rindex("}") + 1]
    doc = json.loads(body)

    keep = [p for p in doc.get("props", []) if not p["id"].startswith(("tree-", "knee-"))]
    new = plant(doc, args.seed, args.dry)
    if new is None:
        return
    doc["props"] = keep + new
    out = src[:src.index("{", i)] + json.dumps(doc, indent=2, ensure_ascii=False) + src[src.rindex("}") + 1:]
    DOC.write_text(out)
    print(f"  -> {DOC.relative_to(ROOT.parent.parent)}  ({len(keep)} kept, {len(new)} planted)")


if __name__ == "__main__":
    main()

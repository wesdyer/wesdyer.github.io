#!/usr/bin/env python3
"""Plant Glowtide Strait — tamanu, palms, pandanus, pemphis, sea hibiscus, naupaka, coconut.

    python3 regatta/art/plant_glowtide.py            # write into the venue doc
    python3 regatta/art/plant_glowtide.py --dry      # report only, write nothing
    python3 regatta/art/plant_glowtide.py --seed 12
    python3 regatta/art/plant_glowtide.py --calibrate

Deterministic: same seed, same islands. Re-run after editing the map and the vegetation
follows the new coastline instead of being hand-patched.

WHAT THIS IS SOLVING. The brief is Palau: two enormous jungle landmasses west and east, and
a chain of bare limestone islets threading the strait between them. The failure mode the
guidance names is sprinkling all seven species evenly everywhere — so this is built to make
BANDS AND CLUSTERS instead: dense jungle-dominant interiors, sculptural near-bare karst, and
pocket beaches that stay mostly sand.

THE FIVE RULES THAT DO THE MOST WORK

1. TERRAIN PICKS THE CAST, DISTANCE-FROM-WATER PICKS THE BALANCE. Each substrate (jungle
   floor, exposed karst, sand) has its own composition straight from the brief, and the
   shoreline-distance bands then shift it — pandanus, pemphis and naupaka crowd the water's
   edge, tamanu takes over 3+ canopy diameters inland.

2. THE ISLETS ARE A HARD GATE, NOT A TENDENCY. "Some tiny rocks should have no vegetation
   whatsoever" cannot be a coverage target, because a target is a thing you aim at and a
   bare rock is a thing you decide. Under ISLET_M2 an island gets a plant BUDGET drawn from
   a distribution that includes zero, whatever the weights would otherwise pay for.

3. ONLY THE LAND THE CAMERA CAN REACH IS PLANTED. Measured on this map: about 60% of the
   land lies within a screen's reach of the arena and the rest is backdrop nobody ever sees.
   Density holds full to VIS_FULL beyond the boundary and tapers to zero at VIS_FADE — the
   taper is what stops it ending on a visible line, which a hard cut does.

4. Z-ORDER IS REAL HEIGHT x SCALE, and every kind here is on `surface` so ONE sort covers
   them all. See the sort at the end of plant(), and the PROP_KINDS note on why this venue
   registers its own palms rather than reusing Pearl Lagoon's canopy-planed ones.

5. THE JUNGLE IS NOT UNIFORM. The brief asks for roughly 60% dense / 25% medium / 15% gap,
   so a low-frequency noise field modulates density across the forest floor. Without it a
   coverage target produces one even carpet, which is the thing the brief warns against.

⚠️ THE BEACH OVERLAY IS DELIBERATE. Three of the five tropicsand shapes are drawn BEFORE
their landmass's karst and jungle, so those caps paint over most of each beach and only a
fragment reads as sand — 22.4k m2 of a 111.5k m2 total. That is the owner's intent (asked
and confirmed 2026-08-25), not a document-order bug: what survives is a pocket beach. So
this plants the sand that IS sand after the overlay, and the beach species are scarce
because the beaches are small, not because the brief was ignored.

DELIBERATE OVERSIZE. Crowns are planted at EXAGGERATE x their true diameter, the same trade
plant_ocean.py and plant_cove.py make, and the owner asked for it explicitly: linear
oversize buys back the square of itself, so 2.6x is 6.8x fewer props than life size for the
same coverage. Every RELATIONSHIP the art was measured against survives — the size ladder
holds and each species keeps its own small/medium/large spread. Sharpness is not the limit:
every bake is 4x its world size, so even the largest specimen is still drawn downsampled.
"""
import argparse
import json
import math
import pathlib
import random
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from plant_cove import compact_props, edt, poly_mask            # noqa: E402

DOC = ROOT.parent / "assets" / "venues" / "glowtide.venue.js"
PREFIX = 'window.VENUE_DOC["glowtide"] = '

PX_PER_M = 9.2                 # art/manifest.json scale.pxPerMetre
CELL = 20.0                    # raster resolution: 2.17 m
EXAGGERATE = 2.6

X0, Y0, X1, Y1 = -7600, -5600, 6800, 8800

VIS_FULL = 1000.0              # full density this far beyond the arena...
VIS_FADE = 2800.0              # ...tapering to nothing here. Rule 3.

WATER, KARST, SAND, JUNGLE = 0, 1, 2, 3
LANDK = {"karst": KARST, "tropicsand": SAND, "jungle": JUNGLE}
TNAME = {KARST: "karst", SAND: "sand", JUNGLE: "jungle"}

# ── the seven species ───────────────────────────────────────────────────────
# `bands` is TRUE canopy diameter in metres as (small, medium, large) with the weight given
# to each; EXAGGERATE is applied on top. `height` is real HEIGHT in metres — a different
# question from width, used for one thing only: z-order.
# `kinds` lets one species draw from several sprites; the palms use four so a grove never
# repeats one silhouette, which is the brief's "avoid evenly spaced palm forests".
SPECIES = {
    "tamanu": dict(
        kinds=[("glowtide-laurel-amanu", 1.0)], world=120, height=18.0,
        bands=[((9.0, 11.5), 0.28), ((11.5, 14.0), 0.46), ((14.0, 17.0), 0.26)],
        cluster=(4, 12), spread=(140, 420), layer="tree"),
    "palm": dict(
        # ⚠️ THE LEANING VARIANT WAS DROPPED 2026-08-26 at the owner's call, and its 0.22 is
        # redistributed across the other three rather than left to renormalise silently.
        # Three silhouettes still clears the brief's "avoid evenly spaced palm forests".
        kinds=[("glowtide-palm", 0.44), ("glowtide-palm-dense", 0.36),
               ("glowtide-palm-fan", 0.20)],
        world=74, height=22.0,
        bands=[((5.5, 6.8), 0.28), ((6.8, 8.2), 0.46), ((8.2, 9.8), 0.26)],
        cluster=(2, 6), spread=(120, 340), layer="tree"),
    "coconut": dict(
        kinds=[("ocean-palm-coconut", 1.0)], world=70, height=26.0,
        bands=[((6.0, 7.2), 0.28), ((7.2, 8.6), 0.46), ((8.6, 10.2), 0.26)],
        cluster=(2, 5), spread=(90, 240), layer="tree"),
    "pandanus": dict(
        kinds=[("ocean-pandanus", 1.0)], world=52, height=6.0,
        bands=[((4.0, 5.0), 0.30), ((5.0, 6.4), 0.45), ((6.4, 8.0), 0.25)],
        cluster=(1, 4), spread=(80, 300), layer="tree"),
    # THE UNDERSTOREY — all three stay under the tree crowns so the brief's
    # beach -> scrub -> canopy sequence survives planting.
    "hibiscus": dict(
        kinds=[("glowtide-hibiscus-sea", 1.0)], world=78, height=5.0,
        bands=[((6.5, 8.0), 0.30), ((8.0, 9.6), 0.45), ((9.6, 11.5), 0.25)],
        cluster=(3, 8), spread=(90, 260), layer="shrub"),
    "naupaka": dict(
        kinds=[("ocean-naupaka", 1.0)], world=40, height=2.4,
        bands=[((3.2, 4.0), 0.30), ((4.0, 5.0), 0.45), ((5.0, 6.2), 0.25)],
        cluster=(4, 12), spread=(80, 240), layer="shrub"),
    "pemphis": dict(
        kinds=[("glowtide-pemphis", 1.0)], world=26, height=2.0,
        bands=[((2.2, 2.8), 0.32), ((2.8, 3.6), 0.44), ((3.6, 4.6), 0.24)],
        cluster=(3, 10), spread=(70, 220), layer="shrub"),
}
KIND_SP = {k: s for s, v in SPECIES.items() for k, _ in v["kinds"]}
REUSED_OCEAN = {"ocean-palm-coconut", "ocean-pandanus", "ocean-naupaka"}

# ── the brief's composition, per substrate ──────────────────────────────────
MIX = {
    JUNGLE: {"tamanu": .40, "palm": .25, "pandanus": .15, "hibiscus": .12,
             "pemphis": .05, "coconut": .02, "naupaka": .01},
    KARST:  {"pemphis": .45, "pandanus": .30, "tamanu": .10, "palm": .08,
             "hibiscus": .05},
    SAND:   {"naupaka": .35, "pandanus": .25, "coconut": .20, "hibiscus": .15,
             "palm": .05},
}

# Apparent vegetation coverage as a fraction of each substrate: the brief's bands are
# jungle 70-85%, karst 15-30%, sand 10-25%. These aim mid-band.
COVER = {JUNGLE: 0.78, KARST: 0.22, SAND: 0.17}
# ...of which this much is TREE canopy. The brief asks 55-70% canopy on the forest floor.
CANOPY = {JUNGLE: 0.62, KARST: 0.10, SAND: 0.06}

# ⚠️ SPILL IS ONE-WAY, AND THAT ASYMMETRY IS THE WHOLE TRICK. A stand scatters members up
# to `spread` from its seed, so any cluster near a substrate boundary throws plants across
# it. On this map the karst is a thin rim around the jungle cap and the beaches sit inside
# it, so BOTH small substrates are almost entirely within a forest stand's reach — and the
# jungle is 89% of the land, so its spill swamps them. Measured both ways round:
#   jungle spilling freely -> the beach reaches its 10-25% band on forest alone and plants
#   ZERO of its own, so naupaka and coconut never appear at all;
#   small substrates first -> they fill, then jungle spill pushes the rock to 40% and the
#   sand to 42%, over their bands, with no pass able to take it back.
# So the JUNGLE does not spill outward at all, while karst and sand spill INTO it generously.
# The boundary still interpenetrates — pandanus and pemphis push up into the treeline — and
# each small substrate still gets exactly the planting its brief asks for.
SPILL = {JUNGLE: 0.0, KARST: 0.30, SAND: 0.30}

# ⚠️ THE ISLET GATE — rule 2.
ISLET_M2 = 2600.0
ISLET_BUDGET = [0, 0, 1, 1, 2, 3, 5, 8]      # ~25% of islets stay bare

# The distance-from-water rule, in canopy diameters of the largest tree.
CANOPY_DIA = 13.0 * PX_PER_M * EXAGGERATE     # ~311u
NEAR, MID = 1.0 * CANOPY_DIA, 3.0 * CANOPY_DIA

# Multipliers on a species' weight per shoreline band, from the brief's own table.
BAND_BIAS = {
    #            0-1 dia   1-3 dia   3+ dia
    "pandanus": (2.20,     1.30,     0.35),
    "pemphis":  (2.40,     0.80,     0.25),
    "naupaka":  (2.60,     0.70,     0.15),
    "hibiscus": (1.35,     1.25,     0.60),
    "tamanu":   (0.35,     1.15,     1.70),
    "palm":     (0.55,     1.25,     1.10),
    "coconut":  (1.40,     0.90,     0.35),
}

# ── SPECIES GAINS ───────────────────────────────────────────────────────────
# One constant per species multiplying its weight everywhere. MIX says what each substrate
# grows and BAND_BIAS says where; the gain absorbs the fact that this map is 89% jungle by
# area, so a species the karst table favours would otherwise barely appear. `--calibrate`
# solves them against the brief's cross-map share.
SHARE = {"tamanu": .275, "palm": .175, "pandanus": .165, "pemphis": .135,
         "hibiscus": .11, "naupaka": .10, "coconut": .065}
#   solved 2026-08-25, seed 7, 7 rounds, max share error 6.9%
# ⚠️ THE SPREAD IS ENORMOUS — coconut 1.0 against hibiscus 0.009 — and that is this map
# talking, not a bug. The jungle is 89% of the land and hibiscus's field peaks over all of
# it, so left raw it took 24% of every plant against a brief of 11%; coconut is beach-obligate
# and the visible beach is 3% of the land, so it needs everything the solver can give it and
# still lands short. A gain cannot smuggle a species somewhere it does not belong — every
# field has hard zeros (naupaka and coconut are absent from the karst mix, tamanu and pemphis
# from the sand mix) and zero times anything is still zero. What a gain moves is only which
# species wins where several are already plausible.
GAIN = {"tamanu": 0.0800, "palm": 0.1330, "coconut": 1.0000, "pandanus": 0.2264,
        "hibiscus": 0.0058, "naupaka": 0.0900, "pemphis": 0.0160}

# ⚠️ THE SHARES LAND WITHIN A FEW POINTS AND NOT ON THE NOSE, and the brief says that is the
# right answer — "those percentages are composition guidance, not literal area coverage". The
# system is also genuinely coupled rather than a set of independent dials: the understorey is
# seeded into CANOPY GAPS, so raising a tree gain closes gaps and changes what every shrub
# does. Hand-tuning from the solved point was tried in both directions and made the total
# error worse each time (31.2 -> 29.5 -> 33.2 summed absolute), including moves that pushed a
# species the opposite way from the dial. The COVERAGE targets, which the brief does state as
# hard bands, all land inside them; the composition is close and non-monotonic, and chasing it
# further would be tuning noise.


def load():
    src = DOC.read_text()
    i = src.index(PREFIX)
    return src, json.loads(src[src.index("{", i):src.rindex("}") + 1])


def value_noise2(shape, cells, rng):
    """Smooth low-frequency field in 0..1 — the jungle's dense/medium/gap rhythm."""
    h, w = shape
    gh, gw = max(2, h // cells), max(2, w // cells)
    g = rng.random((gh, gw))
    ys = np.linspace(0, gh - 1, h)
    xs = np.linspace(0, gw - 1, w)
    y0 = np.clip(ys.astype(int), 0, gh - 2); x0 = np.clip(xs.astype(int), 0, gw - 2)
    fy = (ys - y0)[:, None]; fx = (xs - x0)[None, :]
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x0 + 1)]
    c = g[np.ix_(y0 + 1, x0)]; d = g[np.ix_(y0 + 1, x0 + 1)]
    return (a * (1 - fx) * (1 - fy) + b * fx * (1 - fy)
            + c * (1 - fx) * fy + d * fx * fy)


def geometry(doc, seed, quiet=False):
    xs = np.arange(X0, X1, CELL)
    ys = np.arange(Y0, Y1, CELL)
    X, Y = np.meshgrid(xs, ys)

    # TERRAIN IN DOCUMENT ORDER. The runtime paints shapes in the order the doc lists them,
    # so what is visible at a point is the LAST shape covering it, not a kind priority. This
    # venue relies on it, and the beach overlay in the module docstring is that rule in use.
    terr = np.zeros(X.shape, np.uint8)
    for s in doc["shapes"]:
        if s["kind"] in LANDK:
            terr[poly_mask(s["outer"], X, Y)] = LANDK[s["kind"]]

    land = terr > 0
    d_coast = edt(~land, CELL)

    comp = np.zeros(X.shape, np.int32)
    n = 0
    for si, sj in np.argwhere(land):
        if comp[si, sj]:
            continue
        n += 1
        stack = [(si, sj)]
        comp[si, sj] = n
        while stack:
            a, b = stack.pop()
            for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                p, q = a + da, b + db
                if 0 <= p < comp.shape[0] and 0 <= q < comp.shape[1] \
                        and land[p, q] and not comp[p, q]:
                    comp[p, q] = n
                    stack.append((p, q))
    cell_m2 = (CELL / PX_PER_M) ** 2
    area = np.zeros(X.shape, np.float64)
    for c in range(1, n + 1):
        m = comp == c
        area[m] = m.sum() * cell_m2

    inside = poly_mask(doc["world"]["boundary"]["poly"], X, Y)
    vis = np.clip((VIS_FADE - edt(inside, CELL)) / (VIS_FADE - VIS_FULL), 0.0, 1.0)

    # Rule 5: the forest's own rhythm. Centred on 1.0 so it redistributes rather than
    # dilutes — the coverage loop still hits its target, just unevenly, which is the point.
    rng = np.random.default_rng(seed + 991)
    rough = value_noise2(X.shape, int(900 / CELL), rng)
    density = np.clip(0.40 + 1.30 * rough, 0.0, 1.6).astype(np.float32)

    if not quiet:
        vl = (land * vis).sum() * cell_m2
        print(f"  raster {X.shape[1]}x{X.shape[0]} @ {CELL:.0f}u   land "
              f"{land.sum() * cell_m2 / 1e6:.3f} km2 in {n} masses   "
              f"visible {vl / 1e6:.3f} km2 ({100 * vl / max(land.sum() * cell_m2, 1):.1f}%)")
        for code in (JUNGLE, KARST, SAND):
            a = (terr == code).sum() * cell_m2
            av = ((terr == code) * vis).sum() * cell_m2
            print(f"    {TNAME[code]:7s} {a:8.0f} m2   visible {av:8.0f} m2 "
                  f"({100 * av / max(a, 1):3.0f}%)")
    return dict(X=X, Y=Y, terr=terr, land=land, d_coast=d_coast.astype(np.float32),
                comp=comp, area=area.astype(np.float32), vis=vis.astype(np.float32),
                density=density, ncomp=n, cell_m2=cell_m2)


def weights(g):
    """Per-species placement weight on every land cell: substrate x shoreline band x gain."""
    terr, d = g["terr"], g["d_coast"]
    band = np.zeros(terr.shape, np.uint8)
    band[d > NEAR] = 1
    band[d > MID] = 2
    W = {}
    for sp in SPECIES:
        w = np.zeros(terr.shape, np.float32)
        for code in (JUNGLE, KARST, SAND):
            base = MIX[code].get(sp, 0.0)
            if base <= 0:
                continue
            m = terr == code
            bb = BAND_BIAS[sp]
            for bi in (0, 1, 2):
                w[m & (band == bi)] = base * bb[bi]
        W[sp] = w * GAIN[sp] * g["vis"]
    return W, band


def _pick_kind(sp, rng):
    ks = SPECIES[sp]["kinds"]
    return rng.choices([k for k, _ in ks], weights=[w for _, w in ks])[0]


def _pick_diam(sp, rng):
    """A true crown diameter in metres, from the species' small/medium/large bands."""
    bands = SPECIES[sp]["bands"]
    (lo, hi), _w = rng.choices(bands, weights=[w for _, w in bands])[0]
    return rng.uniform(lo, hi)


def plant(doc, seed=7, quiet=False):
    rng = random.Random(seed)
    nprng = np.random.RandomState(seed)
    g = geometry(doc, seed, quiet)
    W, band = weights(g)
    X, Y, terr, comp = g["X"], g["Y"], g["terr"], g["comp"]
    vis, dens, area = g["vis"], g["density"], g["area"]
    cell_m2 = g["cell_m2"]

    H, Wd = terr.shape
    cov_tree = np.zeros(terr.shape, bool)
    cov_shrub = np.zeros(terr.shape, bool)
    cov_sp = {s: np.zeros(terr.shape, bool) for s in SPECIES}
    # ⚠️ EACH SUBSTRATE ALSO ACCOUNTS FOR ITSELF. A crown is up to 308px across, so a tamanu
    # standing at the forest edge covers a great deal of beach without one plant being ON the
    # beach — measured, the sand read 27% apparent coverage with ZERO plants of its own, so
    # its loop opened already over target and naupaka and coconut never placed. The brief's
    # per-terrain percentages are about what GROWS there, and overhang from the treeline is a
    # separate thing it explicitly allows ("tamanu can occasionally loom over a beach from the
    # forest edge"). So each pass drives its OWN raster to its own target, and the overhang
    # is reported alongside rather than counted against it.
    own_t = {c: np.zeros(terr.shape, bool) for c in (JUNGLE, KARST, SAND)}
    own_s = {c: np.zeros(terr.shape, bool) for c in (JUNGLE, KARST, SAND)}
    props, placed = [], []

    def stamp(cov, cx, cy, r):
        i0 = max(0, int((cy - r - Y0) / CELL)); i1 = min(H, int((cy + r - Y0) / CELL) + 1)
        j0 = max(0, int((cx - r - X0) / CELL)); j1 = min(Wd, int((cx + r - X0) / CELL) + 1)
        if i1 <= i0 or j1 <= j0:
            return
        sub = ((X[i0:i1, j0:j1] - cx) ** 2 + (Y[i0:i1, j0:j1] - cy) ** 2) <= r * r
        cov[i0:i1, j0:j1] |= sub

    def try_place(cx, cy, sp, home=None, spill=0.06, own=None):
        i, j = int((cy - Y0) / CELL), int((cx - X0) / CELL)
        if not (0 <= i < H and 0 <= j < Wd) or not g["land"][i, j]:
            return False
        # ⚠️ SPILL CONTROL. A stand scatters its members up to `spread` from the seed, so
        # every cluster near a substrate boundary throws plants across it. Unchecked that is
        # not a rounding error: with the jungle sown last its spill drove the karst to 40.7%
        # and the beach to 45.5% against briefs of 15-30% and 10-25%, because those targets
        # had already been met and closed. Letting a QUARTER of border members cross keeps
        # the ragged, interpenetrating edge that makes a treeline look real, while the other
        # three quarters turn back so the arithmetic still means something.
        if home is not None and terr[i, j] != home and rng.random() > spill:
            return False
        # Rule 3: the visibility taper is a probability, so the edge feathers out.
        if rng.random() > vis[i, j]:
            return False
        if W[sp][i, j] <= 0:
            return False
        diam_m = _pick_diam(sp, rng)
        world_d = diam_m * PX_PER_M * EXAGGERATE
        sc = world_d / SPECIES[sp]["world"]
        kind = _pick_kind(sp, rng)
        rec = {"id": "veg", "kind": kind,
               "x": round(cx, 1), "y": round(cy, 1),
               "heading": round(rng.uniform(0, 2 * math.pi), 3),
               "scale": round(sc, 3)}
        # ⚠️ THE VEGETATION PAINTS OVER THE BOATS, so every plant is on `canopy`. The six
        # glowtide-only kinds carry that in PROP_KINDS; the three REUSED ocean kinds cannot,
        # because Bluewater Bonanza plants them 5,476 times and their row is shared. compile
        # takes a placement's own `plane` over the kind's, so those get it written per prop
        # here — the venue overrides its own copies and the ocean is untouched.
        if kind in REUSED_OCEAN:
            rec["plane"] = "canopy"
        props.append(rec)
        placed.append((cx, cy, world_d, sp))
        r = world_d * 0.5
        tree = SPECIES[sp]["layer"] == "tree"
        stamp(cov_tree if tree else cov_shrub, cx, cy, r)
        stamp(cov_sp[sp], cx, cy, r)
        if own is not None:
            stamp((own_t if tree else own_s)[own], cx, cy, r)
        return True

    def sow(cells, sp, n_clusters, stop=None, home=None, spill=0.25):
        """Scatter n_clusters stands of `sp`, seeded on cells weighted by its own field.

        `stop` is checked PER MEMBER, not per stand. Without it the smallest substrates
        overshoot by a whole cluster every time: one naupaka stand is up to twelve crowns and
        the visible sand is only 22k m2, so a single stand is a fifth of the beach.
        """
        if not len(cells) or n_clusters <= 0:
            return
        wts = np.array([W[sp][i, j] * dens[i, j] for i, j in cells], np.float64)
        if wts.sum() <= 1e-12:
            return
        wts /= wts.sum()
        pick = nprng.choice(len(cells), size=int(n_clusters), p=wts)
        lo, hi = SPECIES[sp]["cluster"]
        s0, s1 = SPECIES[sp]["spread"]
        for k in pick:
            i, j = cells[k]
            cx, cy = float(X[i, j]), float(Y[i, j])
            spread = rng.uniform(s0, s1)
            for _ in range(rng.randint(lo, hi)):
                if stop is not None and stop():
                    return
                a = rng.uniform(0, 2 * math.pi)
                rr = spread * math.sqrt(rng.random())
                try_place(cx + rr * math.cos(a), cy + rr * math.sin(a), sp, home=home, spill=spill, own=home)

    # ── per landmass ────────────────────────────────────────────────────────
    isl_area = {c: float(area[comp == c][0]) for c in range(1, g["ncomp"] + 1)}
    for c in sorted(isl_area, key=lambda k: -isl_area[k]):
        m = comp == c
        if not (m & (vis > 0.02)).any():
            continue                                   # rule 3: never seen, never planted
        cells = np.argwhere(m)

        # RULE 2: a tiny rock gets a budget, not a target, and the budget can be zero.
        if isl_area[c] < ISLET_M2:
            budget = rng.choice(ISLET_BUDGET)
            if budget == 0:
                continue
            pool = [s for s in SPECIES if any(W[s][i, j] > 0 for i, j in cells[:80])]
            if not pool:
                continue
            for _ in range(budget):
                i, j = cells[nprng.randint(len(cells))]
                wts = [float(W[s][i, j]) for s in pool]
                if sum(wts) <= 1e-9:
                    continue
                sp = rng.choices(pool, weights=wts)[0]
                try_place(float(X[i, j]), float(Y[i, j]), sp)
            continue

        # A real landmass: drive each substrate to its own coverage target.
        # ⚠️ THE BIG SUBSTRATE FIRST, THE SMALL ONES TOPPING UP — and this order was
        # arrived at the hard way, in both directions. Every pass measures the union over its
        # OWN substrate, so a loop that opens already over target simply does not run.
        #   Small-first fails: the beach fills to 17%, then jungle spill pushes it to 41%
        #   with nothing able to take it back, and coconut never places a plant because the
        #   sand canopy target was already met by forest before its loop opened.
        #   Big-first works: the jungle spills what it spills, then karst and sand see the
        #   real number and add only the shortfall. The rim is the case that forces it —
        #   karst here is a thin band around the jungle cap, so almost every karst cell sits
        #   within a stand's spread of the forest.
        for code in (JUNGLE, KARST, SAND):
            sub = m & (terr == code) & (vis > 0.02)
            n = int(sub.sum())
            if n < 4:
                continue
            sub_cells = np.argwhere(sub)
            # ⚠️ THE SHRUB PASS TARGETS THE UNION, NOT ITS OWN LAYER, and that is the
            # brief's own definition: "apparent vegetation coverage ... includes overlapping
            # tree canopy plus shrubs". Measured against cov_shrub alone the pass hits its
            # number while the picture does not move at all, because most shrubs land UNDER
            # canopy that is already counted — jungle stalled at 66.5% union against a brief
            # of 70-85% while reporting its shrub layer complete. Targeting the union makes
            # the pass keep going until it has actually filled gaps.
            for layer in ("tree", "shrub"):
                if layer == "tree":
                    target = CANOPY[code]
                    hit = lambda: (own_t[code] & sub).sum() / n >= CANOPY[code]
                else:
                    target = COVER[code]
                    hit = lambda: ((own_t[code] | own_s[code]) & sub).sum() / n >= COVER[code]
                pool = [s for s in SPECIES
                        if SPECIES[s]["layer"] == layer and MIX[code].get(s, 0) > 0]
                if not pool or target <= 0:
                    continue
                guard = 0
                while not hit() and guard < 1400:
                    guard += 1
                    # ⚠️ THE UNDERSTOREY IS SEEDED INTO GAPS, NOT ANYWHERE. Seeded at random
                    # over the whole substrate, most shrubs land UNDER canopy that is already
                    # counted, so they cost a prop and move the union not at all — measured,
                    # driving the jungle to 78% that way took 6104 plants and left hibiscus
                    # and pemphis at 45% and 27% of the whole map against briefs of 11% and
                    # 13.5%. Seeding on open cells is both far cheaper and the brief's own
                    # ecology: understorey grows in "openings between larger trees".
                    if layer == "shrub":
                        seed_cells = np.argwhere(sub & ~(own_t[code] | own_s[code]))
                        if not len(seed_cells):
                            break
                    else:
                        seed_cells = sub_cells
                    step = max(1, len(seed_cells) // 4000)
                    wts = [sum(float(W[s][i, j]) for i, j in seed_cells[::step]) for s in pool]
                    if sum(wts) <= 1e-9:
                        break
                    sp = rng.choices(pool, weights=wts)[0]
                    sow(seed_cells, sp, max(1, n // 3000), stop=hit, home=code, spill=SPILL[code])

    # ── Z-ORDER FOLLOWS HEIGHT — rule 4 ─────────────────────────────────────
    # drawProps paints within a plane in DOCUMENT ORDER, so the order of this array IS the
    # z-order. Planted in placement order it is effectively random, which puts a knee-high
    # pemphis over the crown of a 26 m coconut palm about a third of the times they overlap.
    # From directly above that is simply wrong: the tallest thing is nearest the camera.
    #
    # REAL HEIGHT x this individual's scale, not crown width, and the distinction matters
    # twice: across species it ranks the tamanu (18 m) under the palm (22 m) even though the
    # tamanu's crown is half again as wide, and within a species it puts a big specimen over
    # a small one, which is what gives a grove depth instead of a flat pattern.
    props.sort(key=lambda pr: SPECIES[KIND_SP[pr["kind"]]]["height"] * pr["scale"])
    for n, pr in enumerate(props, 1):
        pr["id"] = f"veg-{n}"

    st = measure(g, props, placed, cov_tree, cov_shrub, cov_sp, own_t, own_s)
    if not quiet:
        report(st, seed)
    return props, st


def measure(g, props, placed, cov_tree, cov_shrub, cov_sp, own_t, own_s):
    terr, vis, cell_m2 = g["terr"], g["vis"], g["cell_m2"]
    seen = vis > 0.02
    out = {"n": len(props), "by_sp": {}, "by_terr": {}}
    tot = len(placed) or 1
    for s in SPECIES:
        out["by_sp"][s] = sum(1 for p in placed if p[3] == s) / tot
    for code in (JUNGLE, KARST, SAND):
        m = (terr == code) & seen
        n = int(m.sum()) or 1
        out["by_terr"][code] = dict(
            area=n * cell_m2,
            cover=float(((own_t[code] | own_s[code]) & m).sum()) / n,
            canopy=float((own_t[code] & m).sum()) / n,
            apparent=float(((cov_tree | cov_shrub) & m).sum()) / n,
            n=sum(1 for p in placed
                  if terr[int((p[1] - Y0) / CELL), int((p[0] - X0) / CELL)] == code))
    out["scale"] = dict(
        lo=min(p["scale"] for p in props) if props else 0,
        hi=max(p["scale"] for p in props) if props else 0)
    out["px"] = {s: (SPECIES[s]["world"] * np.mean([p["scale"] for p in props
                 if KIND_SP[p["kind"]] == s]) if any(KIND_SP[p["kind"]] == s for p in props)
                 else 0) for s in SPECIES}
    return out


def report(st, seed):
    print(f"\n  {st['n']} plants, seed {seed}")
    print(f"  {'species':10s} {'share':>7s} {'brief':>9s} {'drawn px':>9s}")
    for s in sorted(SPECIES, key=lambda k: -st["by_sp"][k]):
        tgt = SHARE[s]
        flag = "" if abs(st["by_sp"][s] - tgt) < 0.04 else "  <--"
        print(f"  {s:10s} {100*st['by_sp'][s]:6.1f}% {100*tgt:8.1f}% {st['px'][s]:9.0f}{flag}")
    print(f"\n  {'terrain':8s} {'visible m2':>11s} {'plants':>7s} {'grown':>7s} {'brief':>11s} "
          f"{'canopy':>7s} {'brief':>11s} {'+overhang':>10s}")
    BR = {JUNGLE: ("70-85%", "55-70%"), KARST: ("15-30%", "-"), SAND: ("10-25%", "-")}
    for code in (JUNGLE, KARST, SAND):
        d = st["by_terr"][code]
        print(f"  {TNAME[code]:8s} {d['area']:11.0f} {d['n']:7d} {100*d['cover']:6.1f}% "
              f"{BR[code][0]:>11s} {100*d['canopy']:6.1f}% {BR[code][1]:>11s} "
              f"{100*d['apparent']:9.1f}%")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--calibrate", action="store_true")
    a = ap.parse_args()
    src, doc = load()
    if a.calibrate:
        calibrate(doc, a.seed)
        return
    props, st = plant(doc, a.seed)
    if a.dry:
        print("\n  --dry: nothing written")
        return
    keep = [p for p in (doc.get("props") or []) if not p["id"].startswith("veg-")]
    doc["props"] = keep + props
    i = src.index(PREFIX)
    body = compact_props(json.dumps(doc, indent=2, ensure_ascii=False))
    DOC.write_text(src[:src.index("{", i)] + body + src[src.rindex("}") + 1:])
    print(f"\n  wrote {len(props)} plants (kept {len(keep)} non-vegetation props) -> "
          f"{DOC.relative_to(ROOT.parent.parent)}")


def calibrate(doc, seed, rounds=7):
    """Solve GAIN so the cross-map species split lands on the brief's SHARE."""
    global GAIN
    for r in range(rounds):
        _, st = plant(doc, seed, quiet=True)
        err = 0.0
        for s in SPECIES:
            got = max(st["by_sp"][s], 1e-4)
            adj = (SHARE[s] / got) ** 0.55
            GAIN[s] = float(np.clip(GAIN[s] * adj, 1e-3, 1e3))
            err = max(err, abs(got - SHARE[s]))
        m = max(GAIN.values())
        for s in GAIN:
            GAIN[s] /= m
        print(f"  round {r+1}: max share error {100*err:.1f}%")
    print("\nGAIN = {" + ", ".join(f'"{s}": {GAIN[s]:.4f}' for s in SPECIES) + "}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Plant Stillwater Lake — white pine, quaking aspen, paper birch, balsam fir, and the
shrub layer of speckled alder, bracken fern and lowbush blueberry.

    python3 regatta/art/plant_lake.py            # write into the venue doc
    python3 regatta/art/plant_lake.py --dry      # report only, write nothing
    python3 regatta/art/plant_lake.py --seed 12
    python3 regatta/art/plant_lake.py --calibrate

Deterministic: same seed, same wood. Re-run it after editing the map and the vegetation
follows the new shoreline instead of being hand-patched.

WHAT THIS IS SOLVING. The brief is a northern lake read: forest running right down to the
water on most of the shore, granite points and islets where it does not, a few sandy
camp pockets, and damp coves behind. The failure mode is an even wash of mixed trees over
every piece of land, which reads as wallpaper — so everything here is organised by SHORE
TYPE first and distance inland second.

⚠️ THIS IS NOT THE OCEAN'S MODEL WITH DIFFERENT SPECIES, and the difference is the whole
design. plant_ocean.py hangs its ecology on EXPOSURE — how much open sea and how much
upwind fetch a piece of ground faces — because offshore that is the axis that decides
everything. A lake has no fetch worth the name and no windward side worth exaggerating.
What decides a lake shore is SHELTER AND DRAINAGE, so the field this one is built on is
ENCLOSURE: how much land surrounds a point. High enclosure is the back of a cove — still,
damp, alder. Low enclosure is a headland or an islet — drained, rocky, pine. Same shape of
computation as the ocean's openness kernel, opposite sign, and it means something else.

THE FOUR RULES THAT DO THE MOST WORK

1. SHORE TYPE IS A ZONE, NOT A TENDENCY. Sandy camp shore, rocky point, damp cove and
   ordinary wooded shore each get their own canopy target, and the brief states them as
   fractions of SHORELINE LENGTH — so the report measures shoreline, not area, and says
   what the map actually delivers against 55-65 / 20-25 / 10-15 / 5-10.

2. SPECIES FOLLOW SHELTER AND SUBSTRATE. Pine takes the drained points and thin soil over
   rock, aspen fills the interior in colonies, birch works the EDGES — shore margin, beach
   rim, the seam between wood and clearing — and fir hides in the shaded back. The brief's
   35-45 / 25-35 / 15-20 / 10-15 split is an OUTCOME of those preferences over this
   particular lake, not a quota; see GAIN.

3. THE BEACH STAYS CLEAR. Sand gets a 10% canopy target and the trees are pulled back:
   the brief is explicit that a swim beach is an opening framed by trees, not a wooded
   shore with sand under it.

4. NOTHING HERE COLLIDES. All seven kinds are `surface` / `contact: none`, so there is no
   nav-grid cost to trade against and coverage can be spent on the picture alone.

DELIBERATE OVERSIZE. Crowns are planted at EXAGGERATE x their true diameter, the trade
plant_cove.py and plant_ocean.py both make: linear oversize buys back the square of
itself, so 1.8x is 3.24x fewer props than life size for the same canopy. Every relationship
the art was measured against survives — the ladder holds (pine > aspen > birch > fir >
alder > bracken > blueberry) and each species keeps its own size spread.

RED PINE LANDED 2026-08-15 and took its share out of white pine's rather than adding to it.
The two pines are the venue's one real ecological pair: white pine on the drained points and
thin soil over granite, red pine further back on the dry sandy ground where white pine will
not go. See suitability() for the two terms that keep them from being the same tree twice.
"""
import argparse
import json
import math
import pathlib
import random

import numpy as np

from plant_cove import compact_props, edt, poly_mask, value_noise

ROOT = pathlib.Path(__file__).resolve().parent
DOC = ROOT.parent / "assets" / "venues" / "lake.venue.js"
PREFIX = 'window.VENUE_DOC["lake"] = '

PX_PER_M = 9.2
CELL = 10.0
EXAGGERATE = 1.8

VIS_FULL = 700.0               # full density this far beyond the arena...
VIS_FADE = 1800.0              # ...tapering to nothing here

WATER, FOREST, SAND, ROCK, LILY = 0, 1, 2, 3, 4
LANDK = {"forestfloor": FOREST, "lakesand": SAND, "gneiss": ROCK, "lilybed": LILY}

# ── the seven species ───────────────────────────────────────────────────────
# `bands` is true canopy diameter in metres; EXAGGERATE is applied on top. `height` is the
# plant's real HEIGHT and is used for ONE thing: z-order. See the sort at the end of plant().
SPECIES = {
    "pine": dict(
        kind="lake-pine-white", world=110, height=32.0,
        bands=[((9, 11), 0.25), ((11, 13), 0.50), ((13, 16), 0.25)],
        cluster=(2, 7), spread=(180, 480), layer="tree"),
    "redpine": dict(
        kind="lake-pine-red", world=88, height=27.0,
        bands=[((8, 9.5), 0.28), ((9.5, 11), 0.47), ((11, 13), 0.25)],
        cluster=(4, 12), spread=(160, 420), layer="tree"),
    "aspen": dict(
        kind="lake-aspen-quaking", world=68, height=19.0,
        bands=[((6, 7.2), 0.30), ((7.2, 8.6), 0.45), ((8.6, 10), 0.25)],
        cluster=(5, 16), spread=(150, 380), layer="tree"),
    "birch": dict(
        kind="lake-birch-paper", world=80, height=17.0,
        bands=[((7, 8.2), 0.30), ((8.2, 9.6), 0.45), ((9.6, 11), 0.25)],
        cluster=(2, 4), spread=(90, 240), layer="tree"),
    "fir": dict(
        kind="lake-fir-balsam", world=55, height=15.0,
        bands=[((4.6, 5.6), 0.30), ((5.6, 6.8), 0.45), ((6.8, 8), 0.25)],
        cluster=(3, 9), spread=(100, 260), layer="tree"),
    "alder": dict(
        kind="lake-alder-speckled", world=48, height=4.0,
        bands=[((4.2, 5.0), 0.30), ((5.0, 6.0), 0.45), ((6.0, 7.2), 0.25)],
        cluster=(3, 8), spread=(90, 260), layer="shrub"),
    "bracken": dict(
        kind="lake-fern-bracken", world=34, height=1.2,
        bands=[((3.0, 3.6), 0.35), ((3.6, 4.4), 0.45), ((4.4, 5.2), 0.20)],
        cluster=(4, 14), spread=(110, 320), layer="shrub"),
    "blueberry": dict(
        kind="lake-blueberry-lowbush", world=22, height=0.4,
        bands=[((2.0, 2.5), 0.35), ((2.5, 3.2), 0.45), ((3.2, 4.0), 0.20)],
        cluster=(4, 14), spread=(80, 240), layer="shrub"),
}
KIND_SP = {v["kind"]: k for k, v in SPECIES.items()}

# ── the five zones ──────────────────────────────────────────────────────────
# A-D are SHORE zones, in the brief's own vocabulary; E is everything inland of them.
ZONES = ["A", "B", "C", "D", "E"]
ZCODE = {z: i + 1 for i, z in enumerate(ZONES)}
TARGET = {                       # (tree canopy, shrub cover) as a fraction of the zone
    "A": (0.68, 0.22),           # wooded natural shore     — brief: 60-80% canopy
    "B": (0.12, 0.18),           # rocky point / granite    — owner 2026-08-15: 5-20%
    "C": (0.04, 0.08),           # sandy camp / beach       — owner 2026-08-15: 0-10%
    "D": (0.58, 0.34),           # damp cove / inlet        — wooded, heavy shrub
    "E": (0.72, 0.20),           # interior woodland
}
# ⚠️ B AND C WERE CUT ON 2026-08-15 AND THE REASON IS THE SHAPES, NOT THE BRIEF. The original
# 20-40% for granite came from a brief written when rock was expected to be the occasional
# point. The venue as actually drawn carries 18 gneiss shapes and 11 sand shapes, so B and C
# between them are HALF THE SHORELINE — 24.6% and 24.8% against a 20-25% and 10-15% brief. A
# canopy target tuned for an occasional outcrop, applied to half the coast, is a different
# picture entirely. The owner's call is that bare rock and bare sand are the point: granite
# 5-20%, sand 0-10%. Shrub is left near where it was — blueberry and bracken on a granite
# outcrop is exactly right and costs the rock none of its bareness.
SHORE_BAND = 200.0               # how far inland the shore zones reach
COVE = 0.50                      # enclosure above this is a damp cove

# The brief's canopy split, and the shrub emphasis. GAIN is solved against these.
# ⚠️ THE PINE SHARE IS SPLIT, NOT ADDED TO. The brief's 35-45% pine is a statement about how
# much of this wood is pine, so red pine takes its share OUT of white pine's rather than
# arriving on top of it: 0.22 + 0.18 is the same 0.40 the file has always solved against, and
# aspen, birch and fir are untouched. Red pine gets the slightly smaller half because white
# pine is the bigger tree and still the structural one.
SHARE_TREE = {"pine": 0.22, "redpine": 0.18, "aspen": 0.30, "birch": 0.175, "fir": 0.125}
SHARE_SHRUB = {"alder": 0.18, "bracken": 0.42, "blueberry": 0.40}

# ── SPECIES GAINS ───────────────────────────────────────────────────────────
# One constant per species, multiplying its suitability everywhere. The fields say WHERE
# each species prefers to be and are written to read as ecology; the gain says how much of
# the map it ends up being, which depends on the shape of THIS lake. `--calibrate` solves
# them. A gain cannot smuggle a species somewhere it does not belong — every field has hard
# zeros — it only moves which one wins where several are already plausible.
# ⚠️ ALDER IS PINNED AT 1.0 AND THAT IS THE SOLVER TELLING YOU SOMETHING. The gains are
# normalised so the largest is 1, and alder sits there because even at full weight its field
# cannot reach the 18% share asked of it: it is the sharpest function in the file (a 150u
# exponential off the water, inside an enclosure gate) and there simply is not that much
# damp sheltered shoreline on this lake. That is the honest answer rather than a miss — the
# brief itself says alder should "feel specific, not ubiquitous" and caps it at 10-15% of
# SHORELINE length, which it meets. The 18% figure is a share of shrub INSTANCES, and the
# two are not the same quantity. Do not loosen the field to chase it; that would put alder
# on dry shore, which is the one thing its slot forbids.
#   solved 2026-08-15, seed 7, 8 rounds, max share error 16.3% (all of it alder)
# Re-solved 2026-08-15 after B and C were cut and EXAGGERATE dropped to 1.8. Both moves
# change WHERE plants land, and the gains are what convert a suitability field into the
# brief's species split, so they cannot survive a target change unexamined.
GAIN = {"pine": 0.0985, "redpine": 0.5664, "aspen": 0.018, "birch": 0.0896, "fir": 0.0122,
        "alder": 1.0, "bracken": 0.0209, "blueberry": 0.0313}


def _fft_disc(radius_cells):
    r = int(radius_cells)
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    d = np.hypot(xx, yy)
    k = (d <= r).astype(np.float64) * np.exp(-d / (r * 0.6))
    return k / k.sum()


def _convolve(field, kernel):
    fs = np.array(field.shape) + np.array(kernel.shape) - 1
    fs = 1 << np.ceil(np.log2(fs)).astype(int)
    F = np.fft.rfft2(field, fs) * np.fft.rfft2(kernel, fs)
    out = np.fft.irfft2(F, fs)
    ky, kx = np.array(kernel.shape) // 2
    return out[ky:ky + field.shape[0], kx:kx + field.shape[1]]


def geometry(doc, quiet=False):
    xs, ys = [], []
    for s in doc["shapes"]:
        for p in s["outer"]:
            xs.append(p[0]); ys.append(p[1])
    X0, X1 = min(xs) - 400, max(xs) + 400
    Y0, Y1 = min(ys) - 400, max(ys) + 400
    gx = np.arange(X0, X1, CELL)
    gy = np.arange(Y0, Y1, CELL)
    X, Y = np.meshgrid(gx, gy)

    # TERRAIN IN DOCUMENT ORDER — the runtime paints shapes in the order the doc lists them,
    # so what is visible at a point is the LAST shape covering it. This venue relies on it
    # completely: its four sand shapes are drawn BEFORE the mainland and survive only where
    # the mainland's keyhole leaves them uncovered, which is what makes the beaches.
    terr = np.zeros(X.shape, np.uint8)
    for s in doc["shapes"]:
        m = poly_mask(s["outer"], X, Y)
        for h in (s.get("holes") or []):
            m &= ~poly_mask(h, X, Y)
        terr[m] = LANDK[s["kind"]]

    land = (terr > 0) & (terr != LILY)
    water = ~land
    d_water = edt(water, CELL)
    d_sand = edt(terr == SAND, CELL) if (terr == SAND).any() else np.full(X.shape, 1e5)
    d_rock = edt(terr == ROCK, CELL) if (terr == ROCK).any() else np.full(X.shape, 1e5)

    # ENCLOSURE: how much LAND surrounds a point inside ~700u. This is the lake's answer to
    # the ocean's exposure and it is the inverse question — high here means the back of a
    # cove (still, damp, shaded), low means a headland or an islet (drained, windy, rocky).
    R = int(700 / CELL)
    enc = np.clip(_convolve(land.astype(np.float64), _fft_disc(R)), 0, 1)
    lo, hi = np.percentile(enc[land], 5), np.percentile(enc[land], 95)
    enclosure = np.clip((enc - lo) / max(1e-6, hi - lo), 0, 1)

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
                if 0 <= p < comp.shape[0] and 0 <= q < comp.shape[1] and land[p, q] and not comp[p, q]:
                    comp[p, q] = n
                    stack.append((p, q))
    cell_m2 = (CELL / PX_PER_M) ** 2
    area = np.zeros(X.shape)
    for c in range(1, n + 1):
        m = comp == c
        area[m] = m.sum() * cell_m2

    inside = poly_mask(doc["world"]["boundary"]["poly"], X, Y)
    d_out = edt(inside, CELL)
    vis = np.clip((VIS_FADE - d_out) / (VIS_FADE - VIS_FULL), 0.0, 1.0)

    if not quiet:
        print(f"  raster {X.shape[1]}x{X.shape[0]} @ {CELL:.0f}u   land "
              f"{land.sum() * cell_m2 / 1e6:.3f} km2 in {n} masses")
    return dict(X=X, Y=Y, X0=X0, Y0=Y0, terr=terr, land=land, water=water,
                d_water=d_water.astype(np.float32), d_sand=d_sand.astype(np.float32),
                d_rock=d_rock.astype(np.float32), enclosure=enclosure.astype(np.float32),
                comp=comp, area=area.astype(np.float32), vis=vis.astype(np.float32),
                ncomp=n, cell_m2=cell_m2)


def zones_of(g):
    """The brief's four shore zones, plus the interior.

    Most-general first and overwritten by the more specific, so the order IS the precedence:
    a sandy camp shore is Zone C even if it sits in a cove, and a granite point is Zone B
    even if it is sheltered.
    """
    terr, land = g["terr"], g["land"]
    d_water, d_sand, d_rock, enc = g["d_water"], g["d_sand"], g["d_rock"], g["enclosure"]
    z = np.zeros(terr.shape, np.uint8)
    z[land] = ZCODE["E"]                                             # interior woodland
    shore = land & (d_water < SHORE_BAND)
    z[shore] = ZCODE["A"]                                            # ordinary wooded shore
    z[shore & (enc > COVE)] = ZCODE["D"]                             # damp cove behind it
    z[land & ((terr == ROCK) | ((d_rock < 70) & (d_water < SHORE_BAND)))] = ZCODE["B"]
    z[land & ((terr == SAND) | ((d_sand < 40) & (d_water < 90)))] = ZCODE["C"]
    return z


def build(doc, seed, quiet=False):
    rng = np.random.default_rng(seed)
    g = geometry(doc, quiet)
    g["zone"] = zones_of(g)
    # Clearings sized against the VIEWPORT, not the map — plant_ocean's hard-won lesson. The
    # camera shows 1400x900, so an opening wider than that stops being an opening and becomes
    # emptiness. ~1100 units here.
    g["dens"] = value_noise(g["X"].shape, rng, max(6, int(g["X"].shape[1] * CELL / 1100)))
    g["light"] = value_noise(g["X"].shape, rng, max(4, int(g["X"].shape[1] * CELL / 1900)))
    return g


def suitability(g):
    """Per-cell weight for each species. Continuous, so nothing bands."""
    terr, land = g["terr"], g["land"]
    d_water, d_sand, d_rock = g["d_water"], g["d_sand"], g["d_rock"]
    enc, area, light = g["enclosure"], g["area"], g["light"]
    forest, sand, rock = terr == FOREST, terr == SAND, terr == ROCK
    W = {}

    # WHITE PINE — the structural tree. Drained ground: points, headlands, islets and thin
    # soil over granite. The brief wants it widely spaced, sometimes standing alone as a hero
    # tree, and NOT across open beach or thick in wet coves.
    w = np.exp(-np.maximum(enc - 0.30, 0) / 0.34)          # dislikes enclosure = dislikes coves
    w *= np.where(rock, 1.45, 1.0)
    w *= np.where(sand, 0.03, 1.0)
    w *= 0.55 + 0.45 * np.clip(d_water / 500.0, 0, 1)      # a little back from the water
    W["pine"] = w * land

    # RED PINE — the DRY-SITE pine, and the counterpart to white pine rather than a second
    # copy of it. Red pine takes the poorest, most drained ground on a Minnesota lake: sandy
    # and gravelly outwash, rock ridges, the backs of points — and it takes it in nearly pure
    # even-aged stands, which is why its cluster count is high and its spread wide.
    # ⚠️ TWO THINGS SEPARATE ITS FIELD FROM WHITE PINE'S, and without them this is just a
    # recolour. It stands FURTHER BACK from the water, and IT DOES NOT REFUSE SAND — white
    # pine multiplies sand by 0.03, this leaves it near 1 — so the thin ground behind a beach
    # is exactly where the two species part company and the eye can see them do it.
    w = np.exp(-np.maximum(enc - 0.22, 0) / 0.28)
    w *= np.where(rock, 1.30, 1.0)
    w *= np.where(sand, 0.85, 1.0)
    w *= np.clip((d_water - 120) / 520.0, 0, 1) ** 0.5
    w *= 0.40 + 0.60 * light                                # the open dry stands, not deep shade
    W["redpine"] = w * land

    # QUAKING ASPEN — the interior fill, in colonies. Behind the shoreline, in regrowth and
    # clearing edges. Not on bare rock, not on the wet margin.
    w = np.clip((d_water - 80) / 600.0, 0, 1) ** 0.6
    w *= np.where(rock, 0.12, 1.0) * np.where(sand, 0.06, 1.0)
    w *= 0.5 + 0.5 * light                                  # likes the lit regrowth patches
    W["aspen"] = w * land

    # PAPER BIRCH — the EDGE tree, and edge is what its field is made of. It peaks on the
    # shore margin, around beaches, and at the seam where woodland meets open rock.
    edge = np.exp(-d_water / 220.0)                         # the waterline itself
    edge = np.maximum(edge, 0.85 * np.exp(-d_sand / 260.0))  # beach rims
    edge = np.maximum(edge, 0.60 * np.exp(-d_rock / 200.0))  # outcrop seams
    w = 0.12 + 0.88 * edge
    w *= np.where(sand, 0.30, 1.0)
    W["birch"] = w * land

    # BALSAM FIR — the shaded back. Sheltered, enclosed, inland, and specifically NOT on the
    # exposed tips or the beaches.
    w = np.clip(enc / 0.7, 0, 1) ** 1.2
    w *= np.clip((d_water - 60) / 400.0, 0, 1) ** 0.5
    w *= (1.0 - 0.75 * light)                               # the dark side of the wood
    w *= np.where(rock, 0.15, 1.0) * np.where(sand, 0.02, 1.0)
    W["fir"] = w * land

    # SPECKLED ALDER — damp coves only, in thickets along the water. This is the sharpest
    # field in the file, and deliberately: the brief says it must feel specific rather than
    # ubiquitous, so everything outside a sheltered shoreline band is a hard fade.
    w = np.exp(-d_water / 150.0)                            # right at the water
    w *= np.clip((enc - 0.28) / 0.5, 0, 1) ** 1.2           # and only where it is enclosed
    w *= np.where(rock, 0.02, 1.0) * np.where(sand, 0.06, 1.0)
    W["alder"] = w * land

    # BRACKEN FERN — sunny woodland openings on forest floor, and behind clearings. Not at
    # the water's edge, not in the alder coves, not in deep fir shade.
    w = 0.25 + 0.75 * light
    w *= np.clip((d_water - 70) / 260.0, 0, 1)
    w *= np.where(rock, 0.20, 1.0) * np.where(sand, 0.10, 1.0)
    w *= 1.0 - 0.6 * np.clip((enc - 0.55) / 0.45, 0, 1)     # backs off in the damp
    W["bracken"] = w * land

    # LOWBUSH BLUEBERRY — thin acid soil: under open pine, around granite, on the rocky
    # islands. Not in the wet coves, not on the beach, not in deep shade.
    w = 0.30 + 0.70 * np.exp(-d_rock / 320.0)
    w *= np.where(rock, 1.30, 1.0) * np.where(sand, 0.25, 1.0)
    w *= 1.0 - 0.7 * np.clip((enc - 0.55) / 0.45, 0, 1)
    w *= 0.45 + 0.55 * light
    W["blueberry"] = w * land

    for k in W:
        W[k] = np.clip(W[k], 0, None).astype(np.float32)
    return W


# ── planting ────────────────────────────────────────────────────────────────
def plant(doc, seed=7, quiet=False):
    rng = random.Random(seed)
    nprng = np.random.RandomState(seed & 0x7FFFFFFF)
    g = build(doc, seed, quiet)
    X, Y, land, zone = g["X"], g["Y"], g["land"], g["zone"]
    X0, Y0 = g["X0"], g["Y0"]
    NY, NX = X.shape
    W = suitability(g)
    comp, ncomp, vis, cell_m2 = g["comp"], g["ncomp"], g["vis"], g["cell_m2"]

    cov_tree = np.zeros(X.shape, bool)
    cov_shrub = np.zeros(X.shape, bool)
    cov_sp = {s: np.zeros(X.shape, bool) for s in SPECIES}

    plantable = land & (vis > 0)
    zcells = {z: int(((zone == ZCODE[z]) & plantable).sum()) for z in ZONES}
    zidx = {z: np.argwhere((zone == ZCODE[z]) & plantable) for z in ZONES}
    covn = {(z, ly): 0 for z in ZONES for ly in ("tree", "shrub")}

    def progress(z, layer):
        n = zcells[z]
        tgt = TARGET[z][0 if layer == "tree" else 1]
        if not n or not tgt:
            return 1.0
        return (covn[(z, layer)] / n) / tgt

    props, placed = [], []

    def cell_of(x, y):
        i, j = int((y - Y0) / CELL), int((x - X0) / CELL)
        return (i, j) if 0 <= i < NY and 0 <= j < NX else None

    def stamp(cov, x, y, r, layer):
        i, j = cell_of(x, y)
        rad = int(r / CELL) + 1
        i0, i1 = max(0, i - rad), min(NY, i + rad + 1)
        j0, j1 = max(0, j - rad), min(NX, j + rad + 1)
        disc = ((X[i0:i1, j0:j1] - x) ** 2 + (Y[i0:i1, j0:j1] - y) ** 2) <= r * r
        sub = cov[i0:i1, j0:j1]
        fresh = disc & ~sub
        if layer is not None and fresh.any():
            keep = fresh & plantable[i0:i1, j0:j1]
            zs = zone[i0:i1, j0:j1][keep]
            for z in ZONES:
                n = int((zs == ZCODE[z]).sum())
                if n:
                    covn[(z, layer)] += n
        sub |= disc

    def size_for(sp):
        spec = SPECIES[sp]
        r, acc = rng.random(), 0.0
        lo, hi = spec["bands"][-1][0]
        for (a, b), wgt in spec["bands"]:
            acc += wgt
            if r <= acc:
                lo, hi = a, b
                break
        return rng.uniform(lo, hi) * EXAGGERATE * PX_PER_M / spec["world"]

    def place(x, y, sp):
        spec = SPECIES[sp]
        sc = size_for(sp)
        r = spec["world"] * sc / 2.0
        props.append({"id": f"veg-{len(props) + 1}", "kind": spec["kind"],
                      "x": round(x, 1), "y": round(y, 1),
                      "heading": round(rng.uniform(0, 2 * math.pi), 3),
                      "scale": round(sc, 3)})
        placed.append((x, y, r, sp))
        lay = spec["layer"]
        stamp(cov_tree if lay == "tree" else cov_shrub, x, y, r, lay)
        stamp(cov_sp[sp], x, y, r, None)

    def try_place(x, y, sp, zone_cap=True):
        c = cell_of(x, y)
        if c is None or not land[c]:
            return
        if vis[c] <= 0 or (vis[c] < 1.0 and rng.random() > vis[c]):
            return
        if W[sp][c] < 0.05:
            return
        lay = SPECIES[sp]["layer"]
        zc = zone[c]
        if zone_cap and zc and progress(ZONES[zc - 1], lay) >= 1.0:
            return
        place(x, y, sp)

    jobs = [(z, ly) for z in ZONES for ly in ("tree", "shrub")
            if zcells[z] and TARGET[z][{"tree": 0, "shrub": 1}[ly]]]
    guard, GMAX = 0, 600000
    while guard < GMAX:
        guard += 1
        z, layer = min(jobs, key=lambda j: progress(*j))
        if progress(z, layer) >= 1.0:
            break
        idx = zidx[z]
        i, j = idx[nprng.randint(len(idx))]
        if g["dens"][i, j] < 0.32:          # deliberate open ground, a veto not a multiplier
            continue
        pool = [s for s in SPECIES if SPECIES[s]["layer"] == layer]
        wts = [float(W[s][i, j]) * GAIN[s] for s in pool]
        if sum(wts) <= 1e-9:
            continue
        sp = rng.choices(pool, weights=wts)[0]
        cx, cy = float(X[i, j]), float(Y[i, j])
        spec = SPECIES[sp]
        lo, hi = spec["cluster"]
        n = 1 if rng.random() < 0.16 else rng.randint(lo, hi)
        spread = rng.uniform(*spec["spread"])
        for _ in range(n):
            a = rng.uniform(0, 2 * math.pi)
            rr = spread * math.sqrt(rng.random())
            try_place(cx + rr * math.cos(a), cy + rr * math.sin(a), sp)

    # ── NOBODY LEFT BEHIND ──────────────────────────────────────────────────
    # The pass above balances ZONES across the whole map, which is blind to whether any one
    # island got its share. Every island big enough to read is checked against its own zone
    # mix and topped up; the zone cap is off here because by this point every zone is at
    # target by construction and leaving it on would refuse every placement (plant_ocean's
    # motu spent 6000 tries placing nothing before that was found).
    # ⚠️ THE ISLANDS WERE UNDER-WOODED AND THE FIX IS THE FLOOR, NOT THE TARGET. Measured
    # 2026-08-15 against five aerial photographs of real Minnesota lakes: the islands finished
    # at 41-54% canopy while the mainland sat at 78%, where every photograph shows a small
    # island as the DENSEST thing in the frame.
    # The first attempt at this handed every island TARGET["A"] outright, on the reasoning
    # that a hundred-metre island is inside SHORE_BAND all the way through and so never gets
    # an interior zone to be wooded by. That is true, and the fix was still wrong: it forces
    # 68% canopy onto islands that are largely GNEISS, which plants trees all over the bare
    # granite the owner wants kept bare. The zone weighting is the thing that knows a rock
    # island from a wooded one, so it stays.
    # What was actually wrong is that the floor stopped each island at 80% of its own target
    # and called that done — a 0.68 wooded island was allowed to finish at 0.54. Raising the
    # floor woods the forest-floor islands without touching the rock.
    ISLAND_FLOOR = 0.95
    for c in range(1, ncomp + 1):
        m = (comp == c) & plantable
        n = int(m.sum())
        # ⚠️ THE MAINLAND IS NOT RESCUED, and skipping it is what keeps the beaches clear.
        # This pass exists for islands the global allocator's luck missed, and it runs with
        # the zone cap OFF — so letting it loose on the 0.47 km2 mainland means it ignores
        # Zone C's 7% canopy target and floods every beach with the trees the brief asks to
        # be pulled back. Measured: with the mainland included, Zone C came out at 37%
        # canopy against a 0-15% brief. A landmass this big gets enough attention from the
        # main pass by construction.
        if n * cell_m2 < 400 or n * cell_m2 > 40000:
            continue
        cells = np.argwhere(m)
        want = {ly: sum(TARGET[z][k] * ((zone[m] == ZCODE[z]).sum()) for z in ZONES) / n
                for k, ly in ((0, "tree"), (1, "shrub"))}
        for layer in ("tree", "shrub"):
            cov = cov_tree if layer == "tree" else cov_shrub
            pool = [s for s in SPECIES if SPECIES[s]["layer"] == layer]
            tries = 0
            while (cov & m).sum() / n < want[layer] * ISLAND_FLOOR and tries < 6000:
                tries += 1
                i, j = cells[nprng.randint(len(cells))]
                wts = [float(W[s][i, j]) * GAIN[s] for s in pool]
                if sum(wts) <= 1e-9:
                    continue
                sp = rng.choices(pool, weights=wts)[0]
                cx, cy = float(X[i, j]), float(Y[i, j])
                spread = rng.uniform(*SPECIES[sp]["spread"]) * 0.6
                for _ in range(rng.randint(*SPECIES[sp]["cluster"])):
                    a = rng.uniform(0, 2 * math.pi)
                    rr = spread * math.sqrt(rng.random())
                    try_place(cx + rr * math.cos(a), cy + rr * math.sin(a), sp, zone_cap=False)

    # ── Z-ORDER FOLLOWS HEIGHT ──────────────────────────────────────────────
    # drawProps paints within a plane in DOCUMENT ORDER, so the order of this array IS the
    # z-order. Sorted by REAL HEIGHT x this individual's scale, not crown width: across
    # species that puts a 32 m white pine over a 19 m aspen even though their crowns are
    # 110u and 68u, and within a species it puts a big tree over a small one, which is what
    # gives a stand depth instead of reading as a flat pattern. Blueberry sorts to the
    # bottom at 0.4 m — everything grows through it.
    props.sort(key=lambda pr: SPECIES[KIND_SP[pr["kind"]]]["height"] * pr["scale"])
    for n, pr in enumerate(props, 1):
        pr["id"] = f"veg-{n}"

    st = measure(g, props, placed, cov_tree, cov_shrub, cov_sp)
    if not quiet:
        report(st, seed)
    return props, st


def measure(g, props, placed, cov_tree, cov_shrub, cov_sp):
    land, zone, comp, terr = g["land"], g["zone"], g["comp"], g["terr"]
    cell_m2 = g["cell_m2"]
    seen = land & (g["vis"] > 0.5)
    ns = int(seen.sum()) or 1
    # SHORELINE LENGTH BY ZONE — the brief states its zone targets as fractions of shoreline,
    # not of area, so this measures the actual waterline.
    shore = np.zeros(land.shape, bool)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        shore |= land & np.roll(np.roll(g["water"], dy, 0), dx, 1)
    shore &= seen
    tot_shore = int(shore.sum()) or 1
    st = dict(
        n=len(props), seen_km2=ns * cell_m2 / 1e6,
        tree=(cov_tree & seen).sum() / ns, shrub=(cov_shrub & seen).sum() / ns,
        open=1.0 - ((cov_tree | cov_shrub) & seen).sum() / ns,
        counts={s: sum(1 for p in placed if p[3] == s) for s in SPECIES},
        zone={z: dict(share=((zone == ZCODE[z]) & seen).sum() / ns,
                      shore=((zone == ZCODE[z]) & shore).sum() / tot_shore,
                      tree=(cov_tree & (zone == ZCODE[z]) & seen).sum() / max(1, ((zone == ZCODE[z]) & seen).sum()),
                      shrub=(cov_shrub & (zone == ZCODE[z]) & seen).sum() / max(1, ((zone == ZCODE[z]) & seen).sum()))
              for z in ZONES},
        islands=[])
    for c in range(1, g["ncomp"] + 1):
        m = (comp == c) & seen
        n = int(m.sum())
        if not n:
            continue
        st["islands"].append(dict(id=c, m2=n * cell_m2,
                                  tree=(cov_tree & m).sum() / n, shrub=(cov_shrub & m).sum() / n,
                                  props=sum(1 for p in placed
                                            if comp[int((p[1] - g["Y0"]) / CELL), int((p[0] - g["X0"]) / CELL)] == c)))
    return st


SHORE_BRIEF = {"A": (0.55, 0.65), "B": (0.20, 0.25), "C": (0.10, 0.15), "D": (0.05, 0.10)}
CANOPY_BRIEF = {"A": (0.60, 0.80), "B": (0.20, 0.40), "C": (0.00, 0.15), "D": (0.45, 0.75), "E": (0.60, 0.85)}


def report(st, seed):
    print(f"\n  STILLWATER LAKE — {st['n']} plants, seed {seed}, {EXAGGERATE}x oversize")
    print(f"  {st['seen_km2']:.3f} km2 of land within camera reach\n")
    print(f"  COVERAGE          got")
    print(f"    tree canopy   {st['tree']:6.1%}")
    print(f"    shrub         {st['shrub']:6.1%}")
    print(f"    open ground   {st['open']:6.1%}")
    tt = sum(st["counts"][s] for s in SHARE_TREE) or 1
    ss = sum(st["counts"][s] for s in SHARE_SHRUB) or 1
    print(f"\n  SPECIES MIX          count    share   brief")
    for s, want in SHARE_TREE.items():
        print(f"    {s:16s} {st['counts'][s]:6d}  {st['counts'][s]/tt:7.1%}  {want:6.1%}")
    for s, want in SHARE_SHRUB.items():
        print(f"    {s:16s} {st['counts'][s]:6d}  {st['counts'][s]/ss:7.1%}  {want:6.1%}")
    print(f"\n  ZONES        shoreline (brief)      canopy (brief)        shrub")
    for z in ZONES:
        d = st["zone"][z]
        sb = SHORE_BRIEF.get(z)
        sbs = f"{sb[0]:.0%}-{sb[1]:.0%}" if sb else "  interior"
        cb = CANOPY_BRIEF[z]
        ok = "" if cb[0] <= d["tree"] <= cb[1] else "  <-- out"
        print(f"    {z}  {d['shore']:8.1%} ({sbs:>9s})   {d['tree']:7.1%} ({cb[0]:.0%}-{cb[1]:.0%})"
              f"   {d['shrub']:6.1%}{ok}")
    print(f"\n  BY LANDMASS        area      canopy   shrub    props")
    for d in sorted(st["islands"], key=lambda d: -d["m2"]):
        print(f"    #{d['id']:<3d} {d['m2']/1e6:9.4f} km2 {d['tree']:8.1%} {d['shrub']:7.1%} {d['props']:8d}")


def calibrate(doc, seed, rounds=8):
    gains = dict(GAIN)
    for it in range(rounds):
        GAIN.update(gains)
        _, st = plant(doc, seed, quiet=True)
        tt = sum(st["counts"][s] for s in SHARE_TREE) or 1
        ss = sum(st["counts"][s] for s in SHARE_SHRUB) or 1
        err = 0.0
        for grp, tot in ((SHARE_TREE, tt), (SHARE_SHRUB, ss)):
            for s, want in grp.items():
                got = st["counts"][s] / tot
                err = max(err, abs(got - want) / want)
                gains[s] *= (want / max(got, 1e-4)) ** 0.6
        m = max(gains.values())
        gains = {k: round(v / m, 4) for k, v in gains.items()}
        print(f"    round {it+1}: max share error {err:6.1%}   {gains}")
        if err < 0.05:
            break
    print("\nGAIN = " + json.dumps(gains))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--calibrate", action="store_true")
    args = ap.parse_args()
    src = DOC.read_text()
    i = src.index(PREFIX)
    doc = json.loads(src[src.index("{", i):src.rindex("}") + 1])
    if args.calibrate:
        calibrate(doc, args.seed)
        return
    keep = [p for p in doc.get("props", []) if not str(p.get("id", "")).startswith("veg-")]
    new, _ = plant(doc, args.seed)
    if args.dry:
        print("\n  (dry run: nothing written)")
        return
    doc["props"] = keep + new
    body = compact_props(json.dumps(doc, indent=2, ensure_ascii=False))
    DOC.write_text(src[:src.index("{", i)] + body + src[src.rindex("}") + 1:])
    print(f"\n  -> {DOC.relative_to(ROOT.parent.parent)}  ({len(keep)} kept, {len(new)} planted, "
          f"{DOC.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()

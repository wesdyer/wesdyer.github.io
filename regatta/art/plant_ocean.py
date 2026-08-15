#!/usr/bin/env python3
"""Plant Bluewater Bonanza — coconut palm, pandanus, tropical almond, and the shrub layer.

    python3 regatta/art/plant_ocean.py            # write into the venue doc
    python3 regatta/art/plant_ocean.py --dry      # report only, write nothing
    python3 regatta/art/plant_ocean.py --seed 12
    python3 regatta/art/plant_ocean.py --maps     # dump the field/zone PNGs
    python3 regatta/art/plant_ocean.py --calibrate

Deterministic: same seed, same islands. Re-run it after editing the map and the vegetation
follows the new coastline instead of being hand-patched.

WHAT THIS IS SOLVING. The brief is a South Pacific offshore read: open blue water with
scattered low islands, pale reef rock and sand, wind-shaped coastal vegetation. The two
ways to lose it are opposite and both are easy — carpet every island in palms and it is a
resort brochure; scatter one shrub evenly over everything and it is green noise. What the
guidance actually asks for is PATCHINESS: beach, then scrub belt, then distinct tree
clusters, with open ground left between them.

THE FOUR RULES THAT DO THE MOST WORK

1. SPECIES FOLLOW EXPOSURE AND SUBSTRATE, not a global ratio. Palm wants shelter and sand,
   pandanus tolerates the windward rock nothing else will take, almond wants a sheltered
   interior big enough to have one. The brief's 45/35/20 split is an OUTCOME of those
   preferences over this particular map, not a quota applied on top — see GAIN.

2. WINDWARD AND LEEWARD ARE DIFFERENT PLACES. The engine's wind blows toward
   (-sin d, cos d), so this venue's five regions (230-350 deg, mean weighted by speed) put
   the breeze on the beam from the WEST — west-facing shores are windward. Exposure is
   built as an upwind-biased openness field rather than plain distance from water, so a
   west shore is sparse rock-and-pandanus and an east shore is palm grove, which is the
   asymmetry the guidance says to exaggerate for readability.

3. ISLAND SIZE IS A HARD GATE, NOT A TENDENCY. "Don't decorate every island" is explicit,
   so a landmass under ISLET_M2 gets a tree BUDGET of 0-3 and nothing else, whatever the
   suitability fields would otherwise pay for. Coverage targets alone will not produce a
   bare rock, because a bare rock is what a target looks like when it is missed.

4. NOTHING HERE COLLIDES AND NOTHING HERE IS ON `canopy`. All six kinds are `surface` /
   `contact: none` in PROP_KINDS, so there is no nav-grid cost to trade against, no hidden
   collider to place, and no see-through requirement — the whole set stands on land the
   fleet cannot reach. Coverage can be spent on the picture alone.

⚠️ ONLY THE LAND THE CAMERA CAN REACH IS PLANTED, and that is this venue's own problem
rather than a general policy. Measured: 1.775 km2 of land exists, one mass is 98.3% of it,
and only 30.6% of the total lies within a screen's reach of the arena — the rest is a
backdrop landmass running 6000u north of the boundary that no camera ever sees. Planting it
would triple the prop count and the file for pixels nobody can look at. So density holds
full out to VIS_FULL beyond the arena and tapers to zero at VIS_FADE; the taper is what
stops it ending on a visible line, which a hard cut does.

DELIBERATE OVERSIZE, recorded here because the manifest's scale block requires it. Crowns
are planted at EXAGGERATE x their true diameter — the same trade plant_cove.py makes and
for the same arithmetic: linear oversize buys back the square of itself, so 2.0x is 3.5x
fewer props than life size for the same picture. At 2.5x this venue plants ~16k crowns; at
life size the same picture needs ~100k, and at plant_cove's 1.7x it needs ~36k and a 5.6 MB
venue file. Every RELATIONSHIP the art was measured against survives: the size ladder holds (almond > palm > pandanus > naupaka > vine >
sedge), and each species keeps its own small/medium/large spread. A palm lands at ~175u,
which is 3.1 boat lengths — big, and deliberately so: the brief asks for individual radial
silhouettes to stay readable, and at life size on islands this large they would be a green
wash instead.

⚠️ SHARPNESS IS NOT THE LIMIT. Every bake is 4x its world size (almond 440px for 110u,
sedge 80px for 20u), so even the largest specimen this plants is still drawn downsampled.
2.5x still leaves a factor of 1.6 in hand.
"""
import argparse
import json
import math
import pathlib
import random

import numpy as np

# The pure raster helpers are SHARED WITH plant_cove.py rather than copied. They are
# map-agnostic by construction (a polygon mask, an exact distance transform, value noise,
# and the one-line-per-prop formatter), and a second copy is how two planters come to
# disagree about what a distance transform means. paths.py sets the precedent for this.
from plant_cove import compact_props, edt, poly_mask, value_noise

ROOT = pathlib.Path(__file__).resolve().parent
DOC = ROOT.parent / "assets" / "venues" / "ocean.venue.js"
PREFIX = 'window.VENUE_DOC["ocean"] = '

PX_PER_M = 9.2                 # art/manifest.json scale.pxPerMetre
CELL = 20.0                    # raster resolution: 2.17 m
EXAGGERATE = 2.5               # see the module docstring

# Bounds the raster to the land, with a margin for the fetch kernel to see out of.
X0, Y0, X1, Y1 = -15600, -17200, 12800, 8000

VIS_FULL = 900.0               # full density this far beyond the arena...
VIS_FADE = 2600.0              # ...tapering to nothing here. See the docstring.

# ── terrain vocabulary ──────────────────────────────────────────────────────
WATER, SAND, SCRUB, ROCK = 0, 1, 2, 3
LANDK = {"tropicsand": SAND, "tropicscrub": SCRUB, "coralrock": ROCK}

# ── the six species ─────────────────────────────────────────────────────────
# `bands` is true canopy diameter in metres as (small, medium, large) with the weight given
# to each; EXAGGERATE is applied on top. `height` is the plant's real HEIGHT in metres, which
# is a different question from its width and is used for one thing only: z-order. See the
# sort at the end of plant(). `cluster` is (min, max) members per stand and
# `spread` the radius they scatter over — both wider than the cove's, because these islands
# are bigger and the brief asks for groves rather than hedgerows.
SPECIES = {
    "palm": dict(
        kind="ocean-palm-coconut", world=70, height=26.0,   # a coconut palm is the tallest thing on a motu
        bands=[((5.5, 6.8), 0.25), ((6.8, 8.2), 0.50), ((8.2, 10.0), 0.25)],
        cluster=(3, 12), spread=(150, 430), layer="tree"),
    "pandanus": dict(
        kind="ocean-pandanus", world=52, height=6.0,   # a screw pine is a small tree on stilt roots
        bands=[((4.0, 5.0), 0.30), ((5.0, 6.4), 0.45), ((6.4, 8.0), 0.25)],
        cluster=(2, 7), spread=(90, 320), layer="tree"),
    "almond": dict(
        kind="ocean-almond-tropical", world=110, height=16.0,   # tall, but a palm overtops it
        bands=[((8.5, 11.0), 0.30), ((11.0, 13.5), 0.45), ((13.5, 16.0), 0.25)],
        cluster=(1, 5), spread=(120, 360), layer="tree"),
    # THE SHRUB LAYER. All three stay under the pandanus's 52u so the size ladder the
    # PROP_KINDS note sets up survives planting — a shrub that reads as a tree erases the
    # beach -> scrub -> canopy sequence the whole brief is built on.
    "naupaka": dict(
        kind="ocean-naupaka", world=40, height=2.4,   # waist-to-head-high shrub
        bands=[((3.2, 4.0), 0.30), ((4.0, 5.0), 0.45), ((5.0, 6.2), 0.25)],
        cluster=(4, 14), spread=(80, 250), layer="shrub"),
    "vine": dict(
        kind="ocean-morning-glory", world=30, height=0.15,   # a groundcover flat on the sand - the bottom of the stack
        bands=[((2.6, 3.3), 0.35), ((3.3, 4.2), 0.45), ((4.2, 5.2), 0.20)],
        cluster=(3, 11), spread=(110, 320), layer="shrub"),
    "sedge": dict(
        kind="ocean-grass-coastal", world=20, height=0.9,   # a knee-high tussock
        bands=[((1.8, 2.3), 0.35), ((2.3, 3.0), 0.45), ((3.0, 3.8), 0.20)],
        cluster=(3, 12), spread=(70, 230), layer="shrub"),
}

KIND_SP = {v["kind"]: k for k, v in SPECIES.items()}

# ── the five zones, and what each is asked to grow ──────────────────────────
# Coverage is of LAND. The brief's overall bands are 35-45% canopy and 15-25% shrub; these
# per-zone numbers area-weight over THIS map to land inside both (reported at the end).
ZONES = ["A", "B", "C", "D", "E"]
ZCODE = {z: i + 1 for i, z in enumerate(ZONES)}
TARGET = {                       # (tree canopy, shrub cover) as a fraction of the zone
    "A": (0.62, 0.13),           # sheltered interior, large island   — almond + palm
    "B": (0.50, 0.24),           # leeward coastal belt / back-beach   — palm groves
    "C": (0.28, 0.30),           # windward exposed shore              — pandanus + scrub
    "D": (0.06, 0.26),           # the bare beach strip                — vine + naupaka
    "E": (0.08, 0.22),           # reef platform / islet               — sedge, little else
}

# ⚠️ THE ISLAND GATES. "These are important. Don't decorate every island" is the one line
# in the brief that a coverage model cannot express, because a target is a thing you aim at
# and a bare rock is a thing you decide. So island size caps the CANOPY outright:
ISLET_M2 = 6000.0                # below this: a tree BUDGET of 0-3, not a coverage target
MOTU_M2 = 60000.0                # below this: a small sandy island, canopy capped at 0.40
ISLET_TREES = (0, 3)             # the brief's own numbers, and 0 is a real outcome
MOTU_CANOPY = 0.40
MOTU_CANOPY_FLOOR = 0.26      # ...and the bottom of the brief's 20-40% band, see the top-up
MOTU_PALM_SHARE = 0.40        # the brief's "small coconut grove" on a motu, as a share of its trees
BIG_CANOPY = 0.55

# The brief's cross-map species split. These are what GAIN is solved against, and the only
# place its percentages are treated as a target rather than an outcome.
SHARE_TREE = {"palm": 0.45, "pandanus": 0.35, "almond": 0.20}
SHARE_SHRUB = {"naupaka": 0.50, "vine": 0.25, "sedge": 0.25}

# ── SPECIES GAINS ───────────────────────────────────────────────────────────
# One constant per species, multiplying its suitability everywhere. The suitability
# functions say WHERE each species prefers to be and are written to be read as ecology; the
# gain says how much of the map it ends up being, which depends on the shape of THIS
# coastline and cannot be reasoned out by hand. `--calibrate` solves them.
#
# A gain cannot smuggle a species somewhere it does not belong: every field has hard zeros
# (almond's islet clip, vine's distance-from-sand exponential), and zero times anything is
# still zero. What a gain moves is which species wins where several are already plausible.
# ⚠️ THE SPREAD IS WIDE — pandanus 1.0 against palm 0.08 — and that is the map talking, not
# a bug. Zone A, the sheltered interior, is 57% of the plantable land here, and palm's field
# peaks over almost all of it while pandanus's peaks on the windward rock that is a fifth of
# it. Left raw the split came out palm 68% / pandanus 6% against a brief of 45 / 35, so the
# gain has to do that much work. It cannot put a pandanus somewhere it does not belong: what
# it moves is only which species wins where several are already plausible.
#   solved 2026-08-14, seed 7, 8 rounds, max share error 4.8%
GAIN = {"palm": 0.0801, "pandanus": 1.0, "almond": 0.0912,
        "naupaka": 0.203, "vine": 0.6032, "sedge": 0.0423}


# ── the environmental fields ────────────────────────────────────────────────
def _fft_disc(shape, radius_cells, direction=None, lobe=0.0):
    """A normalised disc kernel, optionally biased into one direction.

    `direction` is a unit (dx, dy) in RASTER space and `lobe` how strongly the kernel
    favours it: 0 is a plain disc, 1 weights a cell by max(0, cos angle) so only the
    named half counts. This is what makes exposure directional without ray casting —
    a convolution over the whole grid costs one FFT instead of 24 marches per cell.
    """
    r = int(radius_cells)
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    d = np.hypot(xx, yy)
    k = (d <= r).astype(np.float64)
    k *= np.exp(-d / (r * 0.55))          # near water counts for more than far water
    if direction is not None and lobe > 0:
        dx, dy = direction
        with np.errstate(invalid="ignore"):
            cos = (xx * dx + yy * dy) / np.maximum(d, 1e-9)
        cos[r, r] = 1.0
        k *= (1.0 - lobe) + lobe * np.clip(cos, 0, 1) * 2.0
    return k / k.sum()


def _convolve(field, kernel):
    fs = np.array(field.shape) + np.array(kernel.shape) - 1
    fs = 1 << np.ceil(np.log2(fs)).astype(int)
    F = np.fft.rfft2(field, fs) * np.fft.rfft2(kernel, fs)
    out = np.fft.irfft2(F, fs)
    ky, kx = np.array(kernel.shape) // 2
    return out[ky:ky + field.shape[0], kx:kx + field.shape[1]]


def wind_from(doc):
    """Unit vector pointing UPWIND, in raster space (x right, y down).

    The engine drifts flotsam and puffs at (-sin d, +cos d) for a region direction d — see
    updateDriftingProps and the gust spawner — so that vector is where the wind blows TO.
    Windward is the other way. Regions are averaged weighted by their own speed, because a
    25-knot region decides more about a coastline's look than an 18-knot one.
    """
    vx = vy = 0.0
    for r in doc.get("wind", {}).get("regions", []):
        d, s = r.get("direction", 0.0), r.get("speed", 1.0)
        vx += -math.sin(d) * s
        vy += math.cos(d) * s
    n = math.hypot(vx, vy) or 1.0
    return (-vx / n, -vy / n)          # negate: upwind


def geometry(doc, quiet=False):
    xs = np.arange(X0, X1, CELL)
    ys = np.arange(Y0, Y1, CELL)
    X, Y = np.meshgrid(xs, ys)

    # TERRAIN IN DOCUMENT ORDER. The runtime paints shapes in the order the doc lists them
    # (compileVenueDoc's shapeOrder), so what is visible at a point is the LAST shape
    # covering it, not a fixed kind priority. This venue relies on that: every island is a
    # sand or rock base with a tropicscrub cap drawn on top of it.
    terr = np.zeros(X.shape, np.uint8)
    for s in doc["shapes"]:
        if s["kind"] in LANDK:
            terr[poly_mask(s["outer"], X, Y)] = LANDK[s["kind"]]

    land = terr > 0
    water = ~land
    d_coast = edt(water, CELL)                      # on land: distance inland
    sand = terr == SAND
    d_beach = edt(~sand, CELL) if sand.any() else np.full(X.shape, 1e5, np.float64)
    d_rock = edt(terr != ROCK, CELL) if (terr == ROCK).any() else np.full(X.shape, 1e5, np.float64)

    # OPENNESS: how much water a point faces inside ~1400u, near water weighted heaviest.
    # Plain distance-from-shore draws concentric bands round every island; openness does
    # not, because a narrow spit is open along its whole length while the middle of a big
    # island is not, however far either is from its own waterline.
    R = int(1400 / CELL)
    wf = water.astype(np.float64)
    openness = np.clip(_convolve(wf, _fft_disc(X.shape, R)), 0, 1)
    up = wind_from(doc)
    upwind = np.clip(_convolve(wf, _fft_disc(X.shape, R, direction=up, lobe=0.85)), 0, 1)
    # Exposure is mostly the upwind half — that is what makes a west shore different from
    # an east shore — with a floor of plain openness so an outer coast is never sheltered
    # merely by facing downwind.
    raw = 0.68 * upwind + 0.32 * openness
    hi = np.percentile(raw[land], 96) if land.any() else 1.0
    exposure = np.clip(raw / (hi or 1.0), 0, 1)

    # ── land masses ─────────────────────────────────────────────────────────
    comp = np.zeros(X.shape, np.int32)
    n = 0
    idx = np.argwhere(land)
    for si, sj in idx:
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
    area = np.zeros(X.shape, np.float64)
    for c in range(1, n + 1):
        m = comp == c
        area[m] = m.sum() * cell_m2

    # ── visibility taper ────────────────────────────────────────────────────
    inside = poly_mask(doc["world"]["boundary"]["poly"], X, Y)
    d_out = edt(inside, CELL)
    vis = np.clip((VIS_FADE - d_out) / (VIS_FADE - VIS_FULL), 0.0, 1.0)

    if not quiet:
        print(f"  raster {X.shape[1]}x{X.shape[0]} @ {CELL:.0f}u   land "
              f"{land.sum() * cell_m2 / 1e6:.3f} km2 in {n} masses   "
              f"upwind vector ({up[0]:+.2f},{up[1]:+.2f})")
    return dict(X=X, Y=Y, terr=terr, land=land, d_coast=d_coast.astype(np.float32),
                d_beach=d_beach.astype(np.float32), d_rock=d_rock.astype(np.float32),
                exposure=exposure.astype(np.float32), comp=comp,
                area=area.astype(np.float32), vis=vis.astype(np.float32),
                ncomp=n, cell_m2=cell_m2)


def zones_of(g):
    """Classify the land into the brief's five ecological zones.

    Written most-general first and overwritten by the more specific, so the order of these
    lines IS the precedence: a rock platform is Zone E even where it is inland, and a tiny
    islet is Zone E whatever it is made of.

    ⚠️ SAND IS ONLY ZONE D WHERE IT IS ACTUALLY BEACH, and that correction is the whole
    reason this venue reads. The first version said `z[terr == SAND] = D` outright, which
    put every grain of sand on the map into the 6%-canopy beach zone — and since this
    coastline's sand runs hundreds of units inland, that meant the BACK-BEACH, which is
    exactly where the brief puts its coconut groves ("ocean -> sand -> scaevola ->
    pandanus/palms -> grass/interior"), was zoned as bare strand. Worse, terrain
    overwriting exposure erased the windward/leeward split entirely: Zones B and C came out
    at 0.2% and 0.0% of the plantable land, so rule 2 of this module was being computed and
    then thrown away. Sand within 220u of the water is beach; sand behind that is coastal
    belt, and its exposure decides which kind.
    """
    terr, land = g["terr"], g["land"]
    exp, d_coast, area = g["exposure"], g["d_coast"], g["area"]
    sand = terr == SAND
    z = np.zeros(terr.shape, np.uint8)
    z[land] = ZCODE["A"]                                        # sheltered interior
    z[land & (d_coast < 500)] = ZCODE["B"]                      # coastal belt, leeward default
    z[land & (exp > 0.50)] = ZCODE["C"]                         # windward, wherever it stands
    z[land & (terr == ROCK)] = ZCODE["E"]                       # bare reef platform
    z[land & sand & (d_coast < 220)] = ZCODE["D"]               # the BARE BEACH STRIP only
    z[land & (area < ISLET_M2)] = ZCODE["E"]                    # a tiny rock is a tiny rock
    return z


def build(doc, seed, quiet=False):
    rng = np.random.default_rng(seed)
    g = geometry(doc, quiet)
    g["zone"] = zones_of(g)
    # ⚠️ THE CLEARING SIZE IS SET AGAINST THE VIEWPORT, NOT AGAINST THE MAP, and the first
    # value here (9) was set against the map and was wrong for it. 9 noise cells across this
    # raster makes features ~3160 units wide; the camera shows 1400x900, so a single clearing
    # covered the entire screen and 47% of the big island's plantable land fell inside one.
    # The result read as a bare beach several boat-lengths deep with nothing on it — which no
    # coverage table catches, because globally the island was at 45% canopy. Openings have to
    # be SMALLER than what the player can see at once, or they stop being openings and become
    # emptiness. 22 cells puts them at ~1290 units, so a frame holds a clearing and both its
    # edges — which is what reads as patchy. plant_cove lands at ~1640 for the same reason.
    g["dens"] = value_noise(g["X"].shape, rng, 22)
    return g


# ── species suitability ─────────────────────────────────────────────────────
def suitability(g):
    """Per-cell weight for each species. Continuous, so nothing bands."""
    terr, exp = g["terr"], g["exposure"]
    d_coast, d_beach, d_rock, area = g["d_coast"], g["d_beach"], g["d_rock"], g["area"]
    land = g["land"]
    sand, scrub, rock = terr == SAND, terr == SCRUB, terr == ROCK
    W = {}

    # COCONUT PALM — shelter and sand. The brief: protected and sandy areas, behind
    # beaches, around coves; NOT exposed rocky headlands, NOT every tiny offshore rock.
    w = np.exp(-np.maximum(exp - 0.12, 0) / 0.20)          # falls off fast into the wind
    w *= np.exp(-d_beach / 700.0) * 0.75 + 0.25            # likes being near sand
    w *= np.where(rock, 0.10, 1.0)
    w *= np.clip(area / ISLET_M2, 0, 1) ** 0.5             # not on every scrap
    w = np.maximum(w, 0.06 * (g["area"] >= ISLET_M2))      # a floor the motu recipe can place into
    W["palm"] = w * land

    # PANDANUS — the wild coastal tree, and the only one that takes a windward rock. The
    # brief: behind the shrub belt, exposed shorelines, limestone and grass, headlands,
    # and the islands too exposed for a palm grove.
    w = 0.35 + 0.65 * np.clip(exp / 0.7, 0, 1)             # rises INTO the wind
    w *= np.exp(-np.maximum(d_coast - 260, 0) / 900.0)     # a coastal species
    w *= np.where(rock, 1.35, 1.0) * np.where(sand, 0.55, 1.0)
    W["pandanus"] = w * land

    # TROPICAL ALMOND — sheltered interiors and larger islands only. The brief is explicit
    # that it should NOT be used heavily on tiny exposed islands, so the islet clip is a
    # hard zero rather than a preference.
    w = np.exp(-exp / 0.26)
    w *= np.clip((d_coast - 180) / 900.0, 0, 1) ** 0.7      # wants to be inland
    w *= np.where(rock, 0.05, 1.0)
    w *= np.clip((area - ISLET_M2) / (MOTU_M2 - ISLET_M2), 0, 1)
    W["almond"] = w * land

    # BEACH SCAEVOLA — the dominant shrub, in a belt directly behind the beach and along
    # exposed shores; also round the feet of the pandanus.
    w = np.exp(-np.abs(d_beach - 150) / 420.0) * 0.7 + 0.3
    w *= 0.45 + 0.55 * np.clip(exp / 0.6, 0, 1)
    w *= np.exp(-np.maximum(d_coast - 320, 0) / 700.0)
    W["naupaka"] = w * land

    # BEACH MORNING GLORY — groundcover, and sand only. Everything else is a hard fade, per
    # the brief's "avoid placing much of it on limestone or deep island interiors".
    w = np.where(sand, 1.0, 0.10) * np.exp(-d_beach / 220.0)
    w *= np.exp(-np.maximum(d_coast - 240, 0) / 420.0)
    W["vine"] = w * land

    # COASTAL GRASS / SEDGE — rocky headlands, open interiors, small islands, and the
    # transition between scrub and open ground. The one that makes exposed land feel windswept.
    w = 0.30 + 0.70 * np.clip(exp / 0.55, 0, 1)
    w *= np.where(rock, 1.45, 1.0) * np.where(sand, 0.30, 1.0) * np.where(scrub, 1.15, 1.0)
    w *= np.clip(1.6 - area / (MOTU_M2 * 2.5), 0.55, 1.6)   # favours the small islands
    W["sedge"] = w * land

    for k in W:
        W[k] = np.clip(W[k], 0, None).astype(np.float32)
    return W


# ── planting ────────────────────────────────────────────────────────────────
def plant(doc, seed=7, maps=False, quiet=False):
    rng = random.Random(seed)
    nprng = np.random.RandomState(seed & 0x7FFFFFFF)
    g = build(doc, seed, quiet)
    X, Y, land, zone = g["X"], g["Y"], g["land"], g["zone"]
    NY, NX = X.shape
    W = suitability(g)
    comp, ncomp, area, vis = g["comp"], g["ncomp"], g["area"], g["vis"]
    cell_m2 = g["cell_m2"]
    if maps:
        dump_maps(g, W)

    # Two coverage rasters, because the brief sets two separate targets and they are not
    # interchangeable: an island at 40% cover made entirely of naupaka has met a total and
    # failed the picture. Per-species rasters are kept only so the report can state UNION
    # coverage — summing pi*r^2 over placements double-counts every overlap, and in a
    # clustered layout that is most of them.
    cov_tree = np.zeros(X.shape, bool)
    cov_shrub = np.zeros(X.shape, bool)
    cov_sp = {s: np.zeros(X.shape, bool) for s in SPECIES}

    # ⚠️ ZONES ARE RECKONED OVER PLANTABLE LAND, NOT OVER ALL LAND, and getting that wrong
    # is what the first run of this script did. Only the land inside the visibility taper is
    # ever planted, but the zone denominators counted the whole map — so Zone A, which is
    # almost entirely the invisible backdrop interior, could never reach its target however
    # many trees were placed. The allocator therefore never left it, spent its whole guard
    # seeding stands whose members were then refused by the taper, and the only coverage
    # that landed was the spill into the coastal zones next door: A read 22% of a 52% target
    # while D read 44% of a 7% one. A target measured over ground you have decided not to
    # plant is not a target, it is a treadmill.
    plantable = land & (vis > 0)
    zcells = {z: int((zone == ZCODE[z]) & plantable) if False else int(((zone == ZCODE[z]) & plantable).sum())
              for z in ZONES}
    zidx = {z: np.argwhere((zone == ZCODE[z]) & plantable) for z in ZONES}
    covn = {(z, ly): 0 for z in ZONES for ly in ("tree", "shrub")}

    # ── the island gate ─────────────────────────────────────────────────────
    # Canopy cap and tree budget per land mass, decided by size BEFORE any coverage maths.
    isl_area = {c: float(area[comp == c][0]) for c in range(1, ncomp + 1)}
    isl_cap, isl_budget, isl_trees = {}, {}, {}
    for c, a in isl_area.items():
        if a < ISLET_M2:
            isl_cap[c] = 0.0
            isl_budget[c] = rng.randint(*ISLET_TREES)
        elif a < MOTU_M2:
            isl_cap[c] = MOTU_CANOPY
            isl_budget[c] = None
        else:
            isl_cap[c] = BIG_CANOPY
            isl_budget[c] = None
        isl_trees[c] = 0

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
        d_m = rng.uniform(lo, hi) * EXAGGERATE
        return d_m * PX_PER_M / spec["world"]

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

    def admits(c, sp):
        """The island gate, asked per placement rather than per zone."""
        if SPECIES[sp]["layer"] != "tree":
            return True
        cid = int(comp[c])
        if isl_budget[cid] is not None:                 # a tiny islet spends a count
            if isl_trees[cid] >= isl_budget[cid]:
                return False
            return True
        m = comp == cid
        return (cov_tree & m).sum() / max(1, m.sum()) < isl_cap[cid]

    def try_place(x, y, sp, zone_cap=True):
        c = cell_of(x, y)
        if c is None or not land[c]:
            return False
        # THE VISIBILITY TAPER IS A PROBABILITY, not a cut: at the fringe a placement
        # simply becomes less likely, so the backdrop thins out instead of ending on a line.
        if vis[c] <= 0 or (vis[c] < 1.0 and rng.random() > vis[c]):
            return False
        if W[sp][c] < 0.05 or not admits(c, sp):
            return False
        # ⚠️ A ZONE THAT HAS REACHED ITS TARGET REFUSES MORE OF THAT LAYER. Without this the
        # allocator's own accounting is honest and the PICTURE still comes out wrong, because
        # a stand seeded in the interior scatters members hundreds of units and they land
        # wherever they land: the first run put 23% tree cover on a beach zone whose target
        # is 6%, entirely from palm groves spilling seaward. Refusing at the destination is
        # what keeps the beach -> scrub -> canopy ladder legible; the stand simply loses the
        # members that would have crossed the line, which also softens its edge.
        # ⚠️ THE ISLAND TOP-UP TURNS THIS OFF, and it has to. The two passes account for
        # different things: the main allocator balances ZONES across the whole map, the
        # top-up rescues one ISLAND. By the time the top-up runs every zone is at target by
        # construction, so leaving the cap on refused every single placement it tried — the
        # motu sat at 15% canopy against its 26% floor while the loop spun its 6000 tries
        # and placed nothing. A cap that silently defeats the pass written to escape it is
        # worse than no cap.
        lay = SPECIES[sp]["layer"]
        zc = zone[c]
        if zone_cap and zc and progress(ZONES[zc - 1], lay) >= 1.0:
            return False
        place(x, y, sp)
        if SPECIES[sp]["layer"] == "tree":
            isl_trees[int(comp[c])] += 1
        return True

    # ALLOCATE BY PROGRESS, NOT BY AREA — plant_cove's lesson and it transfers exactly. A
    # sprite dropped into a zone that is already dense buys less new coverage than one in a
    # thin zone, so splitting the budget up front in proportion to area x target lands the
    # zones at different fractions of their targets and flattens the ladder between them.
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

        # DELIBERATE OPEN GROUND. The density noise is a VETO, not a multiplier: a low-noise
        # cell simply refuses to seed a stand, which leaves real clearings with edges rather
        # than an even thinning everywhere. This is the brief's "leave intentional open
        # ground between clusters", and it is what makes the result read as patchy.
        if g["dens"][i, j] < 0.34:
            continue

        pool = [s for s in SPECIES if SPECIES[s]["layer"] == layer]
        wts = [float(W[s][i, j]) * GAIN[s] for s in pool]
        if sum(wts) <= 1e-9:
            continue
        sp = rng.choices(pool, weights=wts)[0]

        cx, cy = float(X[i, j]), float(Y[i, j])
        spec = SPECIES[sp]
        lo, hi = spec["cluster"]
        n = 1 if rng.random() < 0.18 else rng.randint(lo, hi)
        spread = rng.uniform(*spec["spread"])
        for _ in range(n):
            a = rng.uniform(0, 2 * math.pi)
            rr = spread * math.sqrt(rng.random())
            try_place(cx + rr * math.cos(a), cy + rr * math.sin(a), sp)

    # ── NOBODY LEFT BEHIND ──────────────────────────────────────────────────
    # The pass above accounts coverage per ZONE over the whole map at once, which is blind
    # to whether any one island got its share: the allocator stops as soon as a zone is
    # globally at target, and which cells paid for that is luck. An island smaller than one
    # noise wavelength is all-or-nothing on the phase of that noise, which is not a decision
    # anyone made. So every island that is meant to have vegetation is checked against its
    # own zone mix and topped up.
    #
    # ⚠️ DELIBERATELY NOT APPLIED BELOW ISLET_M2. The brief wants many small islands bare or
    # nearly so, and that variety is real design — the top-up would erase exactly the thing
    # rule 3 exists to protect.
    ISLAND_FLOOR = 0.80
    for c in range(1, ncomp + 1):
        # ⚠️ AN ISLET IS TOPPED UP FOR SHRUBS BUT NEVER FOR TREES. The brief wants tiny rocks
        # bare or nearly so, and `admits` already caps them at a 0-3 tree budget — but it
        # also wants them at 10-30% shrub, and the first version skipped islets entirely
        # here, which left three of this venue's four small islands with literally nothing
        # on them. Bare of TREES is the design; bare of everything is a miss.
        m = (comp == c) & plantable
        n = int(m.sum())
        if not n:
            continue
        layers = ("shrub",) if isl_area[c] < ISLET_M2 else ("tree", "shrub")
        cells = np.argwhere(m)
        # ⚠️ A MOTU GETS A CANOPY FLOOR, NOT JUST A CAP. The brief names 20-40% for a small
        # sandy island, and the zone weighting alone cannot reach it: a motu is nearly all
        # beach and reef platform, whose tree targets are 6% and 8%, so the weighted want
        # came out at 9% and the island sat at 15% looking like a sandbar with a haircut.
        # The zones describe what grows WHERE; the island class describes what the island IS,
        # and on a small sandy island the brief is explicit that it is a coconut grove with a
        # pandanus fringe. Large islands need no floor — their interior carries them past it.
        want_t = sum(TARGET[z][0] * (zone[m] == ZCODE[z]).sum() for z in ZONES) / n
        if ISLET_M2 <= isl_area[c] < MOTU_M2:
            want_t = max(want_t, MOTU_CANOPY_FLOOR)
        want = {
            "tree": min(isl_cap[c], want_t),
            "shrub": sum(TARGET[z][1] * (zone[m] == ZCODE[z]).sum() for z in ZONES) / n,
        }
        # ⚠️ A MOTU GETS ITS COCONUT GROVE PLANTED AS A RECIPE, because it cannot emerge.
        # The brief describes a small sandy island compositionally — "Scaevola belt, several
        # pandanus, small coconut grove" — and the exposure model cannot produce the last
        # item: measured, this venue's motu runs exposure 0.80-1.00 over every one of its
        # 4,577 cells and the cay is a flat 1.00, because the openness kernel reaches 1400u
        # and these islands are smaller than that. A 150 m island in open ocean genuinely has
        # no lee, so the field is not wrong; it simply carries no information at this scale,
        # and with pandanus's gain 12x palm's the species choice is decided before it starts.
        # Left alone the motu came out 49 pandanus and ZERO palms.
        #
        # So the grove is placed, not grown: a share of the island's tree quota is spent on
        # palm, seeded from its OWN least-exposed cells so the grove still lands on the
        # sheltered side rather than anywhere. Large islands need none of this — their
        # interiors are genuinely sheltered and the model handles them.
        if ISLET_M2 <= isl_area[c] < MOTU_M2:
            e = g["exposure"][m]
            lee = cells[np.argsort(e)[:max(1, len(cells) // 3)]]
            have = sum(1 for pl in placed
                       if comp[int((pl[1] - Y0) / CELL), int((pl[0] - X0) / CELL)] == c
                       and SPECIES[pl[3]]["layer"] == "tree")
            for _ in range(400):
                got = sum(1 for pl in placed
                          if comp[int((pl[1] - Y0) / CELL), int((pl[0] - X0) / CELL)] == c
                          and pl[3] == "palm")
                if got >= MOTU_PALM_SHARE * max(have, 1):
                    break
                i, j = lee[nprng.randint(len(lee))]
                cx, cy = float(X[i, j]), float(Y[i, j])
                spread = rng.uniform(*SPECIES["palm"]["spread"]) * 0.45
                for _ in range(rng.randint(3, 7)):
                    a = rng.uniform(0, 2 * math.pi)
                    rr = spread * math.sqrt(rng.random())
                    try_place(cx + rr * math.cos(a), cy + rr * math.sin(a), "palm", zone_cap=False)

        for layer in layers:
            want_l = want[layer]
            cov = cov_tree if layer == "tree" else cov_shrub
            pool = [s for s in SPECIES if SPECIES[s]["layer"] == layer]
            tries = 0
            while (cov & m).sum() / n < want_l * ISLAND_FLOOR and tries < 6000:
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
    # drawProps paints within a plane in DOCUMENT ORDER — its own comment is explicit that
    # the stacking is the designer's, in the order the document lists them — so the order of
    # this array IS the z-order. Planted in placement order it is effectively random, which
    # puts a knee-high sedge tussock over the crown of a 26 m coconut palm about a third of
    # the times the two overlap. From directly above that is simply wrong: the tallest thing
    # is the nearest to the camera and must occlude, not be occluded.
    #
    # The key is REAL HEIGHT x this individual's scale, not crown width, and the distinction
    # matters twice over. Across species it ranks the tropical almond (16 m) under the palm
    # (26 m) even though the almond's crown is half again as wide; within a species it puts a
    # big palm over a small one, which is what makes a grove read as having depth rather than
    # as a flat pattern. The morning glory sorts to the very bottom at 0.15 m, which is right
    # for a vine lying flat on the sand — everything grows THROUGH it.
    props.sort(key=lambda pr: SPECIES[KIND_SP[pr["kind"]]]["height"] * pr["scale"])
    for n, pr in enumerate(props, 1):
        pr["id"] = f"veg-{n}"

    st = measure(g, props, placed, cov_tree, cov_shrub, cov_sp)
    if not quiet:
        report(st, seed)
    return props, st


def measure(g, props, placed, cov_tree, cov_shrub, cov_sp):
    land, zone, comp = g["land"], g["zone"], g["comp"]
    cell_m2 = g["cell_m2"]
    n_land = int(land.sum())
    # Only the land the camera reaches is planted, so global percentages must be quoted
    # over THAT land or they read as a failure the taper caused on purpose.
    seen = land & (g["vis"] > 0.5)
    ns = int(seen.sum()) or 1
    st = dict(
        n=len(props), land_km2=n_land * cell_m2 / 1e6, seen_km2=ns * cell_m2 / 1e6,
        tree=(cov_tree & seen).sum() / ns, shrub=(cov_shrub & seen).sum() / ns,
        open=1.0 - ((cov_tree | cov_shrub) & seen).sum() / ns,
        sp={s: (cov_sp[s] & seen).sum() / ns for s in SPECIES},
        counts={s: sum(1 for p in placed if p[3] == s) for s in SPECIES},
        # Per zone over PLANTABLE land, for the same reason the allocator reckons it that
        # way: a zone's number quoted over ground nobody plants is not that zone's number.
        zone={z: dict(
            cells=int(((zone == ZCODE[z]) & seen).sum()),
            share=((zone == ZCODE[z]) & seen).sum() / ns,
            tree=(cov_tree & (zone == ZCODE[z]) & seen).sum() / max(1, ((zone == ZCODE[z]) & seen).sum()),
            shrub=(cov_shrub & (zone == ZCODE[z]) & seen).sum() / max(1, ((zone == ZCODE[z]) & seen).sum()),
        ) for z in ZONES},
        islands=[],
    )
    for c in range(1, g["ncomp"] + 1):
        m = (comp == c) & seen
        n = int(m.sum())
        if not n:
            continue
        st["islands"].append(dict(
            id=c, m2=n * cell_m2,
            tree=(cov_tree & m).sum() / n, shrub=(cov_shrub & m).sum() / n,
            trees=sum(1 for p in placed if comp[int((p[1] - Y0) / CELL), int((p[0] - X0) / CELL)] == c
                      and SPECIES[p[3]]["layer"] == "tree"),
            props=sum(1 for p in placed if comp[int((p[1] - Y0) / CELL), int((p[0] - X0) / CELL)] == c),
        ))
    return st


def report(st, seed):
    print(f"\n  BLUEWATER BONANZA — {st['n']} plants, seed {seed}, {EXAGGERATE}x oversize")
    print(f"  land {st['land_km2']:.3f} km2 total, {st['seen_km2']:.3f} km2 within camera reach\n")
    print(f"  COVERAGE of visible land      brief          got")
    for lbl, key, band in (("tree canopy", "tree", (0.35, 0.45)),
                           ("shrub / underbrush", "shrub", (0.15, 0.25)),
                           ("exposed terrain", "open", (0.30, 0.45))):
        v = st[key]
        ok = "ok" if band[0] <= v <= band[1] else "<-- OUT OF BAND"
        print(f"    {lbl:24s} {band[0]:>4.0%}-{band[1]:<5.0%}  {v:8.1%}  {ok}")
    tt = sum(st["counts"][s] for s in SHARE_TREE)
    ss = sum(st["counts"][s] for s in SHARE_SHRUB)
    print(f"\n  SPECIES MIX            count    share   brief")
    for s, want in SHARE_TREE.items():
        print(f"    {s:20s} {st['counts'][s]:6d}  {st['counts'][s]/max(1,tt):7.1%}  {want:6.0%}")
    for s, want in SHARE_SHRUB.items():
        print(f"    {s:20s} {st['counts'][s]:6d}  {st['counts'][s]/max(1,ss):7.1%}  {want:6.0%}")
    print(f"\n  BY ZONE      share of land     tree            shrub")
    wt = ws = 0.0
    for z in ZONES:
        d = st["zone"][z]
        wt += d["share"] * TARGET[z][0]
        ws += d["share"] * TARGET[z][1]
        print(f"    {z}  {d['share']:14.1%}   {d['tree']:6.1%} / {TARGET[z][0]:<5.0%}  "
              f"{d['shrub']:6.1%} / {TARGET[z][1]:<5.0%}")
    print(f"    area-weighted targets: tree {wt:.1%}, shrub {ws:.1%}  "
          f"(brief 35-45% / 15-25%)")
    # ⚠️ PER ISLAND, ALWAYS. A global table hides an island that came out bare, and on a
    # venue where one mass is 98% of the land the global number is that mass's number.
    print(f"\n  BY ISLAND          area      canopy   shrub   trees   props")
    for d in sorted(st["islands"], key=lambda d: -d["m2"]):
        cls = "islet" if d["m2"] < ISLET_M2 else ("motu" if d["m2"] < MOTU_M2 else "large")
        print(f"    #{d['id']:<3d} {cls:6s} {d['m2']/1e6:8.4f} km2 {d['tree']:7.1%} {d['shrub']:7.1%} "
              f"{d['trees']:7d} {d['props']:7d}")


def calibrate(doc, seed, rounds=8):
    """Solve GAIN against the brief's species split. Prints a block to paste back."""
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
        print(f"    round {it + 1}: max share error {err:6.1%}   {gains}")
        if err < 0.05:
            break
    print("\nGAIN = " + json.dumps(gains))


def dump_maps(g, W):
    from PIL import Image
    out = ROOT / "_ocean_fields"
    out.mkdir(exist_ok=True)

    def png(a, name, cmap=True):
        v = np.asarray(a, np.float64)
        v = (v - v.min()) / (v.ptp() or 1)
        img = (np.stack([v, v, v], -1) * 255).astype(np.uint8)
        Image.fromarray(img[::-1]).save(out / f"{name}.png")
    for k in ("exposure", "d_coast", "d_beach", "vis", "dens"):
        png(g[k], k)
    png(g["zone"], "zone")
    png(g["terr"], "terr")
    for s in W:
        png(W[s], f"w_{s}")
    print(f"  maps -> {out}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--maps", action="store_true")
    ap.add_argument("--calibrate", action="store_true")
    args = ap.parse_args()

    src = DOC.read_text()
    i = src.index(PREFIX)
    body = src[src.index("{", i):src.rindex("}") + 1]
    doc = json.loads(body)

    if args.calibrate:
        calibrate(doc, args.seed)
        return

    keep = [p for p in doc.get("props", []) if not str(p.get("id", "")).startswith("veg-")]
    new, _ = plant(doc, args.seed, args.maps)
    if args.dry:
        print("\n  (dry run: nothing written)")
        return
    doc["props"] = keep + new
    body = compact_props(json.dumps(doc, indent=2, ensure_ascii=False))
    DOC.write_text(src[:src.index("{", i)] + body + src[src.rindex("}") + 1:])
    kb = DOC.stat().st_size / 1024
    print(f"\n  -> {DOC.relative_to(ROOT.parent.parent)}  ({len(keep)} kept, {len(new)} planted, {kb:.0f} KB)")


if __name__ == "__main__":
    main()

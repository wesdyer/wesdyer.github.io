#!/usr/bin/env python3
"""Plant Lighthouse Cove — black oak, pitch pine, red cedar, bayberry, beach plum, scrub oak.

    python3 regatta/art/plant_cove.py            # write into the venue doc
    python3 regatta/art/plant_cove.py --dry      # report only, write nothing
    python3 regatta/art/plant_cove.py --seed 12
    python3 regatta/art/plant_cove.py --maps     # also dump the field/zone PNGs

Deterministic: same seed, same coast. Re-run it after editing the map and the vegetation
follows the new shoreline instead of being hand-patched — which is the point, because the
town, the harbour and the bridge are still to be cut out of this and the surviving
vegetation has to still make sense around them.

WHAT THIS IS SOLVING. "Green headlands" is the venue card's promise and the cheapest way
to break it is to scatter one shrub kind evenly over every piece of land. The brief is a
Cape Cod / Nantucket read from a top-down camera: the six species have to mean something
about where they are, so that a player who has never heard of a pitch pine still sees the
land change as it approaches the water.

THE THREE RULES THAT DO THE MOST WORK

1. SPECIES FOLLOW EXPOSURE, not a global ratio. The whole ecology hangs on one axis —
   how much open sea a piece of ground faces — and the species ladder is laid along it:
   oak in the sheltered interior, pine on the dry sandy uplands, cedar out on the windward
   points and islets, with the shrub layer taking over as the canopy gives up. The
   research's map-wide percentages are an OUTCOME of those preferences over this
   particular coastline, not a quota applied on top, so they are reported at the end
   rather than enforced.

2. THE COAST IS NOT A SET OF CONCENTRIC BANDS. Distance from the waterline is the obvious
   field and on its own it draws tide-lines round every island. Exposure is what disrupts
   it: a narrow spit is windward along its entire length however far you walk down it,
   while the middle of a big island goes quiet 400u in. Both fields are computed and both
   are used, and the interaction is what stops the venue looking contoured.

3. NOTHING HERE COLLIDES. All six kinds are `contact: none` in PROP_KINDS already, so
   unlike the bayou there is no nav-grid cost to trade against and no hidden collider to
   place. Vegetation on this venue is purely what the place looks like — which means the
   only budget that matters is draw and file size, and coverage can be spent freely.

DELIBERATE OVERSIZE, AND IT IS RECORDED HERE BECAUSE THE MANIFEST REQUIRES THAT. Crowns are
planted at EXAGGERATE x their true diameter. The reason is arithmetic: at life size this
0.909 km^2 of land needs ~18,000 sprites to reach the brief's 40% woody cover, because a
3 m bayberry covers 7 m^2 and 5% of the land in bayberry is therefore five thousand
bushes. Linear oversize buys back the square of itself, so 1.7x is 2.9x fewer props for
the same picture. What is preserved is every RELATIONSHIP the art was measured against:
the six sizes keep the guide's own ladder (oak > pine > cedar > scrub oak > plum >
bayberry), the shrub set still sits below the cedar the way the PROP_KINDS note requires,
and each species keeps its own small/medium/large spread. What moves is trees against
BUILDINGS — a 15 m oak beside an 8.7 m cottage — and that is the correct direction: an
aerial photograph of a Cape village is mostly canopy with roofs under it.

⚠️ SHARPNESS IS NOT THE LIMIT HERE, which is worth knowing before anyone tunes this down
out of caution. Every one of the six bakes is exactly 4x its world size (oak 384px for
96u, plum 88px for 22u), so even the largest specimen this plants is still drawn
downsampled. Scale could go past 3.5x before a sprite reached 1:1.

MEASURED COST of the ~9,000 plants this lands, against the same map with none (eval/_perf.js,
headless software raster, so pessimistic against a real GPU):

    draw           15.63 -> 16.08 ms/frame      +0.45 ms, +2.9%
    venue file      116  -> 1525 KB             one line per prop; see compact_props

⚠️ THE COUNT IS NOT THE COST, and that is the finding that made this budget affordable.
drawProps culls through a spatial grid before it touches a sprite, and on this venue the
camera sits over WATER almost all the time — so the props on screen at once are the fringe
of one or two headlands, a couple of hundred, however many the map holds in total. The
bayou had to trade canopy against a nav grid because its trees collided; nothing here does,
so the honest budget was "whatever the picture needs".
"""
import argparse
import hashlib
import json
import math
import pathlib
import random

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent
DOC = ROOT.parent / "assets" / "venues" / "bay.venue.js"
PREFIX = 'window.VENUE_DOC["bay"] = '

PX_PER_M = 9.2                 # art/manifest.json scale.pxPerMetre
CELL = 20.0                    # raster resolution: 2.17 m, finer than the smallest crown
EXAGGERATE = 1.7               # see the module docstring

# The raster covers every scrap of land, not just the racing limit — the camera is 1:1 and
# follows the boat, so it reaches well past the boundary, and the editor shows all of it.
X0, Y0, X1, Y1 = -6100, -6000, 5400, 7400

# ── terrain vocabulary ──────────────────────────────────────────────────────
# The cove's three grounds, as SHAPE_KINDS names them. `isle` is Coastal Sand (the beach
# band round every landmass), `coastalscrub` the grass/scrub upland that is most of the
# venue, `coastalrock` the weathered shoreline stone.
WATER, SAND, SCRUB, ROCK = 0, 1, 2, 3
LANDK = {"isle": SAND, "coastalscrub": SCRUB, "coastalrock": ROCK}

# ── the six species ─────────────────────────────────────────────────────────
# `real` is the guide's true canopy diameter in metres as (small, medium, large) bands with
# the weight given to each; EXAGGERATE is applied on top. `cluster` is (min, max) members
# per stand and `spread` the radius those members scatter over.
SPECIES = {
    "oak": dict(
        kind="bay-cove-oak-black", world=96, height=20.0,
        bands=[((6, 8), 0.20), ((8, 10), 0.45), ((10, 14), 0.35)],
        cluster=(2, 8), spread=(90, 260), layer="tree"),
    "pine": dict(
        kind="bay-cove-pine-pitch", world=72, height=14.0,
        bands=[((5, 6), 0.25), ((6, 8), 0.45), ((8, 11), 0.30)],
        cluster=(3, 10), spread=(120, 330), layer="tree"),
    "cedar": dict(
        kind="bay-cove-cedar-red", world=42, height=9.0,
        bands=[((3.5, 4.5), 0.40), ((4.5, 6), 0.42), ((6, 8), 0.18)],
        cluster=(1, 4), spread=(60, 200), layer="tree"),
    # THE SHRUB LAYER. Scrub oak's individual band stops at 5.5 m rather than the guide's
    # 6 m for one reason: at 1.7x, 6 m would put it level with the cedar and the PROP_KINDS
    # note is explicit that the shrub set must stay under 42u or the headland becomes one
    # undifferentiated size. The guide's 6-10 m+ THICKETS are still produced — by stands
    # that overlap, which is what a thicket is, rather than by inflating one sprite.
    "scruboak": dict(
        kind="bay-cove-oak-scrub", world=36, height=4.5,
        bands=[((3, 4), 0.30), ((4, 5.5), 0.70)],
        cluster=(4, 14), spread=(70, 200), layer="shrub"),
    "bayberry": dict(
        kind="bay-cove-bayberry-northern", world=28, height=2.5,
        bands=[((1.5, 2), 0.20), ((2, 3), 0.55), ((3, 4), 0.25)],
        cluster=(3, 12), spread=(60, 190), layer="shrub"),
    "plum": dict(
        kind="bay-cove-plum-beach", world=22, height=2.0,
        bands=[((2, 2.5), 0.20), ((2.5, 4), 0.60), ((4, 5), 0.20)],
        cluster=(2, 7), spread=(50, 150), layer="shrub"),
}
# `height` is the plant's real HEIGHT in metres and is used for ONE thing: z-order. See the
# sort at the end of plant(). It is deliberately NOT derived from `world` — a red cedar is a
# narrow 9 m spire and a scrub oak a broad 4.5 m thicket, so crown width and height do not
# rank the same way and only height decides what passes in front of what.
KIND_SP = {v["kind"]: k for k, v in SPECIES.items()}

# ── the five zones, and what each is asked to grow ──────────────────────────
# Coverage is of LAND, and the numbers are the midpoints of the guide's bands. Zone F
# (developed waterfront) has no entry: nothing is built here yet beyond the lighthouse, and
# the brief is to plant what would grow and let the town be cut out of it afterwards.
ZONES = ["A", "B", "C", "D", "E"]
ZCODE = {z: i + 1 for i, z in enumerate(ZONES)}
TARGET = {                       # (tree canopy, shrub cover) as a fraction of the zone
    "A": (0.40, 0.10),           # sheltered inland / village outskirts   45-60% woody
    "B": (0.30, 0.15),           # sandy upland / bluff                   40-50%
    "C": (0.15, 0.15),           # exposed headland / outer shore         25-35%
    "D": (0.02, 0.12),           # beach / dune / sand spit               10-20%
    "E": (0.04, 0.07),           # rocky point / small island              5-20%
}
# ⚠️ THE SHRUB COLUMN IS THE BOTTOM OF EACH ZONE'S BAND, AND THE GUIDE IS MILDLY
# SELF-INCONSISTENT HERE — worth stating so nobody "fixes" it back. §14's per-zone shrub
# bands (10-15, 15-20, 15-20, 10-20, 5-15) area-weight over THIS map's zone areas to 14.3%,
# but §3 asks for 10-15% overall with 12% nominal and §4's three shrub rows sum to exactly
# 12%. The bands and the totals cannot both be met on a coastline with this much Zone B and
# C in it. The totals win, because they are what the species table is written against, so
# every zone sits at the low end of its own band and the map lands at 12.3%.
#
# The tree column needs no such treatment: it weights to 26.4% against §3's 25-30% and §4's
# rows summing to 27%.
ISLET_M2 = 15000.0               # a land mass smaller than this may be Zone E, not a headland
SOIL_CAP = 0.35                  # ...but only if less than this much of it is scrub upland
LIGHTHOUSE_CLEAR = 130.0         # the one structure already standing gets its ground back

# Guide §4: each species' share of the LAND, as union canopy. These are the numbers the
# gains below are solved against, and the only place the research's percentages are
# treated as a target rather than an outcome.
SHARE = {"oak": 0.125, "pine": 0.095, "cedar": 0.050,
         "bayberry": 0.050, "scruboak": 0.045, "plum": 0.015}
# ⚠️ PLUM IS 0.015 AND THE GUIDE SAYS 0.025, AND THAT IS THIS MAP'S ANSWER RATHER THAN A
# MISS. Beach plum only lives on sand; sand is 7.7% of this coastline. Paying §4's 2.5% of
# ALL land out of a 7.7% habitat means covering a third of every beach in plum, against
# §14 D's own 12% shrub target for the dune — and §14 D also names bayberry FIRST and plum
# second, so plum winning its own habitat is the guide contradicting itself. Left free, the
# calibrator did exactly that: gain 4.51, and 383 plum against 27 bayberry on the sand.
# §4's preamble ("allow regional variation rather than forcing exact global percentages")
# is the licence, and the ordering is what gets kept. A coastline with more back-beach than
# this one would reach 2.5% honestly.

# ── SPECIES GAINS ───────────────────────────────────────────────────────────
# One constant per species, multiplying its suitability field everywhere.
#
# WHY THESE EXIST AT ALL, because the honest version of this script would not have them.
# The suitability functions say WHERE each species prefers to be, and they are written to
# be readable as ecology — oak wants shelter, cedar wants wind. What they cannot say is how
# much of the venue each one should end up being, because that depends on the shape of this
# particular coastline: run them raw and pitch pine takes 69% of the canopy against a brief
# of 35%, purely because this map is mostly moderate-exposure upland and that is the middle
# of pine's bell. The alternative to a gain is hand-tuning the ecology until the totals come
# out, which corrupts the part of the model that means something in order to fix the part
# that does not.
#
# So the shape of each field is the ECOLOGY and is written by hand; the gain is the
# BOOKKEEPING and is solved by machine. `--calibrate` runs the planting a few times and
# adjusts each gain by (target / achieved), then prints the block below to be pasted back.
# Re-solve it after changing any suitability function or the map.
#
# A gain cannot smuggle a species somewhere it does not belong: every field has hard zeros
# (oak's exposure clip, plum's distance-from-sand exponential), and multiplying zero by
# anything is still zero. What a gain moves is only which species wins where SEVERAL are
# already plausible.
#   solved 2026-08-11, seed 7, max error 19.9% against SHARE (bayberry runs ~6% vs 5%)
GAIN = {"oak": 0.876, "pine": 0.137, "cedar": 1.907,
        "bayberry": 0.278, "scruboak": 0.129, "plum": 2.673}


# ── raster helpers ──────────────────────────────────────────────────────────
def poly_mask(poly, X, Y):
    """Even-odd point-in-polygon over a grid, vectorised, bbox-limited."""
    p = np.asarray(poly, float)
    inside = np.zeros(X.shape, bool)
    x0, y0, x1, y1 = p[:, 0].min(), p[:, 1].min(), p[:, 0].max(), p[:, 1].max()
    box = (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1)
    if not box.any():
        return inside
    xq, yq = X[box], Y[box]
    acc = np.zeros(xq.shape, bool)
    n = len(p)
    for i in range(n):
        ax, ay = p[i]
        bx, by = p[(i + 1) % n]
        cond = (ay > yq) != (by > yq)
        with np.errstate(divide="ignore", invalid="ignore"):
            xint = (bx - ax) * (yq - ay) / np.where(by - ay == 0, np.nan, by - ay) + ax
        acc ^= cond & (xq < xint)
    inside[box] = acc
    return inside


def _dt1d(f):
    n = f.shape[1]
    out = np.empty_like(f)
    v = np.zeros(n, np.intp)
    z = np.empty(n + 1)
    INF = 1e20
    for r in range(f.shape[0]):
        fr = f[r]
        k, v[0], z[0], z[1] = 0, 0, -INF, INF
        for q in range(1, n):
            s = ((fr[q] + q * q) - (fr[v[k]] + v[k] * v[k])) / (2.0 * q - 2.0 * v[k])
            while s <= z[k]:
                k -= 1
                s = ((fr[q] + q * q) - (fr[v[k]] + v[k] * v[k])) / (2.0 * q - 2.0 * v[k])
            k += 1
            v[k], z[k], z[k + 1] = q, s, INF
        k = 0
        for q in range(n):
            while z[k + 1] < q:
                k += 1
            d = q - v[k]
            out[r, q] = d * d + fr[v[k]]
    return out


def edt(mask, cell=1.0):
    """Exact euclidean distance from every False cell to the nearest True cell.

    Felzenszwalb & Huttenlocher, because scipy is not a dependency of this repo and the
    species ladder is hung on real distances — a 4-neighbour approximation bends them by
    up to 8% on the diagonal, which is a whole size band.
    """
    f = np.where(mask, 0.0, 1e20)
    return np.sqrt(_dt1d(_dt1d(f).T).T) * cell


def value_noise(shape, rng, cells, octaves=3):
    """Low-frequency value noise in [0,1] — the patchiness of guide §17 step 3."""
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = max(2, int(cells * (2 ** o)))
        g = rng.random((n + 1, n + 1)).astype(np.float32)
        yi = np.linspace(0, n, shape[0])
        xi = np.linspace(0, n, shape[1])
        y0i, x0i = np.floor(yi).astype(int), np.floor(xi).astype(int)
        fy, fx = (yi - y0i)[:, None], (xi - x0i)[None, :]
        fy = fy * fy * (3 - 2 * fy)                       # smoothstep
        fx = fx * fx * (3 - 2 * fx)
        g00 = g[np.ix_(y0i, x0i)]
        g10 = g[np.ix_(np.minimum(y0i + 1, n), x0i)]
        g01 = g[np.ix_(y0i, np.minimum(x0i + 1, n))]
        g11 = g[np.ix_(np.minimum(y0i + 1, n), np.minimum(x0i + 1, n))]
        out += amp * ((g00 * (1 - fx) + g01 * fx) * (1 - fy)
                      + (g10 * (1 - fx) + g11 * fx) * fy)
        tot += amp
        amp *= 0.5
    return out / tot


# ── the environmental fields ────────────────────────────────────────────────
def geometry(doc):
    """Everything derived from the SHAPES alone — no seed, so it is cached.

    This is ~50s of exact distance transforms, a flood fill and 24-ray fetch casting, and
    none of it changes when the seed does. Caching it is what makes the species gains
    below calibratable at all: without it every trial run pays the same minute.
    """
    key = json.dumps([[s["kind"], s["outer"]] for s in doc["shapes"]], sort_keys=True)
    # ⚠️ hashlib, NOT hash(). Python salts string hashing per process unless PYTHONHASHSEED
    # is set, so a hash()-keyed cache never hits: every run recomputed the minute of
    # distance transforms AND left another 1.4 MB file behind. Six of them accumulated
    # before the timings stopped making sense.
    tag = f"{hashlib.sha1(key.encode()).hexdigest()[:8]}-{int(CELL)}"
    cache = ROOT / "_cove_fields" / f"geom-{tag}.npz"
    if cache.exists():
        z = np.load(cache, allow_pickle=True)
        return {k: z[k] for k in z.files}
    g = _geometry(doc)
    cache.parent.mkdir(exist_ok=True)
    np.savez_compressed(cache, **g)
    return g


def _geometry(doc):
    xs = np.arange(X0, X1, CELL)
    ys = np.arange(Y0, Y1, CELL)
    X, Y = np.meshgrid(xs, ys)
    NY, NX = X.shape

    # TERRAIN IN DOCUMENT ORDER. The runtime paints shapes in the order the doc lists them
    # (compileVenueDoc's shapeOrder), so what is visible at a point is the LAST shape
    # covering it — not a fixed kind priority. Sorting by kind here would put rock under
    # scrub in places the player sees rock.
    terr = np.zeros(X.shape, np.uint8)
    for s in doc["shapes"]:
        if s["kind"] in LANDK:
            terr[poly_mask(s["outer"], X, Y)] = LANDK[s["kind"]]

    land = terr > 0
    water = ~land
    sand = terr == SAND

    d_coast = edt(water, CELL)          # on land: how far inland from the waterline
    d_beach = edt(sand, CELL)           # how far from the nearest sand

    # ── ISLAND SIZE. Zone E is "rocky point / small island" and nothing local can tell an
    # islet from the nose of a headland — you have to measure the piece of land you are
    # standing on. Flood fill into connected components, carry each one's area per cell.
    comp = np.zeros(X.shape, np.int32)
    size_of = {}
    seen = ~land
    cur = 0
    for si, sj in zip(*np.nonzero(land)):
        if seen[si, sj]:
            continue
        cur += 1
        n = 0
        stack = [(si, sj)]
        seen[si, sj] = True
        while stack:
            i, j = stack.pop()
            comp[i, j] = cur
            n += 1
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, b = i + di, j + dj
                if 0 <= a < NY and 0 <= b < NX and not seen[a, b]:
                    seen[a, b] = True
                    stack.append((a, b))
        size_of[cur] = n
    sizes = np.zeros(cur + 1)
    for k, v in size_of.items():
        sizes[k] = v * (CELL / PX_PER_M) ** 2
    land_area = sizes[comp]

    # ── AND WHETHER IT HAS ANY SOIL ON IT. Size alone puts the wrong islands in Zone E.
    # The wooded islet inside the course — venues.md lists it as "landmark + fixed wind
    # shadow", and the whole point of it is that the fleet can see a wood casting a lee — is
    # 12,231 m^2, under any sensible "small island" threshold, and graded on size alone it
    # came out 100% Zone E and therefore bare. A venue that promises one wind hole and draws
    # a rock is a broken promise.
    #
    # What actually separates the two is not area but GROUND: an exposed ledge is bare
    # stone and sand, while an island with a coastalscrub cap has soil and grows a wood on
    # it. That is the real ecology (rock platforms grow lichen; soil grows oak) and it is
    # already authored into the map, because a designer who wanted a wooded island drew a
    # scrub cap on it.
    scrubfrac = np.zeros(cur + 1)
    for k in range(1, cur + 1):
        m = comp == k
        n = m.sum()
        if n:
            scrubfrac[k] = (terr[m] == SCRUB).sum() / n
    soil = scrubfrac[comp]

    # ── EXPOSURE: how much of the compass sees open sea, cast as rays from every shore
    # cell. This is the field the whole species ladder hangs on, and it took three
    # statistics to get one that discriminates — both failures are worth keeping:
    #
    #   mean of all 24 rays / 4200u   every shore scored 0.05-0.36. From any shore about
    #                                 half the compass points inland and returns ~0, which
    #                                 buries the signal under a constant.
    #   mean of the open third        every shore scored 1.0. This bay is 8 km across, so
    #                                 from anywhere on it the open rays run past the cap.
    #
    # What separates the head of the cove from the outer coast is the WIDTH of the sea
    # sector, not its depth — both look at water, the outer coast just looks at it over
    # 200 degrees instead of 90. So score each ray against a horizon well inside the cap
    # and average: inland rays still contribute nothing, and open rays stop competing on a
    # distance they all reach.
    NDIR, MAXF, STEP, HORIZON = 24, 4200.0, 60.0, 2400.0
    shore = water & (edt(land, CELL) <= CELL * 1.5)
    si, sj = np.nonzero(shore)
    px, py = X[si, sj], Y[si, sj]
    rays = np.zeros((NDIR, len(si)), np.float32)
    for d in range(NDIR):
        a = 2 * np.pi * d / NDIR
        dx, dy = math.cos(a) * STEP, math.sin(a) * STEP
        alive = np.ones(len(si), bool)
        dist = np.full(len(si), MAXF, np.float32)
        cx, cy = px.copy(), py.copy()
        for k in range(1, int(MAXF / STEP) + 1):
            cx[alive] += dx
            cy[alive] += dy
            jj = np.clip(((cx - X0) / CELL).astype(np.intp), 0, NX - 1)
            ii = np.clip(((cy - Y0) / CELL).astype(np.intp), 0, NY - 1)
            hit = alive & land[ii, jj]
            dist[hit] = k * STEP
            alive &= ~hit
            if not alive.any():
                break
        rays[d] = dist
    fetch = np.clip(rays / HORIZON, 0, 1).mean(axis=0)

    # Carry the shore's fetch onto the land behind it.
    #
    # ⚠️ NEAREST SHORE, NOT THE STRONGEST WITHIN REACH. A max-spread was tried first and
    # paints plateaus: it hands the most exposed cell in the neighbourhood to everything
    # behind it, so the field breaks into flat polygons with visible seams and the whole
    # interior inherits the outer coast's number. Walking the land in order of increasing
    # d_coast and taking the value from the neighbour already nearer the water propagates
    # the shore each cell actually sits behind, which is what "the water it faces" means.
    val = np.full(X.shape, np.nan)
    val[si, sj] = fetch
    lidx = np.argwhere(land)
    lidx = lidx[np.argsort(d_coast[land], kind="stable")]
    NB = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))
    for i, j in lidx:
        best, bd = np.nan, 1e18
        for di, dj in NB:
            a, b = i + di, j + dj
            if 0 <= a < NY and 0 <= b < NX and d_coast[a, b] < d_coast[i, j]:
                if not np.isnan(val[a, b]) and d_coast[a, b] < bd:
                    bd, best = d_coast[a, b], val[a, b]
        if not np.isnan(best):
            val[i, j] = best
    # INLAND FADE on d_coast rather than on a band drawn round each island: a narrow spit
    # stays windward down its whole length while a big island's middle goes quiet. That is
    # the geometry doing the disrupting guide §15 asks for, for free.
    raw = np.nan_to_num(val, nan=0.0) * np.exp(-d_coast / 600.0)
    hi = np.percentile(raw[land], 97) or 1.0
    exposure = np.clip(raw / hi, 0, 1)

    return dict(terr=terr, d_coast=d_coast.astype(np.float32),
                d_beach=d_beach.astype(np.float32),
                land_area=land_area.astype(np.float32),
                soil=soil.astype(np.float32), comp=comp,
                exposure=exposure.astype(np.float32))


def zones_of(g):
    """Classify the land into guide §14's zones.

    ⚠️ DERIVED EVERY RUN, NEVER CACHED, and the distinction is what the cache got wrong
    once: `zone` is not a property of the map, it is a property of the THRESHOLDS below.
    Caching it alongside the distance transforms meant that editing ISLET_M2 changed
    nothing — the key hashes the shapes, the shapes had not moved, and the stale
    classification came straight back. Only genuinely shape-derived fields belong in the
    cache; policy is cheap and is recomputed.

    Written most-general first and overwritten by the more specific, so the order of these
    lines IS the precedence: an islet is Zone E even where it is sandy, and sand is Zone D
    even where it is sheltered.
    """
    terr, land = g["terr"], g["terr"] > 0
    exposure, d_coast, d_beach = g["exposure"], g["d_coast"], g["d_beach"]
    zone = np.zeros(terr.shape, np.uint8)
    zone[land] = ZCODE["A"]
    zone[land & (exposure > 0.20)] = ZCODE["B"]
    zone[land & (d_beach < 260) & (d_coast < 420)] = ZCODE["B"]
    zone[land & (exposure > 0.52)] = ZCODE["C"]
    zone[terr == SAND] = ZCODE["D"]
    zone[land & (g["land_area"] < ISLET_M2) & (g["soil"] < SOIL_CAP)] = ZCODE["E"]
    # Bare shoreline stone that is not part of a wooded upland behaves as Zone E wherever
    # it stands: the ISLAND_STYLES entry for coastalrock carries trees:false, and a rock
    # platform a few metres proud of the sea grows what a rock platform grows.
    zone[(terr == ROCK) & (exposure > 0.30)] = ZCODE["E"]
    return zone


def build(doc, seed):
    """Cached geometry, plus this run's zones, this seed's noise and the grid."""
    rng = np.random.default_rng(seed)
    g = dict(geometry(doc))
    xs = np.arange(X0, X1, CELL)
    ys = np.arange(Y0, Y1, CELL)
    X, Y = np.meshgrid(xs, ys)
    d_coast, exposure = g["d_coast"], g["exposure"]
    # SHELTER is exposure and inland depth together, kept as its own field rather than
    # folded into exposure. Both axes are used but they do different jobs: cedar keys on
    # raw coastal exposure wherever it stands, oak keys on shelter, and collapsing them
    # loses the difference between "deep inside a big island" and "just behind a headland".
    g.update(X=X, Y=Y, NY=X.shape[0], NX=X.shape[1],
             land=g["terr"] > 0, water=g["terr"] == 0,
             shelter=np.clip(d_coast / 750.0, 0, 1) * 0.65 + (1.0 - exposure) * 0.35,
             zone=zones_of(g),
             dens=value_noise(X.shape, rng, 7),
             dom=[value_noise(X.shape, rng, 5) for _ in range(3)])
    return g


# ── species suitability ─────────────────────────────────────────────────────
def suitability(g):
    """Per-cell weight for each species. Continuous, so nothing bands.

    Zones set HOW MUCH grows; these set WHAT. Keeping them apart is what stops the map
    looking like a choropleth of the zone raster — a cell near a zone edge has nearly the
    same species mix as its neighbour across the line, only a different density.
    """
    e, s = g["exposure"], g["shelter"]
    dc, db, terr = g["d_coast"], g["d_beach"], g["terr"]
    area = g["land_area"]
    ln = g["land"]
    rock, sand = terr == ROCK, terr == SAND
    w = {}

    def bell(x, mu, sig):
        return np.exp(-0.5 * ((x - mu) / sig) ** 2)

    # ── THE OPEN BEACH ──────────────────────────────────────────────────────
    # Guide §14 D asks for `water -> open sand -> sparse vegetation -> bayberry + beach
    # plum`, and the first arrow is the one a distance-from-sand field cannot draw: d_beach
    # is 0 across the WHOLE sand band, so without this every species that tolerates sand
    # grows right down to the waterline and the beach disappears under bushes.
    #
    # d_coast is the field that knows: on sand it measures how far up the beach you are.
    # Nothing roots in the first 90u (~10 m) of wet sand, and cover comes in over the next
    # 130u, which is the back-beach where dune plants actually start.
    beachramp = np.where(sand, np.clip((dc - 90.0) / 130.0, 0.0, 1.0), 1.0)

    # ── BARE STONE ──────────────────────────────────────────────────────────
    # ISLAND_STYLES.coastalrock ships `trees: false` — the engine's own statement that this
    # ground carries no canopy — and guide §16 asks for isolated cedar, bayberry in
    # pockets, scrub oak in the larger soil pockets, and substantial rock left exposed. So
    # rock is not a terrain that grows a community; it is a terrain that grows exceptions,
    # and each species is penalised on it individually below rather than by one blanket
    # factor, so that cedar can still be the thing you see on a rocky point.

    # BLACK OAK — shelter, mature vegetation, the inhabited New England landscape. It
    # dominates where the land has something between it and the sea, and it is the one
    # species that must be visibly ABSENT from the outer shore, because its presence is
    # what makes the sheltered ground read as sheltered.
    w["oak"] = (np.clip(s - 0.25, 0, 1) ** 1.4
                * np.clip(1.0 - e / 0.45, 0, 1) ** 1.6
                * np.clip(dc / 260.0, 0.06, 1)
                * np.where(sand, 0.10, 1.0)
                * np.where(rock, 0.12, 1.0)
                * np.clip(db / 200.0, 0.25, 1)
                * np.where(area < 40000, 0.15, 1.0)
                * beachramp)

    # PITCH PINE — dry sandy upland, bluff tops, the land behind the dunes, outer
    # peninsulas. The species that makes this Cape Cod rather than generic New England, so
    # it gets the broad middle of the exposure axis and is deliberately allowed further out
    # than the oak and further in than the cedar.
    w["pine"] = (bell(e, 0.30, 0.26)
                 * np.clip(0.30 + s, 0, 1.3)
                 * (1.0 + 0.7 * bell(db, 300.0, 320.0))
                 * np.where(sand, 0.30, 1.0)
                 * np.where(rock, 0.22, 1.0)
                 * np.clip(dc / 130.0, 0.10, 1)
                 * np.where(area < 12000, 0.30, 1.0)
                 * beachramp)

    # RED CEDAR — wind exposure and immediate coastal influence. An ACCENT: it wants the
    # rocky points, the bluff edges and the islets, and it is explicitly not allowed to
    # become a forest tree in the interior.
    w["cedar"] = ((0.10 + 1.9 * e ** 1.3)
                  * np.where(rock, 2.6, 1.0)
                  * np.where(sand, 0.45, 1.0)
                  * np.where(area < 60000, 1.8, 1.0)
                  * np.clip(1.3 - dc / 700.0, 0.05, 1.3)
                  * beachramp)

    # NORTHERN BAYBERRY — the general-purpose coastal shrub, and the one with the broadest
    # range of the six. It fills transitions, which is most of what a shrub layer is for.
    # It LEADS on both of the difficult grounds: guide §14 D lists it first for the dune
    # and §16 gives it the pockets on rock, so it is the only species with no penalty on
    # either.
    w["bayberry"] = ((0.55 + 0.9 * e)
                     * np.clip(1.25 - dc / 1400.0, 0.30, 1.25)
                     * (1.0 + 0.5 * bell(dc, 130.0, 180.0))
                     * np.where(sand, 2.2, 1.0)
                     * beachramp)

    # BEACH PLUM — back-beach, dune backsides, sandy spits. Much more restricted than the
    # bayberry, and the falloff away from sand is the whole character of the species.
    #
    # ⚠️ IT MUST NOT WIN ITS OWN HABITAT, which is the trap this species sets. Guide §4
    # asks for 2-3% of ALL land, but plum only lives on the sand, and sand is 7.7% of this
    # coastline — so hitting 2.5% means covering a third of every beach in plum, against a
    # Zone D shrub target of 12%. The calibrator will happily do it: left free it drove
    # plum's gain to 4.5 and put 412 plum against 12 bayberry on the sand, which is the
    # guide's own ordering backwards. The global figure is the one that gives, because §4
    # says "allow regional variation" and §14 D names bayberry first. Plum lands near 1.3%
    # here and that is this map's answer, not a miss — see PLUM_CAP.
    w["plum"] = (np.exp(-db / 190.0)
                 * (0.35 + 1.5 * np.exp(-dc / 300.0))
                 * np.where(rock, 0.10, 1.0)
                 # ON THE DUNE BACKSIDE, NOT OUT ON THE DUNE. §12 lists "dune backsides"
                 # and "coastal grass immediately behind beaches" before it lists sand
                 # itself, so plum is penalised on bare sand and left at full weight on the
                 # scrub just inland — which is where the species actually grows, and it
                 # also stops it out-numbering bayberry on the beach against §14 D's order.
                 * np.where(sand, 0.55, 1.0)
                 * beachramp)

    # SCRUB OAK — wild dry coastal thicket. Rough undeveloped upland, bluff tops, the
    # margins of the pine, sand-to-rock transitions. Treated as a low woody MASS rather
    # than a decorative bush, which is a clustering property more than a weighting one.
    w["scruboak"] = (bell(e, 0.42, 0.30)
                     * np.clip(dc / 110.0, 0.10, 1)
                     * np.clip(1.15 - dc / 1500.0, 0.22, 1.15)
                     * np.where(sand, 0.30, 1.0)
                     * np.where(rock, 0.55, 1.0)
                     * beachramp)

    # SPECIES-DOMINANCE PATCHES (guide §17 step 4). Without this every cell grows the
    # average of what it could grow, and an average is exactly what a real stand is not:
    # woods come in oak-dominant and pine-dominant masses, and the seam between them is
    # most of what makes a wood read as grown rather than mixed.
    d0, d1, d2 = g["dom"]
    w["oak"] *= 0.45 + 1.5 * d0
    w["pine"] *= 0.45 + 1.5 * (1.0 - d0)
    w["cedar"] *= 0.60 + 1.1 * d1
    w["scruboak"] *= 0.50 + 1.3 * d2
    w["bayberry"] *= 0.65 + 0.8 * (1.0 - d2)
    w["plum"] *= 0.70 + 0.7 * d1

    for k in w:
        w[k] = np.where(ln, np.maximum(w[k], 0.0), 0.0).astype(np.float32)
    return w


# ── planting ────────────────────────────────────────────────────────────────
def plant(doc, seed=7, maps=False, quiet=False):
    rng = random.Random(seed)
    nprng = np.random.RandomState(seed & 0x7FFFFFFF)
    g = build(doc, seed)
    X, Y, land, zone = g["X"], g["Y"], g["land"], g["zone"]
    W = suitability(g)
    names = list(SPECIES)
    if maps:
        dump_maps(g, W)

    lights = [(p["x"], p["y"]) for p in doc.get("props", [])
              if p["kind"] == "bay-cove-lighthouse"]

    # Coverage is tracked on two separate rasters because the brief sets two separate
    # targets and they are not interchangeable: a headland at 30% cover made entirely of
    # bayberry has met a total and failed the picture. A third set, per species, is kept
    # only so the report can state UNION coverage per species against the guide's table —
    # summing pi*r^2 over the placements double-counts every overlap, and in a clustered
    # layout that is most of them.
    cov_tree = np.zeros(X.shape, bool)
    cov_shrub = np.zeros(X.shape, bool)
    cov_sp = {s: np.zeros(X.shape, bool) for s in SPECIES}
    cell_m2 = (CELL / PX_PER_M) ** 2

    comp, ncomp = g["comp"], int(g["comp"].max())
    zcells = {z: int((zone == ZCODE[z]).sum()) for z in ZONES}
    zidx = {z: np.argwhere(zone == ZCODE[z]) for z in ZONES}
    # INCREMENTAL COUNTERS, not a raster scan. progress() is called once per iteration for
    # every (zone, layer) job, and re-deriving it from the rasters cost ten full-grid
    # reductions per iteration — 3.8M cell tests each time round a loop that runs tens of
    # thousands of times, which was the whole runtime. stamp() now returns which cells it
    # newly covered and the counts are carried forward.
    covn = {(z, ly): 0 for z in ZONES for ly in ("tree", "shrub")}

    def progress(z, layer):
        n = zcells[z]
        tgt = TARGET[z][0 if layer == "tree" else 1]
        if not n or not tgt:
            return 1.0
        return (covn[(z, layer)] / n) / tgt

    props = []
    placed = []          # (x, y, r, species)

    def cell_of(x, y):
        i = int((y - Y0) / CELL)
        j = int((x - X0) / CELL)
        if 0 <= i < g["NY"] and 0 <= j < g["NX"]:
            return i, j
        return None

    def stamp(cov, x, y, r, layer):
        i, j = cell_of(x, y)
        rad = int(r / CELL) + 1
        i0, i1 = max(0, i - rad), min(g["NY"], i + rad + 1)
        j0, j1 = max(0, j - rad), min(g["NX"], j + rad + 1)
        disc = ((X[i0:i1, j0:j1] - x) ** 2 + (Y[i0:i1, j0:j1] - y) ** 2) <= r * r
        sub = cov[i0:i1, j0:j1]
        fresh = disc & ~sub
        if layer is not None and fresh.any():
            zs = zone[i0:i1, j0:j1][fresh]
            for z in ZONES:
                c = int((zs == ZCODE[z]).sum())
                if c:
                    covn[(z, layer)] += c
        sub |= disc
        return disc

    def size_for(sp):
        spec = SPECIES[sp]
        r = rng.random()
        acc = 0.0
        lo, hi = spec["bands"][-1][0]
        for (a, b), wgt in spec["bands"]:
            acc += wgt
            if r <= acc:
                lo, hi = a, b
                break
        d_m = rng.uniform(lo, hi) * EXAGGERATE
        return d_m * PX_PER_M / spec["world"]      # -> the doc's `scale`

    def ok(x, y):
        c = cell_of(x, y)
        if c is None or not land[c]:
            return None
        for lx, ly in lights:
            if math.hypot(x - lx, y - ly) < LIGHTHOUSE_CLEAR:
                return None
        return c

    def place(x, y, sp, c):
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

    # ALLOCATE BY PROGRESS, NOT BY AREA — the bayou's lesson, and it transfers exactly. A
    # sprite dropped into a zone that is already dense lands on cover it has already paid
    # for, so it buys less new coverage than one in a thin zone; splitting the budget up
    # front in proportion to area x target therefore lands the zones at different fractions
    # of their targets and flattens the ladder between them. Instead: plant into whichever
    # (zone, layer) is furthest behind ITS OWN target, and the ladder holds regardless of
    # what the overlap does.
    jobs = [(z, ly) for z in ZONES for ly in ("tree", "shrub") if zcells[z] and TARGET[z][{"tree": 0, "shrub": 1}[ly]]]
    guard, GMAX = 0, 400000
    while guard < GMAX:
        guard += 1
        z, layer = min(jobs, key=lambda j: progress(*j))
        if progress(z, layer) >= 1.0:
            break
        idx = zidx[z]
        i, j = idx[nprng.randint(len(idx))]

        # DELIBERATE OPEN SPACE (guide §17 step 7). The density noise is a veto, not a
        # multiplier: a low-noise cell simply refuses to seed, which leaves real clearings
        # with edges rather than an even thinning everywhere. 60% of the land is supposed
        # to stay grass, sand and rock, and openings are what makes the other 40% read.
        if g["dens"][i, j] < 0.34:
            continue

        pool = [s for s in names if SPECIES[s]["layer"] == layer]
        wts = [float(W[s][i, j]) * GAIN[s] for s in pool]
        tot = sum(wts)
        if tot <= 1e-9:
            continue
        sp = rng.choices(pool, weights=wts)[0]

        cx, cy = float(X[i, j]), float(Y[i, j])
        spec = SPECIES[sp]
        lo, hi = spec["cluster"]
        # A fifth stay single. Openings matter as much as plants: an even wash of crowns
        # reads as texture, not as woodland.
        n = 1 if rng.random() < 0.20 else rng.randint(lo, hi)
        spread = rng.uniform(*spec["spread"])
        for _ in range(n):
            a = rng.uniform(0, 2 * math.pi)
            rr = spread * math.sqrt(rng.random())
            x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
            c = ok(x, y)
            if c is None:
                continue
            # A cluster member may drift into a neighbouring zone — that is what makes the
            # boundaries soft — but it may not drift somewhere its species does not belong.
            if W[sp][c] < 0.04:
                continue
            place(x, y, sp, c)

    # ── NOBODY LEFT BEHIND ──────────────────────────────────────────────────
    # The pass above accounts coverage per ZONE, over the whole map at once, and that is
    # blind to whether any one island got its share: the allocator stops as soon as Zone C
    # is globally at target, and which cells paid for that is luck. The wooded islet inside
    # the course — venues.md's "landmark + fixed wind shadow", 12,231 m^2 — came out with
    # exactly ZERO plants, because the density noise has ~1600u features and the whole
    # island fell inside one clearing. An island smaller than one noise wavelength is
    # all-or-nothing on the phase of that noise, which is not a decision anyone made.
    #
    # So every land mass big enough to read gets checked against its own zone mix and
    # topped up. Deliberately NOT applied to the tiny stuff: guide §14 E wants many small
    # islands bare, or one cedar, or shrubs only, and that variety is real design — it is
    # only the islands with soil on them that must not be empty.
    # ⚠️ THE TEST IS SOIL, NOT SIZE, and getting that wrong once cost the same island
    # twice: the first version skipped anything under ISLET_M2, and the wooded islet is
    # 12,231 m^2 — under it — so the pass written to rescue that island skipped exactly
    # that island. Size is what makes a landmass an islet; SOIL is what makes it a place
    # that must not be bare. Same distinction zones_of() already draws.
    ISLAND_FLOOR = 0.85                 # fraction of its own zone target an island must reach
    ISLAND_MIN = 2000.0                 # m^2 — below this the guide wants the lottery, not a quota
    for c in range(1, ncomp + 1):
        m = comp == c
        n = int(m.sum())
        if n * cell_m2 < ISLAND_MIN or g["soil"][m].mean() < SOIL_CAP:
            continue
        want_t = sum(TARGET[z][0] * (zone[m] == ZCODE[z]).sum() for z in ZONES) / n
        want_s = sum(TARGET[z][1] * (zone[m] == ZCODE[z]).sum() for z in ZONES) / n
        cells = np.argwhere(m)
        for layer, want in (("tree", want_t), ("shrub", want_s)):
            cov = cov_tree if layer == "tree" else cov_shrub
            pool = [s for s in names if SPECIES[s]["layer"] == layer]
            tries = 0
            while (cov & m).sum() / n < want * ISLAND_FLOOR and tries < 4000:
                tries += 1
                i, j = cells[nprng.randint(len(cells))]
                wts = [float(W[s][i, j]) * GAIN[s] for s in pool]
                if sum(wts) <= 1e-9:
                    continue
                sp = rng.choices(pool, weights=wts)[0]
                spec = SPECIES[sp]
                cx, cy = float(X[i, j]), float(Y[i, j])
                lo, hi = spec["cluster"]
                spread = rng.uniform(*spec["spread"])
                for _ in range(1 if rng.random() < 0.25 else rng.randint(lo, hi)):
                    a = rng.uniform(0, 2 * math.pi)
                    rr = spread * math.sqrt(rng.random())
                    x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
                    cc = ok(x, y)
                    if cc is not None and comp[cc] == c and W[sp][cc] >= 0.04:
                        place(x, y, sp, cc)

    # ── THE ISLET LOTTERY ───────────────────────────────────────────────────
    # Guide §14 E, almost verbatim: "Many tiny islands should have shrubs only, one cedar,
    # one cedar plus shrubs, or no woody vegetation at all. Do not automatically decorate
    # every island with a tree."
    #
    # THIS EXISTS BECAUSE A COVERAGE TARGET CANNOT EXPRESS IT. Zone E asks for 4% canopy,
    # and 4% of a 600 m^2 rock is a quarter of one cedar — so the allocator, correctly,
    # rounds it to none, and every bare rock in the venue came out with scrub oak and
    # bayberry and no cedar at all. But §10 makes cedar the SIGNATURE of a rocky point and
    # asks for it in ones, twos and threes, which is a statement about individuals, not
    # about a percentage. A per-island roll is the only thing that says it.
    #
    # The roll is seeded per island so it is stable across runs, and the cedar goes at the
    # island's most inland cell — the one place a tree on a rock could actually hold on.
    for c in range(1, ncomp + 1):
        m = comp == c
        n = int(m.sum())
        a = n * cell_m2
        if a < 300 or a > ISLET_M2 or g["soil"][m].mean() >= SOIL_CAP:
            continue
        roll = random.Random(seed * 7919 + c).random()
        want = 0 if roll < 0.45 else (1 if roll < 0.80 else rng.randint(2, 3))
        cells = np.argwhere(m)
        deep = cells[np.argsort(-g["d_coast"][m])[:max(3, n // 6)]]
        for k in range(want):
            i, j = deep[nprng.randint(len(deep))]
            x = float(X[i, j]) + rng.uniform(-30, 30)
            y = float(Y[i, j]) + rng.uniform(-30, 30)
            cc = ok(x, y)
            if cc is not None and comp[cc] == c:
                place(x, y, "cedar", cc)

    # ── Z-ORDER FOLLOWS HEIGHT ──────────────────────────────────────────────
    # drawProps paints within a plane in DOCUMENT ORDER, so the order of this array IS the
    # z-order. Sorted by REAL HEIGHT x this individual's scale, not crown width: a 20 m black
    # oak passes over a 9 m red cedar even though their sprites are 96u and 42u, and within a
    # species a big individual passes over a small one, which is what gives a stand depth
    # instead of a flat pattern. Beach plum sorts to the bottom at 2 m.
    # ⚠️ ADDED 2026-08-15, LATE. plant_lake.py and plant_ocean.py have had this from the day
    # they were written; this file predates the rule and was the last planter still emitting
    # in PLACEMENT order. Measured on the shipped venue before the fix: 4587 of 9171
    # vegetation props painted out of height order — a bayberry drawn over a black oak about
    # half the time the two overlapped.
    props.sort(key=lambda pr: SPECIES[KIND_SP[pr["kind"]]]["height"] * pr["scale"])

    stats = measure(g, props, placed, cov_tree, cov_shrub, cov_sp, cell_m2)
    if not quiet:
        report(stats, seed)
    return (props, stats)


def measure(g, props, placed, cov_tree, cov_shrub, cov_sp, cell_m2):
    zone, land = g["zone"], g["land"]
    nland = int(land.sum())
    counts = {}
    for (_, _, _, sp) in placed:
        counts[sp] = counts.get(sp, 0) + 1
    # UNION coverage per species, not the sum of pi*r^2. In a clustered layout most crowns
    # overlap something, so the summed-disc figure ran to 934% of the land on the first
    # pass — it is not a coverage number at all.
    share = {s: cov_sp[s][land].sum() / nland for s in SPECIES}
    woody = cov_tree | cov_shrub
    per_zone = {}
    for z in ZONES:
        m = zone == ZCODE[z]
        n = int(m.sum())
        if n:
            per_zone[z] = (100 * (cov_tree & m).sum() / n,
                           100 * (cov_shrub & m).sum() / n,
                           100 * (woody & m).sum() / n, n * cell_m2 / 1e6)
    return dict(n=len(props), counts=counts, share=share, land_km2=nland * cell_m2 / 1e6,
                tree=100 * cov_tree[land].sum() / nland,
                shrub=100 * cov_shrub[land].sum() / nland,
                woody=100 * woody[land].sum() / nland, zones=per_zone)


def report(st, seed):
    guide = {"oak": "12-13", "pine": "9-10", "cedar": "~5",
             "bayberry": "~5", "scruboak": "4-5", "plum": "2-3"}
    print(f"seed {seed}: {st['n']} props on {st['land_km2']:.3f} km^2 of land "
          f"(crowns at {EXAGGERATE}x life size)")
    print("  species        count    cover of land   guide")
    for sp in SPECIES:
        print(f"    {sp:11} {st['counts'].get(sp,0):7}   {100*st['share'][sp]:9.1f}%"
              f"   {guide[sp]}%")
    print(f"  cover: trees {st['tree']:.1f}% [25-30]   shrubs {st['shrub']:.1f}% [10-15]"
          f"   woody {st['woody']:.1f}% [35-45]")
    ts = sum(st["share"][s] for s in ("oak", "pine", "cedar")) or 1
    ss = sum(st["share"][s] for s in ("bayberry", "scruboak", "plum")) or 1
    print("  tree canopy mix   " + "  ".join(
        f"{s} {100*st['share'][s]/ts:.0f}%" for s in ("oak", "pine", "cedar")) + "   [45/35/20]")
    print("  shrub cover mix   " + "  ".join(
        f"{s} {100*st['share'][s]/ss:.0f}%" for s in ("bayberry", "scruboak", "plum")) + "   [45/35/20]")
    tt = sum(st["counts"].get(s, 0) for s in ("oak", "pine", "cedar"))
    print(f"  {tt} trees, {st['n']-tt} shrubs")
    print("  by zone (target in brackets):")
    for z, (t, s, w, km) in st["zones"].items():
        print(f"    {z}  trees {t:5.1f}% [{100*TARGET[z][0]:.0f}]"
              f"   shrubs {s:5.1f}% [{100*TARGET[z][1]:.0f}]"
              f"   woody {w:5.1f}%   land {km:.3f} km^2")


def calibrate(doc, seed, rounds=12):
    """Solve GAIN so the realised per-species land cover lands on guide §4's table.

    Iterative proportional fitting with a damped exponent: a gain of (target/achieved)**1
    overshoots, because raising one species takes its area from the others and they push
    back on the next round. 0.6 converges in about five passes without ringing.
    """
    g = dict(GAIN)
    best, best_err = dict(g), 1e9
    for r in range(rounds):
        for k in g:
            GAIN[k] = g[k]
        _, st = plant(doc, seed, quiet=True)
        err = max(abs(st["share"][s] / SHARE[s] - 1) for s in SHARE)
        flag = ""
        if err < best_err:
            best, best_err, flag = dict(g), err, "  <- best"
        print(f"  round {r}: max error {100*err:5.1f}%   " +
              "  ".join(f"{s} {100*st['share'][s]:.1f}%" for s in SHARE) + flag)
        if err < 0.08:
            break
        # KEEP THE BEST ROUND, NOT THE LAST. This does not converge to a point — it
        # descends to about 10% max error and then rings, because the gains are coupled
        # through the zone allocator (raising oak takes canopy from pine, which changes how
        # many seeds pine's zones still need) and because the guide's own targets are not
        # exactly reachable together on this coastline. Past that floor the last round is
        # just a random draw from the ring, and printing it lost a solution twice.
        for s in SHARE:
            got = max(st["share"][s], 1e-5)
            g[s] *= (SHARE[s] / got) ** 0.45
        m = sum(g.values()) / len(g)
        g = {k: v / m for k, v in g.items()}          # keep the set near 1.0, for reading
    print(f"\n# max error {100*best_err:.1f}% against guide 4")
    print("GAIN = {" + ", ".join(f'"{k}": {v:.3f}' for k, v in best.items()) + "}")
    return best


def dump_maps(g, W):
    from PIL import Image
    out = ROOT / "_cove_fields"
    out.mkdir(exist_ok=True)
    land = g["land"]

    def save(name, a, vmax=None):
        a = np.asarray(a, float)
        vmax = vmax or (np.percentile(a[land], 99) if land.any() else 1)
        v = np.clip(a / max(vmax, 1e-9), 0, 1)
        rgb = np.zeros(v.shape + (3,), np.uint8)
        rgb[..., 0] = v * 255
        rgb[..., 1] = (1 - v) * 255
        rgb[..., 2] = 60
        rgb[~land] = (25, 45, 90)
        Image.fromarray(rgb).save(out / name)

    save("exposure.png", g["exposure"], 1.0)
    save("shelter.png", g["shelter"], 1.0)
    save("d_coast.png", g["d_coast"], 900)
    save("d_beach.png", g["d_beach"], 700)
    save("density.png", g["dens"], 1.0)
    for k, v in W.items():
        save(f"w_{k}.png", v)
    ZC = {"A": (40, 110, 40), "B": (150, 170, 60), "C": (210, 140, 60),
          "D": (235, 215, 150), "E": (140, 130, 120)}
    rgb = np.zeros(g["zone"].shape + (3,), np.uint8)
    rgb[:] = (25, 45, 90)
    for z, c in ZC.items():
        rgb[g["zone"] == ZCODE[z]] = c
    Image.fromarray(rgb).save(out / "zones.png")
    print(f"  maps -> {out}")


def compact_props(body):
    """Put each prop on ONE line instead of seven.

    json.dumps(indent=2) spends 7 lines and ~300 bytes on every prop, which is what it
    should do for a venue holding one lighthouse. At eight thousand plants it is 2.6 MB of
    venue file, most of it whitespace, and every re-plant rewrites all of it — so a diff
    can never show what actually moved. One line per prop is ~110 bytes, and a re-run with
    one changed tree produces a one-line diff.

    Purely a formatting pass over the emitted JSON: it re-parses nothing and changes no
    value, so the file still loads as the same document. The editor writes the file back in
    its own format whenever a human saves it, which is fine — this only has to hold until
    then.
    """
    out, i, n = [], 0, len(body)
    while True:
        j = body.find('\n      {\n        "id":', i)
        if j < 0:
            out.append(body[i:])
            break
        out.append(body[i:j])
        k = body.index("\n      }", j) + len("\n      }")
        obj = json.loads(body[j:k].strip().rstrip(","))
        out.append("\n      " + json.dumps(obj, ensure_ascii=False, separators=(", ", ": ")))
        i = k
    return "".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--maps", action="store_true")
    ap.add_argument("--calibrate", action="store_true",
                    help="solve the GAIN block against guide 4's species table")
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
        print("  (dry run: nothing written)")
        return
    doc["props"] = keep + new
    body = json.dumps(doc, indent=2, ensure_ascii=False)
    body = compact_props(body)
    out = src[:src.index("{", i)] + body + src[src.rindex("}") + 1:]
    DOC.write_text(out)
    kb = len(out) / 1024
    print(f"  -> {DOC.relative_to(ROOT.parent.parent)}  ({len(keep)} kept, {len(new)} planted, "
          f"{kb:.0f} KB)")


if __name__ == "__main__":
    main()

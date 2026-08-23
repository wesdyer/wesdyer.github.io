#!/usr/bin/env python3
"""Plant Sockeye Run — cottonwood, spruce, hemlock, alder, willow, moss mat, five flowers.

    python3 regatta/art/plant_river.py            # write into the venue doc
    python3 regatta/art/plant_river.py --dry      # report only, write nothing
    python3 regatta/art/plant_river.py --seed 12
    python3 regatta/art/plant_river.py --maps     # also dump the field/community PNGs

Deterministic: same seed, same valley. Follows plant_cove.py's architecture — raster
fields, hand-written ecology, coverage measured and reported rather than assumed. Read that file's docstring first; this one only records
where Sockeye Run differs, and it differs in four ways that matter.

⚠️ 1. ONLY 4.6% OF THIS VENUE'S LAND CAN EVER BE SEEN, AND THE REST IS NOT PLANTED.
Sockeye Run holds 15.90 km2 of dry land, almost all of it in two enormous humus slabs
that reach 39,000 u across — but `world.boundary` is a 16-point polygon spanning only
12,577 x 13,476 u, and boats stay inside it. cullRadius() is half the screen diagonal, so
the camera reaches CAMERA_REACH past the water it sits over and no further. Planting the
whole map at the brief's coverage would be ~130,000 props, of which ~125,000 would be
scenery no camera in the game can reach. So every field below is multiplied by a
visibility mask and the plantable area comes out at 0.732 km2 — which, worth knowing
before anyone worries about the count, is smaller than Lighthouse Cove's 0.909 km2, a
shipped and measured ~9,000-prop budget on the same engine. The brief's own targets land
at ~11,300 here. That is the whole argument that this is affordable, and it is why the
mask is a hard gate rather than a preference.

⚠️ 2. TWO OF THE BRIEF'S TERRAINS DO NOT EXIST ON THIS MAP.
  - MOSS TERRAIN: brief 5 asks for a wet forest subtype with its own tree mixture. The
    `mossfloor` shape kind exists in venuedoc.js, but river.venue.js authors ZERO of it.
    Support is written and wired (MOSSFLOOR below); it plants nothing until somebody draws
    some. The script reports the area so the gap is visible rather than silent.
  - GRANITE: brief 6 asks for 3-12% cover on rock. This venue's rock kind is `outcrop`,
    and its own venuedoc.js comment says outcrop "IS THE HAZARD OF THE FOUR ... the rock
    standing out of the rapids". All 44 of them are mid-river boulders totalling 1.36 ha
    inside the envelope, and brief 6 itself closes with "active river boulders should
    generally have no moss or plants". So the brief argues against its own section here,
    and it is right to: these are the rocks the fleet hits. They get a token allowance
    (OUTCROP_MOSS) on the largest, calmest, most bank-adjacent ones only.

⚠️ 3. MEADOW IS 44% OF THE VISIBLE LAND, NOT A FEATURE OF IT.
Map-wide, meadow is 7.3% of the land and humus 44%. Inside the camera envelope that
inverts almost to parity — meadow 32.3 ha against humus 34.8 ha — because the meadow was
drawn along the valley floor where the racing is and the humus slabs are mostly out of
reach. Brief 3 says the meadow "should be one of the stars of the venue"; on this map that
is not an aspiration, it is arithmetic. Roughly three quarters of every prop this script
places is a meadow flower.

⚠️ 4. COBBLE IS ONLY 6.7% OF THE VISIBLE LAND (4.95 ha).
Brief 2 hangs the willow/alder gradient — the "this land floods" read — on the gravel
bars, and there is very little of them: a thin grey margin along the channel. Willow
therefore mostly lives on the cobble->meadow boundary and along the meadow's own river
margin, reached through brief 11's boundary bias rather than through cobble area. This is
a deliberate reading of the brief against the map, and it is why WILLOW's suitability is
written on distance-to-water rather than on terrain.

DELIBERATE OVERSIZE, per brief 14, recorded here because the manifest requires it. Every
crown is planted at its species' own EXAGGERATE, not one global factor, because brief 14
asks for different exaggeration by size class (large trees 150-200%, shrubs 175-250%,
flower clumps 175-275%, moss 200-300%) and specifically warns off scaling mature
cottonwood to 300%. What is preserved is the LADDER: effective on-screen diameters come
out cottonwood 240 > spruce 221 > hemlock 178 > alder 105 > willow 71 > moss 65 > lupine
39 > fireweed 38 > yarrow 35 > arnica 32 > paintbrush 27, which keeps every relationship
the art was measured against, including brief 8's required flower order.

⚠️ SCALE VARIES PER CLUSTER, NOT PER PLANT, and that is brief 8's explicit instruction
("give each species a target scale and vary around it", "do not independently randomize
every object's size across the full 150-300% range"). Each cluster draws one base scale
from its species' band; members vary CLUSTER_JITTER around that base. plant_cove.py does
the opposite — independent per-plant size bands — and the difference is visible: a stand
whose members all agree on a size reads as one stand.

⚠️ Z-ORDER IS BY CLASS THEN ANCHOR Y, which is brief 13 and is NOT what the other three
planters do. They sort by real height x scale, so a big individual passes over a small one
of a taller species. Brief 13 asks for explicit height CLASSES with ground-contact
ordering inside each, and names the order: moss mat, flowers, willow, alder, hemlock,
spruce, cottonwood. That puts cottonwood over spruce, which a real-height sort would not
(35 m spruce against 30 m cottonwood). The brief wins — it is a statement about what
should win an overlap, not about botany.

⚠️ ARNICA AND PAINTBRUSH ARE NOT PLANTED YET AND THE SCRIPT KNOWS IT.
`river-arnica` and `river-paintbrush-scarlet` are declared in the manifest but have no
shipped art and no PROP_KINDS row, so a placement would compile to a prop the engine
cannot draw. Every species is gated on being registered in venuedoc.js; a missing one has
its share redistributed across its own layer and the redistribution is printed. Re-run
this script the day they land and the meadow gets its gold and scarlet for free.
"""
import argparse
import hashlib
import json
import math
import pathlib
import random
import re

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
DOC = REPO / "assets" / "venues" / "river.venue.js"
VENUEDOC = REPO / "js" / "venuedoc.js"
PREFIX = 'window.VENUE_DOC["river"] = '
CACHE = ROOT / "__pycache__" / "plant_river_geom.npz"

PX_PER_M = 9.2                 # art/manifest.json scale.pxPerMetre
CELL = 20.0                    # raster resolution: 2.17 m, finer than the smallest crown

# ⚠️ THE VISIBILITY BUDGET, and the single most consequential constant in this file.
# cullRadius() is sqrt(w^2 + h^2) * 0.5, so the camera reaches half a screen diagonal past
# its centre: 1101 u on 1920x1080, 1468 u on 2560x1440. The camera centres on the player's
# boat, which is on WATER inside `world.boundary`.
#
# ⚠️ THIS IS THE OUTER EDGE OF THE FEATHER, NOT THE EDGE OF FULL DENSITY, and getting that
# wrong is visible. The fade below ramps density down over the last FEATHER units, so with
# reach 1500 and feather 420 the forest was already thinning at 1080 u — well inside what a
# 1440p screen shows — and a player looking at the far bank saw the wood peter out. Reach
# 1900 with feather 400 keeps FULL density out to 1500 u, past the 1468 u a 2560x1440
# display reaches, and spends the fade entirely on ground no common screen can see.
CAMERA_REACH = 1900.0

# ── terrain vocabulary ──────────────────────────────────────────────────────
# Resolved in PAINT ORDER: drawIslands walks compileVenueDoc's shapeOrder, which is document
# order, so a meadow listed after a humus slab is what you actually see there. Measuring the
# brief's per-terrain percentages against raw polygon area instead would double-count every
# overlap — and on this map meadow and cobble are drawn ON TOP of humus almost everywhere.
WATER, HUMUS, MEADOW, COBBLE, OUTCROP, SHOAL, MOSSFLOOR = 0, 1, 2, 3, 4, 5, 6
TERRAIN = {"humus": HUMUS, "meadow": MEADOW, "cobble": COBBLE,
           "outcrop": OUTCROP, "cobbleshoal": SHOAL, "mossfloor": MOSSFLOOR}
TNAME = {v: k for k, v in TERRAIN.items()}
# SHOAL is awash — `cobbleshoal` carries awash:true and drag 0.8, i.e. it is river bed with
# water running over it. Nothing is planted on it, ever.
DRY = (HUMUS, MEADOW, COBBLE, OUTCROP, MOSSFLOOR)

# ── the eleven species ──────────────────────────────────────────────────────
# `real` is the brief's true crown diameter in metres; `ex` is its own exaggeration from
# brief 14, applied as a per-cluster base scale. `cluster` is (min, max) members per stand
# and `spread` the radius they scatter over, both from brief 3 and 7. `cls` is the z-order
# class of brief 13. `layer` is what coverage target the plant is charged against.
SPECIES = {
    "cottonwood": dict(
        kind="river-cottonwood-black", world=128, real=(12, 20), ex=(1.50, 2.25),
        cluster=(2, 6), spread=(160, 420), cls=7, layer="tree"),
    "spruce": dict(
        kind="river-spruce-sitka", world=104, real=(6, 10), ex=(2.45, 3.45),
        cluster=(4, 11), spread=(150, 400), cls=6, layer="tree"),
    "hemlock": dict(
        kind="river-hemlock-western", world=84, real=(5, 9), ex=(1.95, 2.65),
        cluster=(4, 12), spread=(140, 380), cls=5, layer="tree"),
    "alder": dict(
        kind="river-alder-red", world=56, real=(3, 7), ex=(1.75, 2.55),
        cluster=(4, 12), spread=(90, 260), cls=4, layer="shrub"),
    "willow": dict(
        kind="river-willow", world=30, real=(2, 5), ex=(1.75, 3.00),
        cluster=(3, 12), spread=(70, 220), cls=3, layer="shrub"),
    # Ground overlay. Not charged against tree or shrub cover — it is a surface accent whose
    # whole job is to break a polygon edge, so it gets its own budget.
    "moss": dict(
        kind="river-moss-mat", world=26, real=(1, 4), ex=(2.00, 3.00),
        cluster=(2, 7), spread=(40, 140), cls=1, layer="moss"),
    # THE FLOWER LAYER. Brief 8: these are deliberately oversized SYMBOLS of a colony, not
    # botanical specimens, so `real` is the colony's footprint rather than one stalk.
    "fireweed": dict(
        kind="river-fireweed", world=18, real=(1.5, 3), ex=(1.70, 2.50),
        cluster=(5, 20), spread=(70, 210), cls=2, layer="flower"),
    "lupine": dict(
        kind="river-lupine-nootka", world=20, real=(1.5, 3), ex=(1.60, 2.30),
        cluster=(4, 14), spread=(60, 190), cls=2, layer="flower"),
    "yarrow": dict(
        kind="river-yarrow", world=16, real=(1, 2.5), ex=(1.80, 2.60),
        cluster=(4, 12), spread=(80, 240), cls=2, layer="flower"),
    "arnica": dict(
        kind="river-arnica", world=14, real=(1, 2.5), ex=(1.80, 2.70),
        cluster=(5, 15), spread=(80, 240), cls=2, layer="flower"),
    "paintbrush": dict(
        kind="river-paintbrush-scarlet", world=12, real=(1, 2), ex=(1.80, 2.70),
        cluster=(2, 8), spread=(40, 130), cls=2, layer="flower"),
}
KIND_SP = {v["kind"]: k for k, v in SPECIES.items()}

# ⚠️ COVERAGE IS STAMPED AS AN EQUAL-AREA DISC, NOT AS THE SPRITE'S BOUNDING CIRCLE, AND
# THE DIFFERENCE IS 22 POINTS OF CANOPY.
# Every planter in this repo models a prop's cover as a disc of radius world*scale/2. That
# is right for a dense round crown and badly wrong for this venue's art: a Sitka spruce
# sprite is a SPIKY STAR and paints only 39.4% of its own square, where a solid disc would
# paint 78.5%. Measured on the shipped bakes — spruce 39.4%, alder 41.6%, cottonwood 49.8%,
# hemlock 51.4%, willow 48.3%, moss 38.7%, fireweed 43.0%, yarrow 27.3%, lupine 24.5%.
#
# The consequence was measurable and visible: the report claimed humus at 88% tree canopy,
# and classifying the actual rendered pixels of that same forest gave 66.5% vegetation and
# 31.8% bare ground. The number was not lying about what it measured, it was measuring the
# wrong thing. So the stamp radius is scaled to the disc of EQUAL AREA to the painted alpha,
# sqrt(4*fill/pi), and a coverage figure now means painted pixels.
#
# Read from the shipped file so it stays true if a sprite is re-rolled; 1.0 if it is
# missing, which only over-counts an asset that cannot be drawn anyway.
def _alpha_fill():
    try:
        import PIL.Image as _I
    except ImportError:
        return {}
    out = {}
    for k, v in SPECIES.items():
        f = REPO / "assets" / "images" / "props" / "river" / (v["kind"][6:] + ".png")
        if f.exists():
            import numpy as _np
            out[k] = float((_np.array(_I.open(f).convert("RGBA"))[..., 3] > 128).mean())
    return out


_FILL = _alpha_fill()
for _k, _v in SPECIES.items():
    _v["rmul"] = math.sqrt(4.0 * _FILL.get(_k, math.pi / 4) / math.pi)
# Brief 8: "±15-20% within a patch". Members vary this much around their cluster's base.
CLUSTER_JITTER = 0.18

# ── what each terrain is asked to grow ──────────────────────────────────────
# Midpoints of the brief's bands, as a fraction of that terrain's visible area.
#   tree  — brief 2/3/4/5/6 canopy targets
#   shrub — alder + willow
#   flower, moss — their own budgets
TARGET = {
    HUMUS:     dict(tree=0.88, shrub=0.10, flower=0.005, moss=0.035),
    MOSSFLOOR: dict(tree=0.86, shrub=0.08, flower=0.004, moss=0.090),
    MEADOW:    dict(tree=0.10, shrub=0.24, flower=0.030, moss=0.008),
    COBBLE:    dict(tree=0.012, shrub=0.045, flower=0.005, moss=0.004),
    OUTCROP:   dict(tree=0.004, shrub=0.005, flower=0.002, moss=0.022),
}
# ⚠️ THESE ARE NOT THE BRIEF'S NUMBERS ANY MORE. THE PHOTOGRAPHS OVERRULED IT, AND HERE IS
# THE MEASUREMENT THAT DID IT.
#
# The owner supplied five aerial references of real Alaskan rivers (Talkeetna, West
# Susitna, an unnamed meander reach, a glacial valley). Classified by pixel, LAND in those
# photographs is roughly 70% dark conifer forest, 16% mid green, 11% bare pale bar and 3%
# bright riparian scrub. The thing that is not there at all is OPEN FLOWER MEADOW: counting
# saturated non-green pixels — the magenta, violet, gold and cream a planted flower makes —
# the three clean references measure 0.15%, 0.19% and 0.25% of frame.
#
# The first planting off brief 3 measured 10.3%. That is not a tuning error, it is a
# fiftyfold overshoot of the thing the references are most obviously about, and it came
# from taking "meadow" at face value. Brief 3 asks for 15-30% visible wildflower on a
# terrain that covers 44% of everything the camera can reach, and the result was two
# kilometres of magenta, violet and cream ribbon along a river that in life is green and
# grey. It looked like an alpine flower meadow with a river in it.
#
# WHAT CHANGED, and each is a direct read off the photographs:
#   MEADOW tree 0.14 -> 0.52. In every reference the forest comes down TO the water. What
#     open ground exists is a narrow sedge flat behind a bar or an old channel, not a
#     terrace. The `meadow` texture stays — Talkeetna is exactly dark spruce standing on
#     bright green ground — but it is now a forest floor that happens to be green, and it
#     is the SUITABILITY fields that keep the waterline itself open, not the target.
#   MEADOW flower 0.220 -> 0.030, and humus 0.010 -> 0.006. Lands the venue near 1.5-2%
#     flower over visible land: an order of magnitude down, still an accent a player sees,
#     and roughly ten times the references' own 0.2% — which is a deliberate game
#     exaggeration of the same kind as the crown oversize, and is recorded as one.
#   MEADOW shrub 0.00 -> 0.11 and COBBLE shrub 0.030 -> 0.045. The brightest, most
#     consistent feature of every reference is a continuous band of pale deciduous scrub
#     between the dark forest and the water. The first planting had 579 willow and no band.
#   HUMUS tree 0.65 -> 0.92, and MOSSFLOOR to 0.88. ⚠️ THIS IS THE SECOND CORRECTION AND
#     IT IS THE ONE THAT MAKES THE WOOD READ. Brief 4 asks for 55-75% canopy and the first
#     two passes delivered exactly that — and a forest at 70% union coverage is 30% GROUND,
#     so from above it reads as scattered trees standing on riverside dirt, not as forest.
#     Every reference shows the opposite: an unbroken green mass with no floor visible at
#     all. Closed canopy is closed. The irregular gaps brief 10 wants come from the density
#     noise, which is now the ONLY thing making holes, rather than from a target that left
#     a third of the floor bare everywhere at once.
#   ⚠️ AND THE BAND IS ALDER, NOT WILLOW, WHICH IS A COLOUR FACT ABOUT THE SHIPPED ART
#     RATHER THAN A BOTANICAL ONE. Measured off the delivered sprites, willow's mean is
#     #95A28C — its own manifest note calls the greyness "the species mark ... the
#     dustiest, least saturated green in the venue", and it was designed as an accent. At
#     a 26% shrub target with willow leading the mix it stopped being an accent and became
#     a continuous pale grey wall two hundred metres long, which reads as concrete or foam
#     rather than as scrub. Alder is #314A31, a proper dark green, so it led the mix while
#     that was true.
#     ⚠️ REVERSED AGAIN 2026-08-22, BECAUSE THE ART WAS FIXED RATHER THAN THE PLACEMENT.
#     The grey was a defect in [[river-willow]]'s own colour spec, not a fact about willow —
#     the owner's reference photograph of an Alaskan willow creek measures the thicket at
#     hue 74-80 and saturation 0.55-0.78, the most saturated green in the picture. The
#     sprite is recoloured to match, so willow leads the riparian band again, which is what
#     both the photograph and brief 7 ("it should closely follow water") actually ask for.
#     Alder's crown also went 1.50-2.25x -> 1.75-2.55x so it can fill a band without
#     needing half again as many props to do it.
#   MEADOW tree 0.52 -> 0.10 and shrub 0.11 -> 0.24. The first reference pass over-corrected:
#     it read "the forest comes down to the water" and forested the terrace as well. A
#     meadow is open ground with SCRUB in it — willow and alder thickets, the odd
#     cottonwood — and it should read as open.
#   HUMUS tree mix back to conifer: spruce 0.50 / hemlock 0.38, cottonwood 0.18 -> 0.05.
#     The broadleaf matrix belongs to the floodplain terrace, not to the forest behind it,
#     and putting it in the forest is what kept the wood looking pale.
#   SITKA IS BIGGER: ex 1.75-2.50 -> 2.45-3.45, hemlock 1.75-2.50 -> 2.20-3.10. Spruce now
#     draws 255-359 px against cottonwood's 192-288, so it is the largest thing in the
#     venue, which is true of a Southeast Alaska Sitka and was not true of the ladder the
#     brief inherited. Its bake is world x 4 = 416 px, so even 359 is still drawn DOWN from
#     the master and no pixel is invented.
#     ⚠️ HEMLOCK STAYS SMALLER THAN SPRUCE AND THAT IS A COLOUR DECISION AS MUCH AS A
#     BOTANICAL ONE. Measured off the delivered sprite, hemlock's mean is #6F835D — a PALE
#     grey-green, twice the lightness of spruce's #26382E. Scaled to 3.10x it became 260 px
#     pale blobs that dominated every stand and undid the darkness the whole pass is for.
#     At 1.95-2.65x (164-223 px) it does what it should: fill between the spruce crowns.
#     ⚠️ AND THE SIZE IS WHAT MAKES THE DARKNESS AFFORDABLE. Closing a canopy costs props
#     as -ln(1-f)/crown_area, so it runs away fast: at 92% with 255 px crowns the gorge put
#     2,944 sprites in ONE 1600x1000 view, and they merged into a flat dark texture with no
#     crown structure left in it. Bigger crowns buy the same darkness for far fewer props
#     AND keep the individual tree legible, which is what stops a closed wood reading as a
#     green bedsheet. 88% with 302 px crowns is ~40% fewer trees than 92% with 255 px.

# Brief 2/3/4/5/6: each terrain's species mix, as a share of that terrain's own layer.
# Shares within a (terrain, layer) are normalised, so a missing species redistributes
# proportionally across the rest of its layer — see resolve_registered().
MIX = {
    HUMUS: dict(
        tree=dict(spruce=0.58, hemlock=0.32, alder=0.08, cottonwood=0.02),
        shrub=dict(alder=0.78, willow=0.22),
        flower=dict(fireweed=0.62, lupine=0.14, yarrow=0.12, arnica=0.08, paintbrush=0.04),
        moss=dict(moss=1.0)),
    MOSSFLOOR: dict(
        tree=dict(hemlock=0.46, spruce=0.44, alder=0.05, cottonwood=0.04, willow=0.01),
        shrub=dict(alder=0.78, willow=0.22),
        flower=dict(fireweed=0.66, lupine=0.13, yarrow=0.12, arnica=0.06, paintbrush=0.03),
        moss=dict(moss=1.0)),
    MEADOW: dict(
        tree=dict(cottonwood=0.34, alder=0.30, willow=0.14, spruce=0.15, hemlock=0.07),
        shrub=dict(willow=0.60, alder=0.40),
        flower=dict(fireweed=0.45, lupine=0.20, arnica=0.15, yarrow=0.12, paintbrush=0.08),
        moss=dict(moss=1.0)),
    COBBLE: dict(
        tree=dict(cottonwood=0.62, spruce=0.20, hemlock=0.18),
        shrub=dict(willow=0.74, alder=0.26),
        flower=dict(fireweed=0.55, lupine=0.18, yarrow=0.14, arnica=0.09, paintbrush=0.04),
        moss=dict(moss=1.0)),
    OUTCROP: dict(
        tree=dict(spruce=0.56, hemlock=0.44),
        shrub=dict(alder=0.59, willow=0.41),
        flower=dict(fireweed=0.45, lupine=0.20, yarrow=0.15, arnica=0.12, paintbrush=0.08),
        moss=dict(moss=1.0)),
}
# ⚠️ THE FOREST MIX MOVED TOWARD BROADLEAF AND THAT IS THE OTHER THING THE PHOTOGRAPHS SAY.
# Brief 4 gives the forest 45% spruce / 38% hemlock / 7% cottonwood, i.e. a solid dark
# conifer canopy with a broadleaf trace. Every reference shows the opposite arrangement
# near the river: a mid-green BROADLEAF matrix — cottonwood, birch, alder — with dark
# spruce spires standing through it, and the conifer only taking over as the ground rises
# away from the water. Cottonwood goes 7% -> 18% and alder 8% -> 12% in the forest.
#
# The distance part of that gradient is NOT in this table and does not need to be: the
# suitability fields already put cottonwood on a band peaking ~300 u off the water and
# spruce on ground that has been stable for a long time, so raising cottonwood's share
# lands the extra trees near the river on their own. A share says how much; the ecology
# says where. That separation is the whole reason this file has no gain block.

# ── clustering, brief 9 ─────────────────────────────────────────────────────
# Fraction of each layer that arrives as part of a stand rather than as a lone outlier.
CLUSTERED = {"tree": 0.75, "shrub": 0.90, "flower": 0.90, "moss": 0.85}
# Brief 4: "avoid a checkerboard alternation ... 4 spruce + 2 hemlock, 5 hemlock + 2 spruce,
# one dominant spruce surrounded by smaller hemlock". A stand is one species by default;
# this is the chance it admits a companion, and who the companion may be. Everything else
# stays single-species, which is brief 3's 70-85% same-species rule for flowers and reads
# the same way for trees.
COMPANION = {"spruce": ("hemlock", 0.45), "hemlock": ("spruce", 0.40),
             "alder": ("willow", 0.12), "willow": ("alder", 0.10)}

# ── gameplay legibility, brief 12 ───────────────────────────────────────────
CORRIDOR_R = 700.0             # how far the racing line's clear band reaches onto the bank
# ⚠️ THIS IS NOT THE THINNING THE REPORT MEASURES, and the gap is worth understanding.
# `leg` multiplies the SAMPLING weight, so a cut here moves plants away from the line — but
# the allocator still fills each terrain to its coverage target, so what the line loses the
# far bank gains, so the measured difference does not track the multiplier at all. It was
# tuned against the measurement rather than reasoned: 0.55 -> 26% thinner (under the band),
# ⚠️ AND IT IS DELIBERATELY MILD NOW, WHICH MISSES BRIEF 12'S 30-60% BAND ON PURPOSE.
# Tuning this against the printed number was a mistake: 0.12 measured a textbook 60%
# thinner and drew a BARE BROWN BAND of unplanted forest floor two hundred metres wide
# along the whole river, which is the one thing every reference photograph contradicts —
# the wood comes down to the water. The picture is the acceptance test, not the percentage.
# What brief 12 is actually protecting is the readability of the land/water edge, and that
# is now done precisely by `over_water` below, which stops a 300 px crown standing where
# most of its canopy would lie across the channel. This constant only takes the last of the
# density off the racing line itself.
CORRIDOR_CUT = 0.34            # density multiplier at the line itself
GATE_CLEAR = 700.0             # a start/finish gate wants its geometry visible
RAPIDS_CUT = 0.80              # how much a turbulence-1.0 rapid strips from its own banks
OUTCROP_MOSS = 0.35            # only the calmest, largest, most bank-adjacent rocks

# ⚠️ THERE IS NO GAIN BLOCK HERE, AND ITS ABSENCE IS A DESIGN DECISION.
# plant_cove.py carries one solved constant per species and a `--calibrate` mode to solve
# them, because that venue's brief gives MAP-WIDE species percentages and its ecology is a
# single exposure axis: the percentages are an OUTCOME of running the ecology over that
# particular coastline, so the only way to hit them is to correct afterwards.
#
# This brief is shaped the other way. It gives a species table PER TERRAIN, which is a
# target rather than an outcome — so the allocator below drives those tables DIRECTLY: it
# plants whichever (terrain, species) is furthest behind its own share, and takes the
# LOCATION from the suitability field. Species choice is bookkeeping, placement is ecology,
# and neither has to be corrected for the other afterwards.
#
# The distinction that makes this legal is in the brief itself. Brief 2/4/5/6 label their
# tables "relative share" and "relative canopy contribution" — area. Brief 3's flower table
# says in as many words "these are placement frequencies, not pixel coverage" — count. So
# woody and moss species are driven to a CANOPY share and flowers to a COUNT share, which
# is why the report prints both columns and why they disagree for the flowers.

CANOPY_LAYERS = ("tree", "shrub", "moss")   # driven to an area share
COUNT_LAYERS = ("flower",)                  # driven to a placement-frequency share


# ── raster helpers ──────────────────────────────────────────────────────────
# Lifted from plant_cove.py, which measured them: an exact EDT because the species ladder
# hangs on real distances and a 4-neighbour approximation bends them 8% on the diagonal.
def _dt1d(f):
    """Felzenszwalb & Huttenlocher's 1D squared-distance transform, VECTORISED OVER ROWS.

    plant_cove.py runs this row by row in Python, which is fine on its 0.9 km2 of coastline
    and is not fine here: the same code on this raster took over two minutes before it
    reached the first suitability field. The algorithm is unchanged and still exact — the
    lower-envelope stack is simply carried as one array per row, and the inner `while s <=
    z[k]` pop becomes a masked loop that runs until no row still wants to pop. Same
    parabolas, same intersections, ~200x faster.
    """
    R, n = f.shape
    rows = np.arange(R)
    v = np.zeros((R, n), np.int64)
    z = np.empty((R, n + 1), np.float64)
    z[:, 0] = -1e20
    z[:, 1] = 1e20
    k = np.zeros(R, np.int64)
    for q in range(1, n):
        vk = v[rows, k]
        s = ((f[:, q] + q * q) - (f[rows, vk] + vk * vk)) / (2.0 * q - 2.0 * vk)
        bad = s <= z[rows, k]
        while bad.any():
            k[bad] -= 1
            r = rows[bad]
            vk = v[r, k[r]]
            s[bad] = ((f[r, q] + q * q) - (f[r, vk] + vk * vk)) / (2.0 * q - 2.0 * vk)
            bad = s <= z[rows, k]
        k += 1
        v[rows, k] = q
        z[rows, k] = s
        z[rows, k + 1] = 1e20
    out = np.empty_like(f)
    k[:] = 0
    for q in range(n):
        while True:
            adv = z[rows, k + 1] < q
            if not adv.any():
                break
            k[adv] += 1
        vk = v[rows, k]
        out[:, q] = (q - vk) ** 2 + f[rows, vk]
    return out


def edt(mask, cell=CELL):
    """Exact Euclidean distance, in world units, from every cell to the nearest True."""
    f = np.where(mask, 0.0, 1e20)
    out = _dt1d(np.ascontiguousarray(f))
    out = _dt1d(np.ascontiguousarray(out.T)).T
    return np.sqrt(np.maximum(out, 0.0)) * cell


def value_noise(shape, rng, cells, octaves=3):
    """Low-frequency value noise in [0,1] — brief 10's multi-scale density variation."""
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = max(2, int(cells * (2 ** o)))
        g = rng.random((n + 1, n + 1)).astype(np.float32)
        yi = np.linspace(0, n, shape[0])
        xi = np.linspace(0, n, shape[1])
        y0i, x0i = np.floor(yi).astype(int), np.floor(xi).astype(int)
        fy, fx = (yi - y0i)[:, None], (xi - x0i)[None, :]
        fy = fy * fy * (3 - 2 * fy)
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


def fill_poly(shape, poly, x0, y0):
    """Scanline fill of one polygon into a boolean raster. No PIL dependency."""
    H, W = shape
    out = np.zeros(shape, bool)
    pts = [((px - x0) / CELL, (py - y0) / CELL) for px, py in poly]
    n = len(pts)
    ys = [p[1] for p in pts]
    for row in range(max(0, int(min(ys))), min(H, int(max(ys)) + 2)):
        yc = row + 0.5
        xs = []
        for i in range(n):
            xa, ya = pts[i]
            xb, yb = pts[(i + 1) % n]
            if (ya <= yc < yb) or (yb <= yc < ya):
                xs.append(xa + (yc - ya) * (xb - xa) / (yb - ya))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            a, b = int(math.ceil(xs[i] - 0.5)), int(math.floor(xs[i + 1] - 0.5))
            if b >= 0 and a < W:
                out[row, max(0, a):min(W, b + 1)] = True
    return out


def seg_dist_field(X, Y, segs):
    """Distance to a polyline, in world units. Few segments, so brute force is fine."""
    best = np.full(X.shape, 1e9, np.float32)
    for (ax, ay), (bx, by) in segs:
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        t = 0.0 if L2 == 0 else np.clip(((X - ax) * dx + (Y - ay) * dy) / L2, 0, 1)
        best = np.minimum(best, np.hypot(X - (ax + t * dx), Y - (ay + t * dy)))
    return best


def poly_dist(X, Y, poly, inside):
    """Exact distance to a polygon: zero inside it, distance to its edge outside.

    ⚠️ USED INSTEAD OF edt() FOR THE 43 RAPIDS AND CURRENT REGIONS, and the reason is
    arithmetic rather than taste. Each region needs its own falloff field, and calling a
    full-raster distance transform once per region is 43 transforms over 658,000 cells for
    43 polygons averaging nine points each. Distance to nine segments is exact, costs one
    vectorised pass, and does not care how big the raster is.
    """
    segs = [(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))]
    d = seg_dist_field(X, Y, segs)
    d[inside] = 0.0
    return d


# ── the environmental fields ────────────────────────────────────────────────
def geometry(doc):
    """Everything derived from shapes, boundary, course and rapids. No seed, so cached."""
    key = hashlib.sha1(json.dumps(
        [[s["kind"], s["outer"], s.get("holes", [])] for s in doc["shapes"]]
        + [doc["world"]["boundary"]["poly"]]
        + [[r["poly"], r.get("turbulence", 0.5)] for r in doc.get("rapids", {}).get("regions", [])]
        + [[m["id"], m["x"], m["y"]] for m in doc["course"]["marks"]]
        + [CELL, CAMERA_REACH], sort_keys=True).encode()).hexdigest()[:16]
    if CACHE.exists():
        z = np.load(CACHE, allow_pickle=False)
        if str(z["key"]) == key:
            return {k: z[k] for k in z.files if k != "key"} | {"key": key}
    g = _geometry(doc)
    g["key"] = key
    CACHE.parent.mkdir(exist_ok=True)
    np.savez_compressed(CACHE, key=np.array(key), **{k: v for k, v in g.items() if k != "key"})
    return g


def _geometry(doc):
    bnd = doc["world"]["boundary"]["poly"]
    bx = [p[0] for p in bnd]
    by = [p[1] for p in bnd]
    pad = CAMERA_REACH + 600
    x0, y0 = min(bx) - pad, min(by) - pad
    W = int((max(bx) + pad - x0) / CELL) + 1
    H = int((max(by) + pad - y0) / CELL) + 1
    shape = (H, W)
    yy, xx = np.mgrid[0:H, 0:W]
    X = (x0 + (xx + 0.5) * CELL).astype(np.float32)
    Y = (y0 + (yy + 0.5) * CELL).astype(np.float32)

    # ── terrain, in paint order ──
    terr = np.zeros(shape, np.uint8)
    for s in doc["shapes"]:
        c = TERRAIN.get(s["kind"])
        if c is None:
            continue
        m = fill_poly(shape, s["outer"], x0, y0)
        for h in s.get("holes", []):
            m &= ~fill_poly(shape, h, x0, y0)
        terr[m] = c
    land = np.isin(terr, DRY)
    wet = ~land                                  # river, shoal-side channel, open water

    # ── the visibility mask, and it is a HARD gate ──
    # The camera centres on the boat, the boat is on water inside the boundary, and
    # cullRadius reaches CAMERA_REACH past that centre. Anything further is unreachable.
    inb = fill_poly(shape, bnd, x0, y0)
    d_reach = edt(inb & wet)
    vis = d_reach <= CAMERA_REACH
    # ⚠️ AND IT IS FEATHERED, WHICH THE FIRST RENDER SAID WAS NOT OPTIONAL. A hard mask ends
    # the vegetation on an arc — the envelope is a dilated waterline, so its edge is a
    # smooth curve, and a smooth curve where planting stops is the most artificial thing a
    # generated map can show. It was plainly visible on the first render as a scalloped
    # boundary across open meadow of otherwise identical colour. Ramping density down over
    # the last FEATHER units turns it into ordinary thinning. `vis` stays hard because the
    # coverage targets are measured against it; only the sampling weights fade, so the
    # interior compensates and the terrain still lands on its number.
    FEATHER = 400.0
    fade = np.clip((CAMERA_REACH - d_reach) / FEATHER, 0, 1).astype(np.float32)

    # ── distance fields the ecology hangs on ──
    d_water = edt(wet)                           # 0 at the waterline, up onto the terrace
    d_land = edt(land)
    d_forest = edt(terr == HUMUS) + edt(terr == MOSSFLOOR) * 0  # humus only; moss adds below
    if (terr == MOSSFLOOR).any():
        d_forest = np.minimum(d_forest, edt(terr == MOSSFLOOR))
    d_meadow = edt(terr == MEADOW)
    d_cobble = edt(terr == COBBLE)

    # ── how much active gravel bar a big crown would stand over ──
    # ⚠️ WITHOUT THIS, THE BARE RIVER BED ENDS UP DENSER THAN THE FOREST, AND NOT BY ITS OWN
    # ALLOCATION. The bar is a strip ~30 m wide between water and meadow; a cottonwood at
    # 240 px is a 26 m crown; so a tree correctly planted on the meadow side of the
    # boundary — which brief 11 actively wants — throws a third of its canopy across the
    # gravel. Measured before this field existed: cobble came out 14.1% tree cover against
    # brief 2's 3%, from FIVE trees actually allocated to it. The overshoot was all
    # neighbours' overhang, so no amount of tuning cobble's own target could reach it.
    # The fix is physical rather than statistical: a large tree is penalised by how much
    # bar its own crown would cover. Boundary attraction survives, standing ON the bar does
    # not. Box-blurred with a summed-area table at BAR_R, which is a big-crown radius.
    BAR_R = 170.0
    # Both bare river-bed kinds: the gravel bar AND the mid-river rock. Brief 2 and
    # brief 6 ask for the same thing about both — keep the active bed bare — and one
    # field says it once.
    bar = np.isin(terr, (COBBLE, OUTCROP)).astype(np.float32)
    k = max(1, int(BAR_R / CELL))
    sat = np.pad(bar, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    ii = np.clip(np.arange(H)[:, None] + np.array([-k, k + 1])[None, :], 0, H)
    jj = np.clip(np.arange(W)[:, None] + np.array([-k, k + 1])[None, :], 0, W)
    a, b = ii[:, 0], ii[:, 1]
    c, d = jj[:, 0], jj[:, 1]
    tot = (sat[np.ix_(b, d)] - sat[np.ix_(a, d)] - sat[np.ix_(b, c)] + sat[np.ix_(a, c)])
    area = ((b - a)[:, None] * (d - c)[None, :]).astype(np.float32)
    bar_frac = (tot / np.maximum(area, 1)).astype(np.float32)

    # ── and the same summed-area trick for OPEN WATER ──
    # Brief 12's real subject: keep the land/water edge readable. A Sitka at 3.45x is a
    # 359 px crown, and one standing three metres up the bank throws most of itself across
    # the channel — which is where the player is looking to find the shoreline. Penalising
    # by the water fraction under the crown keeps the wood at the waterline (which every
    # reference demands) while stopping it from roofing the river.
    wat = wet.astype(np.float32)
    sat2 = np.pad(wat, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    tot2 = (sat2[np.ix_(b, d)] - sat2[np.ix_(a, d)] - sat2[np.ix_(b, c)] + sat2[np.ix_(a, c)])
    water_frac = (tot2 / np.maximum(area, 1)).astype(np.float32)

    # ── terrain-boundary proximity, brief 11 ──
    # Anywhere a terrain changes. Plants biased here straddle the polygon edge and stop it
    # reading as an authored line, which is the whole point of that section.
    b_edge = np.zeros(shape, bool)
    b_edge[:-1, :] |= terr[:-1, :] != terr[1:, :]
    b_edge[:, :-1] |= terr[:, :-1] != terr[:, 1:]
    d_edge = edt(b_edge)

    # ── the rapids suppression field, brief 2 and 12 ──
    # Weighted by each region's own turbulence: a 1.0 rapid strips its banks hard, a 0.3
    # riffle barely notices. Falloff is the region's authored falloff.
    rough = np.zeros(shape, np.float32)
    for r in doc.get("rapids", {}).get("regions", []):
        t = float(r.get("turbulence", 0.5))
        fo = float(r.get("falloff", 250)) or 250.0
        d = poly_dist(X, Y, r["poly"], fill_poly(shape, r["poly"], x0, y0))
        rough = np.maximum(rough, t * np.clip(1.0 - d / (fo * 2.2), 0, 1))

    # ── the current field: how fast the water beside this bank runs ──
    flow = np.zeros(shape, np.float32)
    for r in doc.get("current", {}).get("regions", []):
        sp = float(r.get("speed", 0) or 0)
        if sp <= 0:
            continue
        fo = float(r.get("falloff", 200)) or 200.0
        d = poly_dist(X, Y, r["poly"], fill_poly(shape, r["poly"], x0, y0))
        flow = np.maximum(flow, sp * np.clip(1.0 - d / (fo * 2.0), 0, 1))

    # ── the racing corridor, brief 12 ──
    marks = {m["id"]: (m["x"], m["y"]) for m in doc["course"]["marks"]}
    lines = {l["id"]: l["marks"] for l in doc["course"].get("lines", [])}

    def node(step):
        if step.get("kind") == "gate":
            a, b = lines[step["lineId"]]
            return ((marks[a][0] + marks[b][0]) / 2, (marks[a][1] + marks[b][1]) / 2)
        return marks[step["markId"]]

    pts = [node(s) for s in doc["course"]["route"]]
    segs = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    d_line = seg_dist_field(X, Y, segs) if segs else np.full(shape, 1e9, np.float32)
    gates = [marks[m] for l in lines.values() for m in l]
    d_gate = (seg_dist_field(X, Y, [(p, p) for p in gates]) if gates
              else np.full(shape, 1e9, np.float32))

    return dict(terr=terr, land=land, wet=wet, vis=vis, fade=fade, bar_frac=bar_frac,
                water_frac=water_frac, x0=np.float64(x0), y0=np.float64(y0),
                d_water=d_water, d_land=d_land, d_forest=d_forest, d_meadow=d_meadow,
                d_cobble=d_cobble, d_edge=d_edge, rough=rough, flow=flow,
                d_line=d_line, d_gate=d_gate)


def fields(g, seed):
    """Seeded fields: brief 10's multi-scale density variation, and the damp/dry axis."""
    rng = np.random.default_rng(seed)
    shape = g["terr"].shape
    return dict(
        # Broad low-frequency density: dense stand -> moderate -> clearing -> dense.
        patch=value_noise(shape, rng, 6, 4),
        # A second, finer one so a "clearing" is not always the same size as a "stand".
        fine=value_noise(shape, rng, 16, 3),
        # The damp axis: where hemlock and moss prefer to be within the same forest.
        damp=value_noise(shape, rng, 9, 3),
        # Which flower colony wins where. Independent of `patch` so a colourful patch is
        # not automatically a dense one.
        colony=value_noise(shape, rng, 15, 2),
        # Wobble for the old-channel scars built in suitability(). Seeded here with
        # everything else so a re-seed moves the scars too.
        wobble=value_noise(shape, rng, 7, 2),
    )


# ── species suitability ─────────────────────────────────────────────────────
def suitability(g, f):
    """Where each species prefers to be. This is the ecology, written by hand.

    Every field is a weight in [0, inf) that is later multiplied by its GAIN, by the
    terrain's mix share and by the density fields. Hard zeros are habitat, not tuning:
    multiplying zero by any gain is still zero, so a gain can never smuggle a species
    somewhere it does not belong.
    """
    terr, dw, rough, flow = g["terr"], g["d_water"], g["rough"], g["flow"]
    d_edge, d_forest, d_meadow, d_cobble = g["d_edge"], g["d_forest"], g["d_meadow"], g["d_cobble"]
    bar_frac, water_frac = g["bar_frac"], g["water_frac"]
    W = {}
    # Brief 2: keep the bar mostly bare. Applied to the three big crowns only — a willow or
    # a flower standing on gravel is exactly right and is what the bar is for.
    on_bar = 1.0 - 0.94 * np.clip(bar_frac / 0.40, 0, 1)
    # Brief 12, precisely: a big crown may stand AT the water, not OVER it.
    over_water = 1.0 - 0.90 * np.clip((water_frac - 0.30) / 0.35, 0, 1)
    on_bar = on_bar * over_water
    # The shrub layer gets a gentler version of the same rule. Willow and alder BELONG on a
    # gravel bar — brief 2 makes them 65% of its vegetation — so this is not about keeping
    # them off it, only about not centring a whole colony where the colony's own spread
    # (70-220 u) is wider than the strip it is standing on.
    on_bar_s = 1.0 - 0.72 * np.clip(bar_frac / 0.40, 0, 1)

    def ramp(v, a, b):
        return np.clip((v - a) / (b - a), 0, 1)

    # A plant on a terrace that floods every spring is a willow; one on a terrace that has
    # not moved in fifty years is a spruce. Distance from the waterline is the proxy for
    # terrace age and it does most of the work below.
    young = 1.0 - ramp(dw, 40, 420)        # 1 at the waterline, 0 well up the terrace
    old = ramp(dw, 140, 750)               # stable ground
    # ⚠️ AND THE TERRAIN KIND OUTRANKS THE DISTANCE HEURISTIC. `old` is a proxy for terrace
    # age read off distance-from-water, and on a narrow island or a tight bend EVERY cell is
    # close to water, so the proxy said "too young for conifer" and the island came back as
    # bare brown forest floor with a few shrubs on it. But `humus` and `mossfloor` are the
    # DESIGNER STATING that this ground is established forest — that is what those kinds
    # mean — and an inferred field has no business overruling authored information. The
    # floor is 0.55 rather than 1.0 so the gradient still works inside a big slab: the
    # waterline edge of a forest is younger than its middle, just not young enough to be
    # treeless.
    old = np.maximum(old, 0.55 * np.isin(terr, (HUMUS, MOSSFLOOR)))
    # Brief 11: boundaries are high-value. A bump that fades within ~140 u of any edge.
    boundary = 1.0 + 0.9 * np.exp(-d_edge / 140.0)
    # Brief 2: fresh cobble beside fast water stays bare.
    fresh = 1.0 - np.clip(flow / 2.4, 0, 1) * (1.0 - ramp(dw, 0, 260))
    opening = 1.0 - np.clip(f["patch"], 0, 1)

    # ── OLD CHANNEL SCARS ───────────────────────────────────────────────────
    # The most distinctive thing in the meander references and the first planting had
    # nothing like it: sinuous ribbons of DIFFERENT vegetation tracing channels the river
    # used to run in, lying roughly parallel to the present bank and wandering across it.
    # They are cheap to make honestly, because that is what they geometrically are — bands
    # of constant-ish distance from the water, displaced by a slow wobble. Taking the
    # fractional part of (distance / wavelength + wobble) and peaking it near 0.5 gives
    # ribbons that follow every bend of the river for free, because `d_water` already does.
    SCAR_WL = 340.0
    ph = np.mod(dw / SCAR_WL + 2.2 * f["wobble"], 1.0)
    scar = np.clip(1.0 - (np.abs(ph - 0.5) / 0.16) ** 2, 0, 1) * ramp(dw, 60, 260)
    scar *= 1.0 - ramp(dw, 900, 1800)      # they die out well away from the river

    # ── DISTURBED GROUND ────────────────────────────────────────────────────
    # Where fireweed actually lives, which is the correction the references force. Brief 3
    # put the flowers on open terrace, so the first planting carpeted 32 ha of it. Fireweed
    # is a coloniser: it takes the margin just behind a gravel bar, the floor of an old
    # channel, and holes in the canopy. All three are fields this file already has.
    bar_margin = np.exp(-np.abs(dw - 130.0) / 100.0)
    disturb = np.clip(np.maximum(np.maximum(0.9 * bar_margin, 0.85 * scar),
                                 0.55 * opening), 0, 1)

    # ── THE RIPARIAN BAND ───────────────────────────────────────────────────
    # The brightest, most consistent feature of every reference: a continuous pale-green
    # deciduous fringe standing between the dark forest and the water, on both banks, for
    # the whole length of the river. It is not a preference, it is a wall of scrub, so it
    # gets its own field rather than relying on `young` alone.
    riparian = np.exp(-np.clip(dw - 30.0, 0, None) / 130.0) * (0.35 + 1.15 * f["fine"])

    # WILLOW — "it should closely follow water" and it is what says THIS LAND FLOODS.
    # Deliberately written on distance-to-water rather than on terrain, because this map has
    # only 4.9 ha of cobble and the willow gradient has to live on the meadow's river margin
    # too. Zero above 600 u from water and nearly zero in mature forest (brief 4).
    W["willow"] = (0.25 + 2.6 * riparian) * (0.35 + young) * boundary * fresh
    W["willow"] *= on_bar_s
    W["willow"] *= np.where(terr == HUMUS, 0.06, 1.0)
    W["willow"] *= np.where(terr == MOSSFLOOR, 0.03, 1.0)
    W["willow"] *= (dw < 700)

    # ALDER — the thicket of disturbed ground: river edge, forest openings, old channels,
    # meadow/forest transition. Brief 4 puts it at openings, so it likes a LOW patch value
    # (a gap in the canopy) as much as it likes an edge.
    W["alder"] = (0.30 + 1.7 * riparian + 0.8 * scar) * boundary * (0.6 + 0.8 * opening) * fresh
    W["alder"] *= on_bar_s
    W["alder"] *= np.where(terr == MOSSFLOOR, 0.45, 1.0)   # brief 5: fewer alder thickets

    # COTTONWOOD — floodplain, terraces, old channels, meadow/river transitions, established
    # islands. Peaks at middle distance from water: off the active bar, not deep in conifer.
    band = np.exp(-((dw - 300.0) / 260.0) ** 2)
    W["cottonwood"] = band * boundary * (0.25 + 1.6 * ramp(f["patch"], 0.22, 0.88))
    W["cottonwood"] *= on_bar
    W["cottonwood"] *= np.where(terr == HUMUS, 0.30, 1.0)   # brief 4: rarer deeper in
    W["cottonwood"] *= np.where(terr == MOSSFLOOR, 0.22, 1.0)
    W["cottonwood"] *= np.where(terr == OUTCROP, 0.05, 1.0)  # brief 7: avoid exposed rock
    # ...and rarer still the deeper into the forest it goes.
    W["cottonwood"] *= np.exp(-np.clip(d_meadow, 0, 3000) / 900.0) * 0.75 + 0.25

    # SPRUCE — the structural forest tree. Stable ground, and it wants to be IN forest.
    W["spruce"] = old * (0.12 + 1.9 * ramp(f["patch"], 0.18, 0.92))
    W["spruce"] *= on_bar
    W["spruce"] *= np.where(terr == MEADOW, 0.16, 1.0)      # brief 3: few in the interior
    W["spruce"] *= 1.0 + 0.6 * np.exp(-d_forest / 260.0)    # forest edge is where it starts

    # HEMLOCK — the same forest, damper and shadier, and it fills between spruce crowns.
    W["hemlock"] = old * (0.10 + 1.8 * ramp(f["patch"], 0.18, 0.92)) * (0.55 + 0.9 * f["damp"])
    W["hemlock"] *= on_bar
    W["hemlock"] *= np.where(terr == MEADOW, 0.10, 1.0)
    W["hemlock"] *= np.where(terr == MOSSFLOOR, 1.35, 1.0)  # brief 5: slightly more hemlock
    W["hemlock"] *= 1.0 + 0.5 * np.exp(-d_forest / 220.0)

    # MOSS MAT — brief 5 is emphatic that this is an ACCENT, not a carpet: it exists to
    # break boundaries and attach moss to objects. So its field is almost entirely the
    # boundary bump and the damp axis, and it is strongest on rock edges (brief 6 gives it
    # 40% of granite's vegetation) and at the humus/moss transition.
    W["moss"] = (0.25 + 1.6 * np.exp(-d_edge / 110.0)) * (0.4 + 1.3 * f["damp"])
    W["moss"] *= np.where(terr == OUTCROP, 2.2, 1.0)
    W["moss"] *= np.where(terr == MEADOW, 0.25, 1.0)
    W["moss"] *= 1.0 - 0.75 * np.clip(f["patch"], 0, 1) * (terr == MEADOW)

    # ── THE FLOWERS ──
    # Two rules now, and the second is the reference correction.
    #
    # 1. COLONIES, not a mix. The `colony` noise decides WHICH species owns a stretch, by
    #    slicing its range into soft bands, so a same-species cluster is the default rather
    #    than a rule applied afterwards. Unchanged from the first planting and it worked.
    # 2. ON DISTURBED GROUND, not on open terrace. This is what changed. A flower here is
    #    a coloniser of the bar margin, the old channel and the canopy gap, so `disturb`
    #    multiplies every species. Combined with the target dropping from 22% to 3%, the
    #    meadow goes from a continuous flower carpet to occasional strong patches on ground
    #    that has a reason to hold them — which is both what the photographs show and what
    #    [[river-fireweed]]'s own manifest note has asked for since the day it shipped
    #    ("USE IT SPARINGLY ... a dozen of them on one terrace will read as a flowerbed").
    col = f["colony"]
    sun = 1.0 - 0.85 * np.exp(-d_forest / 200.0) * (terr != HUMUS) * (terr != MOSSFLOOR)
    # No flowers under closed canopy except at its edge.
    shade = np.where(np.isin(terr, (HUMUS, MOSSFLOOR)),
                     0.08 + 0.9 * np.exp(-d_meadow / 240.0), 1.0)

    def colony_band(lo, hi):
        mid, half = (lo + hi) / 2, (hi - lo) / 2
        return np.clip(1.0 - (np.abs(col - mid) / (half + 0.10)) ** 2, 0.03, 1.0)

    # FIREWEED — the coloniser, and the venue's one loud accent. Heaviest weight on
    # disturbance of all five: it is the species that turns up on a scraped bar margin.
    W["fireweed"] = colony_band(0.00, 0.34) * shade * (0.15 + 1.5 * disturb) * boundary
    # LUPINE — open terrace behind the scrub, off the gravel. Its own manifest note bans it
    # from the bar on a measurement: dE 7.9 from [[river-cobble]], it vanishes there.
    W["lupine"] = colony_band(0.30, 0.56) * sun * shade * (0.3 + 1.0 * ramp(dw, 120, 700)) \
        * (0.35 + 0.9 * disturb)
    W["lupine"] *= np.where(terr == COBBLE, 0.10, 1.0)
    W["lupine"] *= np.where(terr == OUTCROP, 0.05, 1.0)
    # ARNICA — sunny openings in and at the edge of the forest.
    W["arnica"] = colony_band(0.50, 0.74) * sun * shade * (0.3 + 1.1 * disturb)
    # YARROW — the loose one, and the flattest field of the five so it reads as diffuse
    # rather than as a colony. Widest tolerance; likes the dry terrace and the old channel.
    W["yarrow"] = (0.35 + 0.8 * colony_band(0.66, 0.90)) * shade \
        * (0.5 + 0.6 * ramp(dw, 60, 500)) * (0.4 + 0.8 * disturb)
    # PAINTBRUSH — a tiny concentrated accent. Narrowest band, tightest clusters.
    W["paintbrush"] = colony_band(0.86, 1.02) * sun * shade * (0.25 + 1.1 * disturb)

    # ── EVERYTHING is gated on visibility and on the rapids ──
    keep = (g["vis"] & g["land"]) * g["fade"]
    quiet = 1.0 - RAPIDS_CUT * rough
    for k in W:
        W[k] = np.maximum(W[k], 0) * keep * quiet
    return W


def legibility(g):
    """Brief 12's density multiplier: keep the gameplay geometry readable."""
    corr = 1.0 - (1.0 - CORRIDOR_CUT) * np.clip(1.0 - g["d_line"] / CORRIDOR_R, 0, 1)
    gate = 1.0 - 0.55 * np.clip(1.0 - g["d_gate"] / GATE_CLEAR, 0, 1)
    return (corr * gate).astype(np.float32)


# ── which species can actually be planted ───────────────────────────────────
def registered_kinds():
    """Kinds with a PROP_KINDS row. A placement without one compiles to nothing drawable."""
    src = VENUEDOC.read_text()
    i = src.index("const PROP_KINDS = {")
    body = src[i:src.index("\n};", i)]
    return set(re.findall(r"'([a-z0-9-]+)':\s*\{", body))


def resolve_registered(quiet=False):
    """Drop unregistered species and redistribute their share inside their own layer."""
    have = registered_kinds()
    missing = [s for s, v in SPECIES.items() if v["kind"] not in have]
    if not missing:
        return []
    for t, layers in MIX.items():
        for layer, mix in layers.items():
            lost = sum(v for s, v in mix.items() if s in missing)
            if lost <= 0:
                continue
            for s in list(mix):
                mix[s] = 0.0 if s in missing else mix[s] / (1.0 - lost)
    if not quiet:
        print("  ⚠️ NOT REGISTERED IN PROP_KINDS, so not planted: " + ", ".join(missing))
        print("     their share was redistributed inside each layer; re-run when the art lands")
    return missing


# ── planting ────────────────────────────────────────────────────────────────
def plant(doc, seed=7, maps=False, quiet=False):
    g = geometry(doc)
    f = fields(g, seed)
    W = suitability(g, f)
    leg = legibility(g)
    terr, vis, land = g["terr"], g["vis"], g["land"]
    H, Wd = terr.shape
    x0, y0 = float(g["x0"]), float(g["y0"])
    cell_a = CELL * CELL

    rng = random.Random(seed)
    nprng = np.random.RandomState(seed & 0x7FFFFFFF)
    yy, xx = np.mgrid[0:H, 0:Wd]
    X = x0 + (xx + 0.5) * CELL
    Y = y0 + (yy + 0.5) * CELL

    # Terrains actually present and visible, and their areas.
    present = [t for t in DRY if (vis & (terr == t)).any()]
    tcells = {t: int((vis & (terr == t)).sum()) for t in present}

    # ── coverage accumulators. One raster per layer per terrain is what lets the report be
    #    per-terrain rather than a single global number that hides a failure in one meadow.
    cov = {ly: np.zeros(terr.shape, bool) for ly in ("tree", "shrub", "flower", "moss")}
    cov_sp = {s: np.zeros(terr.shape, bool) for s in SPECIES}
    props, placed = [], []
    clustered_n = {ly: [0, 0] for ly in cov}      # [in-cluster, total]
    # Incremental per-terrain counters. Re-measuring a full raster inside the placement
    # loop is what makes an allocator like this unusable at ten thousand props, so every
    # stamp reports the cells it actually newly covered and these are updated from that.
    covA = {ly: {t: 0 for t in present} for ly in cov}          # layer cells, by terrain
    covS = {s: {t: 0 for t in present} for s in SPECIES}        # species cells, by terrain
    cntS = {s: {t: 0 for t in present} for s in SPECIES}        # species props, by terrain
    # Union of every disc from a prop ROOTED in each terrain. What this buys is the one
    # split the coverage table cannot otherwise make: how much of the vegetation you see on
    # a terrain grew there, and how much is a neighbour's crown hanging over it.
    root_cov = {t: np.zeros(terr.shape, bool) for t in present}

    def stamp(mask, x, y, r):
        """Paint a disc and return the cells it NEWLY covered, as (window, bool array)."""
        i0 = max(0, int((y - r - y0) / CELL))
        i1 = min(H, int((y + r - y0) / CELL) + 1)
        j0 = max(0, int((x - r - x0) / CELL))
        j1 = min(Wd, int((x + r - x0) / CELL) + 1)
        if i0 >= i1 or j0 >= j1:
            return None
        sub = (X[i0:i1, j0:j1] - x) ** 2 + (Y[i0:i1, j0:j1] - y) ** 2 <= r * r
        win = mask[i0:i1, j0:j1]
        new = sub & ~win
        win |= sub
        return (i0, i1, j0, j1), new

    def tally(counter, res):
        """Add a stamp's new cells to a per-terrain counter, visible land only."""
        if res is None:
            return
        (i0, i1, j0, j1), new = res
        n = new & vis[i0:i1, j0:j1]
        if not n.any():
            return
        tw = terr[i0:i1, j0:j1][n]
        for t in present:
            c = int((tw == t).sum())
            if c:
                counter[t] += c

    def at(x, y):
        j, i = int((x - x0) / CELL), int((y - y0) / CELL)
        if 0 <= i < H and 0 <= j < Wd:
            return i, j
        return None

    def place(x, y, sp, base_scale, in_cluster, home, job_layer):
        spec = SPECIES[sp]
        # Brief 8: ONE base scale per stand, members jitter around it. Not an independent
        # draw per plant — that is the thing brief 8 says destroys species identity.
        # Clamped back into the species' own band: brief 8 asks for +-15-20% jitter AND
        # brief 7/8 state a range per species, and unclamped jitter breaks the second to
        # satisfy the first — willow reached 3.49x against a stated 1.75-3.00x.
        lo, hi = spec["ex"]
        sc = min(hi, max(lo, base_scale * (1.0 + rng.uniform(-CLUSTER_JITTER, CLUSTER_JITTER))))
        r = spec["world"] * sc / 2.0 * spec["rmul"]
        props.append({"id": f"veg-{len(props) + 1}", "kind": spec["kind"],
                      "x": round(x, 1), "y": round(y, 1),
                      "heading": round(rng.uniform(0, 2 * math.pi), 3),
                      "scale": round(sc, 3)})
        placed.append((x, y, r, sp))
        # ⚠️ CHARGED TO THE JOB'S LAYER, NOT THE SPECIES'. Alder and willow are shrubs
        # everywhere, but brief 3 gives the meadow ONE woody budget of 8-20% and splits it
        # across all five species including those two, where brief 4 gives the forest a
        # separate 10-20% shrub layer under its canopy. Charging by the species would put a
        # meadow alder into a shrub budget the meadow does not have, and the meadow would
        # quietly run at woody 22% against a 20% ceiling with both columns reading fine.
        ly = job_layer
        tally(covA[ly], stamp(cov[ly], x, y, r))
        tally(covS[sp], stamp(cov_sp[sp], x, y, r))
        if home in root_cov:
            stamp(root_cov[home], x, y, r)
        if home in cntS[sp]:
            cntS[sp][home] += 1
        clustered_n[ly][1] += 1
        clustered_n[ly][0] += 1 if in_cluster else 0

    # ── THE ALLOCATOR ───────────────────────────────────────────────────────
    # Two nested decisions, and they answer different questions.
    #
    # WHICH (terrain, layer) — whichever is furthest behind ITS OWN coverage target. This
    # is plant_cove.py's lesson and it transfers exactly: splitting a budget up front in
    # proportion to area lands each terrain at a different fraction of its target, because
    # a sprite dropped on ground that is already dense buys less new coverage than one on
    # thin ground. Progress, not area.
    #
    # WHICH SPECIES — whichever is furthest behind its own share of that layer, by CANOPY
    # for woody and moss and by COUNT for flowers, per the brief's own wording. This is the
    # part plant_cove.py solves with machine-fitted gains and this file does not need to.
    #
    # WHERE — the suitability field, always. Species choice never moves a plant somewhere it
    # does not belong: a share deficit decides WHICH species gets the next stand, and the
    # ecology decides where that stand goes.
    def progress(t, ly):
        want = TARGET[t][ly] * tcells[t]
        return 9.9 if want <= 0 else covA[ly][t] / want

    jobs = [(t, ly) for t in present for ly in cov
            if tcells[t] and TARGET[t].get(ly) and any(MIX[t][ly].values())]

    # Normalised placement weights per (terrain, layer, species). Suitability x legibility,
    # restricted to the terrain. The MIX share is deliberately NOT folded in here — it is
    # the deficit rule's job now, not the sampler's.
    sample = {}
    for t, ly in jobs:
        for sp, share in MIX[t][ly].items():
            if share <= 0:
                continue
            w = W[sp] * leg * (terr == t) * vis
            if sp == "moss" and t == OUTCROP:
                w = w * OUTCROP_MOSS
            s = float(w.sum())
            if s > 0:
                sample[(t, ly, sp)] = w / s

    def pick_species(t, ly):
        opts = [sp for sp in MIX[t][ly] if MIX[t][ly][sp] > 0 and (t, ly, sp) in sample]
        if not opts:
            return None
        if ly in COUNT_LAYERS:
            # Placement frequency: largest remaining deficit, +0.5 so the first draw in a
            # terrain is spread across species rather than always the same one.
            return min(opts, key=lambda s: (cntS[s][t] + 0.5) / MIX[t][ly][s])
        want = TARGET[t][ly] * tcells[t]
        return min(opts, key=lambda s: covS[s][t] / max(want * MIX[t][ly][s], 1e-9))

    # Brief 9's clustered fractions are of PLANTS, not of stands, so the per-stand lone
    # probability has to be solved from the species' own mean stand size: with mean m and
    # lone probability p, the planted fraction that is lone is p / (p + (1-p)m).
    def lone_p(sp, ly):
        m = (SPECIES[sp]["cluster"][0] + SPECIES[sp]["cluster"][1]) / 2.0
        want_lone = 1.0 - CLUSTERED[ly]
        return min(0.95, want_lone * m / (1.0 - want_lone + want_lone * m))

    # ⚠️ LOCAL DEFICIT, RECOMPUTED AS WE GO. plant_cove.py's note records that per-zone
    # coverage accounting starves small features, and it does: a terrain target is met
    # across 44 ha of forest while a two-hectare mid-river island inside it stays bare,
    # because the sampler has no idea the island is behind. Its fix was a per-landmass
    # top-up pass; this is the same idea made continuous — every REBALANCE placements,
    # measure canopy in a DEFICIT_R window with a summed-area table and multiply the
    # sampling weights by how far behind each cell is. Costs ~10 ms per rebuild, about
    # sixty rebuilds for a full planting, and it fixes three things at once: starved
    # islands, over-dense cores, and brief 10's density variation, which is now the noise
    # fields deciding WHERE the slack sits rather than an accident of sampling order.
    DEFICIT_R, REBALANCE = 260.0, 250
    kd = max(1, int(DEFICIT_R / CELL))
    ai = np.clip(np.arange(H)[:, None] + np.array([-kd, kd + 1])[None, :], 0, H)
    aj = np.clip(np.arange(Wd)[:, None] + np.array([-kd, kd + 1])[None, :], 0, Wd)
    _a, _b = ai[:, 0], ai[:, 1]
    _c, _d = aj[:, 0], aj[:, 1]
    _area = ((_b - _a)[:, None] * (_d - _c)[None, :]).astype(np.float32)

    def local_frac(mask):
        sat = np.pad(mask.astype(np.float32), ((1, 0), (1, 0))).cumsum(0).cumsum(1)
        tot = (sat[np.ix_(_b, _d)] - sat[np.ix_(_a, _d)]
               - sat[np.ix_(_b, _c)] + sat[np.ix_(_a, _c)])
        return tot / np.maximum(_area, 1)

    def rebuild_weights():
        for (t, ly, sp) in list(sample):
            want = TARGET[t][ly]
            if want <= 0:
                continue
            df = np.clip(1.0 - local[ly] / np.maximum(want * demand[t], 1e-4), 0.02, 1.0) ** 1.4
            w = base_w[(t, ly, sp)] * df
            tot = float(w.sum())
            sample[(t, ly, sp)] = (w / tot).ravel() if tot > 0 else base_w[(t, ly, sp)].ravel()

    # ⚠️ THE LOCAL TARGET IS NOT FLAT, AND MAKING IT FLAT UNDID TWO OTHER RULES AT ONCE.
    # A deficit measured against the terrain's single number tells the sampler to fill
    # every hollow, so it erased exactly the two places density is SUPPOSED to be low:
    # brief 10's clearings (density variation collapsed from cv 0.27 to 0.08 — a forest
    # with no structure) and brief 12's racing corridor (which came back 15% DENSER than
    # the far bank, because `leg` had thinned it and the rebalance read that as a deficit
    # and topped it back up). The demand field carries both, normalised to mean 1 over each
    # terrain so the terrain still lands on its own target — the slack just sits where the
    # ecology and the gameplay rules put it.
    demand_raw = (leg * (0.18 + 1.75 * np.clip(f["patch"], 0, 1))).astype(np.float32)
    demand = {}
    for t in present:
        msk = vis & (terr == t)
        mu = float(demand_raw[msk].mean()) if msk.any() else 1.0
        demand[t] = demand_raw / max(mu, 1e-6)

    base_w = {k: (v.reshape(H, Wd) if v.ndim == 1 else v) for k, v in sample.items()}
    local = {ly: np.zeros((H, Wd), np.float32) for ly in cov}
    rebuild_weights()

    GMAX = 400000
    guard = 0
    while guard < GMAX:
        guard += 1
        t, ly = min(jobs, key=lambda j: progress(*j))
        if progress(t, ly) >= 1.0:
            break
        sp = pick_species(t, ly)
        if sp is None:
            jobs = [j for j in jobs if j != (t, ly)]
            if not jobs:
                break
            continue
        if guard % REBALANCE == 0:
            for _ly in cov:
                local[_ly] = local_frac(cov[_ly])
            rebuild_weights()
        idx = nprng.choice(sample[(t, ly, sp)].size, p=sample[(t, ly, sp)])
        i, j = idx // Wd, idx % Wd
        spec = SPECIES[sp]
        cx, cy = float(X[i, j]), float(Y[i, j])
        base = rng.uniform(*spec["ex"])
        lone = rng.random() < lone_p(sp, ly)
        n = 1 if lone else rng.randint(*spec["cluster"])
        spread = rng.uniform(*spec["spread"])
        # Brief 4's mixed stands: a companion species, sometimes. Every third member.
        comp, comp_p = COMPANION.get(sp, (None, 0.0))
        use_comp = comp is not None and MIX[t][ly].get(comp, 0) > 0 and rng.random() < comp_p
        for k in range(n):
            # ⚠️ THE TARGET IS CHECKED PER MEMBER, NOT PER STAND. One cottonwood at 240px
            # covers 1.1% of this venue's entire visible cobble, so a stand of four
            # committed up front overshoots a 3% target by half before the loop looks
            # again. Checking here costs nothing and is why the report lands on its numbers.
            if progress(t, ly) >= 1.0:
                break
            # Irregular radial falloff, biased inward so the middle of a stand is its
            # densest part — compose.py's r = R*u^0.62, for the same reason.
            a = rng.uniform(0, 2 * math.pi)
            rr = spread * (rng.random() ** 0.62)
            x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
            c = at(x, y)
            if c is None:
                continue
            # Thin toward unsuitable ground rather than clipping at the polygon edge, so a
            # stand fades out instead of stopping in a line. A member may cross a terrain
            # boundary — brief 11 explicitly wants plants to straddle them — but only where
            # it would have been welcome on the other side too.
            who = comp if (use_comp and k % 3 == 2) else sp
            if W[who][c] <= 0 or not vis[c] or not land[c]:
                continue
            if rng.random() > min(1.0, W[who][c] / max(W[who][i, j], 1e-6)) ** 0.35:
                continue
            place(x, y, who, base, not lone, t, ly)

    # ── Z-ORDER: CLASS, THEN GROUND CONTACT ─────────────────────────────────
    # Brief 13, and it is deliberately NOT what plant_cove/lake/ocean do — they sort by real
    # height x scale, so a large individual passes over a small one of a taller species. The
    # brief asks for explicit classes with the anchor's Y inside each, and names the order:
    # moss mat, flowers, willow, alder, hemlock, spruce, cottonwood. That puts cottonwood
    # over spruce, which a real-height sort would invert (a Sitka spruce is the taller tree).
    # drawProps paints within a plane in document order, so this array IS the z-order.
    props.sort(key=lambda pr: (SPECIES[KIND_SP[pr["kind"]]]["cls"], pr["y"]))

    st = measure(g, f, props, cov, cov_sp, covS, cntS, root_cov, clustered_n, tcells,
                 present, cell_a, map_land_area(doc))
    if not quiet:
        report(st, seed, guard >= GMAX)
    if maps:
        dump_maps(g, f, W, leg, props)
    return props, st


def map_land_area(doc):
    """Dry-land area of the WHOLE map, from the polygons, in world units squared.

    Measured off the shapes rather than off the raster, because the raster stops at the
    camera envelope and the whole point of the first line of the report is the ratio
    between what exists and what can be seen.
    """
    def A(p):
        a = 0.0
        for i in range(len(p)):
            x0, y0 = p[i]
            x1, y1 = p[(i + 1) % len(p)]
            a += x0 * y1 - x1 * y0
        return abs(a) / 2
    tot = 0.0
    for s in doc["shapes"]:
        if TERRAIN.get(s["kind"]) in DRY:
            tot += A(s["outer"]) - sum(A(h) for h in s.get("holes", []))
    return tot


def measure(g, f, props, cov, cov_sp, covS, cntS, root_cov, clustered_n, tcells, present,
            cell_a, all_area):
    terr, vis = g["terr"], g["vis"]
    st = {"n": len(props), "terr": {}, "sp": {}, "clustered": {}, "tcells": tcells,
          "cell_a": cell_a, "all_area": all_area}
    st["vis_area"] = float((vis & g["land"]).sum() * cell_a)
    for t in present:
        m = vis & (terr == t)
        n = max(1, int(m.sum()))
        d = {ly: float((cov[ly] & m).sum()) / n for ly in cov}
        d["area"] = n * cell_a
        d["open"] = float((~(cov["tree"] | cov["shrub"] | cov["flower"]) & m).sum()) / n
        anyv = cov["tree"] | cov["shrub"] | cov["flower"] | cov["moss"]
        d["self"] = float((anyv & root_cov[t] & m).sum()) / n
        d["over"] = float((anyv & ~root_cov[t] & m).sum()) / n
        # The brief's own tables, checked where they are stated: per terrain, per layer.
        d["mix"] = {}
        for ly in cov:
            want = TARGET[t][ly] * n
            if want <= 0:
                continue
            tot_n = sum(cntS[s][t] for s in MIX[t][ly] if MIX[t][ly][s] > 0)
            # ⚠️ NORMALISED AGAINST THE LAYER'S OWN TOTAL, not against the coverage target.
            # Species canopies OVERLAP, so the sum of covS over a layer exceeds the union
            # the target is written against and every row would read high. A share is a
            # share of what was actually planted.
            tot_c = sum(covS[s][t] for s in MIX[t][ly] if MIX[t][ly][s] > 0)
            for s, share in MIX[t][ly].items():
                if share <= 0:
                    continue
                got = (cntS[s][t] / tot_n if tot_n else 0.0) if ly in COUNT_LAYERS else \
                      (covS[s][t] / tot_c if tot_c else 0.0)
                d["mix"][(ly, s)] = (share, got, cntS[s][t])
        st["terr"][t] = d
    for s in SPECIES:
        k = SPECIES[s]["kind"]
        st["sp"][s] = {"n": sum(1 for p in props if p["kind"] == k),
                       "cov": float((cov_sp[s] & vis & g["land"]).sum() * cell_a)}
    for ly, (c, n) in clustered_n.items():
        st["clustered"][ly] = (c / n) if n else 0.0
    # Brief 10: density must vary. Measure it — coefficient of variation of the tree+shrub
    # coverage over 600u blocks of forest. A flat 60% everywhere scores near zero.
    B = int(600 / CELL)
    woody = (cov["tree"] | cov["shrub"]).astype(np.float32)
    forest = vis & np.isin(terr, (HUMUS, MOSSFLOOR))
    vals = []
    for i in range(0, woody.shape[0] - B, B):
        for j in range(0, woody.shape[1] - B, B):
            fm = forest[i:i + B, j:j + B]
            if fm.mean() > 0.7:
                vals.append(woody[i:i + B, j:j + B][fm].mean())
    st["density_cv"] = float(np.std(vals) / max(np.mean(vals), 1e-6)) if len(vals) > 3 else 0.0
    st["blocks"] = len(vals)
    # Brief 12: did the corridor actually thin out?
    near = vis & g["land"] & (g["d_line"] < CORRIDOR_R * 0.5)
    far = vis & g["land"] & (g["d_line"] > CORRIDOR_R * 2)
    anyveg = cov["tree"] | cov["shrub"] | cov["flower"]
    st["corridor"] = (float(anyveg[near].mean()) if near.any() else 0.0,
                      float(anyveg[far].mean()) if far.any() else 0.0)
    return st


def report(st, seed, hit_guard):
    PX2 = PX_PER_M * PX_PER_M
    print(f"\n  Sockeye Run — {st['n']} props, seed {seed}")
    print(f"  plantable {st['vis_area'] / PX2 / 1e6:.3f} km2 of {st['all_area'] / PX2 / 1e6:.3f} km2 "
          f"land ({st['vis_area'] / st['all_area'] * 100:.1f}% — the rest is out of camera reach)")
    print(f"\n  {'terrain':11} {'ha':>6} {'tree':>7} {'shrub':>7} {'flower':>7} {'moss':>6} {'open':>6}")
    for t, d in sorted(st["terr"].items(), key=lambda kv: -kv[1]["area"]):
        want = TARGET[t]
        print(f"  {TNAME[t]:11} {d['area'] / PX2 / 10000:6.2f} "
              f"{d['tree']:6.1%} {d['shrub']:6.1%} {d['flower']:6.1%} {d['moss']:5.1%} {d['open']:5.1%}")
        print(f"  {'':11} {'target':>6} {want['tree']:6.1%} {want['shrub']:6.1%} "
              f"{want['flower']:6.1%} {want['moss']:5.1%}")
        print(f"  {'':11} {'':>6} vegetated {d['self'] + d['over']:5.1%} = {d['self']:.1%} "
              f"rooted here + {d['over']:.1%} overhung from next door")
    # ⚠️ PER TERRAIN, NOT GLOBAL. A single map-wide species table is exactly the thing that
    # hides a failure in one place — the whole meadow could be fireweed and a global column
    # would still read 35%. The brief states its mixes per terrain, so they are checked per
    # terrain, and `n` is printed beside the share so a 100%-of-four-plants row is visible
    # as the non-result it is.
    print(f"\n  species mix, checked where the brief states it")
    for t, d in sorted(st["terr"].items(), key=lambda kv: -kv[1]["area"]):
        for ly in ("tree", "shrub", "flower", "moss"):
            rows = [(s, v) for (l, s), v in d["mix"].items() if l == ly]
            if not rows or ly == "moss":
                continue
            unit = "count" if ly in COUNT_LAYERS else "canopy"
            cells = "  ".join(f"{s} {got:.0%}/{want:.0%}({n})"
                              for s, (want, got, n) in sorted(rows, key=lambda r: -r[1][0]))
            print(f"    {TNAME[t]:9} {ly:6} ({unit:6}) {cells}")
    print(f"\n  {'species':12} {'n':>6} {'cover of visible land':>22}   scale")
    for s, d in sorted(st["sp"].items(), key=lambda kv: -kv[1]["n"]):
        if not d["n"]:
            continue
        sp = SPECIES[s]
        lo, hi = sp["ex"]
        print(f"  {s:12} {d['n']:6} {d['cov'] / st['vis_area']:21.1%}   "
              f"{lo:.2f}-{hi:.2f}x  ({sp['world'] * (lo + hi) / 2:.0f}px effective)")
    print("\n  clustered: " + "  ".join(f"{ly} {v:.0%}" for ly, v in st["clustered"].items())
          + "   (brief 9: tree 70-80, shrub 80-90, flower 85-95)")
    print(f"  density variation across {st['blocks']} forest blocks: cv {st['density_cv']:.2f} "
          f"(brief 10 wants this well above 0 — a flat forest scores 0)")
    n, fr = st["corridor"]
    print(f"  racing corridor: {n:.1%} vegetated near the line vs {fr:.1%} away from it "
          f"= {(1 - n / max(fr, 1e-9)) * 100:.0f}% thinner (brief 12 asks 30-60%)")
    if hit_guard:
        print("  ⚠️ hit the placement guard — a target is unreachable on this map")


def dump_maps(g, f, W, leg, props):
    """Field PNGs. The owner judges venue art by looking at it, so make looking cheap."""
    try:
        from PIL import Image
    except ImportError:
        print("  (no PIL — skipping maps)")
        return
    out = ROOT / "_river_maps"
    out.mkdir(exist_ok=True)

    def save(name, a, cmap=None):
        a = np.asarray(a, np.float32)
        lo, hi = float(np.nanmin(a)), float(np.nanmax(a))
        v = (a - lo) / max(hi - lo, 1e-9)
        im = Image.fromarray((v * 255).astype(np.uint8))
        im.save(out / f"{name}.png")

    save("terrain", g["terr"])
    save("visible", g["vis"].astype(np.float32))
    save("d_water", np.minimum(g["d_water"], 1200))
    save("rough", g["rough"])
    save("flow", g["flow"])
    save("legibility", leg)
    save("colony", f["colony"])
    save("patch", f["patch"])
    for s in W:
        save(f"w_{s}", np.clip(W[s], 0, np.percentile(W[s][W[s] > 0], 99) if (W[s] > 0).any() else 1))
    print(f"  -> {out.relative_to(REPO.parent)}/  ({len(list(out.glob('*.png')))} PNGs)")


def compact_props(body):
    """One line per prop instead of seven — plant_cove.py's reasoning, verbatim."""
    out, i = [], 0
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
    args = ap.parse_args()

    src = DOC.read_text()
    i = src.index(PREFIX)
    body = src[src.index("{", i):src.rindex("}") + 1]
    doc = json.loads(body)

    resolve_registered()

    keep = [p for p in doc.get("props", []) if not str(p.get("id", "")).startswith("veg-")]
    new, _ = plant(doc, args.seed, args.maps)
    if args.dry:
        print("\n  (dry run: nothing written)")
        return
    doc["props"] = keep + new
    body = compact_props(json.dumps(doc, indent=2, ensure_ascii=False))
    DOC.write_text(src[:src.index("{", i)] + body + src[src.rindex("}") + 1:])
    print(f"\n  -> {DOC.relative_to(REPO.parent)}  ({len(keep)} kept, {len(new)} planted, "
          f"{len(DOC.read_text()) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()

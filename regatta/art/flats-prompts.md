# Spoonbill Flats — texture prompts (Sep 16 2026)

Three ground tiles for the tidal estuary, on the [VENUE] [TERRAIN] convention (Wes: a new
venue's grounds are its own kinds even where they repeat a material). They are REGISTERED
in `art/manifest.json` as texture slots — the pipeline addresses them by key:

    python3 regatta/art/prompt.py flats-saltmarsh
    python3 regatta/art/prompt.py flats-mudflat
    python3 regatta/art/prompt.py flats-sand
    # save each master as regatta/art/inbox/<key>.png, then
    python3 regatta/art/ingest.py flats-saltmarsh flats-mudflat flats-sand

(`prompt.py` prepends the base and texture clauses itself; the subjects below are what it
carries.) Every tile is a seamless square seen from directly overhead in flat even light,
no water, no waves, no boats, no shadows with direction, no vignette, no text.

How they are used, so the briefs are honest about what the camera resolves:

| kind | where it draws | tileWorld | code row on ingest |
|---|---|---|---|
| `flats-marsh` (look `saltmarsh`) | the never-wet ground: the shore and the islands. Drawn by drawIslands like any land. | 128 | `LAND_TEXTURES.saltmarsh` in js/render/sprites.js (src, tile 128, alpha ~0.6); reset `ISLAND_STYLES.saltmarsh.body` to the delivered mean |
| flats mud (`flats-mudflat`) | the intertidal ground the tide layer paints (js/tide.js `COL.mud`) — most of the exposed flat at low water | 128 | set `TIDE.tiles.mud` in js/tide.js to `assets/images/terrain/flats/mudflat.png` (the hook is written: the tile's luma about its mean modulates the dry pass at `TIDE.tileMix`); reset `COL.mud` to the delivered mean |
| flats sand (`flats-sand`) | bars and crests: every sill, the two spits (`COL.sand`) | 128 | `TIDE.tiles.sand`, same hook, blended by the field's material raster; reset `COL.sand` |

The tide layer already darkens freshly exposed ground and pales it with height, so the
tiles carry TEXTURE, not wetness: "wetness is a rendering treatment of the same material,
not a fourth terrain" (the coding brief §2) is exactly how the code is built.

---

## 1. `saltmarsh` — Saltmarsh Turf

SUBJECT: A SALTMARSH seen from directly overhead from about ten metres up, in flat even
light — the low, dense, salt-tolerant turf of an estuary's high ground: cordgrass and
sea-lavender and samphire grown into one close mat. THE SQUARE COVERS ABOUT 14 METRES.
At this height the turf is a fine, even, muted texture: a close mottle of olive and
straw tufts with no single plant resolvable, broken by a few SMALL IRREGULAR PATCHES OF
BARE BROWN SOIL — three to six in the square, no two the same size, never aligned,
each a soft-edged pan of dark peaty silt — and by one or two hairline drainage cracks
that wander and stop. NOTHING REPEATS: no rows, no lattice, no even scatter, no
direction the eye can follow. THE COLOUR IS MUTED OLIVE AND STRAW: the whole image
holds a narrow range from #6f6f3a to #a9a66a around a mean of #8f8f52 — greyed, dry,
sun-bleached green-gold, never a lawn green, never yellow, never brown overall. The
soil patches are #4a3b26 to #5e4a30. No water, no reeds standing up, no flowers, no
birds, no shells.

CHECK ON DELIVERY: wrap; mean within ~3 of #8f8f52; the soil patches irregular and few
(a grid of them is the failure — cinder's quilt, see art/manifest.json); dE from the
tide layer's dry mud (#b08a54) at least 15 so marsh and mud read apart at the edge.

## 2. `flats-mudflat` — Golden Mudflat

SUBJECT: A TIDAL MUDFLAT seen from directly overhead from about ten metres up, in flat
even light, an hour after the water left it — warm ochre and caramel SILT, smooth,
faintly gleaming, laid in broad soft faceted patches where the last of the ebb drained
across it. THE SQUARE COVERS ABOUT 14 METRES. The structure is BROAD AND SMOOTH: wide
low planes of near-uniform tone meeting at soft seams, with SUBTLE DRAINAGE WRINKLES —
a few shallow, meandering, branching runnels a hand wide, darker in their floors, that
wander across the square and out of it; two or three worm-cast dimples; nothing else.
NO CRACKED-DESERT PATTERN: no polygons, no curling plates, no dry cracks — this mud is
damp. No ripples, no parallel ridges, nothing that repeats or lines up. THE COLOUR IS
WARM OCHRE: the whole image holds a narrow range from #957048 to #c9a266 around a mean
of #b08a54, damp-looking, with the runnel floors a shade darker (#7a5c38). Never grey,
never orange, never yellow. No water standing in it, no birds, no footprints, no shells.

CHECK ON DELIVERY: wrap; mean within ~3 of #b08a54; anisotropy low (runnels wander,
they do not run one way); no cracked-mud polygons at all — that is a reject.

## 3. `flats-sand` — Rippled Sand

SUBJECT: A DRYING SANDBAR seen from directly overhead from about ten metres up, in flat
even light — lighter honey and sandy gold sand, firm, with SMALL SIMPLIFIED RIPPLE RIDGES
left by the tide. THE SQUARE COVERS ABOUT 14 METRES. The ripples are the subject and
the risk: short, low, gently curved crests a hand apart, running in PATCHES whose
direction wanders across the square — one patch bending into the next, crests forking
and dying out — so that no straight line crosses the frame and no spacing repeats
exactly; between the patches, small smooth pans of unrippled sand. The ridges read as
a soft light-and-shade relief, never as drawn lines. NO CRACKS, no shells in rows, no
footprints, no weed. THE COLOUR IS HONEY GOLD, clearly lighter and cooler than the
mudflat: the whole image holds a narrow range from #c8ad76 to #eddcae around a mean of
#dec484. Never white, never orange, never grey. No water.

CHECK ON DELIVERY: wrap; mean within ~3 of #dec484; the ripple patches must change
direction inside the square (parallel crests edge to edge tile into a corduroy field —
a reject, and retiling cannot fix it: bay-sand's lesson); dE from the mud at least 12.

---

Withies (the channel markers) and the spoonbills are drawn procedurally by js/tide.js
(a stake with a twig tuft and an IALA topmark that leans with the stream; small birds
feeding on the band the ebb just uncovered) — no art owed for either. If a painted withy
is ever wanted it is a PROP kind, not a tile: one leaning birch bough on a stake, top-down.

---

## Props (registered Sep 16 2026, night — eighteen `open` slots in art/manifest.json)

    python3 regatta/art/prompt.py <key>          # the brief
    # save the master as regatta/art/inbox/<key>.png, then
    python3 regatta/art/ingest.py <key> [<key> ...]

The venue has no placed props yet; withies, spoonbill sandpipers, the waterline and the
draft contour are procedural. Eighteen slots, in the order they earn their place:

| key | role | world | contact | what it is for |
|---|---|---|---|---|
| `flats-stranded-dinghy` | ambient | 48 | none | the warning: a hull the tide left, on the bars a racer passes |
| `flats-kaap` | landmark | 56 | hard, h15 | the mouth's timber daymark, one on each spit |
| `flats-perch-beacon` | nav | 44 | hard, h8 | the throat and the creek junctions; red to port (green derived) |
| `flats-wreck-hull` | landmark | 100 | hard, h3 | a derelict smack on the ebb delta and the head's bar |
| `flats-oyster-trestles` | hazard | 150 | hard, h1 | rows you must not sail through, on the low flats |
| `flats-fish-weir` | hazard | 200 | hard, h2 | a stake net, mouth downstream |
| `flats-fishing-boat` | hazard | 64 | hard, h3 | on moorings in the pools and the channel's edges |
| `flats-houseboat` | landmark | 120 | hard, h5 | one, against the marsh at the traverse |
| `flats-oyster-shed` | landmark | 100 | hard, h6 | one, where the wantij creek leaves the channel |
| `flats-tide-mill` | landmark | 240 | hard, h10 | THE centrepiece, placed once at the head beside the finish |
| `flats-stone-bridge` | landmark | 300 | none | scenery across the river beyond the finish |
| `flats-spoonbill-roost` | ambient | 64 | none | the witness, standing; creek banks and pool edges |
| `flats-seal-haulout` | ambient | 110 | none | the swash bars |
| `flats-driftwood-tree` | ambient | 100 | none | the high bars and the spit's back |
| `flats-shell-bank` | ambient | 150 | none | the bright line a bar wears |
| `flats-eelgrass-bed` | ambient | 175 | none, seabed | the low flats beside the channels, under the water |
| `flats-sea-lavender` | ambient | 72 | none | colour on the marsh |
| `flats-brent-geese` | ambient | 100 | none | winter on the eelgrass |

On ingest each gets its PROP_KINDS row (label, plane, contact, height) and the hard ones a
traced collider (art/prop_outlines.py); placement is Wes's in editor.html. One engine item
before placing: a prop on ground that dries needs to draw UNDER the tide's water when it is
covered (the seabed plane under the wet pass) — the eelgrass bed and the dinghy want that.

**Delivered Sep 17 2026 (round 1):** the dinghy, the kaap, the wreck, the fish weir, the
oyster trestles and the bridge — ingested (`art/prep_master.py` squares a Desktop delivery
and records its `master`; the wreck and the trestles were rotated 90° clockwise so the bow /
the rows are sprite-up), registered in PROP_KINDS, colliders traced (the weir's ring is the
V's two arms, not the triangle between them; the trestles are four rows). The wreck went
world 100 → 130: at 100 it was a race hull's length on the at-size sheet. **Rejected:** the
perch beacon — an elevation (legs converging up, ladder rungs, the cage from the side); its
brief now spells the plan out as a diagram (dots, lines, a ring). Re-run
`python3 regatta/art/prompt.py flats-perch-beacon`.

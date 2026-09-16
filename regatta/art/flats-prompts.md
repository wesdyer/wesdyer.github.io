# Spoonbill Flats — texture prompts (Sep 16 2026)

Three ground tiles for the tidal estuary, on the [VENUE] [TERRAIN] convention (Wes: a new
venue's grounds are its own kinds even where they repeat a material). Prepend the base
prompt from `guidelines/venue-art.md` §"Base prompt" to each. Every tile is a seamless
square seen from directly overhead in flat even light, no water, no waves, no boats, no
shadows with direction, no vignette, no text.

How they are used, so the briefs are honest about what the camera resolves:

| kind | where it draws | tileWorld | code row on ingest |
|---|---|---|---|
| `flats-marsh` (look `saltmarsh`) | the never-wet ground: the shore and the islands. Drawn by drawIslands like any land. | 128 | `LAND_TEXTURES.saltmarsh` in js/render/sprites.js (src, tile 128, alpha ~0.6); reset `ISLAND_STYLES.saltmarsh.body` to the delivered mean |
| flats mud (`flats-mudflat`) | the intertidal ground the tide layer paints (js/tide.js `COL.mud`) — most of the exposed flat at low water | 128 | a pattern fill multiplied into the tide layer's DRY pass (not yet written: `Tide` draws flat colour today — add a `TIDE_TILES` map and `createPattern` the way getLandPattern does) |
| flats sand (`flats-sand`) | bars and crests: the wantij sill, the creek sill, the two spits (`COL.sand`) | 128 | same hook, blended by the field's material raster |

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

Withies (the channel markers) are PROPS, not tiles: a single leaning birch bough lashed
to a stake, 1.5 m above the water, dark bark with a tuft of twigs, drawn as a small
top-down sprite with a short shadow. Not briefed yet — the venue reads its channel from
the water's own shading today.

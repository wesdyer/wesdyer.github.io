# Venue Art — Direction, Prompts & Delivery

*Moved July 28 2026 from `assets/images/venues/ART_STYLE.md`. Companion to
[visual-style.md](visual-style.md).*

How to generate new art that fits the established venue-card collection (the ten
images in `../assets/images/venues/`). Use this when prompting for any new venue,
loading screen, or backdrop so it reads as the same artist's work.

## The style in one sentence

Vivid, jewel-toned painterly game art built from crisp chunky shapes and
faceted brush planes — flat colors with hard 1–2 tone shading, no gradients
except sky and water bands, cheerful storybook clarity over realism.

## Core rules (apply to every piece)

1. **Format**: square (~1250×1250), no text, no lettering, no humans.
   Wildlife yes; people at most as a tiny implied figure (e.g. the committee
   boat's sailor silhouette).
2. **Color**: commit to ONE dominant hue family per piece, saturated and
   confident, plus one accent (a complement or a warm point against cool).
   Every venue owns a color the others don't.
3. **Shapes**: chunky and faceted. Rocks are 2–3 tone angular blobs; foliage
   is clustered leaf-mass blobs, not individual leaves; ice is literal
   low-poly facets. Edges crisp — this style never blurs.
4. **Water**: built from interlocking angular ripple patches, darker and
   lighter planes of the venue hue. Whitecaps are clean white curling strokes.
   Shallows glow pale turquoise over sand. Foam lines hug every shoreline.
5. **Sky** (when present): flat saturated blue; cartoon cumulus — rounded
   white blob-stacks with a single flat shade tone — plus thin horizontal
   streak clouds. Horizon sits in the upper third.
6. **Light**: bright unclouded daylight, hard shadow edges, minimal
   atmospheric haze (distant land = one flatter, bluer tone). Night pieces
   (Glowtide) invert to near-black water and make every light source glow.
7. **Composition**: aerial-oblique (roughly 30–60° down-angle) or low
   horizon. Always give the eye a PATH through the water — a channel, a river
   bend, a moon trail. One focal element (landmark or creature), corners kept
   quiet. Keep the bottom ~20% simple: the UI name-scrim overlays it.
8. **One witness**: include a single charming wildlife element where natural —
   whale, orca + penguins, gator, eagle, jellyfish. Simplified but correctly
   proportioned; never cartoon-eyed mascots.

## Base prompt (prepend to every generation)

> Stylized painterly game art, vivid saturated jewel-toned colors, crisp
> chunky shapes with faceted brush planes, hard two-tone shading and no soft
> gradients, angular rippled water patches, flat cartoon cumulus clouds,
> storybook clarity, square composition, aerial-oblique view, no text, no
> people.

Then add the venue-specific scene description (subject, palette commitment,
eye-path, focal element, wildlife witness).

## Palette registry (owned hues — new venues must claim unclaimed territory)

| Venue | Dominant | Accent |
|---|---|---|
| Lighthouse Cove | coastal azure + green headlands | red/green channel buoys, white lighthouse |
| Stillwater Lake | deep lake blue + pine green | warm cabin lights, red/green buoys |
| Pearl Lagoon | pale glowing turquoise + sand | coral pinks/purples under water |
| Gatorgrass Bayou | olive/yellow-green everything | rust roof, cattail brown |
| Sockeye Run | whitewater teal + tan rock | stone bridge, foam swirls |
| Bluewater Bonanza | deep open-ocean cobalt | white clouds, whale blow |
| Redrock Reservoir | orange/rust sandstone | turquoise water (the inverted lagoon) |
| Glowtide Strait | near-black indigo night | electric cyan biolume + red lit buoy + moon gold |
| Glacier Sound | steel navy + faceted ice blue-white | penguin yellow, orca black |
| Clubhouse Point | plain honest blue | one orange mark + committee boat |
| Curlew Flats | warm amber-gold sandbars | deep slate-blue channels, rust-red withies |
| Duckling Pond | fresh meadow green (lawn to the water's edge) | buttercup yellow — training sails, ducklings |

Unclaimed hue territory for future venues: greys (storm/fog), volcanic black +
ember red.

*Spring pastels was listed here and has been struck: pastel means low chroma,
which contradicts rule 2's "saturated and confident". The first Curlew Flats
pass was specced as pewter/pastel and measured 0.185 mean saturation against a
set that runs 0.66–0.94 — it read as unfinished next to its neighbours. A
palette claim must name a saturated hue, not a muted one.*

## Sky & weather registry (own a sky the way you own a hue)

Audited July 2026: six of the ten shipped cards had effectively the same sky —
white cumulus clustered left and right on flat mid-blue. In a sailing game the
sky IS the wind, so a default sky wastes the most valuable band of the card.

**Rule: the sky advertises the mechanic.** A player should be able to guess how
the venue plays from the top fifth alone. Rule 5's cartoon-cumulus recipe is the
*house style* for clouds, not an instruction to put the same clouds everywhere.

| Venue | Mechanic it must advertise | Sky |
|---|---|---|
| Lighthouse Cove | sea breeze, shore traffic | cloud line stacked over the LAND edge, clear over the water — the true sea-breeze signature |
| Stillwater Lake | glass patches & puffs | near-empty pale sky, a scatter of *tiny* fair-weather cumulus — small clouds are the puffs |
| Pearl Lagoon | mobile rain squalls | dark squall curtain with a visible rain shaft marching in, bright trade sky behind it |
| Gatorgrass Bayou | dead air | no sky — canopy, heat haze, god-rays. Already correct |
| Sockeye Run | current & rocks | high thin cirrus only. Wind here is terrain-driven, not thermal — no cumulus |
| Bluewater Bonanza | cloud-shadow pressure cells | *Parked July 2026 — see note below. Card keeps its original sky* |
| Redrock Reservoir | terrain wind, williwaws | towering thermal build over the rim, dust haze low in the canyon |
| Glowtide Strait | night information game | clear moonlit night, minimal cloud. Already correct |
| Glacier Sound | katabatic, ice | low grey overcast, sea smoke off the water, snow streaks. Already correct |
| Clubhouse Point | it is a benchmark | deliberately plain and evenly lit — blandness is the identity. Flatter than everything else |
| Curlew Flats | falling tide, building current | wide open estuary sky, varied blob-stack cumulus at mixed sizes plus thin streaks |
| Emberfall Isle | vents & pumice | ash plume drifting downwind, ember-lit from beneath |
| Duckling Pond | light, steady, safe — nothing is coming | early-morning gradient, buttery gold low to pale blue high, essentially cloudless — first-lesson light. ⚠️ Distinct from Lake's near-empty *midday* pale: the warmth is the difference, and Lake owns the tiny-cumulus scatter |

**Status (July 2026).** Reworked and shipped: **Lagoon** (squall cell + rain
shaft), **Lake** (12 small puffs), **Bay** (sea-breeze line — land:water cloud
ratio 4.1:1 → 11.3:1), **Sockeye Run** (cirrus only — sky max luminance 254 → 191).
All four moved saturation up and held contrast. **Redrock** keeps its bare sky by
choice; **Clubhouse Point** stays plain on purpose (0.055 contrast, by far the flattest
card, which is correct for a benchmark).

**Ocean: attempted and parked.** Cloud shadows on the water are the right idea —
its mechanic literally is cloud-shadow pressure cells — but two generative passes
produced varied clouds and no shadows, and a hand-composited attempt read as
off-style: feathered shadow edges contradict rule 3's crisp edges and rule 5's
flat shade tones. A clouds-only version measured *worse* than the shipped card
(saturation 0.814 → 0.736, contrast unchanged), so the original stays. If revived,
the shadows must be FLAT hard-edged cloud-shaped patches with the wave streaks
running unbroken through them — not soft gradients, not reflections.

## Delivery pipeline

1. Save the full-size original: `regatta/assets/images/venues/<key>.png`
   (the `<key>` matches the `VENUES` config key in script.js).
2. Generate the picker thumbnail:
   `sips -Z 256 <key>.png --out thumbs/<key>.png`
3. The picker card and detail panel pick it up by key automatically.

## Quality checklist before accepting a piece

- [ ] Reads instantly at 256px thumbnail size (squint test)
- [ ] Dominant hue is committed, not muddy; pops against neighbors on the grid
- [ ] Saturation sits in the set's range — the ten shipped cards measure 0.66–0.94
      mean HSV saturation (128px downsample), mean 0.78. Under ~0.6 reads as
      unfinished on the grid no matter how good the painting is. Check it against
      real neighbours in a contact sheet, not on its own.
- [ ] Eye-path through the water exists
- [ ] Bottom fifth is simple enough for the name scrim
- [ ] Exactly one focal creature/landmark; corners quiet
- [ ] Style match: chunky facets, hard shading, zero blur/photo-realism

## In-game water (top-down) — now matches the card idiom

**Rendering north star (July 2026):** the in-game world matches the card art
style — chunky facets, crisp flat tones, no blur. Water was rewritten from
noise-contours to the card art's ANGULAR RIPPLE LATTICE. Future passes pull
gusts, islands and wakes toward the same language.

Two layers, and the split matters:

- Base: flat venue hue + faceted piecewise-linear wave strokes in light and
  dark tones — the card art's diamond lattice, baked tileable
  (`water.js` `updateTextures`, `rippleSpacing: 26`, `rippleOpacity: 0.9`).
  Uses its own PRNG, never `Math.random` — render must not touch the eval RNG
  stream.
- Crests: DYNAMIC stitched whitecap fragments — thin white zigzag dashes
  with gaps + optional echo line — living in the wind-wave grid
  (`updateWindWaves`/`drawWindWaves` in script.js), oriented perpendicular to
  local wind travel, drifting downwind, density/brightness scaled by local
  wind speed. Gusts whiten, lulls go glassy: the water reports the wind field.
- Never bake crests into the texture: static crests can't align with the
  scene's wind and read as wallpaper.
- The `contour*` knobs in `WATER_CONFIG` are legacy, kept for compatibility.
  Don't design against them.

Per-venue base/deep/shallow/shoreline values and gust tints live in
`VENUES[key].palette` (script.js) — table in
[visual-style.md](visual-style.md) §4.5.
A new venue must supply all four tones plus gust tints.

## Where the rest lives

This document covers venue illustration: direction, prompts, delivery,
acceptance. Brand, color tokens, typography, UI and HUD rules are in
[visual-style.md](visual-style.md).

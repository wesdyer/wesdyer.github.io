# The Race View — Rendering Guide

**Version:** 1.0 · **Date:** July 28, 2026
**Scope:** everything drawn on or in the water during a race — camera, water, land,
course overlay, wakes, particles, weather, and the sprites that sail through it.
**Companion docs:** [visual-style.md](visual-style.md) (brand, color, type, chrome, accessibility) · [venue-art.md](venue-art.md) (venue illustration) · [debt.md](debt.md) · [README.md](README.md)

---

## 0. How to use this document

This file exists because the product has a clean seam in it, and it is the same seam
the design decisions follow:

> **On the water: broadcast graphics and the illustrated world.
> Above it: the product shell.**

Everything below the seam is here. Everything above it — panels, badges, the
leaderboard, type, the color tokens, motion, accessibility floors — is in
[visual-style.md](visual-style.md). The HUD *chrome* deliberately stays with the
shell (visual-style.md §6.8): it is product UI that happens to sit over a race.

**Markers** work exactly as in visual-style.md §0: **Observed** = what the code does
today, verifiable and goes stale; **Rule** = a decision new work must follow;
**Intent** = direction not yet realized. The marker sits on the numbered section and
subsections inherit unless they carry their own.

**Citations are symbols, never line numbers** — `drawLadderLines()`, `ISLAND_STYLES`,
`WATER_CONFIG`. All are greppable in `js/script.js` and `js/water.js`.

### The rule that governs this whole file

From visual-style.md §2:

> **The card art governs palette, mood and shape vocabulary.
> The view governs construction.**

The venue illustrations are perspective paintings; the race view is top-down. A
top-down island has no planes to shade, so it is built from flat masses, an outline
and a shallow halo — not from the stepped faceted planes a card uses. Water is the
exception that proves the rule: the card's angular ripple lattice *does* read
correctly from above, so it was adopted (§3). Land and wakes keep the top-down idiom.

When in doubt: **colors from the card, construction from the view.**

Reference: `references/topdown-world-reference.png`.

---

## 1. Camera and projection — **Rule**

- **Top-down orthographic.**
- **In heading mode the boat sits three quarters of the way down the frame**
  (`CAM_LOOK_AHEAD`), not centred: what a sailor reads is ahead of the bow — the next mark,
  the pressure coming down, the crest about to lift the stern — and a centred camera spends
  half the frame on water already sailed. The trade is that a boat on your transom is more
  often off screen; the edge indicators cover it.
  - ⚠️ **Heading mode only.** The offset works because that mode guarantees the bow points up
    the frame. In `north` the same offset would put the boat at a different edge every time
    you changed course.
  - ⚠️ **Applied after the follow smoothing, not chased by it.** Lerping the view centre
    toward `boat + offset` makes the boat ROCK through every turn: rotating the camera swings
    that target through an arc a quarter of the screen in radius and a 10%-per-frame follow
    cannot keep up. `camera.fx/fy` is the soft follow point; the look-ahead is rigid on top,
    so turning pivots the world about the hull. Measured on one trajectory with both rules
    running: excursion 13 px → 5 px on a 1000 px frame (`eval/_camturn.js`).
- Anything projecting world→screen must go through `camera.x/y` and `camera.rotation`
  (`drawBoatInstruments`, the edge indicators) — never assume the player is at frame centre.
- Boat heading unambiguous at a glance.
- No perspective distortion that conflicts with navigation.
- Decorative objects may carry slight stylized dimensionality; their footprint and
  collision area stay clear.

---

## 2. Environment simplification — **Rule**

Race backgrounds are quieter than venue illustrations.

- Lower contrast beneath boats, labels, wakes and course lines.
- Reduce fine texture and local focal points in active race areas.
- Large soft value zones communicate depth, wind, current, weather and ice.
- Hazards read through silhouette and outline, not detailed rendering.
- Strongest contrast is reserved for boats, marks, UI and immediate hazards.

---

## 3. Water — **Observed** (`updateTextures`; `updateWindWaves` / `drawWindWaves`)

Water is where the card idiom transferred successfully, because a ripple lattice
reads correctly from above. Two layers:

1. **Baked ripple lattice** — faceted piecewise-linear wave strokes in light and dark
   tones over the flat venue base, tileable, own PRNG (never `Math.random`; render
   must not touch the eval RNG stream). `rippleSpacing: 26`, `rippleOpacity: 0.9`.
2. **Dynamic wind crests** — stitched whitecap fragments in the wind-wave grid,
   perpendicular to local wind travel, drifting downwind, density and brightness
   scaled by local wind speed. Gusts whiten, lulls go glassy: **the water reports the
   wind field.**

**Never bake crests into the texture.** Static crests can't align with the scene's
wind and read as wallpaper.

The `contour*` knobs in `WATER_CONFIG` are legacy, kept for compatibility. Don't
design against them.

---

## 4. Venue water palettes — **Observed** (`VENUES[*].palette`, `WATER_CONFIG`)

Each venue owns four water tones plus gust/lull tints. This is the real per-venue
color system and the reason venues read as different places at race scale.

| Venue (key) | Base | Deep | Shallow | Shoreline |
|---|---|---|---|---|
| Lighthouse Cove `bay` * | `#0EA5E9` | `#0369A1` | `#38BDF8` | `#4ADE80` |
| Stillwater Lake `lake` | `#0E7490` | `#155E75` | `#22D3EE` | `#4ADE80` |
| Pearl Lagoon `lagoon` | `#1FB6C9` | `#0E7490` | `#7EE8E0` | `#FDE68A` |
| Gatorgrass Bayou `swamp` | `#606C38` | `#3A4423` | `#7D8A4E` | `#8A9A5B` |
| Sockeye Run `river` | `#3F6F5F` | `#2C5248` | `#5C8F7A` | `#A3B18A` |
| Bluewater Bonanza `ocean` | `#0369A1` | `#1E3A8A` | `#0EA5E9` | `#93C5FD` |
| Redrock Reservoir `redrock` | `#189DB5` | `#0C6478` | `#5CD6D6` | `#E8A06A` |
| Glowtide Strait `glowtide` | `#1A2560` | `#0A0F30` | `#27407E` | `#67E8F9` |
| Glacier Sound `arctic` | `#1D4066` | `#0E2444` | `#2E5C8F` | `#DBEAFE` |
| Clubhouse Point `seatrials` * | `#0EA5E9` | `#0369A1` | `#38BDF8` | `#4ADE80` |

\* `bay` and `seatrials` define no `palette` and inherit `WATER_CONFIG` defaults.

Gust/lull tints (`palette.gusts`) follow the venue's water, so a cat's-paw reads as
pressure on *this* water rather than a blue patch pasted on top.

**A new venue supplies all four tones plus gust tints**, claims a hue no other venue
owns (registry in [venue-art.md](venue-art.md)), and is checked against the overlay
contrast floor in §6.

---

## 5. Land, islands & shallows — **Observed** (`ISLAND_STYLES`, `bakeIslandSprite()`)

Land keeps the **top-down idiom** — flatter and more graphic than a venue card,
because top-down has no planes to shade (§0). Form comes from outlined masses and one
interior color break.

Construction, from the water outward:

1. **Shallow halo** — a glow ring in the venue's `shorelineColor` at
   `shorelineGlowOpacity` 0.5, blur `shorelineGlowSize × 20`. This is what makes land
   read as *sitting in* water rather than pasted on it. **Never skip it.**
2. **Body mass** — one flat fill with a 2px darker stroke. Traced through
   `traceRoundedPoly` (smoothed) for land, `traceAngularPoly` (straight segments,
   snapped corners) for ice.
3. **Vegetation mass** — a second flat fill inset from the body, not individual
   plants.
4. **Rock accent** — a small neutral mass, used sparingly.
5. **Trees** — the shared `palm.png` sprite scattered and baked in, never drawn
   per-frame.

| Style | Body | Stroke | Vegetation | Rock | Trees |
|---|---|---|---|---|---|
| `tropical` | `#FDE6B1` | `#D4B483` | `#84CC16` | `#9CA3AF` | yes |
| `grass` | `#A89B6A` | `#7D7048` | `#4D7C0F` | `#8A8A7A` | yes |
| `ice` | `#E6F2FB` | `#7FB2D9` | `#FFFFFF` | `#8FC2E8` | no |
| `redrock` | `#C2703E` | `#8A4A26` | `#D98E57` | `#7C4A2D` | no |

Ice additionally gets two translucent shelf rings (`rgba(74,144,200,.45)` at 1.28×,
`rgba(120,180,226,.42)` at 1.12×) — the drowned shoulder every aerial berg reference
shows.

**Islands bake to a sprite once, then blit.** Any new land treatment must survive
that: no per-frame procedural detail.

### Shoals — **Observed** (`drawShoals()`, `bakeShoalSprite()`, `shoalTint()`)

The `shoal` kind is the one shape that is *under* the surface, and the whole visual
job is to make that unmistakable. Three rules, and they are the reason it does not go
through `bakeIslandSprite` at all:

1. **No outline, ever.** A crisp edge is the single cue that reads as *land*, and a
   shoal the player believes is land costs them a longer course for nothing. Its edge
   is a gradient — alpha `SHOAL_ALPHA_CORE` 0.62 over the shallowest water easing to 0
   at the outline.
2. **It is drawn as its own drag field.** Every pixel's alpha is `VenueDoc.shoalMul`
   at that point — the same call the speed model and the router make — so the sand you
   see fading out is exactly the water that stops costing you. Baked once per shoal per
   race at 2.5 units/px.
3. **First layer in the world, under the swell.** Wakes, cat's-paws, wind waves and
   the nav aids all run across it unbroken, because they are all at the surface and it
   is not. Drawn with the land instead, it grows a coastline the moment a wake stops
   at its edge.

Its colour is **derived from the venue's water, not fixed** (`shoalTint()`): the sand
is mixed `SHOAL_IN_WATER` 0.38 toward `WATER_CONFIG.baseColor`, then scaled by that
water's luma against a tropical reference of 128. A bar is lit by whatever light
reaches the bottom, which is the same light that makes the water its colour — painted
as flat sand it was right on Lighthouse Cove and read as a spotlight on the seabed on
Glowtide's night water. **Test any change to it on both.**

It gets **no shore surf** — `updateSurf` spawns foam that runs up a beach and dies at a
waterline, and a submerged bar has none, so those breakers would draw in the coastline the
kind exists not to have. It does get the separate effect that belongs to it: on a venue with
a swell, a bar **trips the sea** and breaks along its own seaward contour (§9.3). No run-in,
no run-up, no outline — a line of white water offshore that appears, sweeps across the bar
and is gone.

A new island style supplies all four colors plus a trees flag. Body and vegetation
belong to the venue's hue family; rock stays neutral so it reads as rock everywhere.

---

## 6. Course overlay — **Observed** + **Rule**

References: `references/sailgp-*.jpg`. The code names this lineage directly —
*"Course-overlay kit (SailGP-inspired): thin mint-teal geometry, dashed"*.

> **The overlay is a broadcast graphics layer, not part of the world.** It sits above
> the water in one accent hue, uses thin confident geometry, and never picks up the
> water's color or texture. It reads as information because it looks like nothing the
> world could produce.

### 6.1 The kit — **Observed**

| Element | Treatment | Where |
|---|---|---|
| Laylines / ladder rungs | ✱`#40F5C8` at 0.5–0.9 alpha, `lineWidth` 3–7, round caps | `drawLadderLines()` |
| Distance labels | `italic 900 22px Saira` in ✱`#40F5C8`, rotated to the course axis, chevron tick | `drawLadderLines()` |
| Mark zone | ✱`#40F5C8` ring at 0.68 alpha; `rgba(251,191,36,.95)` amber when the player is inside | `drawMarkZones()` |
| Active gate line | rank-colored, `bold 24px monospace` | `drawActiveGateLine()` |
| Course boundary | white ring, 20px white glow, arc-culled to the visible span; suppressed on river venues where the shore *is* the boundary | `drawBoundary()` |
| Competitor label | two-line dark rounded box 50px below the boat — `rank NAME` / `speed kn`, `bold 11px monospace`, `red-500` on penalty | `drawBoatIndicator()` |
| Off-screen competitor | edge chevron with name and rank pip | `drawNpcEdgeIndicator()` |
| Off-screen mark | edge chevron in `cyan-400` with distance | `drawMarkEdgeIndicator()` |

Status colors (`green-400`, `yellow-300`, `amber-500`, `red-500`, `cyan-400`) mean
the same thing here as everywhere — visual-style.md §4.3.

### 6.2 Rules

- **One accent hue for all course geometry.** Adding a second nav color breaks the
  read that "teal means the course is telling you something."
- **Labels orient to the course; boat labels stay camera-upright.** Distance numbers
  lie along the axis they measure. Anything naming a competitor stays readable.
- **Geometry is thin; type is heavy.** Lines 3–7px and translucent so they never
  compete with boats; the numbers on them are black-weight and opaque.
- **Every overlay element carries its own contrast** (§6.3) — the hue is not enough
  on bright water.
- Nautical instrument, not sci-fi hologram. No scanlines, no chromatic aberration, no
  pulsing.

### 6.3 The overlay fails its contrast floor on bright venues — **Observed**

Nav teal ✱`#40F5C8` measured against each venue's water. The floor for overlay
geometry is **3:1** (visual-style.md §7.1).

| Venue | Ratio | |
|---|---|---|
| Pearl Lagoon (shallows `#7EE8E0`) | **1.04:1** | invisible |
| Pearl Lagoon (base) | **1.76:1** | fails |
| Lighthouse Cove | **1.99:1** | fails |
| Gatorgrass Bayou | 4.09:1 | passes |
| Glacier Sound | 7.64:1 | passes |
| Glowtide Strait | 10.23:1 | passes |

The overlay was designed against dark water and never checked on the bright tropical
venues. `drawLadderLines` strokes nav teal with no halo, shadow or dark under-stroke,
so nothing holds it off the background.

**The fix is a contrast carrier, not a color change.** Nav teal is load-bearing for
"this is the course talking to you" (§6.2), so changing the hue costs more than it
saves. A dark under-stroke or soft shadow beneath the geometry preserves the hue and
buys the ratio on every venue at once. [debt.md](debt.md) item 1.

**Any new venue is checked against this table before it ships.**

### 6.4 Three things the references do that we don't — **Intent**

1. ~~**Pressure as colored streaks.**~~ **BUILT** — see §8.1.
2. **Labels on a leader line.** SailGP raises each label on a thin pole so it never
   overlaps the boat or its neighbours. Ours sits at a fixed 50px offset and collides
   in a crowded start.
3. **Position-change indicators.** The broadcast leaderboard carries a green up / red
   down chevron per boat. Ours shows distance deltas but not movement.

---

## 7. Wakes — **Rule**

- Tapered, translucent, broken into rounded streaks and bubbles — see the wake in
  `references/topdown-world-reference.png`: separated soft streaks that fade, not a
  solid ribbon.
- Communicate speed and recent path without becoming a solid trail.
- Turning wakes arc smoothly and decay behind the boat.
- Heavy weather may add spray or longer streaks; the boat silhouette stays clear.

---

## 8. Environmental particles — **Rule**

- Wind streaks, snow, rain, foam and bioluminescent flecks have directional logic.
- Vary spacing and length to avoid wallpaper repetition.
- Keep particles below the contrast of boats and labels.
- Fewer, larger marks beat dense micro-particles.
- Gust and lull tints come from the venue's `palette.gusts` (§4), never a generic
  blue — a cat's-paw is *this* water moving, not a patch laid on top.

### 8.1 Wind comets — **Observed** (`drawParticles(ctx, 'air')`)

The pressure overlay §6.4 asked for. A streak is one parcel of air, drawn along **its
own track** over the last `WIND_TAIL_PTS × WIND_TAIL_STEP` seconds — so its direction
and its length are measurements, not formulas, and it curves where the breeze bends.

Four channels. **Three read off `pressureAt()`; colour reads absolute knots.** They answer
two different questions and cannot contradict each other, because within a race both rise
together:

| channel | carries | why |
|---|---|---|
| **density** | pressure (strongest cue) | Real water is bare in light air and streaked in a fresh breeze. A lull is drawn as **absent streaks**, which is what a sailor sees and the only encoding that survives on a dark palette. |
| **length** | wind speed, exactly | distance covered in a fixed window of time |
| **width** | pressure **and absolute wind** | `t` alone made a 6.5 kt Gatorgrass streak as fat as a 16 kt Bluewater one at half the length — stubby. Scaling with the breeze too keeps a comet's *shape* constant and lets its *size* report the wind. Aspect ratio now sits at 12–17:1 on every venue. |
| **colour** | **absolute knots, 0 → 35** | so a shade means the same wind on every venue |

**Density and width are anchored to the course** (`computeWindPressureScale`): p10/p90 of
the mean field sampled over sailable water **inside the mark box**, averaged across one
full oscillation cycle, widened to at least ±18% of the median. 18 knots is a hole on
Glacier Sound and a squall on Gatorgrass, and several venues still state one uniform wind
region, so without the widening `lo === hi` and the ramp has no denominator. This is what
keeps *which side of this course is windy* readable even where the absolute range is too
narrow to shift hue much.

**Colour is anchored to knots, and that is deliberate** — it reverses the original rule,
which anchored every channel to the course. Reading the wind is the primary skill the game
asks for, and a course-relative shade is only learnable *within* one race: the same colour
was 5 kt on Gatorgrass and 30 on Glacier Sound, so the reading was wrong the moment the
player changed venue. The original argument for relative anchoring was that nine of ten
venues stated one uniform region and an absolute ramp would paint them flat — much less
true now (Gatorgrass alone carries 27 regions), and even where it holds, gusts, lulls and
island lees all move the *local* speed, so an absolute ramp still marks them, and marks
them better for not already being pinned at the top of a narrow course ramp.

**The floor the layer measures from is per-course too** (`computeStreakRef`).
`STREAK_MIN_WIND` (5.5 kt) is a fact about water — below it the surface is glass and
carries no Langmuir streaks — but held as an absolute gate it also decided that a venue
whose whole range sits underneath it got **no layer at all**. Measured on Gatorgrass
(2.7–6.0 kt): 5.3% of the water cleared the gate and the live streak count was **zero**, on
the venue whose entire identity is reading a fickle breeze. Three things compounded —
density (the gate rejected ~95% of spawns), length (a fixed 0.55 s tail window is 4 world
units of track at 3.7 kt) and width (`abs` pinned at zero held every survivor at the
`wLight` floor). A four-unit speck at half width that almost never spawns is not a faint
layer, it is no layer.

So the floor drops to a fraction of the **course median** when the course is lighter than
the glassy threshold, and the tail window stretches so a slow parcel still draws a readable
mark. `Math.min` leaves every venue already above 5.5 kt untouched. **From the median, not
the p10** — Stillwater authors genuinely glassy 2-knot shore patches, which put its p10 at
0.09 and would have driven the floor to 0.08, marking up the very glass the layer exists to
leave bare.

**This layer is information, never the subject of the frame.** Thickness and density are the
two channels that turn a reading into a curtain, so both have **hard ceilings that are clamps,
not coefficients** — `STREAK_MAX_ALPHA`, `STREAK_MAX_HALFWIDTH`, `STREAK_MAX_SPAWN`. A
coefficient is a number someone later raises for a venue that "needs more", and the failure it
produces is a wall of ink over a mark rounding. The arithmetic could otherwise reach alpha
**1.008** — a fully opaque streak — and that is not a rare corner: `pressureAt` clamps at the
course's p90 and a gust pushes local wind straight past it, so every channel pins to maximum
exactly where the fleet is and exactly where the boats most need to be visible.

Verified by forcing the whole view to the top of the ramp (`_comet_ceiling.js`), including
with the config knobs deliberately abused: alpha holds at 0.55, half-width at 4.6, and the
population moves 67 → 72 on screen. Alpha-weighted ink stays near **1% of the viewport**.

Rules this layer must keep:

- **Through amber, never sitting on orange.** Saturated orange is the hull colour of four
  boats and the fill of every inflatable mark — side by side, a streak and Cruz's topsides
  were the same swatch. An absolute ramp only reaches its hot end on the windiest venues,
  which is exactly where the fleet is packed and where a boat most needs to be findable, so
  the ramp passes *through* amber (26 kt) to a dark **crimson** (35 kt) rather than resting
  on orange. Crimson still reads as the danger end and separates from the hulls by being
  darker and pinker.
- **Green arrives late, because green is the water.** Gatorgrass paints `#606c38` olive and
  the river banks are grass, so a green streak in the 7–14 kt band is the lowest-contrast
  pairing in the game. The band Gatorgrass actually occupies (it tops out near 7 kt) is
  white through pale **mint**; green proper does not arrive until 12–16 kt, where the water
  underneath is blue.
- **Stops sit close together.** The LUT interpolates in RGB, which cuts the chord between
  two colours instead of following hue — a wide jump between distant hues passes through
  grey. A first pass went teal at 14 kt straight to gold at 20 and drew a dead olive at 17.
  Neighbouring stops must always be adjacent in hue.
- **Light air is drawn FINE, not pale-and-fat.** `wLight` is the width multiplier at the
  bottom of the ramp; at 0.50 a 4-knot streak read as a fresh-breeze streak that had merely
  lost its colour. It is 0.40, which is only safe because density and length no longer
  collapse at the same time.
- **A streak is a mark on WATER.** Culled to the arena and off land at spawn, rechecked
  every `WIND_WATER_RECHECK` seconds as it drifts.
- **Nothing in this layer may disappear while visible.** Killing a beached streak outright
  made it blink out at full strength *against the shoreline* — the eye goes straight to a
  disappearance, so a cull meant to be invisible was the loudest thing the layer did. It
  fades over `WIND_BEACH_FADE`, and the water test is thrown **ahead** by exactly the
  distance the streak covers while fading, so it dies out approaching the shore and
  arrives already gone. Guarded by `_comet_beach.js`: zero removals above env 0.05.
- **Streaks drift at 0.6–0.9× the true wind**, the same band the puff cells use, so a
  streak inside a cat's-paw travels with it instead of sliding through it.
- **The tail ends at a fixed AGE, not at a stored sample.** Retiring the oldest sample
  whole made the tip jump ~16× the head's step on 6.5% of frames — a visible twitch on
  every streak, ten times a second. `streakSpine` keeps one spare sample and interpolates.

Diagnostics: `eval/_comet_probe.js` (drawn vs `getWindAt`), `_comet_flicker.js` (tip
smoothness), `_comet_venues.js` (all ten), `_comet_cost.js`, `_comet_look.js` (variant
sheets), `_dir_check.js` (which way a comet points). Tunables live on `window.__COMET`.

---

## 9. Effects & weather — **Rule**

**Wind** — sparse directional streaks, varied length and opacity, aligned to the wind
field. Stronger wind increases density and length, not brightness alone. See §8.1.

**Rain and snow** — a few clear directional layers rather than uniform particle
noise. Snow broader and softer than rain. Keep precipitation behind labels and
critical UI.

**Foam and spray** — foam is bright but broken into irregular shapes. Spray is
localized to bow impact, surf, rapids and heavy weather. Never outline every
shoreline with an identical white ribbon.

**Glow** — emissive objects and special environments only. Bright core, restrained
colored halo, nearby surface reflection. Never bloom the whole scene. Glowtide is the
only venue where glow is the dominant idiom.

**Squalls, fog and shadows** — large, soft, directional masses. Atmospheric value
shifts rather than opaque overlays. A squall reads as a distant localized event, not
a dark gradient across the frame.

**Reduced motion** does not apply here — weather and water are the simulation, not
decoration (visual-style.md §7.4).

### 9.1 Surf — **Observed** (`surfSeaAt`, `drawSurf` / `updateSurf`)

Only the coast facing into the waves; the lee stays glassy. What "the waves" means is the
one thing that changed: **on a venue with a `swell` block the breakers are the swell, and
everywhere else they are the local breeze exactly as before.** `surfSeaAt` is the single
call both passes make, so they cannot disagree about which way the water is running or when
it breaks — foam thrown a beat off the crest that threw it is the failure that split is
there to prevent.

| | wind venues (nine) | swell venue |
|---|---|---|
| direction | `regionWindAt` — waves run with the wind | the primary train's own travel |
| timing | `state.time` × a per-stretch rate, decorrelated by a position hash | **the train's phase at that stretch of coast** |
| crests at once | 2, half a cycle apart | 1 — the cycle is a real wavelength |
| lee shore | hard cutoff at `face ≤ 0.02` | refraction floor (`SURF_REFRACT_FLOOR`) |
| shape of the coast | not consulted | headland/bay focus (`surfFocus`) |
| stand-off, crest length | fixed | scale with swell height |

**The phase lock is the whole effect.** Every shore on the venue breaks in step with the
wave that is under your boat, and because phase varies along a coast the break *runs along
it* wherever the crests arrive at an angle. A per-stretch random offset — right for chop —
destroys it, so only `SURF_PHASE_JITTER` of scatter survives.

**Refraction** wraps energy round headlands, so a shore square to the swell still gets some.
§9's rule against an identical white ribbon round every shoreline is about a ribbon that says
*nothing*; a graded one that still points at the weather is the picture, not the failure.

**`surfFocus` measures signed curvature against a fixed feature size** (`SURF_FOCUS_R`), and
two more obvious measures were tried and are wrong. "Turns more than half a right angle over
a window" floors every shape at the bay end, because a small island's whole ring turns 360° —
and a rock in a swell is all headland, not one continuous cove. "Turns faster than this shape
does on average" is scale-free and makes a circle correctly neutral, but makes a *straight*
coast read as sheltered. Neutral at zero curvature is the only one that holds. The sign is
`turn * sgn`, worked through on a unit square both windings; backwards, it inverts every
island.

**A swell carries its own crest weight** (`gap`, `skip`, `weight`, `maxAlpha`, `build`,
`foam`). The drawing was tuned for chop, which is thin, sparse and broken, and is right for
that; a 3.9 m swell on a beach is a band of white water along the whole exposed shore. One
parameterisation covering both would have meant retuning nine venues to fix one.

⚠️ Two things that scale with the sea and two that must not. Stand-off and crest **length**
grow with swell height; the crest's **bow and jitter** are fractions of the base constant on
every venue. Scaling those with the reach gave a 40-unit crest 30 units of arc — a hairpin,
not a wave. Same trap in `drawShoalBreaks`.

Guarded by `eval/_surf_identity.js`: it wraps the 2D context and compares the draw calls
`drawSurf` issues from the pre-change tree and the current one, across four points of the
wave cycle, on all ten venues. Nine identical. ⚠️ It compares **calls, not pixels**, and that
is forced: `fxRand` is deliberately not reseeded, so the foam blobs on screen differ between
two runs of the *same* tree and a canvas hash can never be stable.

### 9.2 Sea effects — **Observed** (`SeaFX.draw`, `js/seafx.js`)

Three marks that only exist where there is a sea state, which today is Bluewater Bonanza
alone. Drawn after `drawWindWaves` — a whitecap *is* one of those crests breaking, and foam
floats on whatever colour the water underneath is — and before the fleet, so §7's "the boat
silhouette stays clear" holds.

**Gated on the mechanic, never on the venue.** Each effect keys off something only a swell
produces: a wind-sea crest line, `boat.swell.surf01`, a bow crossing a trough. There is no
venue-name test in the file and there must not be one — a second ocean venue then gets all
three for free, and Clubhouse Point cannot inherit them by accident. Guarded by
`eval/_seafx_venues.js` (zero marks on the other nine).

**It cannot reach the simulation.** Own PRNG, own particle arrays, per-boat state in a
`WeakMap` rather than fields on the boats. `eval/_seafx_isolation.js` asserts three ways:
same seed twice, layer on vs. off, and layer on *with the camera moved* — the last is the
one that would catch the `fxRand` class of bug, since spawn tests are camera-relative.

| Mark | What it is | What drives it |
|---|---|---|
| **Whitecaps** | broken runs of torn white patches on the **wind sea's** crest lines, biased to the swell crests, that run with the crest for a second and are then left behind as streaky foam | local wind **cubed** (`CAP_EXP`), from the aerial coverage surveys — so a puff carries visibly more, and the layer doubles as a pressure cue |
| **Surf sheet** | a churning wedge off each bow, opening aft and easing back over its last quarter, plus torn-off droplets | `surf01` while running with the waves, smoothed so it cannot strobe at the wave frequency |
| **Bow impacts** | a burst at the trough, then a sheet laid to leeward as the stem drives into the next face | the **encounter rate** alone — no point-of-sail test, so footing upwind visibly gets you wetter and running with the waves switches it off |

Three shapes were tried and rejected for whitecaps, all for the same reason — they had an
axis of symmetry and water does not. A single quad between a leading and trailing edge read
as a paper scrap; a chain of pinched shards read as a spindle, and with the foam tail behind
it the whole sea became darts pointing downwind; trapezoids with parallel ends read as
tiles. **Every corner has to move, along the crest as well as across it.** The surf sheet
failed the same way once: bulged amidships and closed at the quarter, it was a fur collar.
What makes a sheet say *fast* is that it leaves.

Diagnostics: `eval/_seafx_bench.html` + `_seafx_look.js` (isolated contact sheets, seconds
per iteration), `_seafx_probe.js` (in the real race view, with a burst capture — a slam is
one event per wave and 1 Hz sampling misses it), `_seafx_cost.js` (0.16 ms/frame at ~200
caps, beside the swell's 0.21 and the water's 4.1).

### 9.3 Breaking over a bar — **Observed** (`drawShoalBreaks`, `js/seafx.js`)

The effect §5 used to record as missing. A bar has no waterline for shore foam to die at, so
what it gets instead is the wave TRIPPING: a line of white water along its seaward contour
that appears, carries forward across the bar in the swell's own direction, and is gone.

**The contour moves with the swell.** A wave breaks where the water shoals to about 1.3× its
height; there is no bathymetry here, but `shoalMulAt`'s profile is exactly a smoothstep of
the distance in from the ring, so the contour at a given shallowness is a *fixed offset*
solved once (`invSmoothstep`) instead of searched for per frame. A bigger swell trips in less
shallow water and so breaks further out on the bar. ⚠️ Shallowness is a **drag field read as
a depth** — defensible because it is the same number the speed model and the router use, but
`SHOAL_BREAK_REF` is a tuned constant with metres on one side and a drag fraction on the
other, and should not be dressed up as γ = 0.78.

Sites are solved once per race. The outward normal is **measured by asking the depth field
which side is deep**, not derived from winding — the same trap `surfOutwardSign` records
getting wrong twice — and every candidate site is re-checked against the field, which rejects
thin necks and holes where an inward offset would otherwise hang a breaker over open water.

Attribution is by A/B (`eval/_barcheck.js`): the same frame with the layer silenced. On a
busy frame a bar break and the shore surf's stand-off are easy to mistake for each other, and
reasoning about distances from one screenshot is how you talk yourself into the wrong answer.

### 9.4 What a frame costs — **Observed** (`eval/_frame_attrib.js`)

A 2D-canvas frame is priced in **draw calls and the state changes between them**, not in the
wall time a rasteriser takes. Measured per frame, mid-race, and it is the same on every venue:

| | before | after |
|---|---|---|
| total canvas ops | ~5,020 | **~3,320** |
| `drawDisturbedAir` | 1,560 (arc+fill per particle) | 1,560, now culled to the view |
| `drawWindWaves` | 1,897 strokes | **441** |
| `SeaFX.draw` | ~450 fills | ~230–460 |
| `drawWakes` / `drawParticles` / `Swell.draw` | ~700 combined | ~700 |

Two fixes got the 34%: `drawWindWaves` stroked **every segment separately** and now batches a
crest's segments into one path (§3), and `drawDisturbedAir` had **no viewport cull at all** and
paid for all ten boats' plumes however far off screen they were.

⚠️ **`_perf.js`'s baseline figure is not a frame time.** It reports a MEAN over repeated
draws, and headless is a software rasteriser that stalls ~250 ms on about one paint in twelve
— on a *frozen, paused* world, so it is the rasteriser and not the game. That tail is most of
the 22–27 ms/frame it prints. Measured in a real browser over 650 frames, `draw()` is p50
**1.9 ms**, max **5.2 ms**, with zero frames over 8 ms. Use op counts for cost, `_perf.js` for
relative ablation deltas, and `_live_profile.js` in a real browser for anything absolute.

**Next lever, unclaimed:** `drawDisturbedAir` is now ~47% of the frame — one `arc` + `fill`
per turbulence particle, ~780 of them, each with its own alpha. It cannot be batched without
quantising that alpha (visible banding along the plume's fade) or moving to a baked dot
sprite (halves the ops, slightly different antialiasing). Both change how dirty air looks, so
neither was taken unilaterally.

---

## 10. Boats, sails, marks & sprites — **Rule**

### 10.1 General sprite principles
- Design at **4× intended display size**, then judge after downsampling. (Shipped
  boat parts are 1024×1024.)
- Judge every asset at its smallest real display size — boats race at roughly 55px.
- Prioritize silhouette, orientation, color block, and one or two identifying
  details.
- Remove any detail that becomes a single noisy pixel.
- Consistent light direction across the whole sprite set.

### 10.2 Boats
- Strict top-down orthographic construction — see the boat in
  `references/topdown-world-reference.png`: a clean hull silhouette, one interior
  break, a visible bow point, and a wake that says which way it's going.
- Bow and stern clearly differentiated.
- A dark edge or contact shadow separates hull from water.
- Cockpit, deck, hull, mast and sail occupy distinct readable regions.
- **Recolorable areas stay clean masks with minimal baked lighting** — hulls are
  tinted programmatically (`settings.hullColor`, default `yellow-400 #FACC15`).
- Hardware simplified to the minimum that still reads as a sailboat.
- **No two boats racing in the same fleet may be confusable at race scale.** Hull and
  sail are what the player sees on the water; the portrait distinctions in
  visual-style.md §8.6 do not help here.

> **Tint constraint — Observed.** `getTintedBoatPart()` multiply-tints the whole
> sprite, and `hull.png` bakes its detail lines at ✱`#666E81` (21% of its opaque
> pixels) over a `#F8F7F2` near-white fill, so those lines land at ~0.42× the hull
> color once tinted. **20 of 66 boats** (hull luma < 100) lose outline, coaming, hatch
> and trunk entirely — the darkest hulls render as featureless silhouettes. Any new
> recolorable part must either keep its detail lines dark enough to survive a multiply
> against a near-black tint, or carry them on a separate non-tinted layer. A
> composite-op fix was prototyped and deliberately deferred: at race scale the lines
> are sub-pixel anyway, so the payoff is confined to the profile card.

### 10.3 Sails
- Read as curved fabric, not flat triangles.
- One broad light plane, one broad shadow plane, one narrow edge/seam accent.
- Spinnaker shading communicates fullness and asymmetry through curved value bands.
  Default spinnaker `red-500 #EF4444` (`DEFAULT_SETTINGS.spinnakerColor`).
- Simple enough to recolor or swap; no fabric texture or stitching at race scale.

### 10.4 Buoys and race marks
- Canonical red / green / orange / yellow coding.
- Top shapes, lights and flags exaggerated slightly for recognition.
- Small dark water contact plus a limited reflection or ring ripple.
- Never realistic enough to become visually thin or fragile.
- Must read against both bright tropical and dark polar water — test on Pearl Lagoon
  and Glacier Sound, the two extremes (§6.3).

### 10.5 Wildlife and hazards
- Clear top-down silhouette, one signature behavior.
- Same world as the competitors, but **less portrait-like and more functional** —
  wildlife in the world is not a mascot (visual-style.md §9).
- Strong readable key poses over fluid but ambiguous motion.
- Hazards telegraph danger before collision through motion, shape or contrast.
- Per-venue wildlife is often **character kin** (Sockeye Run ← Slipstream, Gatorgrass ←
  Chomp, Glacier Sound ← Pebble). Keep that thread.

---

## 11. Review checklist — **Rule**

Race-view specific. The full asset rubric is visual-style.md §13.

- [ ] Reads at race scale (~55px for a boat), not just at master size
- [ ] Silhouette and heading unambiguous
- [ ] Meets the 3:1 overlay floor on Pearl Lagoon **and** Glacier Sound (§6.3)
- [ ] Construction matches the **view**, not the venue card (§0)
- [ ] Colors come from the venue palette (§4) or the status set (visual-style.md §4.3)
- [ ] Land carries its shallow halo (§5)
- [ ] Nothing new loops or pulses — the wind field must stay the most alive thing on
      screen (visual-style.md §6.10)
- [ ] Anything baked stays baked; no new per-frame procedural detail
- [ ] Render code touches no RNG that the eval harness depends on (§3)

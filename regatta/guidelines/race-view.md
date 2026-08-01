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
| Otter Run `river` | `#3F6F5F` | `#2C5248` | `#5C8F7A` | `#A3B18A` |
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

1. **Pressure as colored streaks.** `references/sailgp-halifax-pressure.jpg` shades
   the course with short directional streaks colored by wind speed (teal → yellow →
   orange). We model the wind field precisely and surface it only through gust
   tinting and whitecap density. This would make information the AI already uses
   visible to the player, and it fits the venue design language exactly — *the water
   tells you the truth if you look*.
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

---

## 9. Effects & weather — **Rule**

**Wind** — sparse directional streaks, varied length and opacity, aligned to the wind
field. Stronger wind increases density and length, not brightness alone.

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
- Per-venue wildlife is often **character kin** (Otter Run ← Bixby, Gatorgrass ←
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

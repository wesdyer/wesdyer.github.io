# SaltyCritter Yacht Club — Visual Style Guide

**Version:** 0.5 · **Date:** July 28, 2026
**Scope:** brand, color, typography, motion, accessibility, the product shell and HUD
chrome, character art, asset specs.
**Companion docs:** [race-view.md](race-view.md) (everything drawn on the water) · [venue-art.md](venue-art.md) (venue illustration) · [debt.md](debt.md) · [README.md](README.md)

---

## 0. How to use this document

### Find your task

| If you are… | Read |
|---|---|
| Adding or restyling a menu panel, card, button | §4.1–4.2, §5, §6.2–6.7, §7 |
| Adding a HUD element or badge | §4.3, §5.1, §6.8–6.9, §7 |
| Drawing something on the water | [race-view.md](race-view.md), then §4.3 |
| Making a new venue's water and land | [race-view.md](race-view.md) §4–5 |
| Making a boat, sail, mark or wildlife sprite | [race-view.md](race-view.md) §10, then §10 here |
| Commissioning or generating venue art | [venue-art.md](venue-art.md), then §9 |
| Commissioning or generating a competitor portrait | §8, §10, §11 |
| Adding an animation or transition | §6.10, §7.3 |
| Judging whether an asset is finished | §13 (plus race-view.md §11 for race assets) |
| Wondering why a rule exists | §12 |
| Looking for what's broken | [debt.md](debt.md) |

### Know what kind of statement you're reading

| Marker | Meaning |
|---|---|
| **Observed** | What the code does today. Verifiable, and **goes stale** — if the code changes, this doc is wrong and must be updated in the same commit. Cited by symbol (`renderVenuePicker()`, `#start-race-btn`, `WATER_CONFIG`), never by line number. |
| **Rule** | A decision new work must follow. Not derived from code and does not go stale. Binding. |
| **Intent** | Direction not yet realized. Safe to design toward; not safe to cite as "how it works." |

The marker sits on the numbered section (`##`) and subsections inherit it unless they
carry their own. Sections that mix kinds throughout (§4, §5, §6) are labelled per
subsection. Sections 12, 14 and 15 are records rather than rules. If you add a
normative section, label it.

### Two standing conventions

**The pre-race screen wins ties.** It has had the most design work and is the only
surface with a real type system. Where the race HUD disagrees, the HUD is the thing
to fix; gaps are itemized in [debt.md](debt.md). Do not "average" the two.

**Cite the token, not the hex.** The game loads Tailwind v3 from
`cdn.tailwindcss.com`, so nearly every UI color is a default-scale token. Sampling a
screenshot yields composites and color-profile drift — it has already produced wrong
values in a draft (§12). The handful of genuinely custom hexes are marked ✱ and
listed together in §4.5.

---

## 1. Brand essence — **Rule**

**SaltyCritter Yacht Club** is a colorful tactical sailing game with the warmth of a
character-driven adventure. The world should feel welcoming, energetic and slightly
mischievous while preserving enough nautical credibility that the racing feels
skillful and consequential.

> **Core promise: serious sailing decisions in a playful, adventurous world.**

**Personality:** adventurous (every venue is a place worth visiting) · friendly
(characters are expressive and approachable) · competitive (race information is fast
and trustworthy) · nautical (boats, marks, wind and wakes are grounded) · polished
(deliberate shapes and controlled palettes, not generic cartoon dressing).

**Tone boundaries.** Playful, not preschool. Stylized, not slapstick. Tactical, not
simulator-austere. Broad-family friendly while keeping enough sophistication for
adult sailing enthusiasts.

**Voice, in the copy we ship.** Venue blurbs end on the winning move
(`VENUES[*].blurb`), taglines are two nouns joined by an ampersand ("Buoys & Breeze",
"Dead Air & Weed"), hazard chips are amber and skill chips are green. Keep new copy
in that shape.

---

## 2. Sources of truth — **Rule**

Grouped by what each governs. Within a group, the first entry wins.

**Product surfaces — layout, chrome, type, states**
1. `references/ui-venue-selection.png` — the pre-race screen. **The reference
   standard.** → `#pre-race-overlay`, `renderVenuePicker()`, `renderVenueDetail()`
2. `references/gameplay-sea-trial-bay.png`, `gameplay-glacier-sound.png` — the race
   view at bright and dark extremes. Authoritative for *density and scale*, not for
   *chrome* — that trails the pre-race screen ([debt.md](debt.md)).

**Art direction — color, mood, shape vocabulary**
3. `assets/images/venues/*.png` — the ten venue illustrations. Rules in
   [venue-art.md](venue-art.md).

**Construction — how a thing is actually drawn**
4. `references/topdown-world-reference.png` — the race view: land, shallows, water
   surface, boat, wake. Rules in [race-view.md](race-view.md).
5. `assets/images/competitors/*.png` — character rendering (81 files, 500×500,
   straight alpha).

**Course overlay — tactical information on the water**
6. `references/sailgp-*.jpg` — broadcast graphics. Rules in
   [race-view.md](race-view.md) §6.

### The two-idiom rule

Sources 3 and 4 are not in competition, because they govern different things:

> **The card art governs palette, mood and shape vocabulary.
> The view governs construction.**

The venue cards are perspective illustrations; the race view is top-down. A top-down
island has no planes to shade, so it is built from flat masses, an outline and a
shallow halo — not from the stepped faceted planes a card uses. Water is the
exception that proves it: the card's angular ripple lattice *does* work from above,
so it was adopted.

When in doubt: **colors from the card, construction from the view.** Worked through
in [race-view.md](race-view.md) §0.

### Where the seam falls

> **On the water: broadcast graphics and the illustrated world.
> Above it: the product shell.**

Everything below that line lives in [race-view.md](race-view.md). Everything above it
— panels, badges, the leaderboard, type, color tokens, motion, accessibility — lives
here. The HUD *chrome* deliberately stays on this side (§6.8): it is product UI that
happens to sit over a race.

---

## 3. Visual pillars — **Rule**

### 3.1 Bold, simplified shapes
Build from large clean masses before adding detail. Silhouette and value grouping
must survive reduction to in-game size.
- Broad planes, chunky forms, clear overlaps.
- Three to six major value groups per material.
- Remove texture that does not survive downsampling.
- No thin decorative details that become noise.

### 3.2 Saturated, controlled color
Colorful, but grouped by purpose. Each venue commits to one dominant hue family plus
a small accent set (registry in [venue-art.md](venue-art.md)).
- Water and sky establish the dominant hue.
- Landforms provide a distinct secondary family.
- Buoys, sails, characters and UI alerts take the high-contrast accents.
- Shadows stay colored, never neutral gray or black.

### 3.3 Clean cel-shaded / faceted rendering
- Crisp or softly controlled edges — this style never blurs.
- Model form through clustered shapes, not airbrushed gradients.
- Reserve soft gradients for sky, atmosphere, glow and deep-water transitions.
- Highlights broad and graphic.

### 3.4 Friendly readability
At every scale the player understands what matters first: heading, course,
competitors, hazards, marks, status, mood.
- Important objects have distinct silhouettes.
- Interactive and competitive elements separate clearly from background.
- VFX supports motion without obscuring boats or labels.
- **Color is always reinforced by shape, icon, position or text — never color alone.**

### 3.5 Place-specific atmosphere
Every venue is identifiable from a small crop without its name. Climate, vegetation,
geology, light, water character and signature wildlife work as one identity.

### Style spectrum

Target blend: **polished stylized game illustration** for finish · **storybook
adventure** for warmth and place · **nautical sport interface** for race information ·
**mascot character design** for competitors, without becoming clip art.

**Avoid:** photorealism · heavy painterly brush texture · flat corporate-vector
minimalism · gritty military or survival-horror styling · hyper-detailed anime ·
preschool proportions and excessive cuteness · uncontrolled neon or bloom outside
Glowtide · procedural texture that reads as noise.

---

## 4. Color — *labelled per subsection*

Venue water palettes are in [race-view.md](race-view.md) §4 — they belong to the
world, not the UI.

### 4.1 UI surfaces — **Observed**

The shell is translucent slate over a blurred backdrop. **The rendered color is a
composite** — never sample a screenshot and hardcode the result; it changes the
moment an opacity does. Compose from the token.

| Surface | Recipe | Renders as | Where |
|---|---|---|---|
| App background | `bg-slate-900/95` + `backdrop-blur-md` | `#0F182C` | `#pre-race-overlay` |
| Header band | `bg-slate-900/50` + `border-b border-white/10` | — | pre-race header |
| Panel / card | `bg-slate-800/50` + `border border-white/10` + `shadow-xl` | `#172136` | every pre-race panel |
| Data row (inset) | `bg-slate-950/60` + `border border-white/5` | `#091124` | `renderVenueDetail()` |
| Card name scrim | `from-slate-950/95 via-slate-950/55 to-transparent` | — | `renderVenuePicker()` |
| Footer fade | `from-slate-900 via-slate-900 to-transparent` | — | pre-race footer |

"Renders as" values were measured off `references/ui-venue-selection.png`. They
document the current composite; they are **not** tokens to author against.

### 4.2 Brand & action — **Observed**

| Role | Token | Hex | Where |
|---|---|---|---|
| Brand blue ("YACHT CLUB", accents) | `blue-400` | `#60A5FA` | pre-race `<h1>` |
| Primary action | `blue-600` → hover `blue-500` | `#2563EB` → `#3B82F6` | `#start-race-btn` |
| Selection outline (venue card) | `sky-400` + `ring-sky-400/40` | `#38BDF8` | `renderVenuePicker()` |
| Competitor selection ring | `ring-amber-400` | `#FBBF24` | `selectCompetitor()` |

### 4.3 Status semantics — **Observed**

One meaning per color, everywhere, in every venue, on both sides of the seam.

| Meaning | Token | Hex | Used for |
|---|---|---|---|
| Positive / valid / finished | `green-400` | `#4ADE80` | VMG readout, winner triangle, finish state |
| Player identity | `yellow-300` (DOM) / `yellow-400` (canvas) | `#FDE047` / `#FACC15` | leaderboard name, mark ring, default hull |
| Attention / caution | `amber-500` | `#F59E0B` | rules-amber triangle |
| Danger / penalty / invalid | `red-500` (canvas) / `red-400` (DOM) | `#EF4444` / `#F87171` | penalty label, OCS, loser triangle |
| Navigation / course | ✱ `NAV_RGB` | `#40F5C8` | all course-overlay geometry |
| Mark / gate indicator | `cyan-400` | `#22D3EE` | mark labels, gate markers |
| Secondary metadata | `slate-400` | `#94A3B8` | inactive data, distances |
| Stat positive / negative | `emerald-300` / `rose-300` | `#6EE7B7` / `#FDA4AF` | competitor stat deltas |
| Archetype label | `amber-300` | `#FCD34D` | competitor archetype |

**Purple and other hues carry competitor identity only** — never global system
meaning.

> Two shades ship for the same meaning (`yellow-300`/`yellow-400`,
> `red-400`/`red-500`) because the DOM and canvas layers were built at different
> times. [debt.md](debt.md) item 9 — pick the DOM value and push it into canvas.

### 4.4 Text colors & measured contrast — **Observed**

| Role | Hex | On | Ratio | Where |
|---|---|---|---|---|
| Primary information | `#FFFFFF` | panel | 14.2:1 | throughout |
| Briefing row value | ✱ `#EEF4FF` | inset row | 17.0:1 | `renderVenueDetail()` |
| Body / blurb | ✱ `#C2CDE0` | panel | 10.0:1 | `renderVenueDetail()` |
| Card tagline | ✱ `#A7B4CC` | scrim | 9.0:1 | `renderVenuePicker()` |
| Label / eyebrow | ✱ `#7F8EA9` | panel | 4.85:1 | `.t-label` |
| Sub-label | `slate-500` `#64748B` | panel | **3.38:1** ⚠ | "Fine-tune wind…" line |

⚠ fails the §7.1 floor. Move to `slate-400` (6.27:1).

### 4.5 Custom colors — **Observed**

Everything not on the Tailwind scale, in one place. Six values. Adding a seventh
needs a reason.

| ✱ Hex | Name | Used for |
|---|---|---|
| `#40F5C8` | Nav teal | all course-overlay geometry (`NAV_RGB`) |
| `#7F8EA9` | Label slate | `.t-label` default |
| `#A7B4CC` | Scrim label | venue card tagline over the scrim |
| `#C2CDE0` | Body slate | venue blurb |
| `#EEF4FF` | Value white | briefing row values |
| `#666E81` | Hull line | baked linework in `hull.png` (race-view.md §10.2) |

### 4.6 Palette rules — **Rule**

- One dominant color family per screen, one supporting family, a limited accent set.
- Pure black is rare — use blue-black, green-black or warm charcoal.
- Pure white is reserved for text, foam, snow, sail highlights and eye highlights.
- **Status colors are constant across every venue.** Environment color may shift
  dramatically; player-critical color must not.
- New UI color comes from the Tailwind default scale unless there is a reason it
  can't — then mark it ✱ and add it to §4.5.

---

## 5. Typography — *labelled per subsection*

### 5.1 The system — **Observed** (`index.html`, the `<style>` typography block)

Three families, four voices.

| Voice | Class | Definition | Used for |
|---|---|---|---|
| **Display** | `.t-display` | **Saira** 900, `font-stretch: 81%`, italic per-use | venue titles, section headings, competitor names, CTA |
| Display (small) | `.t-display-8` | weight 800 | display type under ~20px |
| **Label** | `.t-label` | **Archivo** 800, uppercase, 11px, `letter-spacing: 2px`, ✱`#7F8EA9` | eyebrows, stat labels, metadata |
| Label (tight) | `.t-label-sm` | `letter-spacing: 1.6px` | dense rows, card taglines |
| **Data** | `.t-mono` | **IBM Plex Mono** 600, `font-variant-numeric: tabular-nums` | every numeric readout |
| **Body** | `body` | **Archivo** | everything else |
| Brand | `.t-wordmark` | system UI sans stack, black, italic, tight tracking | pre-race H1 only |

**Why these three.** Saira condensed-italic-black carries sports-poster energy
without shouting; Archivo is a neutral workhorse that stays legible at 10px in caps;
Plex Mono's tabular figures stop race numbers jittering as they tick.

### 5.2 Size ramp — **Rule**

Nine steps. Everything sizes to one of these.

| Step | px | Voice | Use |
|---|---|---|---|
| Hero | 48 | brand | pre-race wordmark |
| Display XL | 36 | `.t-display` | competitor profile name |
| Display L | 31 | `.t-display` | venue briefing title |
| Action | 27 | `.t-display` italic, `+1px` | primary CTA |
| Display M | 24 | `.t-display` italic | section headings |
| Display S | 20 | `.t-display` | venue card title |
| Display XS | 17 | `.t-display .t-display-8` | fleet card name |
| Body / Data | 14 | body or `.t-mono` | blurbs, stat values, row values, sub-copy |
| Label | 11 | `.t-label` | all labels |

**No two steps may sit closer than 1.12×.** This is the rule that matters, because
without it the ramp drifts back. It previously carried twelve steps including
15/14.5/13.5 and 11/10.5 — differences of half a pixel that no one can see, which
made "the ramp" a record of accident rather than a system.

`.t-label-sm` differs from `.t-label` in **tracking only** (1.6px vs 2px), not size.
That's what earns it a place.

### 5.3 Typographic rules — **Rule**

- Wide tracking for small uppercase labels; tighter as size grows.
- Italic display is for **identity and action only** — never paragraphs.
- Body copy stays upright and calm to balance the energetic headings.
- One condensed face. Do not introduce a second.
- Every number the player reads under time pressure is `.t-mono` with tabular
  figures.
- **Never use Tailwind's `font-mono`** — that's the OS mono stack (SF Mono/Menlo),
  not IBM Plex Mono. Use `.t-mono`.

### 5.4 Porting to the HUD — **Intent**

The HUD predates the type system. The pre-race builders (`renderVenuePicker`,
`renderVenueDetail`, `competitorProfileHTML`) use `.t-display`/`.t-label`/`.t-mono`;
the HUD builders (`updateLeaderboard`, the HUD block in `draw()`, the canvas `draw*`
family) use raw `font-mono` and Tailwind utilities. Five gaps, in the order worth
fixing:

1. **Two wordmarks, two typefaces.** Pre-race is `.t-wordmark` (system stack) at
   48px, one line, "Yacht Club" in `blue-400`. In-race is Archivo black italic at
   `text-2xl`, stacked, "Yacht Club" in `blue-100`. Pick one lockup. `.t-wordmark`
   pins the *system* sans, so the brand mark renders differently on every OS — the
   real fix is an SVG lockup, and short of that, one shared class.
2. **Two mono stacks, and the race view has none of the good one.** `font-mono`
   (the OS stack) appears 26× — 17 in `index.html`, 9 in `script.js`, all of it HUD.
   `.t-mono` (IBM Plex Mono) is applied **twice in the whole codebase**, both in the
   pre-race sidebar. The race timer and the venue-briefing wind value are literally
   different typefaces.

   More broadly: **every use of `.t-display`, `.t-label` and `.t-mono` is on the
   pre-race screen.** The race view uses zero type-system classes — the system is
   defined in the same file that renders the HUD and applied only to the other
   screen.
3. **Canvas text is outside the system.** Of the ten `ctx.font` sites, eight specify
   bare `monospace` or `sans-serif` — `drawWindDebug`, `drawActiveGateLine`,
   `drawBoundary`, `drawBoatIndicator`, `drawMarkEdgeIndicator`,
   `drawNpcEdgeIndicator` (×2), `draw`. Only `drawLadderLines` and `drawMarkZones`
   use Saira. Needs canvas font constants plus a `document.fonts.ready` gate.
4. **HUD headings skip `.t-display`.** `#hud-leg-info` hardcodes Archivo inline; the
   Race Results H1 and "Paused" are Archivo black.
5. **No shared ramp.** Unify on §5.2 once 1–4 land.

---

## 6. Layout, surfaces & shape — *labelled per subsection*

### 6.1 Viewport — **Rule**

**This is a desktop browser game.**

| | |
|---|---|
| Target range | 1280–2560 px wide |
| Aspect | 16:9 through 21:9 |
| Minimum supported | 1280 × 720 |
| Mobile / portrait | out of scope |

Test every layout change at **1280×720 and at ultrawide**. The pre-race screen is a
fixed three-band layout (header / workspace / action tray) with an internally
scrolling workspace; at 720p the venue grid is the first thing to clip
([debt.md](debt.md) item 12).

This is a decision, not a description — the game currently has exactly one responsive
breakpoint in the whole file, which made the target implicit and the clipping bug
unbounded.

### 6.2 Radii — **Observed**

| Tier | Class | Size | Use |
|---|---|---|---|
| Panel | `rounded-2xl` | 16px | major panels, modals (14 uses) |
| Card | `rounded-xl` | 12px | venue cards, data rows (5 uses) |
| Chip | `rounded-lg` | 8px | chips, small rows, leaderboard (21 uses) |
| Pill | `rounded-full` | ∞ | buttons, badges, portrait frames (37 uses) |

Pills are the house shape for anything actionable or badge-like. That is the
convention, not an exception.

### 6.3 Panel recipe — **Observed**

```
bg-slate-800/50  border border-white/10  rounded-2xl  p-6  shadow-xl
```

- Borders subtle and cool, only slightly lighter than the fill. Separation comes from
  value, not heavy strokes.
- Shadows soft and low-contrast.
- Interior padding generous and consistent (`p-6` at this scale).
- One panel, one inner rhythm, clear spacing. Do not nest borders.

### 6.4 Venue card recipe — **Observed** (`renderVenuePicker()`)

- **4:3** (`aspect-[4/3]`), `rounded-xl`, `overflow-hidden`.
- Thumbnail fills (`object-cover`) from `venues/thumbs/<key>.png` (256×256); full art
  at `venues/<key>.png` (1254×1254).
- **Text is never baked into the art** — a scrim carries it (§4.1), `pt-8 pb-2 px-3`.
- Name: `.t-display` uppercase white, 20px, `leading-tight`.
- Tagline: `.t-label .t-label-sm` in ✱`#A7B4CC`, one line.
- All cards in the grid share crop ratio, baselines and padding.

### 6.5 States — **Observed**

| State | Treatment |
|---|---|
| Default | `border-white/10  opacity-85` |
| Hover | `opacity-100  border-white/40` |
| Selected | `border-sky-400  ring-2 ring-sky-400/40  shadow-lg` |

- Selection keeps a crisp edge; never glow alone.
- Selection does not resize the card, so the grid stays still.
- Hover is quieter than selection.
- Keyboard focus and a non-hue selection cue are required by §7 and not yet built.

### 6.6 Shell composition — **Observed**

1. **Global header** — burgee + wordmark + tagline, `border-b border-white/10`.
2. **Workspace** — 12-col grid, `gap-8 p-8`: browse `col-span-8`, briefing
   `col-span-4` (the ⅔ / ⅓ split).
3. **Action tray** — bottom fade with exactly one primary action.

Consistent outer margins; aligned panel tops and internal baselines; generous
negative space. Never two equally weighted primary buttons on one screen.

### 6.7 Primary action — **Observed** (`#start-race-btn`)

```
.t-display italic · 27px · +1px tracking · uppercase
px-12 py-6 · bg-blue-600 hover:bg-blue-500 · rounded-full
border-2 border-white/20
shadow-[0_0_40px_rgba(37,99,235,0.6)] → hover 60px/0.8
hover:scale-105  active:scale-95
```

Brightest blue and strongest treatment are reserved for this one control. Secondary
actions are smaller, darker and quieter.

### 6.8 Race HUD chrome — **Rule**

**The HUD chrome stays the navy shell.** Same `slate` surfaces, `white/10` borders and
radius tiers as the pre-race screen — denser and more translucent, but visibly the
same product.

The SailGP influence is confined to what is drawn **on the water**
([race-view.md](race-view.md) §6). That split is deliberate:

> **On the water: broadcast graphics. Above it: the product shell.**

Two layers, one brand. Do not pull the broadcast look up into the chrome — the
leaderboard and badges are product UI, not overlay.

- Smaller radii and denser spacing than the shell.
- Translucent panels where the background should stay readable.
- Race-critical values visible without scanning a menu-style hierarchy.
- Dialogue, minimap, standings and instruments read as one system, not independent
  widgets.

### 6.9 Information hierarchy — **Rule**

**Product shell:** current choice and primary action → venue identity and art →
conditions and copy → secondary metadata.

**Race view:** race-critical status (heading, speed, VMG, timer, warnings) → nearby
competitors and course state → tactical helpers (minimap, trim, rules) → logs and
flavor dialogue.

### 6.10 Motion — **Observed** + **Rule**

Motion is sparse and purposeful. Five things move; everything else is static.

| Motion | Definition | Purpose |
|---|---|---|
| Burgee flutter | `flutter` 1.0s infinite linear — `skewY` ±4°, `scaleX` 0.98, origin left center | the one piece of idle life in the brand mark |
| Leaderboard reorder | `transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)` on `.lb-row` | rank changes are *animated*, so the player sees the pass happen |
| Rank highlight | `highlight-flash` 1s ease-out, `rgba(234,179,8,.5)` → row default | draws the eye to the row that just moved |
| Button press | `hover:scale-105` / `active:scale-95` | tactile confirmation |
| Podium celebration | `confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } })` | finishing only — never lesser events |

**Rules:**

- Standard easing is `cubic-bezier(0.4, 0, 0.2, 1)` at 300–500ms for state change;
  75ms linear for anything tracking live physics (compass rose, heading arrow — these
  use `duration-75 ease-linear` with `will-change-transform`).
- Animate to *show a change the player would otherwise miss*. A leaderboard that
  simply redraws in a new order hides the pass; one that slides shows it.
- Nothing loops in the race view except the burgee. Ambient animation competes with
  the wind field for attention, and the wind field must win.
- Never animate anything the player is reading a number off.
- Honour `prefers-reduced-motion` (§7.3).

---

## 7. Accessibility — **Rule**

Targets, not aspirations. New UI meets these before it ships.

### 7.1 Contrast floors

| Element | Floor |
|---|---|
| Body text under 18.66px, or under 24px non-bold | **4.5:1** |
| Large text (≥18.66px bold, ≥24px regular) | **3:1** |
| UI component boundaries, focus rings, icon-only controls | **3:1** |
| Course overlay geometry against venue water | **3:1** |

Menu text is measured in §4.4 and all but one line passes. **The course overlay
currently fails on the bright tropical venues** — measurements and the fix in
[race-view.md](race-view.md) §6.3.

### 7.2 Never color alone

The status set (green / yellow / amber / red) is the main color-blind risk, and it
carries race-critical meaning. Every status must be reinforced by shape, icon,
position or text. This is pillar §3.4 and it is not optional.

Selection state currently relies on hue alone (§6.5) — it needs a border-weight,
check or icon cue as well.

### 7.3 Reduced motion

Under `prefers-reduced-motion: reduce`:

- Burgee flutter stops.
- Leaderboard reorder becomes instant; the highlight flash **stays** (it carries
  information).
- Confetti is suppressed.
- Button scale transforms are removed.
- Live-physics indicators (compass, heading arrow) keep updating — they are data, not
  decoration.
- **Water, weather and wind are unaffected** — they are the simulation, not
  decoration.

The distinction: **decorative motion goes, informational motion stays.**

### 7.4 Keyboard and controller

Focus must be visible, meet 3:1, and be at least as obvious as hover. Not built yet
([debt.md](debt.md) item 10).

---

## 8. Competitor character art — **Rule**

### 8.1 The formula
A strong species silhouette · one immediately readable personality trait · a distinct
color identity · a sailing gear motif · an expression that survives a circular crop.

### 8.2 Proportion and pose
- Bust or upper-body framing on transparent background.
- Three-quarter front view with enough asymmetry to show personality.
- Heads and features enlarged for readability; bodies do not go baby-like.
- Eyes large and glossy with simple highlights.
- Mouths and brows carry most of the expression.
- Fins, wings, flippers and hands may gesture; anatomy stays species-inspired.

### 8.3 Linework
Character art uses stronger outlines than environment art.
- Outer contour dark, confident, continuous — roughly **4–8px at 500px master**.
- Interior lines thinner, only where they clarify form.
- Line color near-black charcoal, not pure black.
- No sketchy, hairy or variable brush lines.

### 8.4 Shading and materials
- Clean cel-shaded planes with limited soft transitions.
- Fur, feathers, scales and skin stay graphic and sparse.
- Metal and plastic get one highlight and one shadow, never realistic reflections.
- Clean transparent edge, no dark matte halo.

### 8.5 Personality through design
Broad angular forms → power or aggression. Rounded forms → warmth, optimism, comic
energy. Narrow swept shapes → speed, focus, precision. Dark palettes read mysterious
without being villainous. Bright warm palettes read confident without being childish.

### 8.6 Consistency rules
- Every portrait legible at **64px** (leaderboard size) and inside a circular frame.
- No two competitors share the same dominant silhouette *and* vest palette.
- Eye rendering, line weight, highlight logic and gear construction stay consistent.
- No unrelated props unless central to the character.
- No scenic backgrounds in profile assets.

Portrait distinctness does **not** carry to the water — hull and sail are what the
player sees there. See [race-view.md](race-view.md) §10.2.

**Intent — sailing gear.** The target is that every competitor wears recognizable
sailing safety gear with clear panel construction, zipper, belt and buckle shapes
(Hug is the model). Not yet true of the whole roster: Bruce wears a zip jacket with
no PFD hardware. This is the standard for new and reworked art, not a description of
all 81 existing portraits.

---

## 9. Venue art — **Rule**

Composition, shape language, lighting, the owned-hue registry, generation prompts,
delivery pipeline and acceptance checklist all live in
**[venue-art.md](venue-art.md)**. Build every venue-art prompt from that file.

Only the boundaries that bind venue art to the rest of the product live here:

- **Every venue owns a hue no other venue owns.** New venues claim unclaimed
  territory; the registry in venue-art.md is authoritative.
- **No humans and no cartoon-eyed mascots in venue art.** Wildlife is rendered
  naturalistically ("one witness"); mascot rendering belongs to portraits (§8) and
  nowhere else. This boundary is what keeps the two modes from collapsing.
- **Cards supply color and mood to the race view, not construction** (§2).
- **The bottom fifth stays simple** — the card name scrim (§6.4) sits there, and text
  is never baked into the art.

---

## 10. Asset specifications — **Observed**

| Asset | Master | Background | Notes |
|---|---|---|---|
| Venue illustration | **1254 × 1254** square | opaque | no baked text; critical content out of the outer 8–10%; bottom fifth simple |
| Venue thumbnail | **256 × 256** | opaque | `sips -Z 256 <key>.png --out thumbs/<key>.png` |
| Competitor portrait | **500 × 500** square | transparent (straight alpha) | bust crop, centered for circular use; face within central 70% |
| Boat part | **1024 × 1024** | transparent | top-down orthographic; clean recolor masks |
| Burgee / brand mark | 649 × 462 | transparent | must stay clear at small size |
| Gameplay sprite | ≥ 4× target display size | transparent | padding for rotation, wake and animation; documented pivot |

Filenames match the `VENUES` / `AI_CONFIG` keys in `script.js` — that's how the picker
and roster resolve art. Deliver lossless PNG; layered source preferred.

**UI art:** vector where practical; raster icons at 1×/2×/4×; consistent pixel grid
and optical padding. Test HUD elements over both bright tropical and dark polar water
([race-view.md](race-view.md) §6.3). Test the shell at 1280×720 and ultrawide (§6.1).
Keep card artwork separate from text, gradients, selection borders and metadata
overlays.

---

## 11. AI-assisted art prompts — **Rule**

Base prompt, then the asset add-on. **For venue art, use venue-art.md instead** — its
base prompt and per-venue palette commitment are tuned to the existing collection.

> **Stylized polished 2D game art for SaltyCritter Yacht Club; colorful nautical
> adventure; bold simplified shapes; clean cel-shaded and lightly faceted planes;
> saturated but controlled palette; crisp readable silhouette; friendly sophisticated
> tone; clear directional lighting; minimal microtexture; no text; no UI; no
> photorealism.**

**Character add-on** — Anthropomorphic [species] sailing competitor, upper-body
three-quarter portrait, transparent background, expressive face, strong dark outer
outline, simplified interior linework, wearing a distinctive modern life jacket with
zipper and belt, clean cel shading, readable at 64 px, no scenery.

**Gameplay sprite add-on** — Strict top-down orthographic game sprite, transparent
background, heading immediately readable, simplified geometric construction, strong
outer silhouette, limited shading, no perspective, no water, no cast scenery,
designed to remain legible when reduced.

**Negative prompt** — photorealistic, cinematic realism, 3D render, heavy painterly
brushwork, watercolor wash, gritty, horror, military, generic vector clip art,
excessive texture, excessive bloom, neon everywhere, thin fragile details, cluttered
background, text, logo, watermark, inconsistent perspective.

---

## 12. Mistakes we've actually made — *record*

Not a restatement of the rules — these are the specific wrong turns taken on this
project, kept because each one cost real work and none is obvious in advance.

1. **Sampling screenshots for color instead of reading the code.** Produced a
   selection color that appears nowhere in the product (`#0082FB` for what is really
   `sky-400 #38BDF8`), off-by-one tokens from color-profile drift (`#2663EB` for
   `blue-600`), composite blends named as if they were tokens, and four status colors
   with zero occurrences anywhere. → §0, §4.

2. **Describing the top-down view with card-art rules.** The race view and the venue
   cards are different drawings of the same world. Water transferred; land did not.
   → §2, [race-view.md](race-view.md) §0.

3. **Baking wave crests into the water texture.** Static crests can't align with the
   scene's wind, so they read as wallpaper and the water stops reporting the wind
   field. → [race-view.md](race-view.md) §3.

4. **Letting the same meaning ship in two shades.** `yellow-300`/`yellow-400` and
   `red-400`/`red-500` diverged purely because DOM and canvas were built at different
   times. → §4.3.

5. **Letting type sizes drift until the ramp was twelve near-identical steps** —
   including 15/14.5/13.5, differences no one can see. → §5.2.

6. **Designing the course overlay against dark water only.** Nav teal measures 1.04:1
   on Pearl Lagoon shallows. A hue chosen on one venue was never checked on the
   others. → [race-view.md](race-view.md) §6.3.

7. **Multiply-tinting a sprite whose detail lines weren't dark enough to survive it.**
   20 of 66 hulls lost all interior linework. → [race-view.md](race-view.md) §10.2.

8. **Citing line numbers in these documents.** They went stale within a single working
   session. Cite symbols. → §0.

---

## 13. Review rubric — **Rule**

Score 1–5. Production-ready means averaging ≥ 4 with nothing below 3. This is the
acceptance gate for commissioned or generated art. Race-view assets additionally run
the checklist in [race-view.md](race-view.md) §11; venue art additionally runs the one
in [venue-art.md](venue-art.md).

| Category | Question |
|---|---|
| Silhouette | Recognizable at final size? |
| Readability | Does the important information separate from the background? |
| Style match | Established shape, line, shading and texture language for **this view** (§2)? |
| Palette | Controlled hierarchy, right for its venue or character? Colors from §4? |
| Contrast | Does it meet the §7.1 floor on the venues it will appear over? |
| Personality | Distinct mood, place or competitor identity? |
| Nautical credibility | Connected to sailing, water, navigation, race behavior? |
| Technical fit | Projection, transparency, padding, crop, resolution, filename key? |
| UI hierarchy | For interface assets — is the current selection and next action obvious? |
| Restraint | Has unnecessary detail, glow, texture and clutter been removed? |

---

## 14. Reference inventory — *record*

**Shipped surfaces** — what the game looks like now
- `references/ui-venue-selection.png` — the product shell. **The reference standard.**
- `references/gameplay-sea-trial-bay.png` / `gameplay-glacier-sound.png` — race view
  over bright and dark water

**Direction** — what we are aiming at
- `references/topdown-world-reference.png` — the top-down idiom: island construction,
  shallow halo, flat water with low-contrast ripples, boat + wake
- `references/sailgp-portsmouth-gate.jpg` — mark zones, gate labels, rounding arrows
- `references/sailgp-portsmouth-ladder.jpg` — ladder rungs and distance chevrons
- `references/sailgp-portsmouth-boundary.jpg` — boundary ribbon, lane geometry
- `references/sailgp-halifax-pressure.jpg` — **wind pressure as colored streaks**, the
  one overlay idea we haven't built

**Live assets** — referenced in place, never duplicated
- Venue art `../assets/images/venues/<key>.png` (10) + `thumbs/` (10)
- Competitor portraits `../assets/images/competitors/<name>.png` (81)
- Boat parts `../assets/images/boat-parts/` (hull, main, jib, spin, preview)
- Brand & misc `../assets/images/misc/` (burgee, marks, podium icons)

Venue keys, journey order: `bay` Lighthouse Cove · `lake` Stillwater Lake · `lagoon`
Pearl Lagoon · `swamp` Gatorgrass Bayou · `river` Sockeye Run · `ocean` Bluewater
Bonanza · `redrock` Redrock Reservoir · `glowtide` Glowtide Strait · `arctic` Glacier
Sound · `seatrials` Clubhouse Point.

---

## 15. Open decisions — *record*

- Standard outline thickness by sprite class and target resolution.
- Reference boat, sail, wake and wildlife sprites — none exist yet.
- Sprite animation timing and key-pose standards (UI motion is settled — §6.10).
- Whether the fleet needs an enforced hull/sail color-distinctness check
  ([race-view.md](race-view.md) §10.2) or whether hand-assignment is sufficient at 66
  characters.
- Rules for marketing art vs venue-card art vs in-race environment art.
- Export presets, pivots and sprite-sheet layout conventions.

Known defects live in [debt.md](debt.md), not here.

---

## Changelog

**0.5 — July 28, 2026.** Split the race view into [race-view.md](race-view.md) —
camera, water, venue water palettes, land, course overlay, wakes, particles, weather
and race-scale sprites — along the seam the design already draws: *on the water,
broadcast graphics; above it, the product shell.* This file keeps brand, the shared
design system, the shell and HUD chrome, character art and specs. Moved the debt
register to [debt.md](debt.md) so one list serves every document.

**0.4 — July 28, 2026.** Settled three direction questions: the **two-idiom rule**
(card art governs palette and mood, the view governs construction), **HUD chrome stays
the navy shell**, and **desktop-only** at 1280–2560. Added the **Rule** marker and
labelled every section — 36 of 59 previously carried none. Redesigned the size ramp
from twelve drifted steps to nine with a 1.12× minimum interval. Added accessibility
with real floors, and measured the course overlay against every venue's water — it
fails on the bright tropical ones. Replaced Do/Don't, which was 100% restatement, with
Mistakes we've actually made. Added a task index and a single custom-color table.

**0.3.1 — July 28, 2026.** Added the top-down world and SailGP references and the
sections they establish, Motion, and the hull multiply-tint constraint.

**0.3 — July 28, 2026.** Rewrote color and typography from shipped code rather than
screenshot sampling — corrected the selection color, replaced four invented status
colors with real tokens, replaced composite "navy" tokens with their source recipes,
added the per-venue water palettes and the shipped type system. Corrected the venue
roster to ten proper names. Split venue-art generation into `venue-art.md`.

**0.2 — July 28, 2026.** First full draft (external). Structure, pillars, art
direction, rubric and prompt framework — largely carried forward.

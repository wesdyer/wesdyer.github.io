# Skills — competitor stats, traits and character shape

*Steps 1–3 of the roster rework. Sections marked APPLIED are in the code; the rest
remain Intent.* Companion to [venues.md](venues.md) (what the courses will ask for) and
[visual-style.md](visual-style.md) §8 (portrait and colour rules).

Statements are labelled **Observed** (what the code does today, verifiable, goes
stale), **Rule** (binding on new work) or **Intent** (direction not yet realised),
per [README.md](README.md).

---

## 0. Why this document exists

Two findings from the July 31 measurement forced it.

**The tier list was never real.** The design sketch assigned every character a tier
S–D. Measured over 1,200 races, agreement between designed and measured tier is
**16/66 — exactly chance**, and *not one* of the eight designed-S characters measures
S. The stats in `script.js` were authored independently of the sketch and correlate
with it at +0.17.

**A stat can be decorative for the roster's entire life without anyone noticing.**
`reach` is worth −0.180 s/pt, last of seven, because every venue races windward-
leeward and there are no reaching legs anywhere in the game. Sixty-six characters
carry a number that does almost nothing.

Both are failures of definition, not of tuning. Hence: define first.

---

## 1. Principles — **Rule**

1. **Every skill has a mechanic.** If it cannot be traced to code that changes a
   race, it is not a skill. `reach` is the cautionary tale.
2. **Every skill is a trade-off, never flat power.** Inherited from the archetype
   rule and it holds for stats too: a skill that is strictly good is a difficulty
   knob wearing a character's name.
3. **Every skill is measurable in seconds.** `tier_eval.js` prices any stat by
   regression. A skill we cannot price is a skill we cannot balance.
4. **Moderate conditions are neutral ground.** The conditions stats act only at the
   extremes, so a character with zeros races exactly as it does today.
5. **Zero means fleet baseline.** New stats default to 0 so adding a column changes
   no existing character until a value is authored.
6. **Scale is −5..+5, integers by default, one decimal when tuning.** The range is
   kept rather than normalised to −1..+1 because it is arbitrary — only resolution
   matters — and changing it would rewrite 462 existing values for no gameplay gain
   (the profile bar width is literally `Math.abs(v) * 10`). Decimals exist to land a
   character on a target tier, not for everyday authoring.

   **Resolution is not what causes clumping.** Measured, the fleet is tightly packed:
   median gap between adjacent characters 0.15s against a typical ±1.2s standard
   error, 54 of 65 adjacent pairs within 0.5s, and the middle half of the fleet
   occupying 6.1s of a 21.7s range. But stat values are already spread evenly across
   the integer range (35–48 uses of every value from −5 to +5), so authors are not
   saturating the resolution. Seven stats of comparable magnitude simply average out.
   **Spread comes from authoring tier targets deliberately, not from finer numbers.**

## 2. Stats and traits are separated by AUTHORSHIP, not by subject — **Rule**

The distinction that matters in this codebase is **granularity**, not
physics-versus-cognition:

| | Stats | Traits |
|---|---|---|
| Authored | per character | per archetype |
| Count | 10 | 13 fields on 8 archetypes |
| Range | −5..+5 integers | multipliers, documented per field |
| Shown to player | yes, profile panel | yes, as archetype label + threat/weakness |

Both are numbers — `shiftSense: 1.5` is no less numeric than `upwind: 3`. So the
question for any new skill is simply: **does this vary per character, or per
archetype?** A quality every character needs its own value for is a stat, whatever
it represents.

**Consequence:** all eight `shift` characters share one `shiftSense`. No character
can currently be a better reader than another of the same archetype — see §6.

---

## 3. The seven original stats — **Observed**, with three APPLIED changes

Measured value per point, 1,200 races on Clubhouse Point, weighted R² 0.942:

| Stat | s/pt | Mechanic |
|---|---|---|
| downwind | −1.151 | polar multiplier, 0.015/pt |
| upwind | −0.892 | polar multiplier, 0.012/pt |
| pressure *(was `boost`)* | −0.380 | wind capture (see below) |
| acceleration | −0.317 | `speedAlpha × (1 + acc·0.024)` while gaining |
| handling | −0.245 | turn rate `× (1 + hdl·0.03)` — pure turning since the relief moved |
| momentum | −0.228 | `speedAlpha × (1 − mom·0.02)` while losing, plus tack agility |
| reach | −0.180 | polar multiplier, 0.018/pt — highest multiplier, no legs to use it |

### 3.1 `boost` renamed to **`pressure`** — *APPLIED; mechanic unchanged*

Three effects, all multipliers on how far local wind deviates from base:

- **gusts** — gain above base `× (1 + pressure·0.05)`
- **lulls and terrain shadows** — loss below base `× (1 − pressure·0.05)`; `getWindAt`
  applies island shadow as a speed multiplier, so shadows arrive as lulls
- **dirty air** — `effectiveBadAir = badAirIntensity × (1 − pressure·0.05)`

It does **nothing** in steady, clean, undisturbed wind. Its real identity is *wind
capture and cover resistance* — "you cannot be shut down in traffic" — and nothing
else in the game touches the dirty-air term. The name hides that completely.

### 3.2 `handling` gave up `handlingRelief` — *APPLIED, then removed entirely*

Was `{ threshold: 18, costPerKnot: 0.03, handlingRelief: 0.08, maxCost: 0.25 }`.
Handling had been the heavy-air stat, worth ~9.6% boatspeed across its range when
overpowered; that job moved to `heavyAir` (§4.2), because leaving it in both places
would double-count and make a high-handling, high-heavyAir boat untouchable above 18
knots. The constant was first set to 0 and has since been **deleted** — a dead field
in a tuning struct is a trap for whoever tunes it next.

**Handling is now pure turn rate**, plus its share of tack agility
(`handling×0.3 + acceleration×0.3 + momentum×0.2`).

### 3.3 `speedScale` deleted, `shift` given a real weakness — *APPLIED*

Difference-in-differences over 1,200 identical seeds, traits on vs off:

| archetype | trait value | |
|---|---|---|
| **shift** | **+4.68s** | ±0.94, t = +5.0 |
| all seven others | −0.96 … +0.34 | none significant |

`speedScale: 0.97` is a ~6.45s tax on a 215s race; the reading traits buy back
**1.77s**. The tax overshoots its own benefit by nearly 4×.

**Remove the field entirely** — from `DEFAULT_TRAITS`, from `shift`, and from its
single call site. A flat boatspeed multiplier is the bluntest available nerf: it
taxes every second of the race whether or not the archetype's advantage is doing
anything, which is exactly how it came to overshoot. Nothing else uses it.

That leaves `shift` with no weakness, and its advertised one — *"slow in a straight
line"* — would become false, breaking principle 1. Replacement:

> **Shift over-tacks.** A shift-chaser cannot leave a header alone, and every tack
> costs speed through the existing manoeuvre mechanics.

Better than a flat tax on three counts: **situational** (costs nothing in steady
air), **self-limiting** (the more the advantage is exercised, the more it is paid
for), and thematically exact.

**Open question — Observed vs. record.** The project notes state shift *"dominated
(+5s) until speedScale 0.97 made 'slow in a straight line' true"*, but the paired
ablation puts the traits at only **1.77s** of benefit without the tax. These
disagree. The ablation is the better-powered measurement (1,200 races, paired on
identical seeds), but if +5s is right, over-tacking becomes load-bearing rather than
flavour and needs real tuning. Settle it at the rebalance pass, not now.

**Verified after the change:** shift moved from +5.12 to −0.86 (−5.98s, t = −4.4),
now statistically indistinguishable from zero and inside the band with every other
archetype.

Note the wider result: **seven of eight archetypes have no measurable effect on
finish time.** That is the design working — archetypes change *how* a boat races
without handing it power. `shift` was the lone violator.

### 3.4 `momentum` — **narrowed**: the drag-zone role is gone

Momentum is **cause-agnostic hull inertia**. It does not know whether target speed
fell because of a lull or a tack. It is *not* a wind stat, and the overlap with
`pressure` is only apparent: pressure acts on the wind **input**, acceleration and
momentum on the **speed response**.

⚠️ **It used to be the designated drag-zone stat** — `stick = 1 − momentum×0.04` in
the weeds branch of `getVenueSpeedFactor`, with the intent that shoals and reef flats
would reuse it. That function and the whole `fx.weeds / swell / ice` system were
removed when venues became document geometry, so **momentum is weaker than it was
authored to be**: deceleration damping and tack agility, nothing else. If drag zones
come back as authored objects, this is the coupling to restore — and the 82 stat lines
were written assuming it existed.

This matters because it rules out a redesign that was considered and rejected:
making pressure an asymmetric rate (quick to gain, slow to lose) would duplicate
acceleration and momentum exactly.

---

## 4. Three new stats — **APPLIED** (`memory` plumbed, mechanic pending)

All three are −5..+5, 0 = fleet baseline.

### 4.1 `lightAir` — groove below ~10 kn
### 4.2 `heavyAir` — groove above ~16 kn, inherits the overpowered relief

**Two independent axes, not one signed axis.** A signed range can only say light
*xor* heavy; two axes give all four quadrants:

| | heavyAir + | heavyAir − |
|---|---|---|
| **lightAir +** | wide groove — good in everything, should be rare and paid for elsewhere | light specialist |
| **lightAir −** | heavy specialist | narrow groove — only good in the middle, a real and valid character |

Moderate air (~10–16 kn) is untouched by both, so these stats never decide a
mid-range race; the other seven do.

**Bands, with soft shoulders.**

| | No effect | Ramp | Full effect |
|---|---|---|---|
| `lightAir` | ≥ 10 kn | 10 → 6 kn | ≤ 6 kn |
| `heavyAir` | ≤ 16 kn | 16 → 20 kn | ≥ 20 kn |

**The ramp is quadratic, not linear** — `effect = t²`, where `t` is normalised depth
into the band. Marginal difficulty escalates in reality: 9 knots versus 10 is
nothing, 6 versus 7 is everything; 17 knots is manageable, 20 is a handful. A linear
ramp would over-reward the shoulders and under-sell the extremes.

**Mechanic sketch.** Heavy/light ability is *both* boat and sailor, so it acts
through both halves already present:

- **boat half** — the `OVERPOWERED` cost, relieved by `heavyAir`
- **sailor half** — `trimEfficiency` (`targetKnots *= trimEfficiency`), which is
  currently ~1.0 for every AI boat and is therefore a dormant lever. Outside a
  character's groove, effective trim degrades.

**Reconciling with `OVERPOWERED`.** Its threshold is 18 kn, inside the 16–20 band.
Clean split: `OVERPOWERED` is the cost *every* boat pays above 18 and `heavyAir` is
relief from it; between 16 and 18, where no overpowered cost exists, `heavyAir` acts
through the groove alone.

⚠️ **`OVERPOWERED` now applies on EVERY venue**, derived from the wind a boat is
actually in rather than from a per-venue `fx` flag that only Glacier Sound carried.
The threshold is the gate, and it gates better than a hand-kept venue list: Gatorgrass
tops out at 8 knots and never pays it, anywhere genuinely reaching 18 does. **This
makes `heavyAir` worth more than the modelled −0.187 s/pt in §4.4**, which was priced
against venue wind exposure when the penalty was Arctic-only. Re-price it at the
rebalance.

Venues already span the range with no new work: swamp 5–8 kn, lake 6–12, river
10–14, ocean 12–20, arctic 16–22.

### 4.3 `memory` — spatial recall of wind **and** current

Coarse grid over the course; each boat EMAs observed wind speed/direction and
current per cell; routing and tack scoring consult it.

**It is a persistence-vs-recency axis, not a good/bad one.** "More memory" as a
straight benefit would have no coherent negative end and would violate principle 2.
What the number sets is the *retention window*:

| | Window | Strong when | Weak when |
|---|---|---|---|
| **+5** | long | structure is fixed and repeats — terrain wind, tidal pattern | the pattern genuinely changes; slow to notice a persistent shift or a turning tide |
| **0** | today's behaviour | — | — |
| **−5** | short | conditions are changing; adapts immediately | never accumulates; re-learns the course every lap |

This is the spatial generalisation of `windFast`, which is already an EMA learning
rate carrying exactly this trade-off — precedent that the shape works in this
codebase.

Memory and planning (§5) are the two halves of one pipeline — *observe → model →
route* — and are complements, not substitutes. Which one **binds** depends on
whether the world holds still:

| World | Binds | Because |
|---|---|---|
| fixed, learnable — terrain wind, tidal pattern | **memory** | a brilliant planner who forgets re-solves the same problem every lap |
| random, roving — puffs, cloud shadows | **planning** | yesterday's gust isn't there |

They substitute in exactly one place: **cached routes** in a stationary world —
local knowledge replacing computation. A memory character arrives at the planner's
answer without doing the planning. Design consequence: **no character should be high
in both**, since complements are super-additive.

**Precedent:** `updateWindTracker` already learns — an EMA of wind *direction* with
`windFast` scaling the learning rate. It is temporal, scalar and position-blind.
Memory is its spatial generalisation.

**What gates it — Observed.** Every venue document today holds exactly ONE wind
region (`wind-all`) spanning the course, so there is no authored spatial structure
and memory would measure ≈0. The region system already supports many polygons, each
with its own direction, speed, oscillation period and phase — *fixed in space,
periodic in time*, which is precisely "learnable". **So memory is gated on venue
authoring, not on engine work.** Expect a ~0 payoff at validation until a
multi-region course exists, and do not read that as a broken stat.

### 4.4 How the values were derived — **Rule**

198 numbers hand-assigned one at a time are unauditable. The 66 shipped characters
were authored from creature identity against a stated rule, then hand-tuned only
where it fought an established character:

| Stat | Positive | Negative |
|---|---|---|
| `lightAir` | small, light, low-drag, patient | massive, power-hungry |
| `heavyAir` | mass, waterline, stability | small, fragile |
| `memory` | intelligence, territoriality, site fidelity, natal homing | no brain, sessile, pure drift |

Worked examples: **Slipstream** memory +5 (salmon natal homing is the most famous
memory in nature, and he is the Sockeye Run native), **Drift** 5/−5/−5 (a jellyfish
has literally no brain and drifts), **Pebble** memory +5 (a penguin returns to the
same nest and the same pebble), **Whiskers** −4/+5 (which makes his existing blurb,
*"unbeatable in heavy conditions"*, mechanically true for the first time).

**Two rules apply at once, and the second one binds.** Deriving purely from identity
produced 30 of 66 as light specialists — the roster really is mostly small creatures —
which is one shape occupying 45% of the fleet. Twelve characters whose light lean was
weakly motivated (pom pom crab, flamingo, hermit crab, kingfisher, tern, mantis
shrimp, tree snake, swan, pufferfish, starfish, octopus, fire salamander) were
moderated toward the middle. Extremes were kept only where delicacy *is* the animal —
seahorse, leafy seadragon, jellyfish, dragonet, nudibranch — or where the design
called for it, as with Croak.

Resulting census: **light 18 · heavy 13 · middling/even 29 · wide 3 · narrow 3.**

---

## 5. Two new traits — **Intent**

Archetype-level, with per-character override (§6).

- **`planning`** — lookahead depth and field-aware routing. `planner.js` is
  currently A* minimising distance subject to not hitting land, with no wind or
  current awareness; making edge cost expected-VMG-through-the-field is the unlock.
- **`currentSense`** — reads current structure. Deliberately a trait, not a stat:
  current is applied as pure drift (`boat.velocity += c`) with **no conversion
  stage**, so every hull in a 2-knot stream gets 2 knots and there is no per-boat
  quality to vary. The gain is in *being in the right water*, which is routing.
  It only bites once currents have structure — eddies behind boulders, tidal
  inversion.

Planning stays a trait rather than a stat for two reasons: it is naturally an
archetype property (a Corner Artist and a Gambler *should* plan differently), and
eleven stat bars stops being legible in the profile panel.

---

## 6. Per-character trait overrides — **APPLIED**

One line in the `Boat` constructor:

```js
this.traits = Object.assign({}, DEFAULT_TRAITS,
                            archDef ? archDef.traits : {},
                            (!traitsOff && config && config.traits) || {});
```

Optional and additive — existing characters need no edits. It removes the §2
limitation: a character can finally be a better reader than another of the same
archetype.

**Discipline — Rule.** An override is a modest scalar on the *one* trait that is
that character's identity: at most one or two fields, within roughly ±30% of the
archetype value. Beyond that, archetypes stop meaning anything and every character
becomes bespoke.

---

## 7. Character shape — **Rule**

Tiers measure *how strong*. Shape measures *what kind*. The roster needs variety in
both, or ten stats collapse into four repeated builds.

**Shape classes**, all legitimate:

| Shape | Signature | Reads as |
|---|---|---|
| **Spike** | one or two extremes, rest near zero | a specialist with an obvious hole |
| **Wide groove** | strong light *and* heavy | unflappable, must pay elsewhere |
| **Narrow groove** | weak light *and* heavy | brilliant in the middle, fragile at the edges |
| **Trade-off pair** | strong X bought with weak Y | the classic; most of the roster |
| **Even** | nothing beyond ±2 | no strengths, no weaknesses — **a real character**, not a failure to design |
| **Craft-led** | memory/handling high, speed ordinary | wins by knowing, not by pace |

**Rules.**
- Every character has at least one real strength and one real weakness, *or* is
  deliberately Even — never accidentally flat.
- Track the shape distribution across the roster; no shape should dominate.
- Tier and shape are independent: an Even character can be A tier, a Spike can be D.

---

## 8. Colour and pattern — **Rule**

Identity on the water is **hull + spinnaker + pattern**; the portrait carries it
everywhere else.

- **White and very dark hulls are deliberate** and stay. They are a large, intended
  part of the palette; do not "fix" them for the sake of a histogram.
- **The spinnaker is where hue variety lives.** It is the on-water identity signal
  and now carries a second accent colour, so it can differentiate two boats whose
  hulls are both near-black.
- **Not all of the spectrum is equally good** for this art style. Prefer saturated,
  clean hues; avoid muddy mid-tones and anything that dies against blue water.
- **The profile band needs a mid-tone.** It uses the hull unless luma <50 or >200,
  falling back to the spinnaker — so a near-black or near-white hull is fine only if
  the spinnaker is mid-tone.
- **Sails are white or black.** Four characters deviate; three are near-whites and
  read fine. `Puff`'s `#62E517` is the only saturated exception and it competes with
  a blue hull, orange spinnaker *and* cyan cockpit — four hues on one boat. **Puff is
  flagged for a colour rework**, now that `spinnaker2` gives a better way to carry a
  second colour.

### 8.1 A third spinnaker colour — **APPLIED**

`spinnaker3`, **optional**, falling back to `spinnaker2` when absent so every
existing boat renders unchanged. `SPIN_PATTERNS` entries gain an optional colour
index, staying backwards compatible:

```js
// a bare function still means "fill with colour 2", exactly as today
// [3, fn] fills with colour 3
tricolour: [(g, s) => band(g, s, 112, 379),
            [3, (g, s) => band(g, s, 645, 912)]],
```

Three colours matter most where two boats share a near-black or white hull: the
kite is then the only identity signal on the water, and a third colour roughly
triples the distinguishable combinations without touching the hull palette.

### 8.2 New patterns — **APPLIED**

The existing seven (`solid`, `halves`, `crosshalves`, `gores`, `stripes`, `rays`,
`triangle`) all read at race scale because their features are large. Candidates that
use a third colour and keep that property:

| Pattern | Construction | Reads as | First used by |
|---|---|---|---|
| `tricolour` | three head-to-foot bands, base / c2 / c3 | bold, flag-like, unmistakable | Torpedo |
| `chevron` | two nested wedges from the head, c2 outer, c3 inner | directional, suits fast characters | Ember |
| `sunburst` | `rays`, alternating c2 / c3 | festive, high-energy | Prism |
| `thirds` | `halves` extended to three horizontal bands | calm, formal | Cruz |

**The picker states the cost.** Options read `Solid (1)`, `Halves (2)`, `Sunburst (3)`
and sort by colour count then alphabetically, so a player can see what a pattern will
ask of them before choosing it. The count is DERIVED from the pattern data —
no regions is one, any `[3, fn]` region is three, otherwise two — so a new pattern
counts itself correctly the moment it is written.

**Rule — three-colour patterns must be large-featured.** The kite is roughly 40–60 px
on screen at race scale. `stripes` is already near the limit at five bands of one
accent; three colours in fine divisions will mush into grey. Thirds, chevrons and
alternating rays survive; anything finer does not.

Third colour must also flow through `renderProfileBoat`, so the profile card and the
water agree.

**Measured gaps** (66 characters, hue wedges with ≤2 entries):

| Wedge | Hulls | Spinnakers |
|---|---|---|
| yellow | 2 | 1 |
| chartreuse | 2 | 1 |
| green | 5 | 1 |
| spring | 1 | 2 |
| blue | 4 | 1 |
| violet | 3 | 2 |
| magenta | 1 | 4 |

Spinnakers are badly red-skewed — 18 of 66 red, 27 red-or-orange. Sixteen new
characters is enough to correct this if hues are assigned from the empty wedges
deliberately, and creature identity almost always permits several plausible choices.

---

## 9. Venue natives — **Rule**

Level says how strong a character is; shape says what kind. **Home** says *where*.
A venue with a face is a venue you can be beaten at by someone in particular.

### 9.1 Three roles

| Role | Per venue | Shape | Gets |
|---|---|---|---|
| **Native** | exactly 1 | peaks a full tier at home | "home water" tag, venue-flavoured quotes |
| **Local** | 1–2 | tilted toward home, not peaked | venue quotes |
| **Traveller** | the rest | no home; strong on an axis, not a place | nothing |

**The 1–3 rule.** At most three characters attached per venue. This is a reserve
policy, not a balance one: new venues will overlap environments, and a venue whose
entire cast was spent on an earlier one has nothing to be *about*. Roughly a third of
the roster is attached; two thirds stay free.

### 9.2 What a native is

1. **Peaks one tier at home.** Overall tier is independent — a C-tier native who is B
   at their venue is a better character than a flat A, because their home race becomes
   an event.
2. **Keeps a hole at home.** Chomp's `handling −5` in a bayou full of cypress stumps
   is the model. A native you cannot beat on their own water is a wall, not a boss.
3. **Is the species that IS that water**, not one that flies over it. Birds and
   mammals earn it inland or where terrain is the identity; on blue water the native
   is a marine species. An ambient wildlife list is scenery, not a casting list —
   reading one as the other is how an albatross nearly became the face of the ocean.

### 9.3 The map — built venues

| Venue | Native | | Locals |
|---|---|---|---|
| Lighthouse Cove | **Bixby** | sea otter | Scoop, Roll |
| Stillwater Lake | **Gasket** | beaver — *builds the still water* | Paddle ○, Trout ✎ |
| Pearl Lagoon | **Pearl** | oyster — venue is named for her | Puff, Jester |
| Gatorgrass Bayou | **Chomp** | saltwater croc | Etienne ○, Skitter |
| Sockeye Run | **Slipstream** | sockeye salmon — venue is named for him | Vex, or dipper ✎ |
| Bluewater Bonanza | **Finley** | tuna — pelagic distance racer | Blaze, Skim |
| Redrock Reservoir | **Torpedo** ○ | pike, or a canyon fish ✎ | Golden Eagle ✎ |
| Glowtide Strait | **Drift** | jellyfish | Lure, Veil |
| Glacier Sound | **Pebble** | penguin — precise in ice traffic | Fathom, Spike |
| Fallwater Fjord | **Muninn** | raven — the one deliberate bird | Arctic Char ✎, Skerry |
| Clubhouse Point | **none** | | the benchmark has no home-town hero |

○ = orphan, art exists · ✎ = to be created

**Otter Run is renamed Sockeye Run** (Aug 1 2026; specced here first as "Salmon Run").
Bixby is a *sea* otter and belongs on the coast; a second river otter would confuse the
two. Slipstream is the venue's native and his existing beat line — *"salmon cannot run
downstream"* — is already the joke. **Sockeye** over Salmon because Slipstream is
literally a *Sockeye Salmon* on the roster, so it names the venue for its witness
exactly; it also avoids colliding with a well-known game mode of the same name, and
spawning-red is a colour no other venue claims.

### 9.4 The map — unbuilt venues

Reserved, not spent. Four of five already have their native on the roster:

| Venue | Native | Cast in reserve | Still needs |
|---|---|---|---|
| Spoonbill Flats | **Petal** — spoonbill, the namesake | Piper ○ | fiddler crab ✎ |
| Emberfall Isle | **Torch** — the salamander that lives in fire | Ember ○ | vent creature ✎ |
| Flamingo Reach | — | Snap, Splash ○, Croak, Pulse | **flamingo** ✎ |
| Tide Pools | **Grip** ○ — barnacle | Scuttle, Hug, Bramble, Breeze, Clutch | nothing |
| Tropical Reef | **Prism** ○ — giant clam | Cheer, Saffron, Tangle, Crush, Anchor, Nimbus, Flaunt ○ | nothing |

Note the split between **Tide Pools** and **Tropical Reef**: sea stars, urchins and
nudibranchs are temperate rocky-intertidal animals far more than coral-reef ones.
Sorting them apart is both more accurate and what stops a lagoon absorbing everything
with a shell.

### 9.5 Reserve families

| Family | Serves |
|---|---|
| Pelagic / offshore — Blaze, Bruce, Razor, Torrent, Sunshine, Flash, Crimson, Mistral, Flicker, Stripes ○, Anvil ○, Tiny ○ | a distance-offshore venue |
| Polar — Bluff, Bulkhead, Whiskers | a second cold venue |
| Freshwater / marsh — Wiggle, Frenzy ○ | a delta or marsh venue |
| Coastal / harbour — Zeffir, Pinch, Regal | an estuary or second harbour venue |

---

## 10. Validation — **Rule**

No stat is considered real until it has been priced. After implementation, measure
with `tier_eval.js` and confirm each new stat's payoff moved the way the design
intends, **before** authoring 82 values against it. A stat that prices at 0.05 s/pt
is decorative, and we know from `reach` how long that can go unnoticed.

Expect `memory` to price at ≈0 until a multi-region course exists (§4.3). That is a
gating fact, not a failed stat.

---

## 11. Dependency order

| Skill | Needs | Exists today |
|---|---|---|
| `lightAir` / `heavyAir` | venues spanning wind strengths | **yes** — 5–8 kn to 16–22 kn |
| `pressure` rename | nothing | yes |
| `speedScale` removal + shift over-tacking | nothing | yes |
| `memory` | a multi-region wind course | no — authoring, coming soon |
| `currentSense` | eddies, gradients, tidal inversion | no — Sockeye Run identity pass |
| `planning` | fields worth routing through | partial |

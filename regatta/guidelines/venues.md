# Venue Spec — All 15 Candidates

*Spec only. No code changes. Each venue is designed here on its own merits and
pushed as far as it will go — trimming comes after, once we can see what each one
would be at its best.*

Companion to [venue-art.md](venue-art.md) (art direction, palette + sky
registries) and [art-pipeline.md](art-pipeline.md) (asset generation).

---

## What this document is for

Every venue must **stand on its own** and make the game world bigger along five
axes at once:

| Axis | The question it answers |
|---|---|
| **Mechanics** | What can I do here that I can't do anywhere else? |
| **Character** | Who lives here, and what does the place feel like? |
| **Narrative** | What story does a race here produce? |
| **Structure** | What shape is the race, and why that shape? |
| **Aesthetics** | What do I see, and does it tell me how to sail? |

## The finding this document exists to fix

**All ten venues race the identical course.** `state.course` is generated in one
place — a start gate 1100u wide, a windward gate at `legLength` (4000u),
`totalLegs: 4`. Windward-leeward, every venue, every time.

**The biggest consequence: there are no reaching legs anywhere in the game.**
Every leg is a beat or a run. Reaching is a third of sailing, it's where the
spinnaker is most alive, it's the fastest point of sail, and it's where boats
actually pass. All 66 competitors carry a `reach` stat that is currently
near-decorative. Course variety unlocks a third of the game.

## Four principles

1. **The course is the shape that makes the mechanic matter.** A squall you route
   around needs lateral choice. A drying channel needs visiting twice.
2. **Every course asks one recurring question.** A good course puts the same
   decision in front of you every lap and changes the right answer. That's what
   makes a race a story instead of a procession.
3. **Hazards are ON the course, not beside it.** Gators in the channel, not
   gators watching from the bank.
4. **Every venue gets a signature moment** players describe to each other.

---

## Course-type vocabulary

| Type | Shape | What it tests | Build cost |
|---|---|---|---|
| **W/L** | beat up, run down | shifts, speed, mark traffic | built |
| **Triangle** | beat, reach, reach | **true reaching**, kite on a reach | +1 mark |
| **Trapezoid** | beat, reach, run, reach + offset | two reach angles; separated traffic | +2 marks |
| **Loop** | circuit around geography, as laps | every leg a different angle | N marks, no repeat roundings |
| **Out & Back** | down a channel and return | handling, passing lanes, asymmetry | 2 marks + narrow bounds |
| **Round the Cans** | scattered marks in order | navigation, all points of sail, route choice | N marks + order logic |
| **Slalom** | staggered gates, mostly downwind | manoeuvre density, spectacle | gate pairs |

**Distance is a modifier, not a type.** Any shape can run as one long lap instead
of several short ones — *Distance Triangle*, *Distance Loop*. It changes what the
race is about (pressure hunting and endurance rather than mark craft) with no new
geometry, and it's the cheapest way to make two venues sharing a shape feel
unrelated.

**Marks don't have to be buoys.** Emberfall rounds volcanic cones. Once that's
true, a lighthouse, a bridge arch or a grounded berg can all be marks, and
rounding becomes part of a venue's character rather than a uniform orange
cylinder. This is probably the single highest-flavour-per-unit-work idea here.

---

## Summary

| # | Venue | Course | The question it asks every lap | Signature moment |
|---|---|---|---|---|
| 1 | Lighthouse Cove | **Trapezoid** | can I make the harbour gate before the ship? | threading the channel with a cargo ship bearing down |
| 2 | Stillwater Lake | **W/L**, long beat | which side of the island has the breeze? | the whole fleet splitting round an island |
| 3 | Pearl Lagoon | **Triangle** | round the squall or through it? | reef gate on the reach, rain arriving |
| 4 | Gatorgrass Bayou | **Loop** | wide and windy, or short and gator-infested? | the log drifting into the gap you chose |
| 5 | Sockeye Run | **Out & Back**, 1 lap | fast water or slack water — and it inverts? | parking in an eddy to shake a rival |
| 6 | Bluewater Bonanza | **Distance Triangle** | where is the pressure, an hour from now? | the long surf home under kite |
| 7 | Redrock Reservoir | **Distance Loop** | where is the pressure, and can I get there before someone blocks me? | diving inside the spire to break an overlap |
| 8 | Glowtide Strait | **Slalom** | do I follow the glow or trust my own line? | chasing a glowing wake through lit gates |
| 9 | Glacier Sound | **Out & Back** | how close do I dare sail to the ice? | a calving that reshapes your return leg |
| 10 | Clubhouse Point | **W/L — FROZEN** | — | — |
| 11 | Spoonbill Flats | **Loop**, 2 channels | is the shortcut still open? | taking it one lap too late |
| 12 | Emberfall Isle | **Round the Cans** | round the cone now, or wait for the vent? | timing a rounding between eruptions |
| 13 | Fallwater Fjord | **Out & Back** | take the downdraft or sail around it? | punching through the fall at speed |
| 14 | Flamingo Reach | **Round the Cans** | where can I possibly pass? | the flock erupting across your bow |
| 15 | Duckling Pond | **Lessons → mini W/L** | where is the wind, and what does that let me do? | the graduation horn, ducklings escorting you over the line |

---

# 1. Lighthouse Cove `bay`

**Tagline** Buoys & Breeze · **Chips** HONEST BREEZE, ALL-ROUND TEST

**Description.** The friendly front door. Fair water, honest breeze, nothing
hidden — a working harbour with a race running through it.

**Character & narrative.** The club regatta in a working port. Spectator boats at
anchor, pelicans on the pilings, a container ship keeping its schedule regardless
of your race. The story is *the everyday race done well* — you didn't beat the
weather, you beat the fleet and everything else using the harbour that afternoon.

**Traits.** Mid everything, no `cond` overrides — default randomisation, and
that's the point.

**Art.** Coastal azure + green headlands; red/green buoys, white lighthouse. Sky:
sea-breeze cloud line over the land, clear over the water (shipped).

**Key mechanics.** **Marine traffic, at two extremes.** This is the venue's whole
identity: the race itself is deliberately plain, and the traffic is what makes it.

| | speed | what it costs you |
|---|---|---|
| **Cargo ship** | slow, utterly predictable | an enormous moving **wind shadow** — the real hazard is its air, not its hull |
| **Wing foiler** | fast, erratic, tiny | a **dodge** — right of way you have but cannot rely on |

Two things, as far apart as the harbour offers, and they work in opposite
directions: the biggest thing on the water hurts you from furthest away and never
touches you; the smallest can only hurt you by being exactly where you are. A
third, middling traffic type would sit between them and teach nothing new.

### Course — Trapezoid, 3 laps

"ALL-ROUND TEST" is a promise W/L cannot keep. The trapezoid is the modern
fleet-racing course: beat, reach, run, reach, with an offset that separates
upwind and downwind traffic.

**But the thing that makes it *this venue's* course is routing it through the
harbour.** The red and green channel buoys already in the art become a real
**gate** the course passes through every lap — a genuine narrow, with right-of-way
consequences, in the one venue that's about buoys and traffic. The windward mark
sits off the lighthouse headland, close enough that a tight rounding scatters the
gulls.

**One island, one wind hole.** A single wooded islet sits inside the course with a
**fixed wind shadow** to leeward of it. Paired with the cargo ship's *moving*
shadow, the venue teaches the same lesson twice in two forms — and the fixed one
teaches it first, because you can see the island coming from the start. This is
the front door's one real piece of wind strategy, and it is deliberately the only
one.

**The question it asks.** *Can I make the gate before the ship does?* The cargo
ship runs a schedule you can learn across a race. Every lap you're calculating whether
to push for the gap, or bear away and lose three lengths in its wind shadow.

**Course hazards.** The **harbour gate** — two buoys, one narrow channel, ten
boats. The **cargo ship** crossing the reaching leg on its schedule, dragging a
wind shadow far wider than itself. **Wing foilers** cutting across at three times
your speed. **Anchored spectator boats**
squeezing the layline at the windward mark, which is exactly where you least want
fixed traffic. The **island's lee**, a fixed hole you can route around or gamble
through. The **rocky islet** just outside the offset, punishing a wide rounding.

**Signature moment.** Threading the harbour gate overlapped with two other boats
while the cargo ship's horn goes.

**Key assets.** Lighthouse (landmark + mark) · harbourmaster's house (landmark) ·
dock (landmark) · wooded islet (landmark + fixed wind shadow) · red/green channel
buoys (nav + gate) · **cargo ship** (traffic, scheduled, wind shadow) · **wing
foiler** (traffic, fast and erratic) · anchored spectator launch (traffic) ·
**gulls** (ambient, reactive — scatter on a close rounding) · **pelicans**
(ambient, on the pilings and diving) · **seals** (ambient, hauled out on the islet
and swimming) · **great white shark** (ambient) · rocky islet (hazard).

**The headlands are New England, and three trees say so.** The wooded islet and
the shore are planted from black oak, pitch pine and eastern red cedar — the real
coastal-plain association of Nantucket, Martha's Vineyard and the outer Cape, and
the cheapest way to make "green headlands" read as a *place* rather than as green.
They are `ambient`, on land, and never in the racing water. The three are told
apart by silhouette before colour, as art-pipeline §2 requires: a broad closed
dome with a salt-sheared flat top, a loose cluster of bristled needle tufts with a
deeply notched rim, and a small tight rosette, at 96 / 72 / 42 world units. Slots
ship from the art manifest as `cove-oak-black`, `cove-pine-pitch` and
`cove-cedar-red`, placeable as the prop kinds `bay-cove-oak-black`,
`bay-cove-pine-pitch` and `bay-cove-cedar-red`.

⚠️ **They are `surface`, not `canopy` — unlike the lagoon palms.** A palm leans
off a sand spit and a hull really does pass under its crown; nothing sails under
a headland. On `canopy` an inland oak would paint itself across a boat racing
past the shore. Read the plane as a question about what is physically above
what, never about what kind of object it is.

**They are drawn as foliage only, and the green is measured off the card.** No
trunk, no limb, no hub — that apparatus belongs to the Bayou, where a tree is split
into a `surface` trunk and a `canopy` crown so a boat can sail between them, and the
visible limb structure is what makes the split legible. Nothing sails under a
headland, so here it costs a clean silhouette at 96px and buys nothing. On colour:
the first pass came back Gatorgrass olive — measured hue 50–67° at saturation
0.27–0.41, against this venue card's own foliage at hue 95° (band 72–144°) and
saturation 0.82 (band 0.62–0.99). ⚠️ **The error was chroma before hue**, and the
cause was the prompt, which had asked for "olive", "dull", "dusty" and
"grey-green" — the Bayou's registered palette, word for word. A subject that wants
a muted colour must name the direction it is muted *toward*, or a generator simply
desaturates.

**Under the three trees, four shrubs.** Scrub oak, northern bayberry, beach plum
and blue hydrangea — the real sandplain shrub layer of those islands, plus the one
plant they are actually famous for. They fill the ground the trees stand in, and
between them the headland stops being a lawn with trees on it. They ship as
`cove-oak-scrub`, `cove-bayberry-northern`, `cove-plum-beach` and the hydrangea in
both of its colours, `cove-hydrangea-blue` and `cove-hydrangea-pink`, placeable as
the prop kinds `bay-cove-*` at 36 / 28 / 22 / 18 / 18 world units — a band
deliberately *below* the cedar's 42, because a shrub layer that overlapped the
trees would make the whole shore one size.

**The beach plum took two rounds, and the reason is worth keeping.** Round 1 came
back at aspect 1.577 — a camera ~51° off vertical, against 1.010–1.021 for the
other four — and as a wide row of six bushes filling 0.536 of its enclosing circle.
The prompt caused it: the subject asks for "five or six leaf clumps … pushed up
against each other", which reads as an instruction to draw five or six bushes in a
row, and the compactness invariant stated right after it lost. ⚠️ **A constraint
does not survive a construction that contradicts it** — the construction tells the
generator what to draw, the constraint only tells it what to check.

Round 2 fixed the shape (aspect 1.026, fill 0.755) and moved the defect somewhere
else: making the plant compact gave it a centre and a ring, so its arrangement
score went *backwards*, 32.6% → 45.6%. ⚠️ That is the third confirmation of the
pattern the pitch pine documented — **each round fails on a different axis, and the
new failure is caused by the fix for the old one.** Don't chase one number in
isolation; a reroll aimed only at the ring risks bringing the sprawl straight back.
Its foliage is also still under the card's chroma floor (0.571 against 0.62), and
the likely culprit is a single word — "matte" — left in the leaf clause.

⚠️ **Size cannot be the separator in that band, so rim texture is.** The trees are
96 / 72 / 42, far enough apart to be told apart by size before any colour arrives;
four shrubs cannot be, because honest spreads for these species all fall between
1.8 m and 4.0 m and any four points in that range land 1.2–1.3× apart. So each is
written around its own outline instead — the scrub oak widest and most bitten, the
bayberry the smoothest closed cushion, the beach plum the loosest, the hydrangea
scalloped by big single leaves — and all four still pass art-pipeline §2's
colour-removed test. Colour is the second cue, not the first.

**Nothing under about half a metre resolves down here, which decides how fruit is
drawn.** At 36 / 28 / 22 / 18 px the 4-screen-pixel floor lands at ~0.43 m on all
four, so an acorn, a bayberry and a beach plum are individually invisible at race
scale and enlarging them to be countable would put half-metre acorns on a
four-metre bush. The acorns are cut; the berries and plums are drawn as **dense
clusters that merge into one patch of colour**. Cluster what is too small to see,
never enlarge it. The hydrangea is the exception that proves it: its flower heads
are below the floor too, but they cover a third to a half of the crown, so they
read as *mass* — which is why the smallest prop in the library is also the most
legible. Colour survives reduction better than shape.

**The hydrangea is cultivated, and that is a placement rule.** The other three go
anywhere on a wild bluff; this one belongs against the harbourmaster's house, along
the village shore and by the keeper's garden, in ones and short rows. Scattered
across an open headland it reads as a mistake to anyone who knows the islands.
**It ships blue *and* pink** — the same species goes blue in acid soil and pink
where shell and lime got into the ground, and a real dooryard has both — so the two
are meant to be planted alternately. ⚠️ That makes them the one pair in the venue
that must not share a silhouette: the leaf rim, palette and flower coverage are
identical by design, and everything else (head count, head size, cushion symmetry,
grouping) is deliberately different, because a repeated outline planted in a row
reads as a stamp. Check the two masters side by side before accepting either. Pink
also never generates on the magenta chroma key — `BACKGROUNDS['magenta']` ends with
*"no part of the subject may be magenta or pink"*, which would tell the model to
refuse the subject's own identity.

**The channel buoys are being retyped, and the card follows them.** `buoy-channel-red`
and `buoy-channel-green` were written as tapered **cone pillar buoys** with a white
band, faithfully matching the buoys on the shipped venue card. They are now **steel
lattice buoys** — heavy round drum, open square welded cage, blank white number
board, small lantern — after a reference pass. The props are what a player stares at
for a whole race and the card is what they see once in the picker, so the props won
and `bay.png` is slotted for a reroll to match. ⚠️ **Until that card lands the venue
holds two buoy types.** That is accepted and temporary; don't "fix" it by reverting
the prop subjects.

⚠️ **The lattice only exists because the exaggeration is declared.** At `world: 28` a
real buoy's cage members are ~10cm = **0.9px** — drawn true, the identity would not
exist. So the cage goes to three-fifths of the drum (against a true 39%) and its
members to ~3px, leaving the four openings at ~3.9px, exactly on the 4px floor. That
is why the subject demands a **two-by-two** grid and calls any finer mesh a mistake:
a 3×3 would put the openings at 2.3px and dissolve into grey.

**Settled on the contact sheet: no white drum band.** The reference buoy has none, so
the rewrite dropped it and handed findability to the four dark lattice openings
against the bright deck — a value cue rather than a hue cue. At 28px over both extreme
waters that reads cleanly as a nav aid: a coloured disc with a dark cross and a bright
centre. So no band on the props, and none on the card reroll either. The white *number
board* is also out of the prop subject at 2px, but **stays in the card subject**, where
the buoys are drawn at illustration scale — the same object gets a different parts list
at different sizes, which is why props and cards keep separate subjects.

**They are props, not mark kinds — place the buoy, then put a `none` mark on it.** A mark
is a station on a race *course*; a channel buoy is a thing that exists in the harbour
whether the course visits it or not. Making it a mark kind welds those together, so you
could never have a buoy that is only scenery. Instead: line the channel with buoy props
freely, and where the course really should round one, drop a **`none`** mark ("No buoy —
position only") on top of it. Art and race function stack independently, one buoy is
furniture while its neighbour is a gate mark, and the course document never has to know
what a buoy looks like. That composition is why `MARK_KINDS` carries `none` at all.

**They collide — `hard`, `contactR: 13`, `wash: 0.48`.** This is the one place in the
harbour where the collider genuinely fits. Every vessel here is `contact: none` for a
*geometric* reason, not a design one: the hidden collider is a circle, and a 4.3:1 cargo
hull sized to its beam leaves two thirds of the ship sailable-through, sized to its length
it becomes an invisible wall. **A buoy is a disc** — the circle isn't an approximation of
it, it *is* the shape — so what you see is exactly what stops you. `contactR` is r90 off
the bake (12.6u red, 12.7u green), inside the drum's true 13.6u edge; compile inscribes a
12-gon in it, so the effective radius is ~12.6–13. `wash` is r99 ÷ world, by the cypress
knee's rule that "a prop earns a waterline by standing in water."

⚠️ **That makes the harbour gate a real narrow.** Two 13u colliders eat 26u of it before
any hull does, and threading it three-abreast — the venue's signature moment — can now be
*lost* rather than merely tightened. Check the gate width when the course is laid.

⚠️ **These are the first props whose art carries no venue**, so they name their own `src`.
`propSprite`'s `<venue>/<name>` split can't reach a bake that sits flat in `props/`, which
had quietly locked all six venue-neutral world-props (`mark`, `mark-can-yellow`, both
buoys, `committee-boat`, `zodiac`) out of being props at all. The path is built in **three**
places — the game, the editor's palette thumbnail, and the editor's canvas layer — and all
three now honour `src`. Patch one and the kind is pickable with a broken thumbnail.

⚠️ **`planRound` could not catch the failure that actually shipped.** The first green
lattice came back as a bare square cage with no float — circularity **0.634**, the exact
value of a square, against the accepted red's 0.974. Both passed the aspect gate (1.047
and 1.026), because **a square is also as tall as it is wide.** Ratio catches a tilted
camera and is blind to a subject that came back the wrong *shape*. For anything whose
silhouette should be a disc, measure **circularity** — filled area ÷ smallest-enclosing-
circle area — and treat under 0.90 as a reject.

**The shark is atmosphere, not an obstacle.** It cannot slow a keelboat, and a
collision penalty would be the first rule in the game its own fiction doesn't
support. A fin crossing your line that costs you nothing is worth more than a rule
players would resent — and it lands harder in a venue whose real dangers are all
made of steel and air. Character kin: Bruce is a Great White Shark (race-view.md 10.5).

**The gulls are the venue's one reactive element.** A tight rounding at the
lighthouse scatters them, which makes a good rounding *visible* — to you and to
anyone watching. It costs nothing and rewards exactly the thing the venue teaches.

---

# 2. Stillwater Lake `lake`

**Tagline** Glass & Puffs · **Chips** DEAD SPOTS, SHIFT READING

**Description.** Mountain lake, mirror-flat, breeze arriving in visible patches.
The most *readable* venue — the water shows you where the pressure is, and the
penalty for not looking is sitting still while someone sails past.

**Character & narrative.** Quiet and a little smug. An angler who resents you, a
loon that dives as you approach, a cabin with the lights on. The story is *the
patient read* — you won because you looked at the water.

**Traits.** Shiftiest in the game — `shiftiness 0.7–1.0`, `puffShiftiness
0.6–0.9`, weak gusts (`0.35–0.6`).

**Art.** Deep lake blue + pine green; warm cabin lights. Sky: 12 small puffs on
open pale blue (shipped) — the clouds *are* the puffs.

**Key mechanics.** **Glass patches** — mirror-sheen lulls, readable dead air.
**Shoals** — pale turquoise, progressive drag, soft grounding, no penalty, so
reading water colour is racecraft. **Anchored skiffs** that never move.

### Course — W/L with a stretched beat, 4 laps

This is the one venue where W/L is genuinely the *best* design rather than the
default, and the spec should say so out loud. Shift-reading is the entire venue;
a beat is the only leg where a shift is worth points, and a reach is where shifts
matter least. Reaching legs here would dilute the identity.

**What makes it awesome is putting a big pine island square in the middle of the
beat.** That's the most classic decision in real lake racing: you cannot sail
through it, so you commit left or right, and the two sides have different
pressure and different shifts. The fleet physically splits and you lose sight of
half of it for a minute.

**The question it asks.** *Which side of the island has the breeze?* Every lap,
with a different answer, and you can partly read it off the water before you
commit.

**Course hazards.** **Shoals sit on the inside of the favoured layline** — the
shortest route to the mark is the one that grounds you, so read the colour or
pay. **The island's wind shadow** extends well downwind of the island itself,
invisible except in the water texture. **Anchored skiffs** as fixed mid-course
traffic that bark at you when you pass close. **Glass patches** drifting slowly,
so a lull that was on the left last lap isn't now.

**Signature moment.** Taking the unfavoured side alone on a puff you saw and
nobody else looked up for — and emerging ahead of the pack at the mark.

**Key assets.** Log cabin with lit windows (landmark) · dock (landmark) · **big
pine island (course splitter)** · anchored skiff ×3 (traffic, static) · grumbling
angler (ambient, Sayings barbs) · loon pair (ambient, dives when approached) ·
trout rings (ambient) · shoal patch (terrain) · glass patch (terrain, drifting).

---

# 3. Pearl Lagoon `lagoon`

**Tagline** Squalls & Coral · **Chips** RAIN SQUALLS, CORAL HEADS, SQUALL RIDING

**Description.** Turquoise flats, coral gates, and squalls marching down the
trades. Duck the rain or ride it — the brave get wet and get ahead.

**Character & narrative.** Warm, bright, periodically violent. Turtles, rays
under glass-clear water, flying fish off the bow. The story is *the gamble* —
you went into the rain and came out in front, or you didn't.

**Traits.** Steadiest direction in the game (`shiftiness 0.15–0.35`) with strong
gusts (`0.55–0.75`). It blows from one place, hard; the drama is the cells.

**Art.** Pale glowing turquoise + sand; coral pinks/purples under the water. Sky:
dark squall cell with rain shaft one side, bright trade sky the other (shipped).

**Key mechanics.** **Rain squalls** — 2–4 slow mobile cells with a visible rain
curtain, big pressure inside, hard shifts at the edges. **Reef passes** — coral
shelves in broken lines with gaps; paler water reads as shallow.

### Course — Triangle, 3 laps. Build this first

Highest value-per-work in the document: one extra mark unlocks reaching for the
entire game.

A squall is something you *route around*, and routing needs lateral choice. On a
beat the squall is weather that happens to you; on a reach it becomes a decision.
And the reaching leg is deliberately laid so it **crosses a reef pass** — there
is a gap, it is not on the rhumb line, and the pale water tells you where.

**Two things make the squall genuinely great rather than just weather:**

- **It has a payoff curve, not a binary.** Deep inside is big pressure; the edges
  are a hard header. Skirting the back costs distance but stays clean. There is
  no correct answer, only a bet.
- **It leaves a wake of dead air.** Behind a passing cell the water goes glassy.
  So the cell isn't just an obstacle to route around — it's a moving hole you can
  get trapped behind, which means *timing* matters as much as position.

**The question it asks.** *Round it or through it?* — with the reef gap
constraining your options on the same leg.

**Course hazards.** **Coral heads** scattered off the direct line, so the fast
route is never quite the straight one. The **reef pass** as a gate on the reach.
**Squall cells** drifting across all three legs with their dead-air wake behind.

**Signature moment.** The reef gate on the reach with a squall closing from
windward — kite up, gap narrowing, rain arriving.

**Key assets.** Coral head (hazard) · reef shelf (terrain, gate) · sandy islet
with palms (landmark) · squall cell with rain curtain and **dead-air wake**
(weather prop) · sea turtle (ambient) · rays (ambient) · flying fish (ambient).

---

# 4. Gatorgrass Bayou `swamp`

**Tagline** Dead Air & Weed · **Chips** WEED BEDS, KEEP HER MOVING

**Description.** Green, close, airless. The breeze is fickle and the water grabs
at you. Nothing here is fast — this venue is about not stopping.

**Character & narrative.** The most *inhabited* venue. A stilt shack with a rust
roof, a pirogue tied up, gators in the water, dragonflies. The story is *the
grind* — you didn't sail fast, you refused to stop.

**Traits.** Most chaotic wind in the game — `shiftiness 0.8–1.0`, `variability
0.8–1.0` — and the weakest gusts (`0.15–0.35`).

**Art.** Olive and yellow-green throughout. Sky: none — cypress canopy, heat
haze, god-rays. Already correct and exempt from the sky rework.

**Key mechanics.** **Weed beds** with momentum-scaled drag. **Mist patches** on
dead-air zones as the readable hazard. **Cypress stumps** as hard obstacles.

### Course — Loop through braided channels, tight laps

W/L is actively wrong here and so is anything manoeuvre-dense: in dead air every
tack costs the little momentum you have, so many roundings is punishment, while a
long beat in no wind is boring. A loop threading the channels gives continuous
gentle turning and no dead stops.

**What makes it awesome is making the loop braided — a genuine fork every lap.**

- The **outer channel** is wide, longer, and actually has some breeze.
- The **inner cut** is much shorter, twisting, nearly airless — and full of
  gators and drifting logs.

That's a real risk/reward with no dominant answer, and it changes with your
position: leading, you take the safe outer; three boats down with a lap to go,
you take the cut and pray.

**The question it asks.** *Wide and windy, or short and gator-infested?*

**Course hazards — this should be the most obstacle-dense venue in the game.**

- **Drifting logs.** Half-submerged, slowly crossing the channel, hard collision.
  They *drift* — reusing the Arctic floe system — so the gap you planned on lap
  one has closed by lap two. Best hazard in the venue and nearly free to build.
- **Gators.** Genuinely in the way: they lie in the channel, **submerge when you
  come close, and surface somewhere else.** A hit is a soft collision plus a
  Sayings quip. Chomp's kin — the witness that bites back, and the first hazard
  in the game that *moves in response to the player*.
- **Cypress knees** in clusters at the channel edges, punishing a tight inside
  line exactly where the cut is narrowest.
- **Weed beds** narrowing the fast lane so the channel is effectively tighter
  than it looks.

**Signature moment.** Committing to the inner cut and finding a log has drifted
across the only gap.

**Key assets.** Bald cypress (landmark) · cypress knees (hazard) · **drifting
sunken log (hazard, moving)** · **gator that submerges and resurfaces (hazard,
reactive)** · lily-pad raft (ambient) · cattails (ambient) · stilt shack
(landmark) · pirogue (traffic) · day beacon (nav) · dragonflies, egret (ambient).
*Ten slots already declared in the manifest — the pipeline's pilot venue.*

---

# 5. Sockeye Run `river`

**Tagline** Current & Rocks · **Chips** READ THE WATER, LANE CHOICE

**Description.** A river that actually flows. The stream runs hard down the middle
and dawdles — or turns back on itself — along the banks. Pick the lane that pays,
and pick it again in reverse on the way home.

**Character & narrative.** Alpine and busy. Stone bridges, salmon running up the
shallows, bears working the gravel bars, eagles on the snags, Bixby's kin in the
eddies. The story is *the lane* — you found water nobody else was in.

**Traits.** Moderate wind, low shiftiness (`shiftiness 0.20–0.35`). The breeze is
the steadiest in the game because the valley holds it; the variable that matters
is the water.

**Art.** Whitewater teal + tan rock. Sky: high thin cirrus only (shipped) —
terrain-driven wind, not thermal.

**Key mechanics.**

- **Spatial current field** (`fx.river`, built) — the game's only existing current
  system, and the venue is built entirely on it.
- **Three lanes, not two.** The thalweg down the middle runs hardest; the shallows
  run slower; and behind rocks and along the insides of bends the water turns and
  runs *back upstream*. A back-eddy is not merely less bad going up — it is
  actively faster than standing still.
- **Rapids** — a boost or a penalty depending on your line, see below.
- **Valley wind.** The valley funnels the breeze along its own axis, blowing
  downstream. This is what makes the two legs different races rather than the same
  race twice.

### Course — Out & Back, **1 lap**

**Upstream is a beat against the current. Downstream is a run with it.** Wind and
water agree, which stacks the asymmetry as high as it will go:

- **Out** is slow, patient and technical. You are stemming the current and beating
  into the valley wind at once, so you hunt slack and back-eddies along the banks,
  short-tack the insides of the bends, and give up the rhumb line entirely. You
  pass people by being cleverer about water, not faster through it.
- **Back** is fast, compressed and committed. The current does the work, the fleet
  converges on one fast lane, and everything you dodged carefully on the way up
  now arrives at speed with the river pushing you into it.

**One lap changes what the venue tests.** Three laps would let you learn the
river; one lap means you have to *read* it. Every lane cue has to be legible from
the water at racing speed — foam streaks, eddy lines, the colour change over the
shallows, standing waves at the rapids. This venue is the one that teaches players
to read water, so its features must be honest: what you can see must be what is
there.

**The question it asks.** *Where is the water helping me, and is it worth what it
costs to get there?* — and the answer **inverts** halfway through the race, which
no other course shape can do.

**The island asks it twice, with opposite answers.** A wooded island splits the
river into a short shallow channel and a longer deep one. Going up you want the
shallow side: less current, and the back-eddies behind the island's head can
carry you. Coming down you want the deep side: the current is the point. Get it
right twice and you have made two gains from one piece of geography — and the
second decision arrives when you are moving three times as fast.

**Rapids — a boost or a penalty, by line.** Each rapid has a smooth **tongue**
where the water accelerates cleanly, and broken shoulders either side. Hit the
tongue and the river fires you through faster than you could sail. Miss it and the
standing waves stop you dead and turn you sideways. It is precision rewarded, not
a lottery — the tongue is visible as a dark V from upstream, and the tell is
readable at speed, which is what the one-lap format demands.

**Course hazards.**

- **Midstream rocks sit in the fast lane** — the quickest water is the most
  obstructed. They also *make* the back-eddies you want, so the same feature is
  the hazard on one leg and the opportunity on the other. That double duty is the
  neatest thing in the venue and should survive any simplification.
- **Two bridges** form hard gates: pick an arch, commit, no changing your mind.
  Each throws a wind shadow across the river and the current runs faster through
  the narrowed span, so the boat that picks well gains twice. **Bridge pylons** are
  solid.
- **Shallow banks** run progressive drag and then ground you — so the slack lane
  is not free, and hugging the bank to escape the current has a floor.
- **The rapids' shoulders**, on both legs, but far more punishing downstream.

**Signature moment.** Parking in the eddy behind a rock to let a rival sail past
into the stream — a real river-racing trick no other venue can offer.

**Key assets.** Two stone arch bridges (landmark + gate) · **bridge pylon
(hazard)** · midstream rock (hazard, with eddy) · river island (landmark + route
choice) · rapid tongue and standing waves (terrain, boost/penalty) · eddy-line
foam (terrain) · gravel bar and shallows (terrain + soft hazard) · rocky bank
(terrain) · **bear on the gravel bar** (ambient, fishing) · **salmon run**
(ambient — they are doing exactly what you are, fighting the current) · **eagle**
(ambient, perched on snags and overhead) · otter — Bixby kin (ambient; **this
venue owns the otter**).

> The heron moved to Gatorgrass Bayou, where it is already a declared asset
> (`bayou-heron`). Two venues sharing a signature bird would weaken both.

---

# 6. Bluewater Bonanza `ocean`

**Tagline** Swell & Speed · **Chips** UPWIND SLOG, SURF THE SETS

**Description.** No shore, no shelter, no excuses. Big water and a long way to
go. The event, not the place — real regatta slang, deliberately.

**Character & narrative.** Epic and lonely. Dolphins on the bow wave, an
albatross that follows whoever's leading, a whale surfacing once a race. The
story is *the passage*.

**Traits.** Steadiest wind by a distance (`shiftiness 0.05–0.2`). Nothing shifts;
everything is speed and pressure.

**Art.** Deep open-ocean cobalt. Sky: **parked** — cloud shadows are right in
principle but two generative passes and a composite failed on-style.

**Key mechanics.** **Swell sets** (`fx.swell`, built). **Surfing HUD cue**,
sibling of PLANING/OVERPOWERED. **Cloud-shadow pressure cells** — drifting
cumulus shadows *are* the gust cells. Still the best unbuilt idea in the set.

### Course — Distance Triangle, one long lap

No obstacles and no shifts makes short laps pointless — you'd sail the same clean
beat four times. **This should be the one race in the game that feels like a
voyage.**

Give it a **destination you can see from the start**: a distant seamount or rock
on the horizon. You beat out to it, round it, and come home. That single change
turns an empty ocean into a journey with a middle — and it costs one mark that's
also a landmark.

The triangle then gives it **one enormous reaching leg home**, which is where
surfing actually pays: a set only carries you if you have distance to run. A long
reach under kite in big water is the most exhilarating thing a sailing game can
offer, and this venue exists for it.

**The question it asks.** *Where will the pressure be an hour from now?* Not
where is it — where is it going. That's a different skill from every other venue
and it's the one this course tests.

**Course hazards — the only venue whose hazards are invisible.** No rocks, no
traffic. What hurts you is the **swell set caught at the wrong angle** (broach
risk, speed loss) and the **cloud shadow you sailed into** — a pressure hole with
no physical marker. That absence *is* the identity: everywhere else you read the
water for objects, here you read it for air.

**Signature moment.** Catching a set on the long reach home and holding the surf
while the fleet behind drops into the trough.

**Key assets.** **Distant seamount / rock (landmark + mark)** · humpback with
blow (ambient) · dolphins on the bow wave (ambient) · flying fish (ambient) ·
albatross following the leader (ambient) · cumulus shadow patch (weather prop) ·
whitecap fragments (terrain).

---

# 7. Redrock Reservoir `redrock`

**Tagline** Cliffs & Gusts · **Chips** WIND SHADOWS, ROCK SPIRES, LOCAL KNOWLEDGE

**Description.** Sandstone walls, turquoise water, and a breeze that does what
the rock tells it. The only warm palette in the game.

**Character & narrative.** Silent and enormous — until the fleet arrives, and
then it is the loudest venue in the game. Bighorn on the ledges, ravens, an
eagle riding a thermal you can't use. The story is *the local* — you learned the
canyon and it paid.

**Traits.** Strongest gust bias outside the Arctic. Punchy and
location-dependent.

**Art.** Orange/rust sandstone + turquoise water. Sky: **bare, by choice** —
distinctive by absence, excluded from the sky rework.

**Key mechanics.** **Terrain-shaped wind** — its own mechanic class: fixed,
learnable geography-wind rather than random weather.

### Course — Distance Loop, one circuit that folds back through its own water

> ⚠️ **Identity changed August 2026, and the doc is the thing that was wrong.**
> This venue was specced as a lonely expedition — *"down one canyon arm and back
> up a different one, so no leg repeats and you never see the boats ahead."* The
> authored course does the opposite: it doubles back through the same narrows,
> and those narrows are tighter than the fleet. **That is better, and it is now
> the venue's identity.** Redrock is **the traffic venue** — the one place in the
> game where the boat ahead of you is a wall. The old "lonely distance" brief is
> retired and not reassigned; nothing else in the set needs it.

**The maze is the mechanic, and it is already built.** Measured off the authored
geography:

- **20%** of the sailable water is under 2 boat lengths wide, **46%** under 4.
- **Legs 1 and 5 share 100% of their water, running in opposite directions.**
  Legs 2 and 3 share 67%, legs 4 and 5 share 46%.
- Legs 1, 3 and 5 **cross each other** in a junction 40 m across.

So the fleet meets itself three times a lap, head-on, in water where two boats
abreast is a squeeze. No hazard had to be invented for this; it falls out of the
shape of the canyon.

**Distance, not laps — for now.** One long circuit means you meet each pinch
once. ⚠️ **A traffic venue wants laps**, because congestion compounds with
repetition and the second time through a junction — fleet strung out, leaders
lapping — is where the stories are. That change needs the course rethinking from
scratch, so it is deliberately deferred rather than forgotten.

### The wind pass — what the slots actually do

**The venue authored 25 wind regions, more than any other venue in the game, and
every one of them carried 16 knots.** Only direction varied. The consequences
were exact and measurable, and they are worth writing down because any
geography-fixed venue can make the same mistake:

- **Every fork was a coin flip.** Leg 1 offers two genuinely separate routes,
  446 m and 492 m. Priced with the game's polar including the lees, both took
  **24.2 seconds**. The geometry for a decision was built; the reason to prefer
  a branch was not.
- **The breeze was drawn to follow the channels**, so every leg lay along its own
  corridor: measured TWA of 18°, 65°, 144°, 36°, 150°. The race was 44% beat,
  **13% reach**, 43% run — and a "beat" up a channel six boat lengths wide is
  nine forced tacks in twenty-four seconds, which is a metronome, not tactics.
- **There were no gust sources at all**, so no puff or lull ever appeared on the
  water, on the venue whose card promises "sudden gust-bombs".

**A slot's speed is a fact about its geometry, so that is where the numbers come
from.** A slot whose axis lines up with the breeze funnels it; a slot lying
across the breeze, or tucked in behind a wall, goes dead. Speeds now run **7 to
24 knots** across the course, assigned by that rule rather than sprinkled — the
narrows at `wind-14` and `wind-16` lie along the wind and blow 24 and 22, the
cross-slots at `wind-8` and `wind-3` sit at 7 and 11.

**Four regions were turned ACROSS their channels rather than along them.** This
is the change that gives the venue angles: a bent canyon is the one geometry
that hands you every point of sail for free, and aligning the breeze with the
corridor throws all of it away. The race is now **26% beat / 39% reach / 35%
run** — the most balanced split in the set — and reaching in a four-boat-length
channel with a rival to leeward is the passing moment the venue previously had
none of.

**Three gust sources sit on the rim**, over land, upwind of the course. Their
puffs fall onto the water 3–10 seconds after birth, which is what a williwaw is:
it drops off the cliff beside you rather than announcing itself from a mile away.
The *learnable* half of the venue is the static speed map; the *sudden* half is
these. Keeping those two apart is what stops "local knowledge" from meaning
"memorise the weather".

**The question it asks.** *Where is the pressure, and can I get to it before
someone parks in front of me?* Two questions welded together, which is what
makes it this venue and not a bigger Stillwater.

**The forks are traffic decisions, not speed decisions — and that is right
here.** Leg 1's two lanes cost the same time but the short one is 6.1 boat
lengths wide and the long one is 2.7. You take the narrow lane to escape dirty
air and you pay for it if you meet someone coming the other way. On leg 5 the
narrow lane is actually *faster* by 2.4 s, which makes it a genuine risk taken
for a real reward.

**Course hazards.** **Rock spires stand mid-channel** where the wind is best, so
the fast line threads them — and four of them now carry a height, so each throws
a short ribbon of bad air you can be on the wrong side of. **Wall shadows** are
invisible hazards that park you if you cut a corner; every leg spends 2–11% of
its length under 6 knots. **Williwaws** drop off the rim at three fixed,
learnable points. The **narrows** are a hard gate with no passing room. And
**the fleet itself** is the hazard the venue is named for.

⚠️ **Leg 4 contains a pinch 1.3 boat lengths wide.** That is narrower than the
project's own passability floor and it pre-dates the wind pass. It is either the
venue's best gate or its worst bug, and it should be measured with real boats
before anyone decides which.

**The Sentinel.** `mark-1`, the junction mark every boat converges on, is no
longer an orange inflatable: it is a sandstone spire the course rounds, laid as
a `redrock` shape with the mark set to `none` and the rounding radius taken from
the rock. It stands 15 m, so it trails 150 m of bad air, and the two lanes past
it are not the same width. This is the cheapest flavour in the document —
Emberfall's cones and the Cove's lighthouse want the same treatment.

**Signature moment.** Diving inside The Sentinel on the narrow side to break an
overlap, with the boat you just passed sailing back down the same channel on the
other tack.

**Key assets.** Rock spire (hazard) · **The Sentinel — spire as rounding mark** ·
canyon wall (terrain) · **slot narrows (terrain, gate)** · bighorn on a ledge
(ambient) · raven (ambient) · golden eagle (ambient) · dust haze (weather prop).

---

# 8. Glowtide Strait `glowtide`

**Tagline** Moonlight & Glow · **Chips** NIGHT RACING, GLOW READING

**Description.** Night racing on black water, where the only truth glows.

**Character & narrative.** Eerie and beautiful. Jellyfish lanterns, moths at the
mark lamps, an owl on the committee boat. The story is *the leap of faith*.

**Traits.** Mid-everything wind. The difficulty isn't the breeze, it's that you
can't see it.

**Art.** Near-black indigo; electric cyan biolume, red lit buoy, moon gold. Sky:
clear moonlit night — already correct.

**Key mechanics.** **Information scarcity.** Gust visuals dim to faint glow
threads. Bioluminescent wakes, lit marks, nav lights on boats.

### Course — Slalom through lit gates

In darkness *the lit marks are the only thing you can see*, so make them the
course. A downwind slalom through staggered glowing gates turns the venue's
handicap into its spectacle: flying under kite, navigating by lights, at the
fastest and most committed point of sail.

**The mechanic that makes this extraordinary: bioluminescence scales with speed.**
The faster a boat moves, the brighter its wake glows. Which means:

- **The leader is literally the brightest thing on the water.** You can see who's
  fast from anywhere on the course.
- **You can follow a glowing track** — the fleet draws its own racing line in
  light, and a fast boat ahead is a free map of where the pressure was.
- **But following costs you.** Their line was right for the gate they took, and
  the glow is already fading behind them.

That's a genuinely novel tactical layer, it's beautiful, it's mechanically honest
to a venue about reading scarce information, and it exists nowhere else.

**The question it asks.** *Do I follow the glow, or trust my own line?*

**Course hazards.** **Unlit rocks between the gates** — the one genuinely
frightening hazard in the game, invisible except for the faint glow of water
breaking over them. That's the venue's promise as a hazard: *the water tells the
truth if you look, and here looking is hard.* **Gate traffic** is the other — a
slalom compresses the fleet, so every gate is a crowded rounding at speed.

**Fairness guard.** Gates must be lit brightly enough to see from the previous
gate. Unlit rocks must always carry *some* tell (breaking water, a biolume ring).
Keep legs short so a mistake costs a place, not the race.

**Signature moment.** Chasing a glowing wake through three gates and diving
inside at the fourth.

**Key assets.** Lit racing mark with lamp (nav) · red lit buoy (nav) · **unlit
rock with breaking-water tell (hazard)** · **speed-scaled biolume wake
(terrain/VFX)** · glowing jellyfish (ambient) · moths at the lamps (ambient) ·
owl on the committee boat (ambient).

---

# 9. Glacier Sound `arctic`

**Tagline** Glacier Wind & Ice · **Chips** DRIFTING ICE, OVERPOWERED, GUST TIMING

**Description.** Steel water, blue ice, and a wind that falls off the glacier
without warning. The completed template.

**Character & narrative.** Hostile and magnificent. Orcas surfacing in formation,
penguins diving off a floe as you pass, a polar bear once in five races. The
story is *the survival* — you finished, and the ice moved while you did.

**Traits.** Hardest wind in the game — `gustStrengthBias 0.75–0.95`. The only
venue where OVERPOWERED is routine.

**Art.** Steel navy + faceted ice blue-white. Sky: low grey overcast, sea smoke,
snow streaks — already correct.

**Key mechanics.** **Drifting hard ice** (`fx.ice`) — bergs and floes that bounce
and inherit collision, avoidance, pathfinding and wind shadow by being islands.
**Katabatic gusts** (`fx.overpowered`). **Snowfall**. Soft-ice RRS handling.

### Course — Out & Back along the glacier face

**The outbound leg runs the glacier face where the katabatic falls hardest; the
return runs the sheltered side of the sound.** One leg is survival, the other is
tactics — and the venue uniquely earns that asymmetry.

It differs from Sockeye Run's out-and-back on every axis that matters: there the
asymmetry is **current**, here it's **wind**, and here the channel itself changes
because the ice moves while you're racing.

**The awesome part is that the glacier face is a gradient of risk.** Sail close
and the leg is short, but the katabatic is savage and OVERPOWERED is constant.
Sail wide and you're safe, slower and longer. There's a continuous choice of how
brave to be, re-made every lap, and it's the clearest expression of the venue's
whole character.

**The question it asks.** *How close do I dare sail to the ice?*

**Course hazards.** **Bergs and floes drift across the course**, so the gap you
used outbound may be closed on the return. **The calving front** is the signature
hazard: the glacier face periodically drops new ice into the water *during the
race*, spawning fresh floes and a surge that pushes you off your line.
**Katabatic gust lanes** are fixed in position, learnable, and will flatten you
if you're carrying too much sail.

**Signature moment.** A calving between laps that reshapes the return leg you'd
already planned — the course is not the same course it was.

**Key assets.** Iceberg (hazard) · brash floe (hazard, drifting) · **calving
glacier face (landmark + hazard source)** · orca pod (ambient, sequence) ·
penguins on a floe (ambient, dive when approached) · polar bear 1-in-5 (ambient
easter egg) · sea smoke (weather prop). *Orca slots declared in the manifest.*

---

# 10. Clubhouse Point `seatrials`

**Tagline** Cans & Consistency · **Chips** NO SURPRISES, TRUE BASELINE

*Renamed July 31 2026 from **Sea Trial Bay** (tagline "Clipboard & Stopwatch").
Every other venue is named after a place; this one was named after a procedure,
and it read cold in a set whose brand is warmth. The key stays `seatrials` —
see the standing constraint below.*

**Description.** The measuring stick. Nothing happens here on purpose.

**Character & narrative.** The Wednesday-night club series: same course, same
evening breeze, same fleet, every week all season. This is the rename earning its
keep — **beer-can racing is the most repeatable racing there is**, so the name now
*explains* why nothing here ever changes instead of sitting awkwardly beside it.
Warmth is allowed in the copy and the music; it is not allowed in the course. The
story is still *the number*.

⚠️ **A friendly name must not become a friendly venue.** The risk this rename
carries is pressure to make the place fun — a hazard, a bit of flavour, one gator.
The chips and the standing constraint below are what hold that line.

**Art.** Plain honest blue. 0.055 value contrast, by far the flattest card, which
is correct for a benchmark.

**Key mechanics.** None. That is the feature.

### Course — W/L, FROZEN

⚠️ **This venue is the eval anchor.** The harness pins it via `localStorage`
(`eval/eval_harness.js:17`) so AI numbers stay comparable across every change to
every other venue. Its course, wind and conditions must never change —
**including when course types ship.** Whatever else the game gains, Clubhouse Point
keeps racing the 2026 windward-leeward, or the entire regression history becomes
meaningless.

**Course hazards.** None, ever. Adding one breaks the baseline.

**Key assets.** One orange racing mark (nav) · committee boat with flag
(traffic). Nothing else.

---

# 11. Spoonbill Flats `flats` — *art ready*

**Proposed tagline** Ebb & Sandbar

> **Naming.** Specced as "Curlew Flats"; the art landed on spoon-billed
> sandpipers and they're better. **Spoonbill Flats** follows the convention that
> a venue is named for its witness (Sockeye Run/Slipstream, Gatorgrass/Chomp).

**Description.** A wide estuary emptying itself. The tide falls all race: bars
surface, channels narrow, and the water runs harder through what's left.

**Character & narrative.** Big, quiet, slightly ominous — the sea leaving.
Withies leaning in the mud, a stranded dinghy, sandpipers landing on ground that
was underwater a minute ago. The story is *the clock*.

**Traits.** Moderate steady breeze; the drama is entirely in the water. The wind
must stay *quiet* so the tide reads as the thing that changed.

**Art.** Warm amber-gold sandbars with deep slate-blue channels and rust-red
withies. Master measures 0.693 saturation — in range.

**Key mechanics.** **A single `tidePhase` drives both**, which is what makes this
cheap and coherent:
- **Depth falls** → bars emerge → the navigable map shrinks mid-race
- **Flow builds** → the same water squeezes through fewer channels → current
  accelerates as the race goes on

Plus **wind-over-tide chop** and a **slack-water window** to race for.

**Cheaper than it looks.** Sockeye Run already ships a spatial current field; this
adds a time axis rather than a new system. The AI needs no time-aware planner —
if emerging bars join the hazard set, the periodic replan handles them
reactively. `AI_STAT_BONUS` covers the resulting asymmetry.

### Course — Loop through two channels, 4 laps

**This is the only course in the game that is a different racecourse on the last
lap than it was on the first**, and everything should serve that.

- The **short channel** cuts the corner — shallow, tempting, and it *closes*
  partway through the race as the bars dry.
- The **long channel** is deep and always open — but as the tide drops, the same
  volume of water squeezes through it, so its current builds against you.

Neither option gets better. One disappears and the other gets harder, so the race
tightens on everyone at once. The right answer changes lap by lap, and the player
who read the tide chip at the start knew it was coming.

**The question it asks.** *Is the shortcut still open — and is it still worth it?*

**Course hazards.** **Drying sandbars** — the hazard that *arrives*. Soft
grounding, and the bar that wasn't there last lap is the whole venue. **Withies**
mark the deep water but sit close enough to clip. **Eddy lines** at the channel
junction throw you off as flow builds. By the last lap the fast route may simply
be gone.

**Signature moment.** Taking the shortcut one lap too late and feeling the keel
touch.

**Key assets.** Withy marker (nav) · **drying sandbar (terrain, tide-phased)** ·
drain runnel (terrain) · **spoon-billed sandpiper flock landing on newly dry
sand** (ambient — *and the depth gauge; the witness IS the hazard readout*) ·
eddy line (terrain) · stranded dinghy (ambient).

---

# 12. Emberfall Isle `volcanic` — *art ready*

**Proposed tagline** Ash & Ember

**Description.** Black water lit from below. Lava enters the sea, steam stands in
columns, and rafts of floating pumice drift across the course.

**Character & narrative.** Alien and spectacular — the only venue that looks
dangerous before you've sailed a metre. The story is *the gauntlet*.

**Art.** Volcanic black + ember red — the last bold unclaimed hue. Sky: **dusk,
not night** — ash-purple and smoke-red, ember glow doing the lighting.
⚠️ The current art's **aurora** collides with Glowtide's night palette; at 256px
they'd read as siblings. Dropping it is the one required change. It also needs a
wildlife witness (rule 8).

**Key mechanics.** Deliberately **not** thermals — that's Redrock re-skinned.
Instead: **drifting pumice rafts** (*soft* drag, the exact counterpart to
Arctic's *hard* ice, reusing the drifter system); **steam-vent columns** as fixed
dead-air spots; **submerged glowing vents** as the readable hazard.

### Course — Round the Cans, with the cones as the marks

The one venue where the marks should not be inflatable buoys. **You round
steaming volcanic cones.** They're already there, they cost nothing extra, and
rounding one is something a player describes to someone else.

**The mechanic that makes this great: the cones erupt on a cycle.** A cone
periodically vents — steam, ash, a ring of dead air and a scatter of hot debris
around its base. It's telegraphed (the plume builds), it's on a learnable rhythm,
and it lands on the one piece of water you're required to sail through.

So every rounding is a timing problem: **go now and round it tight, or slow down
and lose two lengths waiting for the vent to pass.** That is a genuinely novel
racing decision — a mark that is periodically dangerous — and it turns the venue's
spectacle into gameplay rather than backdrop.

**The question it asks.** *Round it now, or wait for the vent?*

**Course hazards.** **Erupting cones** — the marks themselves, dangerous on a
cycle. **Submerged vents** scattered between marks, glowing but hard to see
against dark water. **Pumice rafts drift across the legs**, soft drag punishing
the straight line. **Steam columns** as fixed dead-air pockets sitting exactly
where you'd want to sail.

**Signature moment.** Rounding a cone close enough to feel it, timed between two
eruptions, with a pumice raft drifting into your exit.

**Key assets.** **Volcanic cone islet (hazard + mark + erupting)** · submerged
glowing vent (hazard) · pumice raft (terrain, drifting) · steam column (weather
prop) · lava delta (terrain) · seabirds on the thermal (ambient) · black sand
shore (terrain).

---

# 13. Fallwater Fjord `fjord` — *art exists, identity unresolved*

**Proposed tagline** Walls & Downdrafts

**Description.** A corridor between vertical rock, with waterfalls dropping cold
air onto the water.

**Known collisions** (evaluate at trim time): palette overlaps Glacier Sound
("steel navy + faceted ice blue-white"); katabatic-plus-cliff-shadow overlaps
both Glacier Sound and Redrock; Out & Back is already claimed twice; and the art
leans on soft mist where the guide says "edges crisp — this style never blurs".

**To be worth a slot it needs a summer palette** — deep green water, mossy black
cliffs, no snow, no mist — vacating Glacier Sound's hues entirely.

### Course — Out & Back between the falls

**The mechanic that would justify this venue: waterfall downdrafts as a slalom of
gust bombs.** Each fall drops a column of cold air onto the water — a visible,
circular patch of disturbed surface at its base. Hit one and you're slammed:
big pressure, no warning, wrong direction.

Lay the falls **alternating down opposite walls**, and the corridor becomes a
sequence of decisions: the downdraft patches are *fast* if you can hold the boat
up, and disastrous if you can't. The centre line is safe, slow and crowded.

**The question it asks.** *Take the downdraft or sail around it?* — every fall,
both directions, with the answer depending on how much sail you're carrying.

**Course hazards.** Downdraft patches at each fall (visible, avoidable, brutal) ·
scree fans narrowing the channel where you'd want to dodge · sheer walls with no
room to recover from a broach.

**Signature moment.** Punching through a downdraft at full speed and coming out
the far side still upright and two lengths up.

**Key assets.** **Waterfall with downdraft patch (hazard)** · sheer wall
(terrain) · scree fan (hazard) · sea eagle (ambient) · mist bank (weather prop).

---

# 14. Flamingo Reach `wetland` — *art exists, weakest case*

**Proposed tagline** Shallows & Sedge

**Description.** A wide subtropical saltmarsh — braided shallow channels between
grass islands, wading birds everywhere.

**Known collisions** (evaluate at trim time): olive/yellow-green dominant is
Gatorgrass Bayou's exact registry claim; pale turquoise water is Pearl Lagoon's;
the art's foreground creature is an **otter**, which no venue is named for any
more — but see the no-otter rule below, which still stands. Mechanically it overlaps Spoonbill Flats without the tide hook.

**To be worth a slot it needs** a palette that is neither Bayou-olive nor
Lagoon-turquoise — deep sedge-green with **flamingo pink** as the accent nobody
else owns — and no otter, ever.

### Course — Round the Cans through the braid

**The one thing this venue could own that nothing else does: a course where
passing is nearly impossible, and the whole race is about the few places it
isn't.** The braids are narrower than the fleet, so boats go single file. Sedge
islands block sight lines, so you can't see who's ahead until a junction opens.

That makes every junction a genuine event — the only place to attack, and
everyone knows it. It's the inverse of Bluewater Bonanza: instead of a huge
empty ocean where position is fluid, a maze where position is nearly frozen and
one overtake decides the race.

**The question it asks.** *Where can I possibly pass?*

**Course hazards.** **Mud banks at every bend**, so the inside line grounds you.
**Sedge islands blocking sight lines** — an information hazard, not a physical
one. **Braids too narrow to pass in**, which turns a slow boat ahead into a wall.

**The flamingos are the signature.** Sail close and **the flock erupts** — a wall
of pink across your bow that briefly blocks your view of the channel ahead. A
reactive hazard that is also the most beautiful thing on the card, and a reason
to sail wide of the shallows that has nothing to do with depth.

**Signature moment.** The flock going up in front of you at the one junction
where you'd committed to passing.

**Key assets.** Sedge island (terrain, sight-blocker) · **flamingo flock
(ambient + reactive)** · mud bank (hazard) · channel stake (nav) ·
spoonbill/egret (ambient).

---

# 15. Duckling Pond `pond` — *tutorial venue, mode-gated*

**Proposed tagline** Lawns & Ducklings · **Chips** FLAT WATER, LEARN THE ROPES

> **Naming.** The *mode* is called **Sailing School** on the menu; the *venue*
> is named for its witness, per convention (Sockeye Run/Slipstream,
> Gatorgrass/Chomp, Spoonbill Flats). "Sailing School" as a venue name would
> repeat the Sea Trial Bay mistake — a procedure, not a place (see §10's rename
> note). The witness writes itself: a line of ducklings following the drake
> **is** a beginner fleet following the instructor's launch — so the witness and
> the instructor are one character, **Paddle**, who is also the venue's unlock.
> See [tutorial.md](tutorial.md) §13.

**Description.** The smallest water in the game. A club pond ringed by mown
lawn — a floating pontoon, a rack of training dinghies, the instructor's launch
puttering nearby. Nowhere is far from shore, and nothing here can hurt you.

**Character & narrative.** Nobody learns to sail on the ocean; everybody learns
on a pond. First-lesson morning: dew on the lawn, sails flapping on the
pontoon, other students wobbling through their tacks, a parent watching from
the dock. The ducklings cross the course in perfect formation, unbothered,
doing effortlessly what you are struggling to learn. The story is *your first
time*.

**Traits.** ~7 kn, unusually steady — minimal shifts, no gusts, flat water.
Teaching needs clean cause and effect: when the boat stalls, it must be because
you pointed too high, never because the wind moved. (Side effect, per
music.md §4: at this wind band the audio bed nearly vanishes, freeing the whole
spectrum for music under instruction text.)

**Art.** **Fresh meadow green + buttercup yellow** — lawn to the water's edge,
yellow training sails, the ducklings. Saturated per the struck-pastels rule in
venue-art.md, not spring-pastel; it should be the warmest card in the set.
Sky: early-morning gradient, buttery gold low to pale blue high, essentially
cloudless — first-lesson light, and distinct at thumbnail size from
Stillwater's near-empty midday pale.

**Key mechanics.** Two monopolies, both cheap:

1. **Objectives instead of a race.** Each lesson is one verb, one buoy: sail a
   reach to a buoy (the easiest, fastest point of sail — a win in the first
   sixty seconds); *try* to sail straight upwind and discover the no-go zone by
   failing safely — that failure is the pedagogical heart of the tutorial; tack
   a zigzag to windward; run and gybe home; round a mark; time a start.
2. **Teaching overlays exist only here** — wind arrow, the no-go cone drawn on
   the water, laylines. Gating them to this venue keeps the rest of the game's
   presentation clean and gives the venue a genuine mechanical monopoly.

**Wind-relative, deliberately.** Lesson buoys are placed from
`state.wind.baseDirection` exactly the way `initCourse()` places marks today —
"the windward buoy" is wind-relative by definition, so the lessons survive any
wind seed with no authored geography and no wind sector.

### Course — Lessons, then a mini W/L

The lesson sequence above, then graduation: **a one-lap windward-leeward at
roughly a third of standard leg length, against two or three wobbly AI
classmates**, the instructor's launch as the committee boat. It is a real
race — real start, real gun, real finish — and it is the bridge that hands the
player to Lighthouse Cove, the friendly front door for people who now actually
sail.

**The question it asks.** *Where is the wind coming from, and what does that
let me do?* — the most fundamental question in sailing, and the one every other
venue assumes you can already answer.

**Course hazards.** None, ever — but for the opposite reason to Clubhouse
Point: not a frozen baseline, a safe classroom.

**Signature moment.** The graduation horn, with the ducklings falling in behind
you as you cross the line.

**Key assets.** Floating pontoon with sails drying (terrain) · instructor's
launch (traffic, committee boat) · training dinghies at the rack (ambient) ·
**Paddle the mallard drake + his duckling line (ambient + reactive — the witness,
and the tutorial's instructor; see [tutorial.md](tutorial.md) §13)** · lesson
buoy (nav) · clubhouse lawn and dock with one watching parent (ambient).

### Standing constraints

- **Hidden from the normal venue picker.** Reachable through Sailing School and
  a "replay tutorial" entry only — it is not part of the rotation.
- **Excluded from eval sweeps and the AI validation matrix.** Zero benchmark
  surface, all warmth — the exact inverse of Clubhouse Point, and the venue
  that absorbs the friendliness pressure so the eval anchor never has to.
- ⚠️ **A teaching venue must not become a shallow venue** — the mirror of
  Clubhouse Point's "a friendly name must not become a friendly venue." The
  lessons must be individually skippable at speed for a player who half-knows
  sailing, and the graduation race must be a real race, however small.

---

## Designed vs randomized

**Recommendation: designed stage, randomized weather.** Author the geography;
randomize everything that blows across it.

### Why this document forces the question

Almost every course above depends on authored geography. Redrock's slot canyon,
Sockeye Run's bridge arches, the Cove's harbour gate, Flats' two channels,
Emberfall's cones-as-marks, Glacier Sound's calving face, Lake's island in the
middle of the beat. **None of these survive randomization** — a randomly placed
slot canyon isn't learnable, and a random bridge is just a rock.

"LOCAL KNOWLEDGE" is already a chip on Redrock's card. It is a promise that a
random course cannot keep. You cannot learn a place that is regenerated.

### Where things stand today

- `initCourse()` places marks from `state.wind.baseDirection` — **the course
  rotates with the wind**, so the beat is always a beat.
- Islands are regenerated per race from `state.race.seed`, guarded by
  `checkCourseNavigability` with 5 retries.
- On failure that guard **drops all islands and logs a warning** — the race ships
  with the venue's terrain deleted.

That last behaviour is the argument in miniature: random generation can't
guarantee a usable course, and its failure mode is removing the character.

### The real-world model

Sailing already answers this. A club races the same water every weekend and no
two races are alike — because the *geography* is fixed and the *weather* isn't.
Local knowledge is precisely the accumulated understanding of how a fixed place
behaves under varying conditions. That's the deepest skill in the sport, and it's
currently impossible in this game.

### Two course families

This split falls out naturally and should drive implementation:

| | **Wind-relative** | **Geography-fixed** |
|---|---|---|
| Marks | placed from wind direction (as today) | pinned to terrain |
| Wind | any direction | constrained to a **venue wind sector** |
| Terrain | sparse or symmetric — must not break any rotation | dense, authored, the point |
| Shapes | W/L, Triangle, Trapezoid | Loop, Out & Back, Round the Cans, Slalom |
| Venues | Lake, Lagoon, Bay, Ocean, **Clubhouse Point**, Duckling Pond | Sockeye Run, Redrock, Bayou, Flats, Emberfall, Glowtide, Glacier Sound |

**Geography-fixed venues need a wind sector**, and that constraint is itself
characterful: canyon wind blows down-canyon, a fjord funnels, a river valley
channels. Without it, a random wind direction eventually makes a narrow channel
dead upwind with no room to tack — unsailable, not hard.

⚠️ **But do not lay the breeze ALONG every channel, which is the obvious way to
express that and is a trap.** Redrock shipped that way and it cost the venue its
tactics: when the corridor and the wind share an axis, every leg is dead upwind
or dead downwind, there is no side of the course to choose, and a "beat" up a
six-boat-length channel is a forced tack every three seconds. A bent channel is
the one geometry that hands you every point of sail for nothing — **turn the
breeze across two or three of the bends and take the reaches.** Redrock went from
13% reaching to 39% by rotating four region directions and touching no polygon.

**Wind-relative venues keep today's behaviour**, which matters most for Sea
Trials: it stays exactly as it is, marks rotating with the breeze, nothing
authored, eval anchor intact.

### What stays randomized

Plenty, and it's the part that actually varies a race:

- Wind direction within the venue's sector, and strength within its `cond` band
- Gust, puff and squall fields — position, timing, track
- Drifting hazard start positions and drift vectors (logs, floes, pumice)
- Phase offsets for cyclic hazards — tide at Flats, eruptions at Emberfall, the
  cargo-ship schedule at the Cove
- Wildlife appearances, and the 9-of-66 fleet draw

A fixed course under a rotating wind produces genuinely different races. Redrock
is the worked example: its slots are venturis or dead zones by geometry, so the
map of *where the pressure lives* is fixed and learnable, and only works because
the slots are always in the same place — while the puffs falling off the rim land
somewhere new every race. **The fixed part is what you learn; the random part is
what you read.** A venue that randomises the first has nothing to teach, and one
that omits the second has nothing to look at.

### Variety without randomness: course cards

Real race committees signal a course number — "today we're sailing Course 3."
Authoring **2–3 course variants per venue** gives replay variety that is designed
rather than rolled, and it's thematically perfect for a yacht club. Cheaper than
it sounds: same terrain, different mark set and rounding order.

### Costs and risks, honestly

- **AI must be validated per venue.** Today the AI is tuned on Clubhouse Point and
  generalises because every course is the same open-water W/L. Bespoke geography
  — narrow slots, single-file braids, bridge arches — is much harder to path
  through. **The river venue already took five fixes**, and that was one current
  field in open water. Budget real AI time per designed venue; this is the
  dominant cost, not the authoring.
- **Authoring load.** 12 venues × terrain + marks. It's data, not code, but it's
  a genuine content pass and it needs an editor or a hand-written format.
- **Eval stability improves.** Designed courses *reduce* the RNG surface, which
  helps determinism — as long as Clubhouse Point is untouched.

### Suggested sequencing

1. Keep every shipped venue wind-relative for now — nothing breaks.
2. Author **one** geography-fixed venue end to end as the pilot. **Sockeye Run** is
   the right choice: it already has a current field, a natural wind sector
   (down-valley), and the simplest fixed geometry (a channel and a bridge).
3. Measure the AI cost there before committing to the rest.
4. Then Redrock and Flats, whose mechanics are worthless without fixed ground.

## Reusable hazard classes

How few *kinds* of hazard the whole set needs — most venues get their character
from recombining these:

| Class | Behaviour | Used by |
|---|---|---|
| **Static hard** | fixed, collision | spires, coral heads, cones, boulders, pylons, islets |
| **Drifting hard** | moves, collision *(built — Arctic)* | floes, bergs, **bayou logs** |
| **Drifting soft** | moves, drag *(momentum-scaled, built)* | pumice rafts, weed mats, glass patches |
| **Static soft** | fixed, drag *(built — `shoal`)* | shoals, reef shelves, weed beds, mud banks |
| **Emergent** | appears mid-race | drying sandbars, calved ice |
| **Cyclic** | dangerous on a learnable rhythm | **erupting cones**, cargo-ship schedule |
| **Reactive** | responds to the player | **gators**, **flamingo flock**, penguins, loons |
| **Invisible** | no physical marker | wind shadows, cloud shadows, dead air, wall lees |
| **Sight-blocking** | hides information | sedge islands, squall curtains, darkness |
| **Traffic** | non-racing boats, scheduled or loose | cargo ship, wing foiler, skiffs, pirogue |

**Three of these are new and each unlocks several venues at once:** *Cyclic*
(Emberfall, Lighthouse Cove), *Reactive* (Gatorgrass, Flamingo Reach), and
*Sight-blocking* (Flamingo Reach, Glowtide, Lagoon). Reactive is the most
valuable — a hazard that moves in response to the player exists nowhere in the
game today, and gators are the right place to prove it.

## Build order for course types

1. **Triangle at Pearl Lagoon.** One extra mark, unlocks reaching for the whole
   game, turns an existing mechanic into a real decision.
2. **Out & Back at Sockeye Run.** Nearly free — narrow boundary, two marks — and
   the current asymmetry does the design work.
3. **Distance Triangle at Bluewater Bonanza.** Reuses step 1 with a longer
   `legLength`, one lap, and a seamount for the far mark.
4. **Trapezoid at Lighthouse Cove.** Adds the offset and separated traffic; the
   cargo ship gets a leg to cross and the buoys become a gate.
5. **Loop / Round the Cans.** The biggest lift (N marks, rounding order, AI
   pathing per rounding), but four venues want it.
6. **Slalom at Glowtide** last. Highest risk, highest spectacle.

Cheap precursor to all of it: **per-venue `legLength` / `totalLegs` overrides.**
Bayou short, Ocean long, Lake with a stretched beat. No new geometry, no AI work,
and it already differentiates how the venues feel.

## Open questions

1. **Marks that aren't buoys** — Emberfall's cones, Ocean's seamount, the Cove's
   lighthouse. Probably the highest flavour-per-work idea in this document.
2. **Spoonbill Flats rename** — three files, one coordinated change.
3. **Emberfall aurora** must go before that art ships.
4. **Ocean cloud shadows** remain parked; still the best unbuilt mechanic here.
5. **Does any venue get more than one course**, or is course a fixed venue
   property? Lighthouse Cove is the tempting exception — W/L for a first race,
   Trapezoid thereafter.

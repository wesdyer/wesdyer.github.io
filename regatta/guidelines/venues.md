# Venue Spec — All 14 Candidates

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
| 5 | Otter Run | **Out & Back**, 1 lap | fast water or slack water — and it inverts? | parking in an eddy to shake a rival |
| 6 | Bluewater Bonanza | **Distance Triangle** | where is the pressure, an hour from now? | the long surf home under kite |
| 7 | Redrock Reservoir | **Distance Loop** | is the narrows doubled or dead today? | the venturi firing you out the slot |
| 8 | Glowtide Strait | **Slalom** | do I follow the glow or trust my own line? | chasing a glowing wake through lit gates |
| 9 | Glacier Sound | **Out & Back** | how close do I dare sail to the ice? | a calving that reshapes your return leg |
| 10 | Sea Trial Bay | **W/L — FROZEN** | — | — |
| 11 | Spoonbill Flats | **Loop**, 2 channels | is the shortcut still open? | taking it one lap too late |
| 12 | Emberfall Isle | **Round the Cans** | round the cone now, or wait for the vent? | timing a rounding between eruptions |
| 13 | Fallwater Fjord | **Out & Back** | take the downdraft or sail around it? | punching through the fall at speed |
| 14 | Flamingo Reach | **Round the Cans** | where can I possibly pass? | the flock erupting across your bow |

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

**The shark is atmosphere, not an obstacle.** It cannot slow a keelboat, and a
collision penalty would be the first rule in the game its own fiction doesn't
support. A fin crossing your line that costs you nothing is worth more than a rule
players would resent — and it lands harder in a venue whose real dangers are all
made of steel and air. Character kin: Bruce is a Great White (race-view.md 10.5).

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

# 5. Otter Run `river`

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

**Character & narrative.** Silent and enormous. Bighorn on the ledges, ravens, an
eagle riding a thermal you can't use. The story is *the local* — you learned the
canyon and it paid.

**Traits.** Strongest gust bias outside the Arctic (`0.6–0.8`). Punchy and
location-dependent.

**Art.** Orange/rust sandstone + turquoise water. Sky: **bare, by choice** —
distinctive by absence, excluded from the sky rework.

**Key mechanics.** **Terrain-shaped wind** — its own mechanic class: fixed,
learnable geography-wind rather than random weather.

### Course — Distance Loop, one long circuit

Down one canyon arm and back up a *different* one, so no leg repeats and you
never see the boats ahead. Every leg sits at a different angle to both wind and
rock: one dead in a wall's lee, one accelerating through the narrows, one exposed
to williwaws off the rim.

Running it as **distance rather than laps** is what separates it from the other
loops: this is a single expedition through a fixed puzzle, not repeated circuits.
Learning happens across *races*, which is what "LOCAL KNOWLEDGE" should mean.

**The awesome part is the slot canyon.** One leg squeezes between walls close
enough that the wind is either **doubled by the venturi or completely dead**, and
which one it is depends on the day's wind angle — but **you can read it off the
water surface before you commit.** Ripples or glass. Enter wrong and you park in
a wind hole with no room to escape and the fleet sailing past outside.

**The question it asks.** *Is the narrows working today?* — and the water tells
you if you look.

**Course hazards.** **Rock spires stand mid-channel** where the wind is best, so
the fast line threads them. **Wall shadows** are invisible hazards that park you
if you cut a corner. **Williwaws** drop off the rim at fixed, learnable points
and will overpower you if forgotten. The **slot narrows** are a hard gate with no
passing room.

**Signature moment.** Reading ripples in the slot, committing, and getting fired
out the far side past a boat that hesitated at the entrance.

**Key assets.** Rock spire (hazard) · canyon wall (terrain) · **slot-canyon
narrows (terrain, gate)** · bighorn on a ledge (ambient) · raven (ambient) ·
golden eagle (ambient) · dust haze (weather prop).

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

It differs from Otter Run's out-and-back on every axis that matters: there the
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

# 10. Sea Trial Bay `seatrials`

**Tagline** Clipboard & Stopwatch · **Chips** NO SURPRISES, TRUE BASELINE

**Description.** The measuring stick. Nothing happens here on purpose.

**Character & narrative.** Deliberately none. A committee boat and an orange
mark. The story is *the number*.

**Art.** Plain honest blue. 0.055 value contrast, by far the flattest card, which
is correct for a benchmark.

**Key mechanics.** None. That is the feature.

### Course — W/L, FROZEN

⚠️ **This venue is the eval anchor.** The harness pins it via `localStorage`
(`eval/eval_harness.js:17`) so AI numbers stay comparable across every change to
every other venue. Its course, wind and conditions must never change —
**including when course types ship.** Whatever else the game gains, Sea Trials
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
> a venue is named for its witness (Otter Run/Bixby, Gatorgrass/Chomp).

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

**Cheaper than it looks.** Otter Run already ships a spatial current field; this
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
the art's foreground creature is an **otter**, and Otter Run is named for its
otter. Mechanically it overlaps Spoonbill Flats without the tide hook.

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

## Designed vs randomized

**Recommendation: designed stage, randomized weather.** Author the geography;
randomize everything that blows across it.

### Why this document forces the question

Almost every course above depends on authored geography. Redrock's slot canyon,
Otter Run's bridge arches, the Cove's harbour gate, Flats' two channels,
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
| Venues | Lake, Lagoon, Bay, Ocean, **Sea Trials** | Otter Run, Redrock, Bayou, Flats, Emberfall, Glowtide, Glacier Sound |

**Geography-fixed venues need a wind sector**, and that constraint is itself
characterful: canyon wind blows down-canyon, a fjord funnels, a river valley
channels. Without it, a random wind direction eventually makes a narrow channel
dead upwind with no room to tack — unsailable, not hard.

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

A fixed course under a rotating wind produces genuinely different races. Redrock's
slot is a venturi or a dead zone *depending on the day's wind angle* — that's
written into its spec above and only works if the slot is always in the same
place.

### Variety without randomness: course cards

Real race committees signal a course number — "today we're sailing Course 3."
Authoring **2–3 course variants per venue** gives replay variety that is designed
rather than rolled, and it's thematically perfect for a yacht club. Cheaper than
it sounds: same terrain, different mark set and rounding order.

### Costs and risks, honestly

- **AI must be validated per venue.** Today the AI is tuned on Sea Trials and
  generalises because every course is the same open-water W/L. Bespoke geography
  — narrow slots, single-file braids, bridge arches — is much harder to path
  through. **The river venue already took five fixes**, and that was one current
  field in open water. Budget real AI time per designed venue; this is the
  dominant cost, not the authoring.
- **Authoring load.** 12 venues × terrain + marks. It's data, not code, but it's
  a genuine content pass and it needs an editor or a hand-written format.
- **Eval stability improves.** Designed courses *reduce* the RNG surface, which
  helps determinism — as long as Sea Trials is untouched.

### Suggested sequencing

1. Keep every shipped venue wind-relative for now — nothing breaks.
2. Author **one** geography-fixed venue end to end as the pilot. **Otter Run** is
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
| **Static soft** | fixed, drag / soft grounding | shoals, reef shelves, weed beds, mud banks |
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
2. **Out & Back at Otter Run.** Nearly free — narrow boundary, two marks — and
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

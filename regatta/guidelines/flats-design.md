# Spoonbill Flats — design study and build log (Sep 16 2026)

Wes's brief (night of Sep 15): a short windward start, then a wide estuary mouth into a
braided basin with three ground types — deep channel, intertidal, never-wet — where the
deep water runs mostly round the outside with deep pockets inside, the intertidal zone
connects them as temporary shortcuts, and a tide that cycles every ~30–60 s fills and
empties the flats *from the channels toward the never-wet ground* on a sine. Cyclic
currents for the first time. Human best 2:45–3:00, bots ~1.3×, high variance because a
boat that ignores the warnings can be stranded. "Above all it should be fun." Everything
else — including the coding brief from the other AI — is a suggestion.

This document is the research, the twenty proposals, the axes, the ratings, the pick,
and then the build log with measurements. Later sections are appended as the night goes.

---

## 1. Research

### 1.1 Real estuaries (what the ground actually does)

- **Wantij / Wattenhoch — the tidal divide.** In the Wadden Sea each island shelters a
  basin fed from its own sea gate; where the flood from two gates meets, water and
  sediment move slowly, silt settles, and the divide is the *shallowest* ground in the
  system. Deep-draft boats cross it "only a few hours" around high water, longer on
  springs. It is the last place to flood and the first to dry, and the crossing is a
  planned, timed act. ([Waddenvereniging](https://waddenvereniging.nl/wadweten/7951-over-het-wantij/),
  [YACHT](https://www.yacht.de/en/sailing-knowledge/navigation/education-watt-is-dat-dat-is-watt/))
- **Mutually evasive ebb and flood channels.** Tidal bars are not river bars. A flood
  channel is deep at its seaward end and shoals inland into a bar (a "flood shield"); an
  ebb channel is the reverse. The two evade each other around diamond-shaped bars, so
  the fair-current channel on the flood is the one that *ends in a sill*, and the ebb
  channel is the mirror. ([Kleinhans et al., ADGEO 2014](https://adgeo.copernicus.org/articles/39/21/2014/))
- **Flats fill sideways.** Once the water tops the channel banks it spills *across* the
  flats, perpendicular to the channel; on the ebb it drains back through runnels. In creeks
  with big intertidal areas the strongest currents come shortly before and after high
  water, when the flats are filling and emptying — not at mid-tide as the textbook
  standing wave says. ([Sciencedirect: tidal current asymmetry](https://www.sciencedirect.com/science/article/abs/pii/S0278434302000353),
  [NOAA FAQ](https://tidesandcurrents.noaa.gov/faq.html))
- **Slack water.** Standing-wave estuaries run fastest at mid-tide and go slack at HW and
  LW; the further inland, the more progressive the wave and the later the slack.
- **Materials.** Mud (silt) stands steep and holds a boat; sand shelves and lets a hull
  graze. The Wadden boats are flat-bottomed precisely so they can dry out on purpose.

### 1.2 Real tidal racing (what sailors actually do)

- **Cheat the foul tide** in the shallows along the edge, **ride the fair tide** in the
  channel's middle. The whole tactical game of a tidal race is where the stream is weakest
  when it is against you and strongest when it is with you.
- **Tide gates.** Round the Island at Hurst, the Fastnet at Portland: get there before
  the stream turns or lose the race waiting. A gate is a *deadline*, and a deadline is the
  strongest pacing device a course can have.
- **Drying heights.** Chart datum, height of tide, draft — every tidal sailor does the
  sum `depth = tide height − drying height`, and the echo sounder is the instrument they
  watch. Depth under the keel is a number, not a colour.
- **Wadden crossing of the divide** is a *planned* window: arrive early and wait, or
  arrive late and take the long way round the island. Waiting is sometimes right.

### 1.3 Games (what has worked on a screen)

- **Cyclic worlds you learn:** Outer Wilds' sand columns bury and reveal on a fixed
  22-minute clock; Wind Waker's Tower of the Gods raises and lowers its water on a timer
  and the level is *about* reading that rhythm. The lesson: a deterministic clock is
  content — the second race knows what the first one saw (the Emberfall cycle already
  follows this).
- **Risk/reward shortcuts** (Hydro Thunder, Mario Kart): the game must *show* you the
  shortcut you failed to take, so you resign yourself to taking it next time; hidden
  shortcuts are for exploration games, not races. ([Vector Unit on Hydro Thunder](https://www.vectorunit.com/blog-posts/2017/2/24/hydro-heritage-evolution-of-an-arcade-racer))
- **Readability first:** if the player cannot instantly tell what is traversable,
  threatening, or decorative, nothing else lands. Teach → practice → test.
  ([gtstu level design principles](https://gtstu.com/game-level-design-principles/))
- **Track rhythm:** a great circuit has more than one rhythm — vary the demands, put a
  technical section after a fast one, give the route splits real consequences and use
  them to spread the field. ([Magnopus](https://www.magnopus.com/blog/the-art-of-designing-a-memorable-race-track))
- **Meaningful choice** (Meier): the interesting decision is the one whose answer
  changes with the situation. A shortcut that is always right is a corridor.

### 1.4 What this game's own venues say

Wes's ranking (Sep 15): Arctic > Volcano > Bluewater > Clubhouse > Cove > Otter > Pearl >
Glowtide > Stillwater > Sockeye > Redrock > Bayou. The top is *a mechanic you learn*
(floes, lightning, surfing) plus *route choice* plus *atmosphere*; the bottom is *mazes
in light wind* (Bayou), *samey narrow* (Redrock) and *rafting, not sailing* (Sockeye).
So for Flats: keep the breeze honest (16 kt, mild gradient), keep channels 5–8 boat
lengths so it is sailing and not threading, keep the current under ~1.5 kt so the wind
is the engine, and make the tide the thing you learn.

---

## 2. Twenty proposals

Each is a whole venue concept, not a feature. C = cross-cutting (a layer for any of them).

| # | Name | The idea in one breath |
|---|---|---|
| 1 | **The Wantij Dash** | Point-to-point: beat, round, run into a braided basin with ONE big timed divide crossing across the interior; the deep channel always goes round. Sine tide. |
| 2 | **Three Gates, Three Heights** | The coding brief: a timed crossing, a continuously adjustable inside line, and a competing creek — three sills at three heights, so each opens for a different share of the cycle. |
| 3 | **Ebb & Flood Channels** | Two braids round a diamond bar: a flood channel (deep seaward, sill inland) and an ebb channel (the mirror). Reversing current makes the better channel flip every half cycle. |
| 4 | **Rising Water Only** | Start at LW in narrow channels; the tide rises all race and the map grows. One flood, no cycle. |
| 5 | **Falling Tide** (the original card) | Laps round a bar; the map shrinks, the shortcut closes, the current builds. "One lap too late." |
| 6 | **Out on the Flood, Back on the Ebb** | Out-and-back: ride the flood to a mark at the head, ride the ebb home; the cycle is tuned so a well-sailed boat catches both. |
| 7 | **The Sill Lap** | Loop round one central bar, 3 laps; the bar's crest crossing is open on some laps and not others. |
| 8 | **Pockets & Traps** | Deep pockets in the interior joined by shallow saddles; hop pocket to pocket at HW, get trapped in one when the saddle dries. |
| 9 | **Runnel Maze** | The flat is threaded by narrow drainage creeks that are the only way across at mid-tide; a maze at LW, irrelevant at HW. |
| 10 | **The Conveyor** | Current-forward: 1.5–2 kt in the channels, slack on the flats; the race is cheating foul tide on the edge and riding fair tide in the middle. |
| 11 | **Sandpiper Signals** (C) | The information layer: depth shading, drying contour, echo-sounder depth readout, tide dial with rise/fall, withies leaning with the stream, spoonbills landing on the flat that is about to dry. |
| 12 | **Slack-Window Sprint** | A narrow mouth that runs 2.5 kt at mid-tide (unbeatable upwind) and goes slack for ~10 s at HW/LW: time the gate or wait. |
| 13 | **Ladder of Bars** | A run up the estuary across a staircase of transverse bars at rising heights; each opens for a shorter window; an early gain changes when you reach the next. |
| 14 | **Mud vs Sand** (C) | Two intertidal materials: sand shelves and lets you graze; mud is steep and grabs. Same depth, different price. |
| 15 | **Two Basins, One Divide** | Two basins joined by a wantij; the course runs basin to basin; at HW you cross, at LW you go round by the sea. The Dash with bigger stakes. |
| 16 | **Meander Cutoffs** | A chain of big meanders, each with a shelving point bar inside; the higher the water the tighter you cut. Continuous, no gates — "a race with a radius knob." |
| 17 | **Gate-Forced Detours** | Route gates placed in the channel so that at LW the fleet must sail the gate and at HW the direct line is open; the rules do the routing. |
| 18 | **Withy Slalom** | The LW channel is 3 boat lengths wide between withies you can clip for a penalty; the withies lean with the stream. |
| 19 | **Springs and Neaps** (C) | Tidal range dealt per race (spring/neap) so which shortcuts open at all varies between races. |
| 20 | **The Grounding Economy** (C) | Stranding is soft and legible: a mud drag zone before the stop, a refloat countdown computed from the sine, and a crew push-off downhill at 1 kt. |

---

## 3. Axes (researched, then weighted)

| Axis | What it measures | Source | Weight |
|---|---|---|---|
| Fun | Moment-to-moment feel; are there "chef's kiss" moments? | Wes's ranking; Koster (fun = learning) | 3 |
| Meaningful choice | Decisions whose answer changes with the situation; no dominant route | Meier; Mario Kart / Hydro Thunder shortcut design | 2 |
| Mastery | Does repetition pay? Deterministic clock, learnable windows | Outer Wilds / Wind Waker; Emberfall's own rule | 2 |
| Readability | Can the player see the state and the consequence seconds ahead? | Level-design canon; SailGP broadcast graphics | 2 |
| Feels like sailing | Breeze honest, real points of sail, room to manoeuvre, current a factor not the engine | Wes's bottom three | 2 |
| Uniqueness | Distinct from the twelve shipped venues (Glowtide has a tide, Sockeye a current, Bayou a maze) | The venue table | 1.5 |
| Variance | Fair drama: a leader can lose it, a trailer can win it | Wes's brief | 1 |
| Fits the numbers | 2:45–3:00 human, bots ~1.3×, AI can sail it, replayable | Wes's brief | 1.5 |
| Buildable tonight | Engine seams exist; risk of a half-built venue at 9 AM | This repo | 1.5 |
| Spectacle | The sea leaving; the flood front; the witness | Venue card; venues.md §11 | 1 |

Scores are 1–5. Weighted total out of 85.

## 4. Ratings

| # | Proposal | Fun | Choice | Mastery | Read | Sailing | Unique | Var | Numbers | Build | Spect | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wantij Dash | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **70.5** |
| 2 | Three Gates | 4 | 5 | 4 | 3 | 4 | 4 | 4 | 4 | 3 | 4 | **68.5** |
| 3 | Ebb & Flood Channels | 4 | 5 | 4 | 3 | 4 | 5 | 3 | 4 | 3 | 4 | **68.0** |
| 4 | Rising Water Only | 3 | 3 | 3 | 4 | 4 | 3 | 2 | 4 | 4 | 4 | 57.5 |
| 5 | Falling Tide | 3 | 3 | 4 | 4 | 3 | 3 | 3 | 3 | 4 | 4 | 58.0 |
| 6 | Out on Flood, Back on Ebb | 4 | 3 | 4 | 3 | 3 | 4 | 3 | 2 | 3 | 3 | 56.5 |
| 7 | The Sill Lap | 3 | 3 | 4 | 4 | 3 | 2 | 3 | 4 | 4 | 3 | 56.0 |
| 8 | Pockets & Traps | 4 | 4 | 3 | 2 | 3 | 5 | 5 | 3 | 3 | 3 | 60.5 |
| 9 | Runnel Maze | 2 | 3 | 3 | 2 | 1 | 3 | 4 | 3 | 3 | 3 | 43.5 |
| 10 | The Conveyor | 3 | 4 | 3 | 3 | 2 | 2 | 3 | 3 | 4 | 2 | 50.5 |
| 11 | Sandpiper Signals (C) | 4 | 3 | 4 | 5 | 4 | 4 | 2 | 4 | 3 | 5 | 66.0 |
| 12 | Slack-Window Sprint | 3 | 2 | 4 | 3 | 2 | 4 | 4 | 2 | 3 | 3 | 50.5 |
| 13 | Ladder of Bars | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 3 | **65.5** |
| 14 | Mud vs Sand (C) | 3 | 3 | 3 | 2 | 4 | 3 | 2 | 4 | 4 | 3 | 52.5 |
| 15 | Two Basins, One Divide | 4 | 3 | 5 | 4 | 4 | 4 | 5 | 3 | 3 | 4 | 66.0 |
| 16 | Meander Cutoffs | 4 | 4 | 4 | 4 | 5 | 3 | 2 | 4 | 4 | 3 | **65.5** |
| 17 | Gate-Forced Detours | 2 | 2 | 3 | 4 | 3 | 2 | 2 | 4 | 4 | 2 | 46.5 |
| 18 | Withy Slalom | 3 | 2 | 3 | 4 | 2 | 1 | 3 | 4 | 4 | 3 | 48.5 |
| 19 | Springs and Neaps (C) | 3 | 3 | 2 | 3 | 3 | 3 | 4 | 3 | 5 | 2 | 50.0 |
| 20 | Grounding Economy (C) | 4 | 3 | 4 | 5 | 4 | 3 | 3 | 5 | 4 | 3 | **64.5** |

Reading the table: the top standalone concepts are the **Wantij Dash**, the brief's
**Three Gates**, and **Ebb & Flood Channels**, with **Meander Cutoffs** and the **Ladder** just
behind — and they are not rivals, they are *layers of one estuary*. The cross-cutting
**Signals** and **Grounding Economy** score high because without them none of the others
is readable or fair. The bottom of the table is everything that turns the venue into a
maze, a slalom, or a river.

## 5. The pick — "The Wantij" (1 + 2 + 3 + 16, wearing 11 and 20)

**Course.** One-way. Short beat offshore to a rounding mark (the fleet spreads), bear away
through a wide mouth between two spits, then a braided basin whose deep channel runs
round the outside in an S, with deep pockets inside. Finish inland after a final merge
with 10–15 s of shared water.

**Ground.** Three flats materials: *golden mudflat* (most of the intertidal), *rippled
sand* (bars and crests), *saltmarsh turf* (never wet — the outer shore and a few islands).
The intertidal zone is a continuous **elevation field** built at load from the authored
polygons: the channels are the low anchors, the marsh the high anchors, and every point
between them sits at a height set by its normalised distance between the two, with a bar
crest or a pool bed where one is drawn, and a little noise so it dries in tongues and
pans rather than in bands. That is precisely Wes's authoring model: *lay down the deep
channels, pick the areas that never fill, and the flats fill from the channel outward.*

**Tide.** One clock. `level(t) = mid + amp · sin(2π t / period + φ0)`, fixed phase at the
gun, period a knob (60 s to start; 30/90 tested). `depth = level − ground`. Draft-safe
water sails free; under a clearance margin the mud takes speed; below the draft the boat
is **aground** — held until the sine refloats her, with the refloat countdown on screen.
Bots and player use the same field.

**Current.** Everything flows *because the level is changing*: channel streams run in
proportion to `dLevel/dt` (slack at HW and LW, strongest mid-tide), flood inland, ebb
seaward, along the authored channel regions (the build script cuts a region per channel
segment so bends carry the stream round). On the flats the water pours sideways from the
channel while they fill and drains back while they empty — a weak cross-stream that is
the most legible tell of all: you can *see* the flood coming across the sand.

**The three choices** (the brief's three, now with real geometry and one clock):
1. **The Wantij** — the divide crossing across the interior, saves the big loop, open for
   roughly a third of the cycle with a *sill at the exit* so late boats are caught.
2. **The point bar** — a shelving inside at the big bend: the higher the water the tighter
   the cut; no gate, just a radius that grows with the tide.
3. **The flood creek** — a competing branch round a diamond bar that carries fair stream
   on the flood and ends in a bar; the outside channel is the ebb channel and never dries.

**Signals.** Ground shaded by depth (dry crests pale, wet mud dark, shallow water going
pale over sand), the drying line as a moving contour, an echo-sounder **DEPTH** readout in
the instruments that goes amber then red, a **tide dial** with rising/falling arrow and
the seconds to HW/LW, and warning marks (withies) at the sills.

**Why this over the others.** The Dash gives the signature moment (the Wadden crossing —
"is it still open, and is it still worth it?"), the point bar gives continuous skill
expression on every lap of the tide rather than one binary gate, the flood creek gives
the current a *tactical* reading, and the one-clock rule keeps it all learnable. Nothing
is a maze; the channels stay 5–8 lengths; the breeze stays 16 kt.

(Build log follows.)

---

## 6. Build log (the night of Sep 15–16 2026)

Everything below was measured with `eval/_flats_race.js` (nine bots, the player parked
off the map, cutoff 900 s) unless it says otherwise. "wantij" in a route means the boat
sailed the corridor; "+sill" that it crossed the sill rather than turning back.

### 6.1 What was built

- **`js/tide.js`** (new, ~700 lines): the field build (scanline raster of the document's
  `flats-*` polygons, chamfer distance transforms, the channel→marsh interpolation with
  γ, noise, per-shape channel beds composed deepest-wins, pools sunk, shelves set,
  bars raised), the clock, depth → speed multiplier, aground/refloat with the
  channel-ward push-off, the fill cross-stream, the bots' grid stamps and route pricing,
  the wet/dry picture, the contours, the HUD info.
- **Five shape kinds** in `venuedoc.js` (`flats-marsh` hard land with a `saltmarsh` look;
  `flats-channel`, `flats-pool`, `flats-bar`, `flats-flat` as awash, paint, unrouted
  field anchors with a `tide` tag) and a per-shape **`elev`** (metres) in `shapeTraits`,
  passed through the compile. Editor rows: picker, fill, a "Tide" inspector field with
  the afloat-and-free share of the cycle computed from the sine.
- **Hooks**: `Tide.init()` on the document path of `initCourse` (with Volcano), a
  multiplier at the shoal slot of `updateBoat` and `afterMove` after the integration,
  `tidal` current regions + `addFill` in `getCurrentAt`, `stampGrid`/`safeGrid` in
  `buildCoursePaths` (the chart path, the ruler and the goal fields run on the
  always-there water), the editor's estimate on the safe grid too, `_tideDry` +
  arrival-time pricing in `pathSailable`, `Tide.update` for the local map, the two draw
  slots (wet under the moving surface, dry under the marsh), the rose readout and the
  on-boat echo sounder.
- **`art/build_flats.js`**: the estuary from centrelines (Catmull-Rom → ribbons →
  hulls for the stream regions), the basin, the marsh islands that set the height of
  the flats between the bends, the three choices, the course, wind and current.
- **Tools**: `eval/_flats_chart.js` (the whole estuary at any clock, through the game's
  own layer), `eval/_flats_race.js` (finish times, groundings, routes).
- Golden traces: 24/24 unchanged on the other venues (the tide is inert without anchors).

### 6.2 What the measurements said, in order

| step | result |
|---|---|
| first cut, γ 1.15, 60 s, HW at gun | 18/18 finish 2:49–3:13, 2 groundings of 1 s — but everyone crossed the head's flats at will: the interior was too low |
| γ 0.8 | 2:57–3:16; interior now mud most of the cycle; the corridor unused (its window shorter than its crossing) |
| add router waiting (hold in a pool for a sill) | WORSE: every bot piled into the pool, 7:14 worst, 21 groundings for one boat — the wait made an unsailable corridor look cheap |
| horizon-growing margin | no help while unbounded (see below) |
| lead 5 s / margin 0.2 on the local map + skip replans on "wet on arrival" cells | WORSE (3:44–6:01): the local map called cells walls while the plan ran through them |
| corridor rebuilt as creek (−2.4) + pool + 1300u shelf (−0.8) + sill (−0.45) | still bad — because **no bot could find any path** from the creek |
| **the horizon margin was unbounded**: 155 s out it demanded 1.9 m of extra water and closed the *channel* at the finish | capped at 0.3 m → 2:57–3:57, one grounding |
| **the clearance field read stamped-dry cells as walls**: a run through the corridor priced as a 60u canyon (~6× gybe tax), so no bot ever took the wantij | land-only clearance → the router takes the sill when it is open |
| phase: HW at the gun → HW 8 s after the gun (`phase0 0.733`) | the sill opens as a well-sailed leader reaches it: 2:41 / 2:43 / 2:48 winners via the wantij across seeds |
| min aground 1.5 s, refloat hysteresis 0.1 m, lead 3 s / margin 0.16 | churn gone (one boat had re-grounded 19 times in 7 s) |
| **final, 60 s, 3 seeds** | **27/27 finish, best 2:43, median 3:11, worst 4:14**; 12 of 27 boats touched the mud (most for 0–3 s), the worst sat 42 s |
| 90 s period, 2 seeds | 18/18, best 2:53, median 3:06, worst 4:37 — fewer touches, the wantij taken by 4 of 18 |
| 45 s period, 2 seeds | 18/18, best 2:49, median 3:17, worst 4:03 — the windows shorter than the crossings again; more touches at the point bar |
| channel-only estimate (editor, safe grid) | 3:11, 4.91 km |

Bots at 1.15–1.2× the human estimate is this game's usual (Otter); here the bots' median
sits ON the channel estimate because they take the point bar and the creek, and the
winners beat it by 25–30 s with the wantij. A human who takes all three should land in
Wes's 2:45–3:00; the channel alone is 3:11. Not measured: a human lap (the display was
asleep, so Chrome's frame loop was stopped; the race was driven step-wise for the
pictures).

### 6.3 Decisions

- **Period 60 s, HW 8 s after the gun** (`doc.tide`). 90 s tested: kinder to the bots,
  the windows longer than any crossing, less drama; 45 s: harsher, no better. The knob is
  one number in the document (`doc.tide.period`).
- **The interior is high** (γ 0.8): the flats near a channel stay a sailable margin for
  half the cycle (the continuous inside line), the middle is mud most of the time, and
  the three authored corridors are the shortcuts. The first cut (γ 1.15) made the head a
  highway at high water and the channel irrelevant.
- **No waiting in the router.** The code is there (`maxWait`), measured worse, left at 0.
  A bot that has no route holds in the deepest water it can reach and asks again.
- **Chart path, ruler, ranking = the always-there water.** The shortcuts are the
  sailor's discovery; the path line never draws you across a flat that will dry.

### 6.4 Later the same night (03:15–04:30)

- Pursuit carrot pulled in when its chord crosses stamped-dry mud: 27/27, best 2:43,
  median 3:07, touches down to 1–3 s (one weak boat still sat 42 s).
- The tide clock on the boat pill; withies (procedural, leaning with the stream, IALA
  topmarks) at both sills, the creek's mouth, the wantij's mouth and down the shelf;
  spoonbills on the band the ebb just uncovered; a soft mottle on the dry mud; sand seams
  softened; the live tide on the minimap; a thump and a banner with the refloat seconds
  when the player sits; the ranking field over all the water; the field build cached by
  the anchors' signature (the editor recompiles on every edit); the router's level from a
  table. Golden traces re-run: unchanged.

### 6.5 Owed

- The three tiles (`art/flats-prompts.md`), and the tile hook in the tide layer's dry pass.
- The stranded dinghy, and any sound for the tide itself (the flats have no bed sound).
- The clubhouse chart draws the venue at one state.
- The stream is modelled as a pure standing wave (slack at HW/LW); the research says the
  strongest flow in a creek with big flats comes just before and after HW — a rate term
  weighted by the area currently flooding would be the honest next step.
- Bots still shave the point bar as it dries (the pursuit chord); ~1 in 3 touches the mud
  once. Fair game for a venue whose card says so, but the helm could read the field.
- A human lap, and the human-vs-bot ratio from it.

## 7. Wes's laps and the fourth section (Sep 16, afternoon–evening)

Five laps on the three-meander layout: **3:13, 2:28, 2:45, 2:27, 2:44**. Every lap went
creek → pool → sill through the wantij and cut the point bar; the two 2:27s then went
nearly straight across the head's flats to the finish at high water; nobody used the east
creek. His verdict: distinct, compelling, the corner-cutting gamble on a rising tide is the
thing to build on, the course is too short, and "more passages would be good". Asked for
the estuary to be extended rather than scaled ("more to sail, not just a larger area of
the same stuff").

Built:
- **A fourth section** at the head: the channel continues past the old finish into a
  meander that bulges east round a delta bar and swings back to a finish ~4000u further
  up. Channel-only 3:11 → 3:38 (4.91 → 5.61 km).
- **Three more passages**, each with a different key: the **west gamble** (the other way
  across the first loop, a long shelf you take at the top of the tide, for boats that reach
  the mouth after the leaders), the **neck** (across the west bend, a pool by Curlew flat),
  the **head cut** (Wes's own line made a marked passage with a sill), and the **delta
  cut** in the new section. With the point bar and the creek that is six, plus
  stepping-stone pools in the flats.
- Router: the tide's clock is now **polar sailing time only** — priced off gScore it
  carried the corridor-gybing and stand-off hints, "arrived" at the neck's sill 35 s late,
  and found it open on the *next* tide while the boats reached it at low water — and a
  cell is priced at the shallower of its arrival water and the water 8 s before it, with
  the horizon margin at 0.02 m/s (cap 0.42). Groundings went from a third of the fleet
  sitting ~25 s to touches; the wantij came back into the bots' repertoire.
- A 1.15× whole-venue scale was built and measured (bots 3:02–3:38) and set aside on
  Wes's call; the knob stays in the script at 1.0.

Bots on the extended venue (3 seeds): 27/27, best 3:06, median 3:37, worst 4:31.
Projected from Wes's 2:27 plus the extension, his best should land ~2:50.

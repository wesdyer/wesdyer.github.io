# Wind across the venues — research-backed assessment (Nov 1 2026)

The aim of this sweep: every venue should pose real sailing wind problems in miniature, and pose
*different* ones. That means real choices about which side to sail, whether to sail further in more
wind or shorter in less, tacking on shifts at some venues and steady wind at others, and above all
"how can I sail in more wind?"

> **Correction (Nov 1 2026, step 2): every region `period` here is in WORLD-CLOCK units.**
> `state.time` runs at `WORLD_CLOCK` = 0.24 of real time (js/script.js), and the oscillator reads
> `state.time`, so a region authored `period: 37` takes **154 real race seconds**, not 37. The probe
> sampled on the same clock, so every "±X°/N s" below is really ±X° over N ÷ 0.24 s. Stillwater's sides
> (95 and 150) swing over 396 and 625 s, longer than a race; Emberfall's "whipsaw" (37) is a 154 s
> swing, which is why it made only 3.3 tacks per boat. Puff `lifeS` is real seconds (gusts age on `dt`).
> Wind events (E1) are written in real seconds from the gun.

This document covers the **understanding** phase. It describes each venue's wind as it actually
plays, measured on the live engine, and compares it with how wind works in the real world. It
changes nothing.

Companion files in this folder:
- `research-physics-tactics.md`: how wind works for sailors: shifts, gusts, lulls, geography, strategy, and how other games model it.
- `research-places.md`: the wind at about 60 real venues by season, plus 22 distinct "wind personalities".
- `probe/`: the measurement scripts and raw numbers behind this file. `probe/maps/` holds the
  mean-field maps (speed × lee, arrows downwind, legs in yellow). Run each script from the repo
  root with `NODE_PATH=node_modules`.

---

## 1. Headlines

1. **The polar makes "sail in more wind" a light-air question upwind.** On the boat's polar, an
   extra knot is worth about **+25% upwind VMG at 4 kt, +11% at 7, +7% at 9, +4% at 11, +2% at 13,
   and about 1% from 15–20 kt**, then nothing. The overpowered model flattens it further. Downwind,
   pressure pays **4–6% per knot all the way up** because the boat planes. Nine of the thirteen
   venues average 13 kt or more, so on those beats pressure is nearly worthless and only shifts
   matter. The pressure question survives on their runs and reaches, and on the beats only at
   Stillwater, Gatorgrass, Glowtide's light middle and parts of Lighthouse Cove.
   *Exchange rate:* at 8 kt, 1 kt of pressure is worth about a 7° shift. At 12 kt it is worth about
   3°, and at 16 kt or more about 1°.

2. **On seven venues, puffs are almost never on the racecourse.** I compared the live wind with the
   mean wind along the legs. The water was more than 1.5 kt above or below the mean only this often:
   Lighthouse Cove 0.9%, Spoonbill 0.8%, Glowtide 0.1%, Bluewater 2.3%, Otter 3.1%, Sockeye 1.3%,
   Glacier 1.5%. The cells exist (3–10 alive), but **only 10–20% of them are within reach of a leg
   and half have drifted out of the arena**. The bounding boxes are tiny (about 0.002 km² per leg
   at the Cove) or sit off the course, and the cells are small (radii of about 70×37 m on most
   venues, 26×17 m at Glowtide). Puffs genuinely shape the racing at only three venues: Stillwater
   (8% puff, 8% lull), Redrock (13% puff) and Pearl Lagoon through its squalls (12% puff, 11% lull).
   Emberfall's variation is mostly lulls (14%) from lees and ash.

3. **Shifts are mostly too small, too fast and too uniform to play.** Each region's oscillation is
   identical across the whole region at once. Left-versus-right direction correlation is 0.95–1.0
   at Lighthouse Cove, Pearl Lagoon, Bluewater, Sockeye, Spoonbill and Emberfall. So a shift
   cannot be seen coming, sailed toward, or used to split a fleet. Shifts only change *when* to
   tack.
   - **Half-periods** run 15–30 s against beats of 25–60 s, so a beat sees one or two phases.
   - **Amplitudes** are ±4–6° on most venues. A 3 s tack doesn't pay for that. A strategy pricer
     that tacks on headers (§3) beat a simple one-tack layline only at Redrock's first beat, and
     tied it on the second.
   - **The exceptions are extremes.** Stillwater has ±14° on 100–150 s half-periods, one big
     slow shift per beat. Gatorgrass has ±40° in 54 independent cells, which is chaos rather than
     a pattern. Emberfall has ±28° every 19 s, a whipsaw.

4. **No venue has a persistent shift.** The global persistent veer was removed when regions took
   over. In the real world, "sail toward the new wind" is half of all wind strategy: sea breezes
   veer and build, gradient winds swing, a new wind fills from one side. In the game it exists
   nowhere. Stillwater's 460 s "day" swinger is the closest thing.

5. **Geography is where the game's wind is genuinely good, but it is static.** Authored regions plus
   the traced lee field give real, learnable structure:
   - Otter's lane outside the points and its cove holes, and the headland acceleration.
   - Redrock's canyon bends and shadows (84% of the course sits under at least some lee).
   - Glowtide's shore lanes, Lighthouse Cove's offshore band, and Emberfall's island shadows.

   The side decisions this produces are fixed: Otter's beat is a one-tack offshore board every
   race, 22% faster than the next option. Pricing left against right at 8 start times, the better
   side **flips with timing** at the Cove, Bluewater's beat, Redrock, Sockeye, Emberfall and
   Gatorgrass, but by only 1–7 s. It is **consistently the same side** on Bluewater's run (about
   9 s, the cape jet) and at Otter (40–74 s).

6. **Most venues currently feel alike.** Bluewater, Otter, Glacier, Spoonbill, Pearl Lagoon (outside
   squalls), Sockeye and Lighthouse Cove share one signature: a steady 11–25 kt with a fast,
   coherent ±4–8° wobble and no puffs. Five venues have distinct wind personalities today:
   Stillwater (big slow shifts plus puffs), Gatorgrass (chaotic light air), Redrock (terrain plus
   bombs), Pearl Lagoon (squalls) and Emberfall (vent-torn wind plus ash). This matches the playtest
   finding "uniform wind gets noticed" at eight venues.

7. **The bots react to wind; they don't plan around it.** They score each tack by VMG, plus a
   pressure bonus sampled **5 s ahead** (about 45 m at 6 kt), plus a shift term measured against
   their own running mean. The router and goal fields price the mean field. No bot can see a puff
   200 m upwind, anticipate a persistent shift, or choose a side for pressure. Any wind feature we
   add will separate the player from the fleet only as far as the bots can read it, so the bots
   need to be built alongside the wind.

8. **Measured against real yardsticks, the game's wind is too smooth.**
   - **Gust factor.** WMO puts the peak gust at about 1.23× the mean at sea, 1.38 on an onshore
     coast, 1.52 on an offshore coast and 1.66 inland. The game gives Bluewater 1.13, Otter 1.08,
     Glacier (offshore, off the ice) 1.11, Sockeye 1.18 and Spoonbill 1.08. Only Stillwater
     (1.57), Emberfall (1.54) and Redrock (1.48) reach their class.
   - **Gust coverage.** Bethwaite's rule is that about half the water is gust and half is lull at
     any moment, with puffs 100–300 m across cycling about every 60 s. Most venues here are at 1–3%.
   - **Shift period.** Below about a 2-minute real period, tacking on shifts stops paying. That is
     about 40 s in game time. Most regions here have full periods of 30–60 s, right on that line,
     and their amplitudes are small. That is why the "tack on headers" boat rarely wins.
   - **Pressure against shifts.** Coaches weigh them about 70:30 upwind in light air and 20:80 in
     heavy air, which matches headline 1.

9. **Courses are short in wind terms.** Beats run 120–765 m (12–90 s). Glacier Sound has no beat at
   all (both legs are reaches round the island), and Spoonbill's beat is 12 s. A wind feature
   needs room on the leg to become a decision; a 12-second beat cannot hold a shift.

---

## 2. How the game's wind works today, and how it maps to real sailing

**Primitives** (js/sim/wind.js, venuedoc.js):

| Construct | What it says | What it can't say |
|---|---|---|
| Wind region | Polygon plus falloff, with an absolute mean direction and speed. One oscillator (dirVar, speedVar, period) shaped as a tanh-sharpened sine plus a sub-harmonic at 2.3× the period. Overlaps average; unstated water is calm. | Speed and direction oscillate **in phase**, from one shared oscillator. The oscillation is **identical across the whole region at once** and doesn't travel. No trend over time. |
| Gust source | Count, knots, size (long axis along the wind, short axis half), life, puff/lull bias, and veer. Cells drift at about 0.72× the wind and steer by the local mean. Asymmetric nose and tail, a ±18° fan across the flanks, and the puff veers or the lull backs. | No lanes or streets, no clustering, no regular pulse. Births are random inside the polygon. |
| Squalls | Lagoon only. A fixed population marching at 1.1× puff drift, with a front of +75%, a core of +40%, a wake at ×0.45, and a veer plus fan. | Can't be used elsewhere without authoring it. |
| Lee field | Traced from land heights (10 heights), up to 70% loss. | Static. No wind acceleration on a lee's flanks, no wind bending to follow a shore. |
| Ash plume, School fade-in | Venue-specific. | — |
| *Removed* | Global shiftiness, variability and persistent shift (see game/state.js). | — |

**Scale.** 1 u = 10 cm, but a knot moves a boat 15 u/s against 5.1 u/s in reality, so **game time
runs about 2.9× fast**. A 300 m game beat sails like an 870 m real beat but lasts about 45 s on the
clock. A period of P game-seconds feels like 2.9·P real seconds in boat-lengths. Puffs drift at
about 1.9× the boat's upwind VMG, close to reality's 2–2.5×, so encounter dynamics are right. But a
puff's half-width of about 37 m is set in real metres on a compressed course: in time terms it is
small and fleeting.

**What a real beat sees** (sources in the research files): oscillations of ±5–15° every 3–8 min,
so 2–4 shifts per beat; puffs 100–300 m across, several per beat, arriving lifted on one tack; a
gust factor of 1.15–1.25 at steady venues and 1.4–1.8 at puffy ones; and often one persistent trend
underneath. In game time, that becomes **shift half-periods of about 1/3–1/2 of a beat** and an
amplitude that clears the tack cost (a 3 s tack on a 45 s beat needs about ±8° or more).

---

## 3. Method

- **Mean field:** `regionWindAt` with the oscillator frozen, sampled across each leg at offsets of
  ±0.4 / ±0.2 / 0 of the leg length (left or right as seen facing the mark), multiplied by the lee
  for the maps.
- **Time:** the oscillating field at mid-leg and the quarter points, 0–600 s, for direction and
  speed SD, p5–p95, half-period (zero crossings), and left/right and front/back correlation.
- **Live:** 240 s of real race simulation (bots, puffs, squalls, plume). At 3×4 points per leg,
  `getWindAt` was compared with the mean×lee to give the puff and lull fraction (|Δ| > 1.5 kt) and a
  gust factor (max/mean per point).
- **Pricer:** a polar-only boat on the oscillating mean field with a 3 s tack and land look-ahead.
  It does not model lees or puffs. Strategies: **L** (left to the layline), **R** (right),
  **M** (stay within 10% of the rhumb line), **H** (tack when the other tack's VMG along the leg
  axis is 8% better, staying within 30%). Each was run from 8 start times. It was validated on
  Clubhouse Point, where L = R = the one-tack optimum (45.5 s) and extra tacks cost what they should.
- Venue legs come from `dmc.legs`, using straight-line endpoints, so curved legs (Glacier, Sockeye's
  bends) are approximated.

---

## 4. Venue by venue

Speeds are in knots. "Phase" is the half-period of the oscillation in game seconds. "Puff/lull" is
the live fraction of course water more than 1.5 kt off the mean. "Side value" is how much faster an
oracle picking the best strategy each time is than the average one-tack boat.

| Venue | Mean (range) | Shift ± / phase | L–R coherent? | Puff / lull | Lee <0.8 | Gust factor | Side value | Feels like |
|---|---|---|---|---|---|---|---|---|
| Duckling Pond | 7 steady | 0 | — | 0 | — | 1.0 | 0 | as designed |
| Clubhouse Point | 13 steady | 0 | — | 0 | 0 | 1.0 | 0 | as designed (benchmark) |
| Lighthouse Cove | 12 (9.5–16) | ±5° / 22–33 s | yes (0.95) | 0.9% / 0.1% | 8% | 1.23 | 3–6% | a steady breeze with a fixed bend |
| Stillwater Lake | 8.7 (7–9; lees to 2) | **±14° / 100–150 s** | partial | **8% / 8%** | 27% | **1.57** | **23%** (timing) | the real thing: shifty and puffy |
| Pearl Lagoon | 15 uniform | ±5° / 60 s | yes (1.0) | **12% / 11%** squalls | 1% | 1.37 | 0–6% | squalls are everything |
| Gatorgrass Bayou | 5 (3.8–6.4) | **±40°**, 54 independent cells | no (0.1) | 0 / 0 | 0 | 1.15 | 8% (lottery) | random light air |
| Sockeye Run | 11 → 16 | ±5° / 15–25 s | yes (1.0) | 0.9% / 0.4% | 0 | 1.18 | 5% | steady, channel bends |
| Bluewater Bonanza | 18 (17.7–20; jet 27) | ±11° / 18 s | yes (1.0) | 0.7% / 1.6% | 0 | 1.13 | 4% beat; **run 9 s right** | a steady blow |
| Redrock Reservoir | 14 (12.5–16) | ±3° / 15–40 s plus ±40° terrain bends | no | **13% / 4%** | **66%** | 1.48 | 4–12% | terrain wind, the right idea |
| Glowtide Strait | 10.7 (8.7–12; lanes 15–17) | ±6° / 18–32 s | no (0–0.3) | 0.1% / 0 | 25% | 1.13 | 9–12% | geography only |
| Glacier Sound | 24 (17–25), ±7 kt swing | ±5° / 60 s | n/a | 1.1% / 0.4% | 25% | 1.11 | (no beat) | "strength, not direction" |
| Spoonbill Flats | 15 (13–16.5) | ±8° / 21 s | yes (1.0) | 0.5% / 0.3% | 0 | 1.08 | 1–3% | wind is wallpaper; tide is the game |
| Emberfall Isle | 16 | **±28° / 19 s** | yes (1.0) | 3% / **14%** | 28% | 1.54 | 4–6% | whipsaw plus holes |
| Otter Point | 17.4 (13–20) | ±6° / 15 s | n/a | 1.7% / 1.4% | 9% | 1.08 (p90 1.48) | **22% (fixed: offshore)** | well-authored geography, no weather |

### Duckling Pond and Clubhouse Point
Steady by design and correctly so: the tutorial and the AI benchmark. One teaching gap, for when the
School grows: real ponds are the *shiftiest* water there is (trees all round, so ±20–30° and holes).
The pond deliberately isn't, and that is the right call for lesson one.

### Lighthouse Cove (bay)
**Today:** five authored regions, with 16 kt offshore on the east, 10–12 in the bay and 6 in the
north. The structure across each leg is real: a left-to-right speed gradient of 12.3 → 13.6 and a
direction bend of −7° → +6° across beat 1, and ±20° of bend across the runs. Oscillation is ±5° and
coherent. Puffs are effectively absent (six cells at 5 kt, each source about 0.002–0.06 km²).
**Real analogue:** a harbour sea-breeze bay, such as San Francisco's Slot and Treasure Island lee,
Sydney, Auckland or Weymouth. These are defined by a *building, veering* sea breeze, a fixed bend
per direction ("top left always good"), wind shadows from islands and ships, and acceleration
between headlands.
**Verdict:** the geography is half there. What's missing is the *day*: a breeze that builds and veers
through the race so the favoured side moves, plus puffs that reach the course, and acceleration
where the island and the bridge squeeze the flow. The ships' and bridge's wind shadows are a
distinctive real-world mechanic already in place.

### Stillwater Lake (lake)
**Today:** the best wind in the game, and the playtest agrees ("the only venue where the conditions
alone kept him racing"). There are two offset side regions on 95 s and 150 s periods with ±24°, a
460 s whole-lake swinger with ±17°, shore lees, and 14 puffs/lulls at 6 kt. Measured: ±14° at the
mark, 8%/8% puff/lull, gust factor 1.57, and side value 23%.
**But:** the beat (about 90 s) sees one shift, and its timing dominates. The same strategy ranges
from 65 s to 143 s depending on when you start. That is partly a lottery: lap time follows the
wind (2:48 against 3:46 in the playtest).
**Real analogue:** "shifty, puffy inland lake", with 6–12 kt, gust factor 1.5–1.8, ±15–25° every 1–3
min real (about 20–60 s game), puffs 50–200 m across fanning out, and holes 5–10 tree-heights
deep. That puts **this lake's shifts at about 2–3× too slow and its puffs at about the right
strength.** It is the reference venue for oscillating and puffy wind; the others should not copy it.

### Pearl Lagoon (lagoon)
**Today:** one uniform 15 kt trade region with ±5° on a 60 s half-period, plus two squalls. Puff and
lull activity is 12%/11%, all from squalls. The gust source (4 cells) is mostly off-course.
**Real analogue:** "trade wind with squall lines", with a steady 14–18 kt (±5–10°), cells 1–5 km
wide, a squall worth +15–20 kt and a 20–40° veer, and a 3–8 kt hole behind. The game's squall model
matches the literature closely.
**But** at 15 kt the polar gives a squall's +11 kt almost nothing upwind (about 1%/kt). Riding
the squall is a downwind and reaching play, and on the beats only the veer matters. Real lagoons
also *build* through the afternoon and have **downslope bullets off the high island** (Bora Bora,
Le Morne). Neither exists here.

### Gatorgrass Bayou (swamp)
**Today:** 54 small regions at 2–7 kt with ±30–65° each (some "pockets" ±60°, "dead air" 1.6–2.2
kt), on unrelated periods of 36–555 s, and no puffs. Direction SD at a point is 30°; left/right
correlation is 0.1. The field is noise. The side value (8%) comes entirely from timing luck, and the
pricer's best-to-worst spread across start times is 80–108 s.
**Real analogue:** "light, patchy calm with zephyrs". The wind is 0–5 kt and most water under tree
walls is dead. The breeze reaches the water **in gaps and clearings**, cat's-paws 20–80 m across
drift slowly, and the direction is erratic *in the holes* but follows the gaps.
**Verdict:** the right numbers but the wrong structure. Real swamp wind has *places* (the gaps that
carry the breeze, the open bayous); here every 150 m cell is a fresh coin toss. This is the venue
where "how can I sail in more wind?" should matter most, because at 4 kt one extra knot is worth
+25%. Yet there is nothing readable to sail toward: no gaps lit up, no cat's-paws (zero gust
cells). The playtest: "you almost memorize the right route". The water channels are memorable;
the wind isn't.

### Sockeye Run (river)
**Today:** seven regions following the bends at 11–17 kt, ±5° coherent, almost no puffs. The current
is the game, as designed.
**Real analogue:** river and gorge axial channelling. The wind is locked to the channel axis, so
every bend is a fixed shift (headed coming out of a bend, lifted going into one). It runs about
0.5× in the bays and 1.5× in the narrows, with side valleys injecting cross-gusts at **fixed
points** and gusts off the banks ("huge gusts to no breeze in seconds"). Trees on the banks give
shadows of 5–10× their height.
**Verdict:** the bends are authored, but the banks don't touch the wind. There are no bank shadows
on the beat (lee <0.95 on only 13%), no narrows acceleration, and no side-valley gusts. "Middle for
current versus bank for wind" is the natural river dilemma, and today only the current half of it
exists.

### Bluewater Bonanza (ocean)
**Today:** six regions at 18–27 kt, with a 27 kt cape jet that makes the run's right side about 9 s
faster every time. Oscillation is ±11° on an 18 s half-period, coherent: the largest fast wobble
outside Emberfall, and too fast to tack on. There are 10 big gust cells (650 m, 10 kt), but only 10%
are near the course and they show on 2% of the water.
**Real analogue:** "big ocean swell with steady breeze" (12–25 kt, ±5–10°, *waves not shifts*), and
the design doc's own unbuilt idea: **cloud-shadow pressure cells**, where drifting cumulus are the
gust cells. Upwind at 18 kt, pressure is worthless; on the run, a 10 kt cloud cell is worth about
40% boat speed. Long-legged ocean sailing is exactly "where is the pressure on the run, and can I
connect the cells?"
**Verdict:** the oscillation is too fast to be a decision, so it reads as noise. The run's pressure
game (the jet) works. Cloud cells big enough to see and connect on the 1.8 km run would make this
venue unlike any other.

### Redrock Reservoir (redrock)
**Today:** the most realistic terrain wind. Eight corridor regions bend the breeze ±40° across the
legs, lees cover two-thirds of the course, and three rim sources fire 15 gust bombs at 8 kt (13%
puff). The gust factor is 1.48. Side value is up to 12%, and the better side flips with timing.
**Real analogue:** Lake Powell and desert reservoirs (canyon funnelling, thermal gusts, wind locked
to the corridors), and "downslope bursts from fixed source points (gullies, saddles)" at 1.5–2.5×
the mean, lasting 10–60 s.
**Verdict:** on concept, this is the closest match between game and reality. Two gaps. The bombs
are random in space within their sources, where in reality they come from *fixed gullies*, so you
could learn where they fall. And at 14 kt the bombs add little upwind; what they add is the fan
shift.

### Glowtide Strait (glowtide)
**Today:** eleven regions with shore pressure lanes at 15–17 kt and a light 9.5 kt middle over the
fair tide. The beat (650 m) prices left about 25 s better than right on average, but the sign flips
with timing (−95 to +7 s), and puffs are essentially absent (100 m, 4 kt cells).
**Known from August:** the polar saturates, so the lanes can't outweigh the tide. The untried fix was
offsetting the fair tide to one shore. It is a night venue, and real night wind is a **land breeze
or drainage**: offshore, strongest near the shore and at valley mouths, dying in the open middle.
Coincidentally, that is roughly what is authored already (lanes on the margins, light middle).
**Verdict:** the structure is right and the real night-wind story supports it. It's the *light* in
"light middle" that matters here: at 9–10 kt pressure is still worth about 5%/kt upwind, so this
venue can still pose the pressure question.

### Glacier Sound (arctic)
**Today:** a 25 kt katabatic tongue that swings ±7 kt on a 120 s period, a 15–20 kt outer sound, and
a gust source of 7 cells at 7 kt and 25° veer mostly off-course. Both legs are reaches (66° and 114°
TWA), so there is no beat. The playtest put it exactly: "the wind varies in strength, not direction".
**Real analogue:** "katabatic bombs off ice", meaning williwaws: a near-calm background broken by
sudden 1.5–3× bursts 50–150 m across, lasting 5–30 s, falling *off the ice at fixed points* with
visible spray 3–5 s ahead and spreading radially. Also "cove calm against strait gale",
two regimes with sharp edges.
**Verdict:** at 25 kt everywhere, more wind isn't a reward; it is an overpowered problem (the
overpowered state is unfinished). Real arctic sailing is about **binary shelter and visible bombs**:
hide in the calm, cross the gale line on purpose, and read the spray. That is the most distinctive
wind personality available to any venue, and today the wind here is a uniform blow.

### Spoonbill Flats (flats)
**Today:** three bands at 16.5/15/13.5 kt, ±8° on a 21 s half-period, coherent. A 12 s beat, then a
1.8 km run. The tide is the game.
**Real analogue:** "tide-dominated venue (wind secondary)", with moderate steady wind (10–15 kt,
±5–10°) and wind-against-tide chop. Correctly secondary. One real feature worth noting: an estuary's
breeze **funnels and bends up the channel**, and the onshore sea breeze **builds** as the flats
warm. Neither is present, and neither is needed for the tide game.
**Verdict:** fine as wallpaper. The upper-estuary 13.5 band does make the run's top end softer, a
quiet pressure cue.

### Emberfall Isle (volcanic)
**Today:** one region at 16 kt with **±29° direction swing on a 37 s period** (half-period 19 s,
coherent across the whole map), ten gust cells at 8 kt, big island lees and the ash plume. Lulls
cover 14% of the course, puffs 3%.
**Real analogue:** volcanic islands (Canaries, Hawaii, the Aeolian islands, Azores): **island wakes
up to about 10 island heights long with sharp shear lines, acceleration "horns" of +30–50% on both
flanks, downslope bullets, and thermals over dark rock.**
**Verdict:** the lees are right and big. The ±29°/19 s swing is not a real-world pattern; it reads as
a slot machine on every leg, and it hides what's real here (the horns, the shear lines). The
playtest's "a hazard must read as fair" applies to the wind as much as to the ash.

### Otter Point (otter)
**Today:** the best-authored geography: 19 regions with a pressure lane outside the points, a
headland at 20 kt, cove lees and the bay hole. Oscillation is ±6° on a 15 s half-period. Puffs are
mostly off-course.
**Real analogue:** Monterey and Point Pinos ("the breeze abruptly doubles" at the point), the NW
afternoon sea breeze that **builds through the afternoon**, fog-bank stability, and an expansion
lee behind each point backed 20–40°.
**Verdict:** spatially rich and well-researched (Sep 14), but static: the beat is a one-tack
offshore board every race (22% faster). The real Monterey breeze *builds and veers*. If the inshore
lane filled first or the breeze veered through the race, "inside or outside?" would change answer
from race to race, which is the design's own stated question ("has the answer changed since last
lap?").

---

## 5. What the engine can't say yet (gaps, not fixes)

From the research, these real phenomena drive sailing tactics but have no primitive in the engine:

| Real phenomenon | Tactical question it creates | Engine today |
|---|---|---|
| **Persistent shift / building sea breeze** (veer 20–45°, build 5–10 kt over the day) | "Go toward the new wind", and the favoured side moving through the race | None (removed with the globals) |
| **Shifts that travel** (arrive with puffs, move down the course) | "See it coming", "who gets it first", fleets splitting | Oscillation is uniform across a region at once |
| **Pressure lanes / cloud streets** (bands across the course, drifting) | "Which lane?", connecting pressure downwind | Only authored static regions |
| **Fixed-source bullets** (gullies, saddles, glacier lips) | Learnable bomb lanes | Sources randomise births anywhere in their polygon |
| **Acceleration horns / compression** at the flanks of islands and points | "Hug the corner", cutting a lee | The lee only removes wind; the flanks never gain |
| **Shore bends / refraction** | A fixed geographic lift on one tack | Authorable by hand with regions, but laborious |
| **Regular pulses** (Bora refoli, katabatic surges) | Timing a manoeuvre to the rhythm | The oscillator could do it, but speed and direction share one phase |
| **New-wind frontier** (a gradient-versus-thermal dead zone sweeping across) | "Get to the new wind first" | None |
| **Shift/pressure phase choice** (header with a puff, lift with a lull) | Real trade-offs: lifted or more wind? | Fixed: one oscillator, same phase |
| **Visible precursors** (spray columns, dark water, cloud shadows) | Reading the water | Puff tone exists; squall shadows exist; nothing else |

The bots: none of the above is valuable unless the bots can perceive it. They would need longer
look-ahead, upwind sampling for travelling features, and a trend tracker for persistent shifts.

## 6. A first sketch of distinct personalities, for discussion only

These map each venue to one real-world personality from `research-places.md` §(b), so that no two
venues ask the same wind question. They are not decisions.

| Venue | Personality | The wind question it would ask |
|---|---|---|
| Duckling Pond | steady (lesson) | — |
| Clubhouse Point | steady (benchmark) | — |
| Lighthouse Cove | clockwork sea breeze that veers and builds, plus a harbour bend and ship shadows | which side will the breeze swing to? |
| Stillwater Lake | shifty, puffy inland lake (faster shifts) | tack on the header, sail puff to puff |
| Pearl Lagoon | trade with squall lines, plus bullets off the high island | which side of the squall? |
| Gatorgrass Bayou | patchy calm with zephyrs in the gaps | where is there any wind at all? |
| Sockeye Run | axial channelling: narrows acceleration, side-valley gusts, bank shadows | mid-river current or bank wind? |
| Bluewater Bonanza | ocean swell plus cloud-shadow pressure cells | connect the clouds downwind |
| Redrock Reservoir | downslope bursts from fixed gullies, plus canyon bends | learn the bomb lanes |
| Glowtide Strait | night land breeze: shore lanes, dead middle | shore for wind or middle for tide? |
| Glacier Sound | katabatic bombs plus cove-calm against strait-gale | shelter, or cross the gale line? |
| Spoonbill Flats | tide-dominated, channel-steered breeze | (the tide asks it) |
| Emberfall Isle | island wake, shear line, acceleration horns | round the flank: horn or hole? |
| Otter Point | headland acceleration plus a building, veering NW sea breeze | inside or outside, and has it changed? |

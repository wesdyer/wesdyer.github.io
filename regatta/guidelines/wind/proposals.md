# Wind proposals: specific changes per venue (draft for Wes, Nov 1 2026)

Built on `assessment.md` and the two research files. Every number here is a starting point to tune by
sailing, not a measurement. Nothing is applied.

> **Correction (Nov 1 2026, step 2): every region `period` here is in WORLD-CLOCK units.**
> `state.time` runs at `WORLD_CLOCK` = 0.24 of real time (js/script.js), and the oscillator reads
> `state.time`, so a region authored `period: 37` takes **154 real race seconds**, not 37. The probe
> sampled on the same clock, so every "±X°/N s" below is really ±X° over N ÷ 0.24 s. Stillwater's sides
> (95 and 150) swing over 396 and 625 s, longer than a race; Emberfall's "whipsaw" (37) is a 154 s
> swing, which is why it made only 3.3 tacks per boat. Puff `lifeS` is real seconds (gusts age on `dt`).
> Wind events (E1) are written in real seconds from the gun.

## 0. The frame: a race is 2.5–5 minutes

Game time runs about 2.9× fast, so **a whole race is roughly one real beat-and-run** (7–15 real
minutes). That decides what fits:

- **One or two wind stories per venue, not a whole day of weather.** Each venue gets a *signature*
  (the thing you'll describe afterwards) and at most one *secondary* feature.
- **Every feature must pay off inside a leg.** A beat is 30–90 s, so a feature that develops over
  3 minutes is invisible on it.
- **Exaggerate in time and amplitude, never in kind.** A sea breeze that turns 20° over an afternoon
  becomes 20° over the race. A 5-minute real oscillation becomes about a 60–100 s period.
- **Consequential means it decides places.** A good call should be worth 3–8 s on a leg (5–13 boat
  lengths at 6 kt). Under about 2 s it is noise, and over about 15 s it is a lottery unless you could
  see it coming.
- **Every feature needs a tell.** Comets turning, dark water, a cloud shadow, spray, a smoke column,
  ships. If you can't see it coming, it isn't a decision; it's luck.

## 1. Shared engine additions

Each one is small, venue-opt-in, and seeded like the squalls so replays and paired evals stay
exact. The venue sections below say which ones they use.

### E1. Wind events: sudden shifts, persistent or not
Today every shift is a smooth sine: the wind turns about a degree at a time and always comes back.
Real shifts are often **steps**: 10–25° in a few seconds. Some hold (a new wind, a sea-breeze
surge, a front) and some snap back (a cloud passing, a gust from a gully).

The proposed field is a per-venue (or per-region) `wind.events` schedule, drawn from the race RNG:

```
events: { every: [25, 45],          // seconds between events (uniform)
          size:  [8, 20],           // degrees, random sign unless bias set
          bias:  0,                 // -1..1: chance an event goes right (+) vs left
          ramp:  [2, 5],            // seconds to turn: a STEP, not a sine
          hold:  [15, 40] | null,   // seconds before it relaxes; null = persistent (stays)
          speed: [-2, 3],           // knots that come with it (a header can bring pressure)
          trend: 0 }                // deg per minute of underlying persistent drift
```

- **Scoped to regions, because the venues are built from them.** The default home for `events` is
  a **wind region**, next to its `dirVar`, `speedVar` and `period`, so each region of the field can
  have its own weather. A region with no events keeps today's oscillator. A venue-level `events`
  block is the shorthand for "every region, together". The field already blends regions by weight,
  so an event in one region fades across its falloff into its neighbours. That is exactly how a new
  wind arrives in one part of a bay and not another, and two regions shifting *differently* create
  a real boundary between "old wind" and "new wind" at their seam.
- **Regions can share a schedule** (`eventsFrom: "wind-1"`) so a whole bay can swing together
  while a sheltered cove keeps its own.
- **Implementation hook:** `regionWindAt` already adds a whole-venue live shift
  (`state.wind.direction - baseDirection`) to every region, and the lee field is precomputed for
  ±40° in 4° bins. A venue-wide event layer is therefore one function feeding
  `state.wind.direction` (and a speed scale), plus a clamp to ±40° from the mean.
- **Travelling version (E1b).** The event reaches each point when the wind carrying it arrives:
  delay = distance upwind of a reference line ÷ (drift speed). The boats upwind get the shift first,
  and the comets upwind turn first. *That* is "see the shift coming" and "who gets it first". It is
  more expensive (phase per point) but it is what makes a fleet split.

### E2. Region phase offset (`speedPhase`)
Today a region's speed and direction oscillate in phase, so the veer always comes with pressure.
Allow an offset in fractions of a cycle (0 = in phase, 0.5 = the lift comes in the lull). This
creates the real dilemma: lifted or more wind?

### E3. Fixed-point gust sources (`vents`)
A gust source can list points (or a polyline) instead of a polygon. Cells are born there and only
there: a gully, a saddle, a glacier lip, a bridge gap. The bombs fall in learnable lanes. Optional
`pulse: { every, jitter }` fires them on a rhythm (Bora-style), so you can time a manoeuvre to the
next one. Optional `tell` (seconds) draws a spray or ripple precursor before the cell lands.

### E4. Acceleration horns
The lee field only subtracts wind. Real islands and points **add** 30–50% on their flanks, where
the flow squeezes round. The proposal is to raise speed beside each traced lee by a `horn` factor,
fading over about one obstacle width. A rounding then becomes "the horn is fast, the lee is dead,
and the line between them is sharp".

### E5. Make puffs reach the water you race on
No engine change is needed, only authoring rules plus a check in venuecheck:
- **Sources sit upwind of the legs**, covering the full width of the course, at least one puff
  life of drift upwind of the windward mark.
- **Coverage target:** 25–50% of course water inside a cell on puffy venues and 10–20% on steady
  ones, against today's 1–3%. Add it as a `puff-coverage` line in the venue check, measured on the
  legs.
- **Size the cells to the course:** puff width about 1/4–1/2 of the course width, so there is a
  "this side" and a "that side". The default `sizeM` of 150 to 225 gives a 37 m half-width, which is
  too small to steer for.

### E6. Building breeze (`build`)
A per-venue speed ramp over the race (e.g. +4 kt from gun to finish) or a sea breeze filling from
one edge (E1b with `hold: null`). Pairs with E1's `trend` for the classic veer-and-build.

### E7. Bots that can read it
- **Look upwind, not just ahead.** Sample the field 15–30 s of drift upwind (where the next puff or
  shift is coming from), not only 5 s along the boat's own track.
- **A trend tracker** (a slow EMA of their own wind) so a persistent event shifts their "mean"
  instead of reading as a permanent lift or header.
- **Know the vents and horns** (they are static) through the router's mean-field pricing. That
  comes free if E3/E4 enter `regionWindAt`'s mean field.
- **Personalities:** `shiftSense` decides how hard they play events, `pressureSense` how far they go
  for a cell. Gamblers bang a corner, and the fleet splits.

---

## 2. Venue by venue
(See below. Each venue has: what it is now, the signature, the changes in authoring and engine
terms, the decision it creates, and the tell.)

### How the venues were re-measured for this
This time I raced the bots on every venue and logged each boat's true wind angle every 0.5 s,
instead of classifying legs by their endpoints (`probe/tracks.js`, `tracks_analyse.py`,
`tracks_regions.py`; track maps are in `probe/tracks/`, red = upwind, green = reach, blue = down).
Each venue below quotes its **sailed** mix (share of race time upwind/reach/down), the true wind
speed boats actually sailed in, tacks per boat, and the wind regions those minutes were sailed in.
Leg numbers are `raceState.leg`, and leg 0 is the first leg after the gun.

**One more systemic finding from this pass.** The `gust-course-leg*` sources that the course
generator froze into Lighthouse Cove, Glowtide, Sockeye, Spoonbill and Otter are **thin strips laid
along the legs**. A puff born on the leg drifts off it within seconds, which is why those venues
show 1–3% puff coverage. Real puffs arrive *from upwind*. The fix is to move each source upwind of
the water it should feed (E5), not to add more cells.

---

## Duckling Pond: no change
Steady 7 kt is the lesson. *Later, optional:* when the School teaches tacking on a header, one
scripted E1 step (12°, persistent, ramp 3 s) in that lesson only.

## Clubhouse Point: no change
It is the frozen AI benchmark. Anything added here moves every eval baseline.

## Lighthouse Cove (bay): the sea breeze that swings
**Sailed:** median 274 s; up 31% / reach 44% / down 25%; upwind TWS 11.5; 5 tacks per boat.
70% of upwind time is sailed in `wind-2` (central bay, 12 kt @350 ±8°/43 s), and the rest in
`wind-5` and `wind-3`. Puffs reach 0.9% of the course.

**Real model:** a harbour sea breeze (Weymouth, Long Beach, Auckland). It arrives from the open-sea
side, **veers and builds**, and has a fixed bend round the harbour shore. Ships and the bridge throw
real shadows.

**Changes**
1. **The breeze swings: E1 persistent events on `wind-1` (offshore, 16 kt) and `wind-2`**, with
   `wind-5` and `wind-3` sharing the schedule via `eventsFrom` at about 60% amplitude:
   - `trend` +5°/min, plus 2 persistent surges per race: `every [60,120]`, `size [8,12]`, `ramp [3,5]`, `hold null`, `speed [+1,+3]`.
   - The sign is drawn per race: **70% veer (sea-breeze day), 30% back (the gradient wins)**, so it
     is learnable but not memorisable.
   - Over a race that is about 20–30° and +3–5 kt: the favoured side moves.
2. **It arrives from offshore first (E1b travelling).** The surge reaches the east and offshore
   side about 8–12 s before the west bay. The comets out there turn first.
3. **Calm the noise so the swing reads:** `wind-2` ±8°/43 s → ±5°/70 s, and `wind-5` and `wind-3`
   likewise.
4. **Puffs from upwind (E5).** Replace the six `gust-course-leg*` strips with one band upwind of
   mark-1 (roughly x 1000…4500, y −3500…−2000, which is upwind on 350°). Use count 6, 4 kt,
   `sizeM` 250, life 50 s, bias 0.6, aiming at 15–20% coverage on the beats.
5. **Horns (E4)** at the two ends of the central island, so cutting close by the island is fast
   and the island's lee is slow.

**Decision:** *Which side will the breeze swing to, and do I go now or wait for it?* A good call is
worth 5–8 s on the 30 s beat sections. **Tell:** comets on the offshore (east) side turn and brighten
first.

## Stillwater Lake (lake): keep the soul, tighten the rhythm
**Sailed:** median 232 s; up 43% / reach 36% / down 21%; **upwind TWS 7.2**, where a knot is worth
about 9%; 10 tacks. Upwind time splits between `wind-east` (52%: 10 kt @348 ±24°/150 s) and
`wind-west` (40%: 6 kt @292 ±24°/95 s). Puffs 8%, lulls 8%, gust factor 1.57. **Already the best
venue for wind; change gently.**

**Real model:** a shifty, puffy inland lake: ±15–25°, a shift every 1–3 real minutes (about 20–60 s
in game), puffs 50–200 m across that fan out, holes behind the trees.

**Changes**
1. **Shifts come as steps, not swells.** Keep the two side regions but give each E1
   *non-persistent* events: `every [18,35]`, `size [8,16]`, `ramp [2,4]`, `hold [12,25]`, random
   sign. Lower their sine to ±8° on the existing periods, as the background breathing. That gives
   2–3 crisp shifts per 30–60 s beat section, the "tack on the header" rhythm, which today is one
   slow swell per beat.
2. **One real persistent shift per race on `wind-day`.** Replace its 460 s sine (±17°) with one
   E1 persistent event at a random time from 60 to 180 s, sized 12–20°, **travelling from the west
   shore (E1b)**. That is "the new wind fills from one side", and the boat on that side gets it 10 s
   early.
3. **More puffs on the beat (E5).** `gust-windward` count 8 → 12, aiming at 25–35% coverage. Lulls
   are already well placed by the glass sources.
4. **Steady the lap time.** The playtest swing (2:48 at 8 kt against 3:46 at 6.5) comes from where
   the slow oscillators happen to be in their cycle for that race (their phase is drawn per race), on
   `wind-east` and `wind-west` at ±2.5 kt. Cut `speedVar` to about ±1.5 kt and let the step events and
   puffs carry the pressure changes, so the race's average wind varies less from run to run.

**Decision:** tack on the step headers, sail puff to puff, and spot the one new wind. **Tell:** the
comets snap; dark puff water. This is the reference shifty venue. No other venue should copy its
rhythm.

## Pearl Lagoon (lagoon): squalls, plus what clouds really do
**Sailed:** median 217 s; up 50% / reach 22% / down 28%; upwind TWS 15.8, where pressure is worth
about 1%/kt upwind; 12 tacks. All of it is in `wind-1` (15 kt @80 ±5°/120 s). Squalls give 12% puff
and 11% lull.

**Real model:** the trades with squall lines. The base is steady (±5–10°). A squall brings +15–20 kt
and a **20–40° step veer that arrives before the rain**, with a hole behind it. Ahead of a growing
cloud, the inflow costs a few knots and backs the wind.

**Changes**
1. **Make the squall's shift the upwind prize.** At 15 kt, a squall's pressure is worth little
   upwind but its shift is worth a lot. Raise `SQUALL_VEER` for this venue from 20° to about 30°,
   and make the turn at the front a **step** (full veer within about 1 rx/6 of the leading edge),
   not a smooth blend. Upwind, the squall becomes "tack into the lifted side of the front", and
   downwind it stays a surge.
2. **Inflow ahead of the cell (new, small).** A soft ring 0.5–1 squall radius ahead of the front,
   at −15% speed and backed 8–10°. You feel the header and the lull before the blast, the classic
   dilemma: **tack away in the pre-squall header, or hold on for the front?**
3. **Steady trade puffs (E5).** Move `gust-1` (now east of the course, mostly off it) to a band
   upwind of the beats (east, since the wind is from 80°). Use count 5, 3 kt, `sizeM` 300, life 60,
   aiming at 10–15% coverage, so the water between squalls isn't dead flat.
4. Keep the base oscillation (±5°/120 s): trades are steady.

**Decision:** which side of the squall: the lifted front, the pre-squall header, or ducking the
wake. **Tell:** squall shadows (they exist), plus the inflow you feel. Worth 5–10 s per encounter.

## Bluewater Bonanza (ocean): steady wind, so the swell is the star
**Sailed:** median 203 s; **up 34% / reach 16% / down 50%**; upwind TWS 19 (pressure worthless
upwind), downwind 17 (about 5%/kt); 2.6 tacks. Downwind time: `cape-jet` 34% (27 kt), `wind-1` 59%.
The ten 650 m gust cells sit on 2% of the water. Gust factor 1.13.

**Real model:** open ocean. Steady breeze (±5–10°), gust factor about 1.23 at sea: *waves, not
shifts*. The playtest agrees: Bluewater's best moments were the pack in the swell.

**Decided Nov 1 (Wes): no cloud pressure cells here.** Drifting cells you pick a side of are Pearl
Lagoon's signature, and clouds would make this venue read like squalls-lite.

**Changes**
1. **Steady the wind:** `wind-1` ±12°/37 s → ±5°/100 s, and the other regions likewise. Stop
   shifts from competing with the swell for attention.
2. **Keep the cape jet.** It is the one consistent pressure call on the run (right side about 9 s).
3. **Honest open-ocean puffs (E5):** re-aim `gust-1` upwind (west) of the run and beat across their
   full width. Use `gustKt` 3–4, `sizeM` 350, life 120 s, bias 0.6, veer 10, aiming at 15–20%
   coverage and a gust factor of about 1.2. They are texture, not a signature: downwind a +4 kt puff
   is worth about 15%, and you feel it on a wave.

**Decision:** the swell (catch the set), then jet or rhumb line on the run. **Tell:** the sets
themselves.

## Glacier Sound (arctic): williwaws and shelter
**Sailed:** median 294 s; **up 47% / reach 34% / down 19%**; 15 tacks per boat. There are two beat
sections: the corridor push to the granite isle on leg 1 (66 s per boat, **TWS 27.5**) and the
beat round the headland on leg 2 (40 s, TWS 18.5). Regions: `wind-1` katabatic (25 kt @45,
±7 kt/120 s) 60% of upwind time, `wind-3` (20 kt @130) 30%, and `wind-2` (15 kt @210) on the reach.
Gust factor 1.11 ("strength, not direction").

**Real model:** katabatic **williwaws**: violent bursts from calm (×1.5–3) that fall off the ice at
**fixed places**, 50–150 m across, lasting 5–30 s, with spray running ahead and air spreading
radially. Cliffs make flat calms at their foot and back-eddies. Across the fjord the wind is locked
to the channel axis.

**The polar problem:** at 25–27 kt, more wind is no reward upwind (and the overpowered state that
would make it a cost is unfinished). So the signature here has to be **shifts and shelter**, not
pressure.

**Changes**
1. **Lower the tongue's mean and add bombs:** `wind-1` 25 → 17 kt, speedVar 7 → 2. Add
   **E3 vents at the glacier lip(s)** above the corridor: bursts of +13 kt (to about 30), `sizeM`
   150, life 18 s, firing every 12–25 s per vent, with **fan veer 30°** and a 3 s spray tell.
   Upwind in the corridor, each bomb is a **30° knock on one tack and a lift on the other**: a real
   tack-or-hold call 3–4 times per beat. On the reach and run it is a surf.
2. **Wall shelter you can choose (cove calm against channel gale).** Add narrow regions (about 80–120 u)
   along the corridor walls at 9–11 kt and *backed* 15° (wind bending along the cliff). Short-tacking
   up the shelter is flat, slow and steady, and mid-corridor is fast but bomb-struck. At 10 kt against
   17 kt that is 5.25 against 6.2 kt VMG, a 15% cost, roughly the bombs' price when one heads you.
3. **Make the opposing-wind seam real.** Where `wind-1` (from 45°) meets `wind-2` (from 210°), two
   near-opposite winds today average into a 20 kt wind that spins direction. Real converging winds
   leave **a calm band**. Author a 3–5 kt seam region (about 150 m wide) with ±40° wobble. On the
   reach section the question becomes where to cross the seam.
4. Optional, for later: E1 katabatic surges (the whole tongue +5 kt and veered 10° for 15 s every
   50–80 s) as a heartbeat under the bombs.

**Decision:** in the corridor, mid-channel bombs or wall shelter. At the seam, where to punch
through. **Tell:** spray columns running down the ice before each bomb. **Depends on** the
overpowered state being finished, if a 30 kt bomb is ever to cost a boat that is badly placed.

## Spoonbill Flats (flats): quiet wallpaper, coupled to the tide
**Sailed:** median 229 s; **up 10% / reach 31% / down 59%**; the beat is about 16 s at sea
(`wind-sea` 16.5 kt). The run sits in `wind-upper` (13.5) and `wind-lower` (15). Coherent ±9°/43 s.

**Real model:** a tide-dominated estuary. The wind is moderate and steady, and the breeze is
stronger at the mouth and **lighter over drying, sun-warmed flats** (exposed flats behave like
land).

**Changes**
1. **Quieter:** ±9°/43 s → ±4°/90 s on all three regions. The tide carries the decisions, and a
   flickering wind angle on a run only adds gybe noise.
2. **Couple the wind to the tide (new, small):** over tide-field cells that are shallower than a
   threshold, scale the wind by 0.8. Crossing the flats at lowish water is then **shorter but
   lighter**: a second price on the wantij and point-bar gambles, read from the same tide clock.
   Downwind at 14 kt, −3 kt is about −15% speed.
3. Keep the gradient (16.5 at sea → 13.5 at the head). It already says "the breeze dies as you go
   inland".

**Decision:** the tide decides, and the wind prices the shortcut. **Tell:** the flats' own sheen.

## Glowtide Strait (glowtide): night drainage you can see glowing
**Sailed:** median 229 s; **up 50% / reach 28% / down 22%**; upwind TWS 11.9 (pressure worth about
3–4%/kt); 13 tacks. Upwind time by region: `wind-1` (12 kt) 40%, `wind-11` light middle (9.5 kt) 20%,
`wind-9` west lane (17 kt) 13%. Puffs 0.1% (100 m, 4 kt cells).

**Real model:** a night **land breeze or drainage**, strongest near shore and at valley mouths and
dying in the open middle, gentle and pulsing. That is already the authored shape (lanes on the
margins, a light middle over the fair tide).

**Changes**
1. **Drainage jets at the valley mouths: E3 vents with a pulse.** Use 2–3 vents per shore where
   gullies meet the water, puffs of +5 kt, `sizeM` 200, life 30 s, **pulse every 30–40 s** (night
   drainage surges). The tell is **the glow**: a bioluminescent ripple sheet where the puff lands.
   The playtest said "the glow is the look, not the decision"; this makes the glow a decision.
2. **Night air is steady.** Retime the many fast regions (29–93 s periods) to 90–150 s at ±3–5°,
   so the drainage pulses are the event rather than one more wobble among many.
3. **The key lever is still the tide** (August finding): offset the fair core to one shore so that
   "tide side or drainage side" is a fork, not a free lunch.

**Decision:** shore lanes and the glowing drainage puffs, or the fair tide in the soft middle.
**Tell:** the glow, which is the venue's own visual language.

## Otter Point (otter): the Monterey breeze builds and the lanes trade places
**Sailed:** median 224 s; **up 46% / reach 35% / down 19%**; the one beat is leg 1 (78 s per boat,
2 sections, about 6 tacks), sailed in `wind-sw-offshore` 30%, `wind-beat-mid` 24%, `wind-point`
20% and `wind-start-outer` 19%. The far-offshore one-tack board wins every race by about 22%.

**Real model:** Monterey and Point Pinos. The NW breeze **builds through the afternoon**, "abruptly
doubles" at the point, and spreads out (faster, diverging) past it. Fog sits over the cold water
offshore, and the inshore shoreline band is where the breeze **arrives first** as the land heats.

**Changes**
1. **The day builds from the shore (E6 + E1b).** Start the inshore lanes (`wind-beat-inshore`
   12 kt and `wind-beat-mid` 14) low and let them **fill** by +4 to +6 kt at a random time between 40
   and 120 s, arriving from the point and travelling down the beat. The offshore board (`wind-sw-offshore`,
   16.5) stays steady. Some races the inshore lane fills early and the short-tackers win, and some
   it fills late and the offshore board wins. That is the venue's own question, "has the answer
   changed since last lap?", answered by the weather.
2. **A persistent veer on the offshore regions:** `trend` +4°/min (about 15° over the race) with
   per-race sign 80/20. A veer lifts the board sailing in toward the point, so it shortens the
   offshore board's advantage on veer days.
3. **Spreading air past the point (E4).** Raise `wind-point` and `wind-approach` by about 15% on
   their downwind halves and back the cove lees another 10°. Real air past a cape is faster and
   diverging.
4. Puffs: move the two leg strips upwind (NW) of the beat and the coast (E5), 15% coverage.

**Decision:** inside or outside, decided each race by *when the inshore breeze fills*, which you
can see happening. **Tell:** comets inshore brightening and lengthening, plus dark water creeping
off the point. Target: the offshore board's 22% edge becomes a range of about −8% to +12% depending
on the fill.

## Sockeye Run (river): the river steers the wind
**Sailed:** median 238 s; up 34% / reach 22% / down 44%; upwind TWS 12.2; 6 tacks. **83% of upwind
time is in `wind-1`, the wide lower basin** (11 kt @225 ±5°/50 s). The reaches and runs go through
the bends (`wind-2`…`wind-6`, 15–17 kt).

**Real model:** valley rivers. The wind is locked to the river's axis, **bends head you**, the
narrows accelerate it, **side valleys inject erratic gusts at the junctions**, and bank trees cast
shadows of 5–10× their height (pass about ⅔ of the way across to avoid both banks' disturbed air).

**Changes**
1. **Side-valley gusts (E3 vents) at 2–3 junctions** along the bends, firing cross-gusts of +5 kt
   at 30–40° to the river axis, `sizeM` 150, life 15 s, every 15–30 s. These are fixed and learnable:
   "the gust off the creek mouth". On the runs they decide the gybe.
2. **Bank shadows:** give the riverbank shapes heights (or tree props `height`) so the traced lee
   casts 5–10× along the banks in the bends. Today the lee covers 0% of the course at <0.8. Then
   "middle for the current, bank for the wind" becomes a real pair of opposites.
3. **The lower-basin beat gets the river-valley shift:** E1 non-persistent steps on `wind-1`
   (`every [20,35]`, `size [8,14]`, `hold [10,20]`). The open basin is where the valley wind swings
   before the walls lock it.
4. Move the `gust-course-leg*` strips upwind (E5).

**Decision:** current versus wind on every bend, plus the creek-mouth gusts. **Tell:** the creek
mouths are visible geography, and the vents can show ripples sweeping out of them.

## Redrock Reservoir (redrock): learnable bomb lanes, and a shorter race
**Sailed:** **median 357 s, the longest race in the game and over the 5-minute target**; up 49% /
reach 20% / down 32%; upwind TWS 10.5 (14 kt nominal, lees cut it); **27 tacks per boat**. Time
spreads evenly over six corridor regions (`wind-6`, `-1`, `-8`, `-7`, `-5`, `-all`, 13–20% each).
Puffs 13%, lees two-thirds of the course.

**Real model:** desert canyon reservoirs. The wind is locked to the corridors, and the bursts come
**down fixed gullies** at 1.5–2.5× the mean, lasting 10–60 s, with the fan from where they hit.

**Changes**
1. **Bombs from fixed gullies (E3).** Convert `gust-1`, `-2` and `-3` from random births in their
   polygons to 4–6 named rim vents at the canyon notches. Keep 8 kt, 160 m and life 40 s, firing on a
   rhythm of 15–30 s with jitter. The bombs land in **lanes you can learn**, and each lane's fan is
   a known lift on one tack.
2. **Shorten the work, not the wind.** 27 tacks in 6 minutes is a corridor problem. Turn the
   corridor regions' directions 5–10° so the beat corridors become **one long and one short board**
   (lifted along the wall), cutting tacks by about a third. That is a real canyon bend effect: the
   wind follows the wall.
3. Keep the oscillation small (±3–6°). The terrain makes the shifts here, so don't add events.

**Decision:** which corridor, and whether to time your tack into the next bomb lane. **Tell:** the
rim notches are visible, and the vents can puff dust or ripples 2–3 s ahead.

## Gatorgrass Bayou (swamp): breeze in the gaps, cat's-paws on the glass
**Sailed:** median 209 s; **up 45%** / reach 37% / down 18%; **upwind TWS 5.2**, where +1 kt is
worth about +20% VMG, the most valuable knot in the game; 8.5 tacks. The beat runs through
`gg-pocket-13`, `-18`, `-19`, `-15` and `gg-outer-24`, cells at ±33–65° on unrelated periods (36–555 s).
No gust cells, and no lee (0%).

**Real model:** light, patchy air among tree walls. Most water is dead, **the breeze comes through
the gaps and down the open reaches aligned with it**, cat's-paws 20–80 m across drift slowly, and
the direction is only erratic *in the holes*.

**Changes**
1. **One coherent light breeze underneath.** Replace the 54-cell checkerboard with a base of about
   4.5 kt from the prevailing direction (about 345°), ±10°/120 s.
2. **Let the geography make the holes.** Give the grass islands and cypress stands lee heights
   (cypress about 20–25 m) so the traced lee casts real dead water downwind of every island. Where
   channels run with the wind, the gaps stay live. Keep 4–6 small "dead air" regions (2 kt, ±40°)
   only in the enclosed pockets. Erratic light air belongs *there*, not everywhere.
3. **Breeze lanes:** 3–4 regions at 6–7 kt along the open reaches that line up with the wind, with
   their shape following the channels. At 5 kt a +2 kt lane pays about 30%, so **sailing 20–30%
   further to stay in a lane is right**. That is the textbook "sail longer in more wind" choice, here
   at full strength.
4. **Cat's-paws (E5):** one source across the whole upwind edge. Use count 12, `gustKt` 2.5 (+55% at
   4.5 kt), `sizeM` 90, life 45 s, bias 0.85, veer 25. Puff tone shows the ripples on the glass.
5. **⚠️ This re-prices the four balanced passages** (Know the Bayou, Oct 18). Re-run the router and
   census after, and use the lanes as the balancing lever: put a lane on the long passage.

**Decision:** *where is there any wind?* Lane against short cut, and going for the cat's-paw you
can see. **Tell:** ripples on the glass, and lanes visible as darker water along the open reaches.
This is the venue where "how can I sail in more wind?" matters most, and today it has nothing
readable to sail toward.

## Emberfall Isle (volcanic): horn or hole, and the mountain breathes
**Sailed:** median 204 s; up 35% / reach 31% / down 34%; upwind TWS 14.1 (the lees take it down
from 16); **3.3 tacks per boat**. The ±29°/37 s whipsaw doesn't even make the bots tack: it is
noise. Everything is in `wind-all`. Lulls 14%, mostly lees and ash.

**Real model:** volcanic islands (Canaries, Hawaii, Stromboli). **Wakes about 10 island heights
long with sharp shear lines, acceleration horns of +30–50% on both flanks** (Canaries: 5 kt in the lee
to 25 kt in the zone within about 200 m), **and bullets down the lee slopes**. An erupting column
also draws air **in** toward itself.

**Changes**
1. **Retire the whipsaw:** `wind-all` ±29°/37 s → ±6°/90 s.
2. **Horns (E4)** on the main isle's two flanks at +40%. The course wraps the island, so every
   rounding becomes "hug the flank in the horn, or swing wide" with the lee hole and the shear line
   right beside the horn. That is the venue's signature, and it is real.
3. **The mountain breathes (E1, eruption-driven).** When a cone erupts (volcano.js cycle), a
   region around it bends the wind 10–20° **toward** the cone (inflow to the column) for the
   eruption's length, with the ash dead-air downwind as now. These are persistent-for-the-eruption
   shifts you can see coming (the plume rises first) and a reason to time a rounding.
4. **Bullets down the lee (E3):** convert `gust-storm`'s random 10 cells into 4–5 vents on the main
   isle's lee ridges firing into the wake: +8 kt, 150 m, every 15–25 s. Each bullet crossing the hole
   is a gamble: wait in the hole for the bullet, or sail round.

**Decision:** horn or hole on each rounding, and time it with the eruptions. **Tell:** the plume
leans toward its cone as the inflow starts, and the shear line shows as a change in water texture.
It also answers the playtest's "a hazard must read as fair": the wind's tricks are now places and
events you can see.

---

## 3. Summary

| Venue | Signature (real model) | Engine needs | Authoring size | The decision |
|---|---|---|---|---|
| Duckling Pond | steady | — | — | — |
| Clubhouse Point | steady (frozen) | — | — | — |
| Lighthouse Cove | sea breeze that veers and builds | E1, E1b, E4 | medium | which side will it swing to? |
| Stillwater Lake | shifty, puffy lake (step shifts, one new wind) | E1, E1b | small | tack the headers, catch the new wind |
| Pearl Lagoon | trade squalls with step veer and inflow | squall tweak | small | which side of the squall? |
| Gatorgrass Bayou | breeze in the gaps, cat's-paws | (lee heights), E5 | **large** (re-balance passages) | where is any wind at all? |
| Sockeye Run | wind locked to the river, creek gusts, bank shadows | E3, (lee heights), E1 | medium | current or wind, bend by bend |
| Bluewater Bonanza | steady breeze, swell first, plus the cape jet | E5 | small | catch the set; jet or rhumb line |
| Redrock Reservoir | bomb lanes from fixed gullies | E3 | small + corridor retune | which corridor, timed to the bombs |
| Glowtide Strait | night drainage pulses that glow | E3 (pulse), glow tell | medium | shore drainage or fair tide |
| Glacier Sound | williwaws off the ice and wall shelter | E3 (+ overpowered) | medium | bombs mid-channel, or the wall |
| Spoonbill Flats | steady; lighter over drying flats | tide-coupled scale | small | (the tide) plus the shortcut's price |
| Emberfall Isle | horns, wake, eruption inflow | E4, E1 (event-driven), E3 | medium | horn or hole |
| Otter Point | the Monterey breeze fills inshore | E6, E1b | small | inside or out, *today* |

**Distinctness check.** Only Stillwater and the lower Sockeye basin use oscillating step shifts.
Only Lighthouse Cove and Otter have a persistent swing, with different causes (a sea-breeze veer
against a shoreline fill). Bombs appear three times but in three forms: Redrock's rhythm lanes,
Glacier's ice williwaws, and Emberfall's bullets into a hole. Light-air pressure hunting is
Gatorgrass alone. Drifting weather cells (squalls) are Pearl Lagoon alone. The swell is Bluewater alone.

## 4. Build order (suggested)

1. **E5, authoring only:** move the upwind sources at Lighthouse Cove, Otter, Sockeye, Bluewater,
   Pearl Lagoon and Stillwater, and add the `puff-coverage` venue check. No engine work, and it
   fixes the biggest measured gap (1–3% coverage).
2. **E1 + E1b (events and travelling)** with the bots' trend tracker (E7): this unlocks Stillwater,
   Lighthouse Cove, Otter and Sockeye.
3. **E3 vents**: Redrock first (the smallest change on the venue that most wants it), then Glacier,
   Glowtide, Sockeye and Emberfall.
4. **E4 horns**: Emberfall, Lighthouse Cove, Otter.
5. **Gatorgrass** last, because it needs the passage re-balance.

**Validation per venue:**
- Race time stays inside 2.5–5 min (Redrock should come *down* from 357 s).
- The best call is worth 3–8 s on the leg it lives on, measured with the L/R/M/H pricer extended to
  events and vents.
- Puff coverage on the legs meets its target.
- The bots' finishing spread doesn't collapse into a procession, and the bots actually use the
  feature: count tacks on events, time in lanes, and gybes toward clouds.

---

## 5. Status: step 1 (E5, puffs from upwind), committed Nov 1 2026 (d0bbadfa)

The gate is `eval/_puff_coverage.js`. It races the bots (4 seeds) and measures, at each boat's own
position, how often the live wind is more than 1.5 kt above or below the mean × lee. `CAND=` tunes a
source without writing the venue. Only `gusts` was swapped in each file, after a byte-identical
round-trip check.

| Venue | Before: coverage / gust factor | After | Change | Median race (one seed, before → after) |
|---|---|---|---|---|
| Lighthouse Cove | 2.2% / 1.25 | **17.0% / 1.43** | 6 leg strips → one source north of the course (14 cells × 280 m, 5 kt, 40 s) | 274 → 269 s |
| Otter Point | 0.7% / 1.20 | **17.5% / 1.30** | 2 leg strips → beyond-the-point source (beat) + offshore band (coast), 10 × 550 m each | 224 → 220 s |
| Sockeye Run | 2.5% / 1.50 | **17.2% / 1.54** | 2 strips → lower-basin source (9 × 280 m) + bends source (5 × 180 m) | 238 → 233 s |
| Bluewater Bonanza | 6.9% (all lulls) / 1.18 | **7.2% (balanced) / 1.18** | off-course 10 kt × 650 m → upwind source, 10 × 550 m, 4 kt, 120 s | 203 → 208 s |
| Pearl Lagoon | 24.8% / 1.51 | *no change* | the squalls already do it; more trade puffs added about 2 points | — |
| Stillwater Lake | 17.5% / 1.92 | *no change* | +4 cells added about 1 point; it is already above the inland gust factor | — |

**Also fixed:** the venue check's "puff covers most of the course" warning measured puffs against
`world.size`, a legacy tile size (275 m on Sockeye, whose river runs 1.1 km). It now uses the
boundary's extent (js/venuedoc.js).

**Consequences:** course records reset on the four changed venues (gusts are physics and are in
`recordsHash`), and the golden traces were re-recorded.

**Glowtide and Spoonbill** also carry leg-strip sources. They were left alone because their
proposals replace them with vents (Glowtide, step 3) or keep the wind quiet (Spoonbill).

## 6. Status: step 2 (E1 + E1b events), Stillwater, Nov 1 2026

**Engine** (`js/sim/wind.js`, `windEventsInit` / `windEventAt` / `windRaceClock`):
- A wind region may author `events` (one schedule or an array) and `eventsFrom` (ids whose schedules
  it also feels). Fields: `every`, `start`, `count`, `size` (deg), `bias`, `ramp`, `hold` (absent =
  persistent), `speed` (kt), `max` (deg, the persistent drift's cap), `travel` (`true` = puff drift
  rate × the region's knots, or a number in u/s).
- **Real seconds from the gun.** The clock is stamped at the gun (`state.wind.gunTime`, script.js);
  before it, the prestart counts up from minus the start timer.
- **Travel is anchored on the marks' centre:** an event's `t` is when it reaches the middle of the
  course; upwind water gets it earlier. (Anchored on the region's upwind edge, a 7 km lake's events
  arrived 100 s late at the marks.)
- Rolled per race from a private stream (`seed + 31`); evaluating is pure (no RNG, no state). The mean
  field (router, lee bins, pressure scale) leaves events out. Summed offset capped at ±30° per region.
- Venue check `wind-events`: malformed fields, `eventsFrom` naming nothing, breathing + steps past
  the lee field's ±40°. Unit test: `eval/test_wind_events.js`. Probe: `eval/_wind_events.js`
  (`PATCH=` merges region fields before the build; reports race, spread, tacks, header response).

**Stillwater** (only `wind.regions` touched, round-trip checked):
- `wind-west` / `wind-east`: ±24° → ±8° breathing, speedVar 2.5 → 1.5, and each its OWN
  non-persistent travelling steps: every 18–35 s, 14–26° authored (felt about 8–15° at the marks,
  because the full-cover `wind-day` dilutes a side region by about half), ramp 2–4 s, hold 12–25 s,
  −1 to +1.5 kt. Both also feel `wind-day`'s schedule.
- `wind-day`: its ±17° sine retired; one persistent travelling shift of 14–22° at 60–180 s.

| Stillwater, 4 seeds | Race (median) | Finish spread p10–p90 | Tacks/boat | Shift sd at the boats | Headers > 8°/boat | Tacked within 8 s |
|---|---|---|---|---|---|---|
| Before | 228 s | 61 s | 12.9 | 9.7° | 5.2 | 79% |
| After | 235 s | 72 s | 13.3 | 15.6° | 6.6 | 78% |

**The bots needed no change for this.** Their 60 s running mean (bot.js `windTracker`) plus the VMG
term already tack on about 78% of real headers within 8 s; the other half of their tacks are
laylines, marks and shores. The trend tracker (E7) waits for a venue with a persistent drift long
enough to fool a 60 s mean.

### Step 2, continued: Lighthouse Cove, Otter, Sockeye (Nov 1 2026)

**Engine additions:** `oneWay` (one sign per race for the whole schedule, from `bias`), `trend`
(deg/min drift from the gun, capped with the surges at `max`), `from` (compass direction a
travelling event arrives from) and `eventsScale` (a borrower feels that fraction). The static race
estimate (editor + venue check) now prices with events off (`WIND_EVENTS_ON`), because a step in
force before the gun is weather, not the venue.

**Lighthouse Cove: the sea breeze swings and builds.** `wind-2` carries a one-way day: 70% veer,
trend 2–3°/min, a surge of 5–8° and +1–2.5 kt every 50–90 s (first at 20–60 s), capped at 18°,
arriving from 060° at 250 u/s (the east side gets it about 10 s before the west). `wind-1` feels it
fully; `wind-3` and `wind-5` at 60%. Breathing cut to ±4–5°. The first try (cap 28°, trend 3–5) swung
25–31°, which turned beats into fetches and bunched the fleet (spread 49 → 31 s); the 18° cap keeps
the beats.

| Cove, 6 seeds | Race | Spread | Day's swing |
|---|---|---|---|
| Before | 281 s | 49 s | about ±5° |
| After | 260 s | 51 s | 14–21° (5 of 6 veered) |

The bots barely split on the beats (about 300 u across), so they cannot show what side is worth;
by geometry a boat 1 km toward the swing gains about 1.5 s on the first beat and about 3 s later.

**Otter: the inshore breeze fills and backs.** The pricer (`eval/_otter_wind_price.js`, on static
variants) showed the proposal's speed fill cannot work: +5 kt in the inshore lanes moves the inshore
beat 133 → 127 s against the far board's 102 (the polar saturates), and an offshore veer either way
only helps the far board. What flips it is DIRECTION: the inshore lanes backed 15° give
offshore-tack 84 s, mid 97, inshore 99, far 95 (25° tears holes in the blend). So:
`wind-beat-inshore` (with `wind-beat-mid` and `wind-start-inshore` via `eventsFrom`) starts the day
3 kt light (a step at −60 s, so the authored mean stays the average) and at −20…70 s the new breeze
fills: +4–6 kt and backed 10–15°, persistent, travelling at 200 u/s. Some races it is in at the gun,
some it arrives mid-beat. Bots: race 214 → 208 s, spread 52 → 53 s. **They don't use it:** the router
prices the mean field, so only a player reading the fill gains.

**Sockeye: the basin swings.** `wind-1` (lower basin) gets non-persistent travelling steps every
20–35 s, 6–10°, hold 10–20 s. 8–14° made a 99 s spread with stragglers (a lottery); 6–10° gives:

| Sockeye, 6 seeds | Race | Spread | Headers/boat | Tacks on a header |
|---|---|---|---|---|
| Before | 225 s | 71 s | 1.2 | 11% |
| After | 226 s | 57 s | 2.6 | 28% |

**Open: E7 for persistent events.** The bots react to steps (they tack on headers) but plan routes
on the mean field, so a persistent change (Otter's fill, the Cove's swing) never reaches their
router. The fix is to re-plan on the field as it now stands once a persistent event has arrived.

## 7. Status: step 3 (E3 vents), Redrock, and E7 tried (Nov 2 2026)

**E3 engine.** A gust source can carry `vents: [[x,y],…]`, `pulse: { every: s | [lo,hi] }` and
`tell` (0–10 s). Each vent fires on its own seeded rhythm (a private stream, seed + 37, rolled at
course init over 700 s of race clock, so drawing it takes nothing from the sim's stream); the cell
itself is an ordinary `createGust`, capped by the source's `count`. `vents` without `pulse` births
the source's random cells at a random vent instead of anywhere in the polygon. The tell is a small
puff in the source's own tone that gathers just downwind of the vent over the last `tell` seconds
and fades over 1 s after the birth, while the cell grows out of it (a first version grew a 750-u
patch three times darker than any puff and vanished at the birth: Wes saw gusts pop). The editor
draws vents as ringed dots; they are edited in the venue file. Tests: `eval/test_wind_events.js`.

**Redrock.** Five vents at the upwind shore notches (found by tracing streamlines back from the
beats), each lane landing on a leg: `gust-1` at (1450,−600); `gust-2` at (750,650) and
(−300,−700); `gust-3` at (600,1850) and (−650,350). Every 15–30 s, 3 s tell, bias 1 (all pressure;
the old sources made 35% lulls); size, strength and life kept.

| Redrock, 6 seeds | Race | Spread | Tacks/boat |
|---|---|---|---|
| Before | 338 s | 169 s | 31 |
| Vents | 311 s | 127 s | 28.5 |
| Vents + `wind-6` bent 50° | 337 s | | |
| Vents + `wind-6` 50° + `wind-all` 95° | 318 s | | |

Change 2 (bend the corridors) does not work: the beats lie within ±1–7° of dead upwind in narrow
canyons, and a 20° bend only moves where the tacks happen. Dropped. Redrock is still ~11 s over the
5-minute target; what is left is the course itself (the three beats are 47, 66 and 66 s).

**E7, the bots reading persistent shifts: built, measured, removed.** Two pieces: the router's wind
stamp re-baked every 4 s from the settled field (mean + persistent steps + trend, 64 direction bins,
only where an event had arrived: 1–11 ms), and a look-upwind term in `scoreTack` (1200 u upwind,
favour the tack the coming shift will head). Paired mixed fleets (each seed raced twice, halves
swapped), smart minus mean-field per boat, 8 seeds: Cove +2.3 ± 2.2 s, Stillwater +0.3 ± 1.4 s,
Otter +3.2 ± 1.7 s. No gain, so it was removed. The bots already react to the live wind within
seconds (75–86% of headers tacked on at Stillwater); knowing earlier buys nothing at these fleet
spreads. The lever left is **side choice**: on Stillwater a boat on the shift's side gains 5–9 s per
100 u, but the fleet spreads only 65–117 u.

**Rounding fix found on the way.** A boat that came within range of a mark on the bearing she
leaves on (Stillwater's mark-3, in from the east) read as banked AND wrapped on the near side,
because `wrapped` measures from the re-base. The AI turned for the exit, unwound past the mark,
lost the bank and orbited to the time limit. The AI's signal (`roundWrapped`, read only by
bot.js) now also needs the leg's own string test (`wrappedLeg`, which reads the turn from the leg's
start, hairpins included). Completion itself is unchanged. A first try that put the hairpin rule on
the re-base bearings sent late-arriving boats round an extra loop (Redrock seed 21, slowest boat
359 → 534 s) and was dropped.

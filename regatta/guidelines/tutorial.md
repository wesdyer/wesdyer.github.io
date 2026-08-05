# Tutorial Spec — Sailing School at Duckling Pond

*Spec only. No code changes. This document designs the learn-to-sail flow that runs
at **Duckling Pond** ([venues.md](venues.md) §15) under the menu name **Sailing
School**.*

Companion to [venues.md](venues.md) §15 (the venue and its standing constraints),
[music.md](music.md) §12.4 (the cue brief, already written),
[achievements.md](achievements.md) (Paddle the Mallard is the graduation reward)
and [roster-ranking.md](roster-ranking.md) (the classmates come from the Starting
Ten).

Statements are labelled **Observed** / **Rule** / **Intent** per
[README.md](README.md).

---

## 1. What this document is for

A first-time player opens the game knowing three things: boats, wind, and arrow
keys. They do not know that a boat cannot sail toward the wind. Everything else in
Salty Critter Regatta — laylines, VMG, the start clock, mark room, dirty air — sits
on top of that one fact and is unreachable without it.

The tutorial has exactly one job:

> **Answer the venue's question — *where is the wind coming from, and what does
> that let me do?* — and then get out of the way.**

**Rule. The tutorial teaches the simulation, not the sport.** See §3. This is the
principle that decides what gets cut, and it cuts more than expected.

**Rule. It should feel like a morning at sailing school** — one long sail with an
instructor talking, other students wobbling around you, and a debrief at the end.
Not a module list. The instructor is **Paddle**, who is also the reward; see §13.

---

## 2. The shape — one sail, one start, one race

**Recommendation. Three units, two seams, ~7 minutes.**

| Unit | What it is | Target | The failure it contains |
|---|---|---|---|
| **1. The First Sail** | One continuous lap. No lesson boundaries, no cards counting "3 of 7", no mode switches. The instructor talks over a sail that never stops. | 3:40 | **In irons** |
| **2. The Start** | The one genuine seam. A clock, a line, and a re-do. | 1:05 | **Over early** |
| **3. The Graduation Race** | One lap, third-length legs, three classmates, real gun. Rules coached live at the moment they occur. | 1:50 | — |
| | seams & cards | 0:25 | |
| | **Total** | **7:00** | |

**Why this and not a phase list.** The eleven-phase structure is the right
*content*, but eleven phases means eleven transitions, eleven "now we will learn
X" cards, and two full races. The transitions are pure tax — they cost time, they
break the sail into homework, and they are the thing that makes a tutorial *feel*
like a tutorial. A continuous sail has none of them.

It also collapses the fast path. **A player who already sails finishes the First
Sail in about 90 seconds** — not by pressing skip, but by doing the things before
being asked, because every instructor line auto-satisfies the moment the player
demonstrates its verb. Competent players and beginners get the *same artifact* at
different speeds, which is worth more than any skip button.

Skip still exists (§10), but it should be the rare path, not the design's answer to
its own length.

---

## 3. Borrow the school's *feel*, not its syllabus

**Rule. Teach what the simulation rewards, not what the sport fears.**

This is not in tension with §1. **The atmosphere of a sailing school is exactly
right** — the launch alongside, the patient voice, the wobbling classmates, the
debrief. What must not be inherited is the *curriculum*, because a real syllabus is
shaped by dangers and crew work this game doesn't have.

Real instruction is shaped by consequence and by crew work. A bad gybe swings a
boom through the cockpit, so schools delay gybing until boat control is solid
([Harbor Sailboats](https://harborsailboats.com/tacking-and-gybing-made-easy/));
a spinnaker is the hardest thing on the boat. Half of a real Level 1 course is
*executing manoeuvres*, because manoeuvres are hard.

**None of that is true here.**

*Observed, from `updateBoat()`, `CONFIG.turnPenalty` and `switchSpeed`:*

| Manoeuvre | Real cost | Cost in this game |
|---|---|---|
| **Tack** | You lose way, you can hang head-to-wind, it needs coordination | **It just happens.** Steer through it. Rudder drag, plus the moment spent crossing the dead zone |
| **Gybe** | The dangerous one | **It just happens, and it's cheaper than a tack** — the same rudder drag, and you never cross the dead zone |
| **Spinnaker** | Crew work, the hardest job on the boat | **A keypress.** `SPACE`. It responds immediately and completes in about five seconds; changing costs ≤8% for the moment you're mid-change (`SAIL_CHANGE_COST`) |

> **The inversion: in this game the manoeuvres are free and the angles are
> everything.** So the tutorial's minutes go where the difficulty actually lives —
> **where to point** — and manoeuvres get named in passing rather than drilled.

### Upwind, angle is everything — and the penalty is one-sided

Measured off `J111_POLARS` at the pond's ~7 kn, VMG to windward as a percentage of
the best available:

| TWA | Boat speed | VMG | % of best |
|---|---|---|---|
| 34° — pinching | 2.62 | 2.18 | **53%** |
| 36° | 3.94 | 3.19 | 77% |
| **38° — optimum** | 5.25 | 4.14 | **100%** |
| 45° | 5.51 | 3.90 | 94% |
| 52° | 5.79 | 3.57 | 86% |
| 60° — footing | 5.92 | 2.96 | 72% |

**Four degrees too high costs 47%. Seven degrees too wide costs 6%.** The optimum
sits right against the dead zone, so the fastest angle is also the one that falls
off a cliff — which makes the correct beginner instruction not "sail the optimum"
but **"err wide, never high."** At 45° you keep 94% and you are safe; at 34° you
have thrown away half the leg and it is not obvious from the deck.

### Downwind, angle barely matters

The same measurement, kite up:

| TWA | Boat speed | VMG | % of best |
|---|---|---|---|
| 120° | 6.17 | 3.08 | 65% |
| 130° | 6.00 | 3.86 | 81% |
| 150° | 5.33 | 4.62 | 97% |
| **163° — optimum** | 4.97 | 4.77 | **100%** |
| 180° — dead downwind | 4.54 | 4.54 | 95% |

**Everything from 150° to dead downwind is within 5% of best**, and the optimum's
edge over doing nothing holds at only +3.8% at 16 kn and +2.7% at 20 kn. The
classic instruction — *heat it up and gybe down* — has a 5% upside here, and a
beginner who overshoots to 130° goes **slower than if they had sailed straight at
the mark.** It also prevents an error beginners don't make: their instinct is to
point at the mark, which is 95% of optimal.

> **Cut downwind VMG angles. Teach upwind VMG properly.** Same concept, opposite
> verdicts, and the polar is the reason for both.

### The kite is the other downwind control

| At 16 kn | Kite up | Kite down | Delta |
|---|---|---|---|
| 45° (upwind) | 2.00 | 8.18 | **−75%** |
| 90° (beam reach) | 9.42 | 9.42 | 0% |
| 110° | 9.66 | 8.68 | +11% |
| 150° | 8.59 | 6.39 | **+34%** |

*Observed:* the player's kite has **no auto-douse** — the `AWA_KITE_SET` /
`AWA_KITE_DOUSE` hysteresis is bot-only — so you can carry it upwind, and it costs
three quarters of your boat speed while you do. That is a large, entirely
recoverable mistake: **a speed loss, not a disaster.** The overpowered work in
progress (heel, leeway, roundups) is deliberately **out of tutorial scope** — the
pond is at 7 kn, where none of it fires, and it is a second system layered on a
player still learning the first.

### The luffing kite — Rule, and it retires a HUD chip

**A kite that isn't paying should *look* like it isn't paying.** This is better than
any instrument: it is diegetic, it needs no chrome, it teaches at every venue
forever, and it turns the tutorial's kite lesson from *telling* into *pointing*.

But the trigger angle needs deciding, because there are three candidate numbers in
play and only one of them is honest. *Observed, from `J111_POLARS` — the delta is
identical at every wind speed, so the crossover is designed, not an artifact:*

| TWA | Kite vs jib |
|---|---|
| 60° | **−62%** |
| 75° | −40% |
| **90°** | **0% — the exact crossover** |
| 110° | +11% |
| 120° | +18% |
| 135° | +29% |

At **115° the kite is still worth about +13%.** So a binary "luffing at 115°" would
be the sail telling the player a lie the speedo contradicts.

**Recommendation: make it progressive rather than binary.**

- **Deeper than ~130°** — full, round, drawing.
- **~115°** — the luff starts to shake. *This is the right place for the onset:* the
  warning should arrive **before** the loss, not at it, so the player learns to
  respond to a hint rather than to a penalty.
- **90°** — properly flogging. This is where it genuinely stops paying.
- **Shallower than 90°** — full flog, and it is now costing 40–60%.

A gradient is also just better art than a state change, and it gives the player a
continuous readout of a continuous quantity.

> **Side observation, not a tutorial matter but worth a look:** `AWA_KITE_SET = 100°`
> apparent works out to roughly **145° true** at pond conditions (7 kn breeze, 5 kn
> boat), and `AWA_KITE_DOUSE = 82°` to about **127° true**. So the bots don't hoist
> until ~145° and douse at ~127° — leaving the **+11% to +18% that the polar offers
> between 90° and 127°** on the table. Either the polar or the hoist thresholds are
> more generous than the other intends.

**So the downwind sequence is:** bear away → `SPACE` → *watch the number climb* →
head back up, *see it shake* → drop it. The gybe is named in one sentence as it
happens.

**The general rule this establishes.** Before any lesson enters this tutorial, check
it against `J111_POLARS`, the physics and `rules.js`. If the simulation doesn't
reward it, it is folklore — however true it is on real water.

---

## 4. The budget

**Rule. The tutorial owns seven minutes, with ten as the pathological ceiling.**

Most players quit a game inside its first ten minutes; a tutorial that spends all
ten has burned the entire attention budget before the game starts
([Game Wisdom](https://game-wisdom.com/critical/onboarding),
[nastyrodent FTUE playbook](https://nastyrodent.com/onboarding-and-ftue-design/)).

**Rule. Nothing in Sailing School is a door.** There are no gates that must be
passed. The First Sail continues whether or not the player does the thing; the
instructor's script advances on *either* the player demonstrating the verb *or* a
timer. Buoys are motivation, not locks. This is what makes one continuous sail
possible and what guarantees no player is ever stuck.

**Rule. Segment timers are a constraint on us, never displayed.** If a segment
routinely runs long in testing, the segment is wrong — cut it, don't extend it.

---

## 5. Five principles

1. **Name after the experience, never before.** The player feels the boat stop, and
   *then* the card says "that's the no-go zone." Jargon ahead of the sensation is
   vocabulary; jargon after it is a label for something they already own. The most
   important writing rule in this file.

2. **Two failures are the spine; everything else is a win.** Exactly two moments
   are engineered to go wrong — **in irons** and **over early**. Both are free at
   the pond, both are the mistakes every beginner makes in their first hour, and
   both are far more memorable than being told. Everything else is built so an
   honest first attempt succeeds.

3. **The geometry does the teaching; the text only names it.** Don't tell the
   player a reach is fast — put the first buoys on a reach so the boat *is* fast,
   and say it afterward.

4. **One verb at a time** ([venues.md](venues.md) §15). If a segment needs two
   sentences to state, it is two segments or it is cut.

5. **Never block, never modal, never more than twelve words.** No dialogue boxes,
   no OK buttons. The world keeps sailing under every card. Words are the enemy
   ([Alexia Mandeville, *Designing a Good Game Tutorial*](https://alexiamandeville.medium.com/designing-a-good-game-tutorial-3c5dcbc50041)).

---

## 6. Unit 1 — The First Sail · ~3:40

One lap of a course shaped like a curriculum. **The sail never stops and the
segments are invisible to the player.**

**Conditions — Intent.** Wind from the north, ~7 kn, steady, no gusts, no shifts
([venues.md](venues.md) §15: "when the boat stalls, it must be because you pointed
too high, never because the wind moved"). Auto-trim on, penalties off. Buoys placed
from `state.wind.baseDirection`, exactly as `initCourse()` does today — so every run
survives any wind seed with no authored geography.

**Cold open.** The screen fades in on a boat already making five knots. No pre-race
screen, no venue card, no character picker. Fun in five seconds.

---

**(a) The reach · ~30 s**

The duckling line is thirty metres ahead on the same heading. Three buoys in a lazy S.

> **"A / D steer. Follow the ducklings."**
> **"That's a reach — wind on your side. Fastest, easiest point of sail."**

*Teaches:* the rudder has weight, the boat carries, speed feels good, nothing is scary.

*Why the ducklings:* they are the venue's witness ([venues.md](venues.md) §15) and a
waypoint that needs no UI. The arc is worth building for — **you follow them here,
and they fall in behind you at the finish.**

---

**(b) The wall · ~35 s · scripted failure #1**

The next buoy is dead upwind, ~300 u away. The wind ribbon is drawn on the water,
so the direction is unambiguous.

> **"Next buoy's straight upwind. Go get it."**

They turn up. The boat slows, the sails shake, it stops. **The no-go cone appears
on the water at the moment the bow enters it** — not before. Drawing it in advance
turns a discovery into a warning sign and destroys the lesson.

> **"You can't sail there. Nobody can."**
> **"Turn away until the sails fill."**

*Observed, and this corrects the folk number:* the dead zone in this game is
**about 38°**, not the 45° of sailing textbooks. `J111_POLARS` gives full speed at
38° and ramps linearly to zero at 30°.

*Teaches:* the fact the whole game rests on — discovered, not told — plus getting
out of irons, a real RYA Level 1 syllabus item
([Yachting World](https://www.yachtingworld.com/features/learn-to-sail-rya-dinghy-level-1-start-sailing-course-139097)).

**Rule. This segment is never shortened to buy budget elsewhere.** If the tutorial
runs long, cut the graduation legs. This is the one the player still has in ten years.

---

**(c) The beat — and the angle · ~70 s**

The cone stays drawn from here on. Two ideas, in this order: *the tack is nothing,
the angle is everything.*

> **"Just steer through the wind to the other side. That's a tack."**
> **"Two steps forward, one across. That's how you go upwind."**

Then the real lesson, aimed at the **VMG readout in the HUD** — *Observed:*
`hud-vmg` shows `|boat speed × cos(TWA)|`, which is exactly "how fast am I actually
getting there," and it is already on screen:

> **"Watch VMG. That's your real progress, not your speed."**
> **"Squeeze up until it drops. Then fall back off a touch."**

*Teaches:* pinching and footing, discovered on an instrument rather than described.
And per §3, the safe habit rather than the theoretical optimum — **err wide, never
high.** A player who settles at 45° keeps 94%; one who pinches to 34° keeps 53% and
cannot see it anywhere except that number.

*Advance on:* two completed tacks, or the timer. **Advance on the verb, not the
destination** — someone who zigzags enthusiastically into the wrong corner has
learned it, and the sail carries on regardless.

---

**(d) The turn and the kite · ~45 s**

Round the top buoy and bear away.

> **"Turn away from the wind. Hear it go quiet."**
> **"SPACE — up with the spinnaker."**  *(the speed number climbs; that's the lesson)*

Then, deliberately, Paddle has them head up until the kite starts to shake:

> **"Come up a bit. See it shaking?"**
> **"That's it telling you. SPACE — get it down."**

*Teaches:* the kite, and the one habit worth having about it — **read the sail, not
the rulebook.** It is a fluid control (press it, the boat responds, it settles in
about five seconds), so there is nothing to drill; the lesson is *when*, not *how*.
This beat only works if the luffing visual in §3 exists, and it is the single
strongest argument for building it: without the shake, this is a fact to memorize;
with it, it is something to notice.

*Not taught here:* downwind angle. Per §3 the polar rewards it by 3–5% and punishes
overshoot, and the beginner instinct — point at the mark — is already 95% of
optimal. Leave it alone.

---

**(e) The gybe, in passing · ~20 s**

The gate home is off to one side, so getting there needs one gybe. No drill, no
objective — one sentence as it happens:

> **"Stern through the wind. That's a gybe — even easier than a tack."**

*Teaches:* the name, and nothing else. On real water this is the manoeuvre that
hurts people, which is why schools hold it back; here it is the cheapest turn in
the game. Inheriting the caution would be inheriting a fear the simulation doesn't
have.

---

**(f) Home · ~15 s**

> **"Through the gate. The arrow shows which way round."**

*Observed:* `drawRoundingArrows()` already paints it and `updateRace()` already
shouts `WRONG WAY ROUND — LEAVE IT TO PORT`. This is an overlay to read, not a
mechanic to learn — which is why gates and mark roundings are one card here rather
than two phases.

---

## 7. Unit 2 — The Start · ~1:05 · scripted failure #2

The one genuine seam, and it earns it: a timed line is the only thing in the game
that **cannot** be discovered by experiment. You can find the no-go zone by
wandering into it. Nobody finds "OCS" by wandering.

**Setup.** A line between the instructor's launch and a pin. A 20-second sequence.
No other boats. **The boat begins close to the line and reaching along it**, so the
natural, unthinking behaviour is to be early — the failure is designed into the
geometry, not scripted into a cutscene.

**Run 1.**
> **"Cross the line when the clock hits zero. Not before."**

If early (the expected case), the shipped `hud-ocs` banner and its arrow fire:
> **"Over early. Drop back below the line and cross again."**

If late:
> **"Eight seconds late. That's a boat length a second, gone."**

**Run 2.**
> **"Again. Use the time — sail away, turn back, arrive at full speed."**
> **"That's the start. Everything after it is easier."**

**Two attempts maximum**, then it moves on regardless.

*Teaches:* the line, the clock, OCS and its recovery, and the idea underneath — a
start is a timing problem, not a speed problem.

---

## 8. Unit 3 — The Graduation Race · ~1:50

**Fleet — recommendation: Cheer, Wobble, Sunshine.** All from the Starting Ten, and
**not Bruce or Pinch** — the two bullies exist to make the start line feel contested
([roster-ranking.md](roster-ranking.md)), which is precisely wrong for a first gun.

- **Cheer** (Pom Pom Crab, metronome) — already specced as "the beatable rival
  beginners measure themselves against." Exactly the job.
- **Wobble** (Platypus, gambler) — named for it. Gambler AI bangs corners, so he
  visibly makes bad decisions. The classmate who tries something silly.
- **Sunshine** (Mahi-Mahi, rocket) — "explosive when the gun fires, catchable when
  it matters." He gives the race a *shape*: he beats you off the line and you reel
  him in, which is a far better first-race story than a procession.

**Glide is the cut**, and worth saying why: he is "the patient perfectionist who
never blunders." That reads as the school's star pupil or a second instructor, not
a classmate — and he is more valuable at Lighthouse Cove as the first real
benchmark.

**Palette check needed:** pink / orange / yellow against a buttercup-and-meadow
venue is a lot of warm. The player's training dinghy should be **white hull with a
yellow training sail** ([venues.md](venues.md) §15 specifies yellow training sails)
rather than a yellow hull, or Sunshine and the player will read as the same boat.

### Handicapping — handicap, don't zero

Zeroed stats give a *baseline-competent* boat, and baseline-competent beats a
five-minute-old sailor. Handicap them properly, to this target:

> **A player who does the four things they were just taught — starts on time,
> doesn't pinch, drops the kite before heading up, goes the right way round —
> wins comfortably. A player who fumbles finishes 2nd or 3rd and still graduates.**

The race grades execution; it does not gate the reward. *Observed:*
[achievements.md](achievements.md) already sets Paddle's criterion as "graduate the
sailing school," not "win it" — which is the right call and should stay.

### The classmates make the mistakes you were just taught — *Intent*

The strongest single thing that would make this feel like a real school: **give each
classmate one characteristic error, drawn from the tutorial's own curriculum.**

- Sunshine is **over early** and has to dip back — the player watches the OCS they
  themselves just made.
- Wobble **pinches** up the beat and goes nowhere.
- Cheer **carries the kite too long** into the leeward mark, and it visibly shakes.

Every lesson gets a second showing from the outside, at no cost in tutorial time,
and a beginner fleet looks exactly like this. *Feasibility:* the trait system
already carries `startBufAdj` (Sunshine's early start) and `laylineTight` /
`overTack`; "pinches" and "holds the kite" may need small additions. Worth checking
what's cheap before committing to all three.

**Course.** Legs at roughly a third of standard — `legLength` ~1300 u against the
shipped 4000 u. One lap, start and finish on the same line, the instructor's launch
as committee boat. Real 20-second sequence, real gun, real horn. Penalties **on**.

**The cone comes off, on camera, at the gun:**
> **"Cone's gone. You've got it."**

A training wheel that vanishes silently teaches nothing; one removed out loud is a
graduation, and it tells the truth about what Lighthouse Cove looks like.

### The rules are coached live, not drilled

**Rule. The tutorial teaches one rule by name and one habit by reflex. Nothing else.**

*Observed:* `rules.js` implements Rules 10, 11, 12, 13, 14, 15, 16, 17, 18 and 21,
with zone latching and overlap history. It is a real racing-rules engine — and
reciting it costs 90 seconds and is forgotten by the player's third race.

Instead, during the race:

- **The habit.** The first time `drawRulesOverlay()` puts a red triangle on the
  player's bow: **"Red triangle: you give way. Green: they do."** That overlay is a
  better rules teacher than any card, because it is present at every cross for the
  rest of the player's life with the game.
- **The name.** On the first port/starboard cross: **"He's on starboard. Steer
  behind him."** (The scripted cross is Wobble's — §8.) It decides most crosses and
  is the rule real clubs teach first
  ([Burghfield's Rules for Rookies](https://www.burghfieldsailing.org/sailing/rules-for-rookies)).
- **The recovery.** If they foul: **"You owe a 360. Spin one."** If they never foul,
  it is never mentioned — an unearned warning is noise.

**One scripting requirement:** Wobble's nav target is nudged so he crosses the
player at least once. Otherwise a clean race teaches no rules at all.

Rules 11, 12, 17 and 18 are learned the way club sailors learn them — from getting
one wrong and reading the toast. `PENALTY (Rule 18)! DO A 360° TURN TO CLEAR` names
the rule at the exact moment it means something, which is §5's
name-after-the-experience principle applied by the shipped code, for free.

**The signature moment** ([venues.md](venues.md) §15): the ducklings fall in behind
the player as they cross the line. Because they are Paddle's beginner class (§13),
this closes the loop opened in the first thirty seconds — **you followed the
ducklings out; now they follow you home.** No explanation needed, and nothing about
it is set dressing.

**Reward. Paddle** (Mallard) — already specced for "graduate the sailing school"
([achievements.md](achievements.md)), and now also the voice that taught you (§13).
The unlock lands as *the person who taught you joins your fleet*, which is a
categorically better reward moment than an anonymous character card. *Intent:* add a
**burgee** for the harder version, per the standing rule that the long tail lands in
the burgee layer and characters are never tiered.

**The debrief, not a results table.** The graduation screen is Paddle talking —
three lines about what actually happened in *your* race ("good start; you pinched
on the second beat; kite came down late"). This is what ends a real lesson, it is
the cheapest possible way to make the whole thing feel like school, and the data is
already collected (§15).

**The exit is a decision, not a menu.** One bright button: **Sail Lighthouse Cove**
— the friendly front door, where Roll the Harbor Seal waits as the first-win witness.

---

## 9. Radical alternatives, evaluated

The recommendation in §2 is a synthesis of these, not a default.

### R1 · No tutorial at all — *ship the overlays, let them race*

Duckling Pond becomes a friendly venue rather than a mode, and the lessons happen
by playing. This is the Mario 1-1 / Half-Life position, and it deserves to be taken
seriously.

**Why it nearly works.** Nintendo's four-step structure teaches by putting a
mechanic in a safe place first, then a dangerous one
([GMTK on Super Mario 3D World](https://archive.org/details/SuperMario3DWorlds4StepLevelDesignGameMakersToolkit)).
A W/L course at a harmless venue *is* that: leg one is safe, the race is the
dangerous version.

**Why it doesn't, quite.** Mario 1-1 works because **everything that matters is
visible.** The goomba is on screen. In sailing, the single most important
constraint is *invisible* — and a player who cannot sail to the windward mark and
does not know why will conclude the game is broken, not that they are.

But that hole is patchable: **the cone and the wind ribbon make the invisible
constraint visible**, and with them R1 becomes genuinely viable for the *boat*.

**What R1 still loses:** the start and the rules. A timed line is not discoverable
by experiment, and a penalty you don't understand reads as a bug.

> **Verdict: R1 is right for the boat and wrong for the race.** Which is exactly
> why the recommendation is shaped the way it is — the boat is taught by sailing,
> the race is taught by racing, and the tutorial is the thin thing that joins them.

### R2 · Pure sandbox — a coach with no sequence

Free sail; the instructor reacts to whatever you do. Stall → the cone and its name.
Press SPACE → "that's the kite."

**Rejected as the whole design** (no completion signal, no test, and a player who
doesn't experiment learns nothing) — **but adopted in half**: it is exactly how the
graduation race teaches rules in §8.

### R3 · Cold open into a real race

You are already in the prestart of race one; the instructor coaches you through it.
Zero tutorial tax.

**Rejected for the First Sail** — the no-go discovery would happen under a clock,
which is the one place a beginner must not be hurried. **Adopted for units 2 and 3**,
which are cold opens into real racing.

### If you only ship one thing — the ladder

Each rung is independently shippable and worth having alone:

1. **The luffing kite** (§3) and **the no-go cone + wind ribbon** (§14). Three
   visuals, no mode, no state machine, and they make the invisible constraints
   visible. **The kite luff ships at every venue and improves the whole game, not
   just the tutorial.** If exactly one thing ships, ship these.
2. **The First Sail** (§6) — the boat, in 3:40.
3. **The Start** (§7) — the one thing that is not discoverable.
4. **The Graduation Race** (§8) — the test, and the hand-off to Lighthouse Cove.

Note what rung 1 does to rung 0: with the cone and the luffing kite in place, a
player who skips the tutorial entirely is *still* being taught, silently, forever.
That is the cheapest onboarding in the file.

---

## 10. What the tutorial deliberately does not teach

**Rule.** Everything on this list is out of scope. Each has a home.

| Not taught | Where it's learned instead |
|---|---|
| Manual trim (TAB, ↑/↓) | §11 — optional post-graduation lesson, or the Controls card |
| Downwind VMG angles | Cut on evidence — §3. Worth 3–5%, punishes overshoot, and the beginner instinct is already 95% right |
| Heel, leeway, roundups — the overpowered system | Out of scope by decision. None of it fires at 7 kn, and it is a second system stacked on a player still learning the first. It belongs to real breeze and the `hud-overpowered` chip |
| Planing | Impossible at 7 kn; Skim the Flying Fish's 10-knot achievement is the teacher |
| Laylines, ladder rungs | The overlay draws them; they start to matter at Lighthouse Cove |
| The polar and target speeds | Upwind VMG *is* taught (§6c) — as an instrument to watch, never as a curve to read |
| Wind shifts, pressure, gusts | Impossible at the pond by design — the venue is steady on purpose |
| Dirty air | Tangle's leech AI is the lesson ([roster-ranking.md](roster-ranking.md)) |
| Rules beyond port/starboard | The penalty toasts, which name the rule as it happens |
| Covering, corners, tactics | Racing. Not teachable in a tutorial at any length |
| Camera modes, nav-aid toggles, splits | The Controls card (`?`) and Settings |
| Character stats and picking | Lighthouse Cove — §12 |

The discipline here *is* the budget. Every row is a thing a reasonable person could
argue in, and every one costs a minute the tutorial does not have.

---

## 11. Manual trim — the recommendation

**Recommendation: not in the tutorial. Yes as an optional lesson after graduation.**

1. **It doubles the control surface at the worst moment.** With auto-trim on,
   steering is the only input — which is exactly what makes the First Sail legible.
   When the boat stalls there is precisely one thing that could have caused it. Add
   sheets and the no-go segment acquires a second suspect and stops being a clean
   experiment.
2. **The game already treats it as advanced.** *Observed:* auto-trim is the shipped
   default (`settings.autoTrim`), and the HUD carries no trim chip at all — a toast
   is the only signal that ↑/↓ changed meaning. And the trim-master achievements are
   gated to boats of +3 power or better precisely because manual trim is very hard.
3. **It has no payoff at 7 knots.** The pond cannot show the player a reason to
   care, and teaching a control whose benefit is invisible is how tutorials get
   resented.

The counter-argument is real: **a player who never learns TAB exists may never find
it.** Two cheap fixes, both recommended:

- **One line on the graduation card:** *"There's more boat than this. TAB hands you
  the sheets."* Twelve words, zero budget.
- **An optional lesson from the graduation results screen** — "Advanced: the
  sheets," ~90 seconds, back at the pond, outside the seven-minute budget because
  the player has already graduated and is choosing it. That is the honest home for
  manual trim: a thing you go back for once you know why you'd want it.

---

## 12. The frame — getting in, getting out, skipping

**Entry — Rule. Offered, never forced.** On first launch the clubhouse leads with
**Sailing School** as the bright primary and a plain secondary straight to racing.
Forced tutorials are the most-complained-about pattern in the genre, and a player
who already sails will resent minute one.

**Entry — Rule. Zero screens between the click and the water.** Sailing School does
not go through the pre-race overlay: no venue card, no fleet list, no character
picker.

**The boat — recommendation.** The tutorial **assigns** a yellow training dinghy
matching the venue's buttercup palette. Do not open the character picker: it is 100
bands with its own scrolling sheet, and a first-time player has no information with
which to choose. Character selection is Lighthouse Cove's moment, and a better
moment for having been withheld.

**Skip — Rule, from [venues.md](venues.md) §15's standing constraint:** *"the
lessons must be individually skippable at speed for a player who half-knows
sailing."*

- **SKIP** is always visible, in the corner, unobtrusive, never hidden.
- **SKIP TO THE RACE** is offered on the first card and again after any skip.
- Every instructor line **auto-satisfies** the moment the player demonstrates its
  verb, even unprompted. Someone who tacks during the wall segment has already
  passed the beat.
- **The skip path is 90 seconds.** If it drifts past two minutes the frame is broken.

**Re-entry.** *Observed:* Duckling Pond is hidden from the venue rotation, so a
"replay tutorial" entry from the clubhouse is the only way back. It must exist from
day one, and it should let the player jump to any unit rather than restart.

---

## 13. Paddle, the instructor — and making it feel like school

**Rule. The instructor is Paddle — a mallard drake, and the duckling line is his
beginner class.**

[venues.md](venues.md) §15's naming note already contains the whole idea — *a line
of ducklings following the drake **is** a beginner fleet following the instructor's
launch.* Cashing it makes the witness and the instructor one character, gives the
ducklings a reason to be on screen, and turns the graduation moment from a cute
animation into the story's resolution. (§15 has been updated to match.)

**Stay mallard.** The drake's green head is the most recognizable marking in
waterfowl — it reads at thumbnail size and at race scale, which is the whole
argument. The showier alternatives trade that away: wood duck and mandarin drakes
are more spectacular but visually busy, which is bad at small sizes and against the
roster's clarity rules; a common eider drake is beautifully clean black-and-white
and has a nice sea-duck angle, but it is obscure and reads oddly at small size.
**Duckling Pond wants the archetypal duck, not a birder's duck** — a player should
look at the card and think *duck*, not *which duck is that?* Mallard is also
uncontested on the roster: the only other waterfowl is Regal the Mute Swan (#57).

**And "great dad" is the better character anyway.** A mother duck with a duckling
line is clip-art; a drake shepherding one is a picture you actually notice. The
against-expectation version is more memorable, warmer, and gives him a personality
that isn't saccharine — *the guy who takes the kids out.* Whether the ducklings are
his brood or his students is a warmth dial, not a mechanic; the strongest reading is
**both**, which is exactly what a club instructor with a young family looks like.

**It also sharpens the ending.** With the ducklings as his class, the arc is:

> **In the first thirty seconds you follow the ducklings. At the finish, they follow
> you.** You started at the back of the line and you are leading it.

That is a more legible graduation beat than being adopted into a family, and it
needs no explanation at all.

It also fixes the reward. An anonymous instructor handing over an unfamiliar mallard
at the end is a coupon; **the voice that taught you for seven minutes joining your
fleet is a payoff.**

### What "feels like school" actually requires

Not modules and quizzes — a real first lesson is one long sail with someone talking.
That is already the shape in §2. What it needs on top is the *furniture*:

- **The launch moves with you.** Paddle motors alongside all through the First Sail.
  This is what an instructor does, it puts him physically in frame with every line
  he says, and it gives the eye something to anchor on.
- **The classmates are on the water from minute one** — wobbling around the pond
  before you have done anything. They do not spawn for the graduation race. A school
  morning has other students in it.
- **The school is visible:** pontoon, dinghy rack, sails drying, the watching parent
  on the dock — all already in §15's asset list. The cold open should frame them.
- **Everyone is in the same boat, literally.** Training dinghies, yellow sails. You
  are not a hero yacht among critters; you are a student in a rented boat.
- **It ends with a debrief** (§8), not a scoreboard.
- **She is teaching, not narrating.** She asks for things, notices what you did, and
  reacts. "Good — now try it the other way" beats "the tack is complete."

### Paddle's rework — what's already right, and what isn't

*Observed, from `AI_CONFIG` and `art/manifest.json[paddle]`:* Paddle is **already
built** — data, portrait and manifest entry all exist. He now has to carry the
game's first seven minutes, which is far more load than the original slot assumed,
so the question is what survives that.

**Keep — the art is good, and three things about it are better than good.**

1. **He is already a drake.** Bottle-green head, yellow bill, white neck ring,
   chestnut breast. The species decision needs no art at all.
2. **The palette is doing real work.** Hull `#2FAE5C`, kite `#F58A00`, accent
   `#6B4A2A` are literally drake plumage, and green-head-against-orange-PFD reads at
   thumbnail. Do not touch any of it.
3. **The stats are quietly perfect and nobody planned it.** `lightAir +3`,
   `heavyAir −2`, `pressure −2` makes him a light-air specialist — and Duckling Pond
   is ~7 kn. **He is the master of exactly the water he teaches on.** His overall
   total is a modest +2, so he is not an overpowered unlock either. Leave the stats
   alone.

**Rework — the expression, and the writing.**

1. **The face is the real problem.** The portrait is a broad open bill caught
   mid-quack, wide grin, eyes off-camera — the manifest asks for *"sunny, forgiving
   and completely without malice."* That is a children's-cartoon mascot, and it is
   precisely the saccharine failure this role cannot afford. The roster plainly
   supports character in expression — Whiskers is *"immovable, and mildly bored by
   the question,"* Snap is *"a proper curmudgeon"* — and Paddle currently has the
   blandest face on the roster while needing the most presence.
   > **Direction:** bill **closed**, a small knowing half-smile, eyes on the viewer,
   > brow level. *Patient, has seen this exact mistake a thousand times, not remotely
   > worried.* Warmth without sugar.
2. **A free fix rides along:** the existing prompt contradicts itself — *"broad open
   bill caught mid-quack"* against `REQUIRED: The bill is CLOSED`. The open bill won.
   Resolving the contradiction toward the REQUIRED line fixes the mascot problem and
   a prompt defect in one re-roll.
3. **Nothing in frame says teacher.** The cheapest and most legible fix by a distance
   is **a whistle on a lanyard over the PFD** — silver on orange, survives thumbnail,
   universally read. *Optional and stronger, but riskier:* a duckling or two peeking
   in at the bottom edge, which would make his the only card on a roster of 100 that
   tells a story instead of posing.
4. **The flavor text does no work for the new role.** Current: personality
   *"Cheerful, forgiving and happiest when the breeze goes soft"*; beat *"Wait for it
   to blow — the duck is a puddle sailor at heart."* The beat is mechanically honest
   and worth keeping in substance. The personality is generic, and "forgiving" is an
   odd word for a rival. **The most connective character in the game has its least
   memorable line.**
   > **Personality — proposals:** *"Taught half the fleet to sail, and still beats
   > most of them."* · *"Runs the beginners' class. Every good habit you have, he
   > gave you."*
   > **Beat — proposals:** *"Wait for it to blow — he learned on a pond and never
   > really left it."* · keep the existing line; it is accurate.

**This is a re-roll of expression and props on a good asset, not a new character.**

### v2 review — Aug 4 2026

A second portrait was generated. **The expression brief is solved**: bill closed, eye
on the viewer, brow level, no grin. Keep that face. Three things block it as
delivered, and one is a hard pipeline gate.

1. **Background — blocking.** It ships on a dark green→black **vignette**. The
   `portrait` profile is `"background": "transparent"`, `ingest.py` hard-fails on an
   unremoved background, and `dekey.py`'s own docstring says *"the seed-relative fill
   cannot key a vignette or a glow at ANY threshold."* `--gradient` exists for this
   case, but the vignette here is **the same hue as the subject's head**, which is
   the worst pairing available. Regenerate on **magenta** — the tool's own
   recommendation, and 255 RGB units from every marking on the bird.
2. **Stylization drift — the note that matters most.** Beside Whiskers it is a
   different rendering language: feather-level stroke detail against fur-as-shape,
   teal rim-lighting the roster does not use anywhere, and longer-necked naturalistic
   proportions against the house's head-heavy chunk. The objective test is the
   profile's own `reduceTest: 64` — **fine feather strokes and 2 px rim lights are
   gone at 64 px, while Whiskers' shapes survive.** On a picker showing 100 cards,
   one card in a different language reads as an error.
3. **The rim light is lit for the wrong room.** Those teal edges exist because the
   art was lit against near-black. De-keyed onto the shell they become an unexplained
   glow, and they are the first thing to die at thumbnail.

Also still outstanding: **no whistle** — the instructor signal has not landed, and it
is the one prop that does the storytelling. And worth checking against the profile's
crop rule (*"bust crop, centered for circular use, face within central 70%"*): the
head sits high enough in frame that a circular crop may clip it.

> **Verdict: right face, wrong execution.** Re-roll keeping v2's expression exactly
> and returning to v1's rendering language, on magenta, with the whistle.

### The part that is actually the most work

Not the art — **the voice lines.** Paddle is the first character in the game who is
*heard* rather than merely raced against: roughly **28 instructor lines** (≈14 in the
First Sail, ~6 in the Start, ~5 in the race, 3 in the debrief), all drafted inline in
§6–§8, plus his ordinary competitor Sayings. Every one is bound by §13's discipline —
twelve words, imperative, no jargon before the sensation, no praise inflation. That
is more authored voice than any other character carries, and it is where his
personality will actually land for the player.

### Housekeeping this creates

[skills.md](skills.md) §9.3 lists him as **"Paddle ○"** — an *orphan* (art exists,
no home) placed as a Stillwater Lake local. He now has a home, and it is a starring
one. That row needs updating.

- **Who he is:** the drake who teaches the club's beginners, with a line of them
  behind him. The connective character — *taught half the fleet to sail, and still
  beats most of them.* That hook makes him worth unlocking rather than merely owed.
- **Voice:** patient, dry, specific. **Not saccharine** — the venue is warm enough
  already, and a syrupy instructor is the fastest way to make a tutorial grating.
  Closer to a good coach than to a mascot. This is also the note his *current*
  portrait and personality line both miss; see below.
- **Archetype: already settled — metronome** ([roster-ranking.md](roster-ranking.md)
  #37), and exactly right for an instructor. The Starting Ten doubles metronome
  (Cheer, Glide), but Paddle is not in the Ten, so the starter fleet is untouched.

**Already aligned elsewhere:** [roster-ranking.md](roster-ranking.md) #37 and
[venues.md](venues.md) §15 (both the naming note and the asset list) have been
updated from "mother duck" to the drake, and now point here.

### Voice discipline

**The instruction is diegetic.** It arrives as a radio call from the launch, not as
UI narration from nowhere.

- **Twelve words maximum.** Most should be six.
- **Imperative, present tense.** "Turn away until the sails fill," not "you should
  now consider bearing away."
- **One line on screen at a time.** Never a paragraph, never a bullet list.
- **Never modal.** The card sits low-centre over a world that keeps sailing. No OK
  button; it leaves when the player does the thing, or when it times out.
- **No jargon before the sensation.** "No-go zone," "tack," "gybe," "OCS" and
  "starboard" each appear for the first time *after* the player has felt the thing
  the word names.
- **No praise inflation.** "Good" for a good thing. Nothing is "amazing."

**Music.** The cue is written and waiting — `pond`, felt piano, 88 BPM, no hook,
short phrases that always resolve ([music.md](music.md) §12.4). Nothing needs a
`targetCue()` change; prestart and racing resolve through the standard mechanism.

---

## 14. The overlays

**Intent.** The pond adds exactly **two** overlays that exist nowhere else:

1. **The no-go cone**, drawn on the water, appearing at the moment of the first
   stall and persisting until the graduation gun.
2. **The wind ribbon** on the surface — where the wind is coming from, unmissable.

Everything else the tutorial leans on — laylines, ladder rungs, rounding arrows,
mark zones, give-way triangles — is the shipped `state.showNavAids` kit, forced on.

**The luffing kite (§3) is deliberately not on this list.** It is not a teaching
overlay and must not be pond-gated: it is the sail behaving honestly, it belongs at
every venue, and its value to a new player is precisely that it keeps teaching long
after Sailing School is over.

*This corrects a line in [venues.md](venues.md) §15,* which reads as though laylines
were pond-only teaching overlays. *Observed:* `drawLayLines()`, `drawLadderLines()`,
`drawMarkZones()` and `drawRulesOverlay()` are live at every venue today. The pond's
genuine monopoly is the cone and the ribbon — which is enough, and which is also the
rung-1 shippable in §9.

---

## 15. Instrumentation

A tutorial that isn't measured can't be fixed. **Intent:** log per session —

- time in each segment, and whether it advanced on the verb or on the timer
- the **drop point** — the last segment seen by a player who never reached the gun
- skips: where, and whether they skipped to the race
- graduation race: finish position, penalties, OCS at the start

**The two numbers that matter:**

1. **Completion** — of players who start the First Sail, what fraction cross the
   graduation finish line. This is the tutorial's whole score.
2. **Median total time.** If it drifts past 8:00, something has grown and needs
   cutting, not explaining.

**Reading it — Rule.** More than ~20% dropping in one segment means that segment is
too long or too vague; fix the segment, do not add a hint. A high timer-advance rate
on the beat or the start is expected and healthy — those are the hard verbs. A high
timer-advance rate on the opening reach means the controls line is failing and
everything downstream is compromised.

---

## 16. Open questions

1. **Manual trim** — cut entirely, or the optional post-graduation lesson in §11?
   *(Recommendation: the optional lesson.)*
2. **Character pick** — assigned training dinghy, or choose from the Starting Ten?
   *(Recommendation: assigned.)*
3. **Wobbly classmates** — do the pond's three AI boats need a difficulty band below
   the current floor? *Observed:* the difficulty bonus scales performance stats only,
   so a negative bonus reads as *slow* rather than *wobbly*. Wobbly may need a trait,
   not a number.
4. **The graduation burgee** — which feat: a clean graduation, or winning? A
   first-timer beating three AI boats should probably not be the bar.
5. **Wind direction** — fixed north every run, or seeded? Fixed is more teachable and
   easier to support; seeded proves the wind-relative placement works. *(Lean: fixed
   north on the first run, seeded on replay.)*
6. **The luffing kite's trigger angle** (§3) — binary at 115°, or the progressive
   130° → 115° → 90° gradient? *(Recommendation: progressive. At 115° the kite is
   still worth +13%, so a binary flag there says something the speedo contradicts.)*
7. **Which characteristic errors** the classmates get (§8), and which are cheap in
   the existing trait system versus needing new ones.
8. **Paddle's ducklings — brood, class, or both?** Purely a warmth question with no
   mechanical consequence, but it sets the tone of every line he speaks. *(Lean:
   both, unstated.)*

*Retired by this round:* the kite HUD chip — the luffing sail is better, for the
reasons in §3. The scripted kite-consequence beat — with a visible luff the loss is
no longer silent, so the tutorial can point at the sail instead of engineering a
punishment. And Paddle's archetype — already metronome in
[roster-ranking.md](roster-ranking.md) #37, and correct.

---

## 17. What this needs from the code

Not a build plan — the seams, so the size is visible.

| Needs | Notes |
|---|---|
| The venue | `pond` in `assets/venues/`, per [venues.md](venues.md) §15 and [venue-art.md](venue-art.md). **The largest piece by far** |
| Two overlays | The no-go cone and the wind ribbon, in the race view, gated to `pond`. Rung 1 of §9 |
| **The luffing kite** | Progressive luff by TWA (§3). **Ships everywhere, not just the pond** — the one item here that improves the whole game, and the thing that makes §6d work |
| A segment driver | Line queue, advance-on-verb-or-timer, no gates. Smaller than a lesson state machine because nothing blocks |
| Objective buoys | Placed from `state.wind.baseDirection`, as `initCourse()` does today. No new geometry system |
| The instructor card | One non-modal line, low-centre. Close cousin of `showRaceMessage()` |
| **Paddle's ~28 voice lines** | The real long pole (§13). Drafted inline in §6–§8; needs a pass for consistency and his final voice |
| Paddle's portrait re-roll | Expression + whistle only — closed bill, level brow, eyes on the viewer. Palette, species signature and PFD colours all stay (§13) |
| Paddle's personality line | One line in `AI_CONFIG`. Stats and archetype need no change at all |
| The launch as a companion | Paddle's boat tracks alongside through the First Sail |
| Classmate handicaps + errors | Stat handicap plus one characteristic error each (§8); check which traits already cover it |
| The debrief | Three lines over the graduation result, from data §15 already collects |
| One AI nudge | Wobble crosses the player once in the graduation race (§8) |
| Cone-off at the gun | Per-overlay gate; leave `showNavAids` alone |
| Skip + jump-to-unit | Corner control, plus a unit list on re-entry |
| Music | `assets/audio/pond.mp3` and one `MUSIC_TRACKS` row — brief already written ([music.md](music.md) §12.4) |
| Graduation reward | Paddle (Mallard), already specced in [achievements.md](achievements.md) |

The tutorial logic on top of the venue is a line queue, a card, and two draw calls.

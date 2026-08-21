# Achievements — How the Characters Are Earned

*Aug 5 2026. Companion to `roster-ranking.md`. Second design pass, incorporating
Wes's feedback on the Aug 3 draft. The starting ten are free; everyone else is
one achievement, one character.*

**What changed in this pass, in one paragraph.** Venues now carry a **five-rung
template** (first win → key mechanic → venue record → venue secret → manual-trim
record) across **sixteen racing venues**, which reserves **80+ characters** for
venue play and takes the roster past a hundred on purpose. The **series family
grew** from a scattering of tags into thirteen achievements about consistency,
because consistency is the skill that's hard to fake. **Records turn out to be
built already** — `regatta_records` keeps separate auto and manual trim boards
per venue, seeded by a designer-authored target — so rungs 3 and 5 need no new
system. Roughly twenty individual criteria were re-cut where the old one was
weak, duplicated another, or was mathematically unreachable at its own venue.

---

## The Starting Ten — free from race one

Unchanged. Chosen in `roster-ranking.md` for personality coverage, ten distinct
hull colors, species variety, and all eight AI archetypes in the opposing fleet.

| #   | Name         | Species             | Hull       | Archetype | The slot they fill   |
| --- | ------------ | ------------------- | ---------- | --------- | -------------------- |
| 1   | **Bixby**    | Sea Otter           | royal blue | shift     | I'm chill            |
| 2   | **Bruce**    | Great White Shark   | black      | bully     | I'm here to win      |
| 3   | **Cheer**    | Pom Pom Crab        | pink       | metronome | I'm happy            |
| 4   | **Pinch**    | American Lobster    | red        | bully     | I'm scrappy          |
| 5   | **Glide**    | Wandering Albatross | white      | metronome | I'm a sailor         |
| 6   | **Wobble**   | Platypus            | orange     | gambler   | I'm weird            |
| 7   | **Sunshine** | Mahi-Mahi           | yellow     | rocket    | I like bright colors |
| 8   | **Tangle**   | Common Octopus      | purple     | leech     | I'm clever           |
| 9   | **Whiskers** | Walrus              | tan        | freight   | I'm an old salt      |
| 10  | **Rift**     | Moray Eel           | chartreuse | corner    | I'm sly              |

Two starters seed chains: **Bruce** anchors the shark ladder and **Whiskers** is
the elder you out-sail to earn Snap.

---

## Base cases — the rules the whole system obeys

1. **One achievement, one character.** No points, no currencies, no duplicate
   paths. The achievement IS the character's story.
2. **Evaluated once, at `showResults()`.** Every criterion is decidable from (a)
   the race that just ended and (b) a small career store. Nothing is checked
   mid-race; nothing needs a server.
3. **Earned characters become opponents.** The fleet is drawn from your unlocked
   pool, so unlock order is also the difficulty curve.
4. **Rivalry rules.** "Beat X" achievements only count races where X actually
   raced. Pending rivals get fleet-draw priority; a newly unlocked character is
   guaranteed a slot for its next 3 races — the game introduces your new rival.
5. **Several unlocks in one race: grant them all.** See below.
6. **Visible but not spoiled.** The picker shows earned characters plus
   silhouettes with hint text for the next few achievable. Venue rungs 1–3 and 5
   appear on the venue card. **Venue secrets and gag unlocks show nothing at
   all** — not a silhouette, not a hint. Discovery is the entire reward.
7. **Reserved characters ship with their venues.** Out of the pool until the
   venue lands; a silhouette teaser on the coming-soon card, never a dead
   achievement.
8. **Regatta lengths: 4, 8, 10, or full.** Unless an achievement says otherwise,
   any length counts. Four series achievements are length-gated (Pearl, Scoop,
   Huddle, Titan) — noted in the table.
9. **Species rule for new characters: real wildlife of that venue, and at least
   part aquatic.** A platypus or a fishing bald eagle qualifies; a marina cat
   does not. This killed two otherwise strong picks in this pass (a dock cat at
   the Cove, a club Labrador at Clubhouse Point) and it is the right trade —
   every critter in this club has a reason to be on the water.

### Several unlocks in one race

**Yes, grant them all** — and expect it to happen constantly early on, then
taper. A first-session player can plausibly finish one race and take Ripple,
Scuttle and Crush at once, which is the correct feeling for a first race.

Two things need designing so the pile-up doesn't turn into noise:

- **The ceremony queues; the grant doesn't.** All unlocks are awarded at
  `showResults()`, but the cards present one at a time, weakest to strongest, so
  the run ends on the best thing that happened. Past four in one race, show four
  and collapse the rest into a single "+N more" card that opens the picker.
- **The new-rival guarantee becomes a FIFO queue, capped at 2 per race.** Base
  case 4 promises each new unlock three races in your fleet. Five simultaneous
  unlocks would hijack an entire fleet, so they queue: at most two guaranteed
  slots per race, oldest first. Everyone still gets their three races, just not
  all in the same one.

---

## The venue template — five rungs, every venue

Ordered by typical difficulty, which is also the order a player meets them:

| # | Rung | Criterion | What it's for |
|---|---|---|---|
| 1 | **Witness** | First win at the venue | The local greets you. Arriving is the achievement. |
| 2 | **Mechanic** | A feat only this venue's key mechanic can produce | Proves you understood *why this place is different* |
| 3 | **Record** | Beat the standing **auto-board** track record | The time attack — the venue's solo game |
| 4 | **Secret** | An unpublished venue-specific objective | Rewards exploring, repeat play and paying attention |
| 5 | **Trim master** | Beat the standing **manual-board** track record | The expert tier: same skill, sixteen different waters |

**Sixteen racing venues × 5 = 80 characters reserved for venue play**, before
extras. That's deliberate: venue play is where the game's hours actually go, and
the reward map should say so.

### Rungs 3 and 5 already exist in code

`regatta_records` (`script.js:13894` onward) turned out to be exactly the system
these two rungs need, and it ships today:

- **Two boards per venue, `auto` and `manual`**, keyed `venue:legs:board`.
- **The board is decided by USE, not by the setting** — `rs.usedAutoTrim` is
  sampled every frame (`script.js:10049`), so touching auto trim once puts the
  whole run on the auto board. The anti-cheese Wes asked for is already written.
- **A designer-authored target seeds both boards.** `doc.records.provisional` is
  the venue document's standing target, aimed at the 75th percentile of real
  runs, authored in the editor (`editor.js:5929`). It displays as **PROV /
  Target** until a player beats it. So "set the venue record" is a real target
  from race one, not a walkover against your own first lap.
- Each board also stores per-leg bests, top speed, shortest distance and quickest
  start, each remembering which character set it — a burgee mine we haven't dug.

Two rules to keep this honest:

- **Venue record achievements count only on the venue's canonical course card.**
  Records are keyed by leg count, so without this a 2-leg sprint mints a cheap
  record on a course nobody races.
- **Wind variance is left in, on purpose.** Times are noisy because conditions
  are random, and normalizing them would be a lot of machinery to make a one-time
  unlock arrive on a schedule. Variance changes *when* you get it, not whether
  the run was good. Author the provisional generously and let a lucky breeze be a
  lucky breeze.

### Venue secrets — what makes a good one

Rung 4 is the one Wes specifically wants to pull repeat play, exploration and
investment. The pattern that works: **something on the venue that is not on the
course**, or a use of the venue's ambient life that you'd only find by looking
up. Wes's own examples set the shape — *spot every pod of orcas*, *chase three
floes of penguins off the ice*. So:

- **Never blocking.** A secret must never be on the fastest line, or it becomes a
  tax on racing rather than a reason to wander.
- **Costed, not free.** Most secrets below cost you distance and still require a
  good result. "Detour and win anyway" is the shape.
- **Zero hint text.** Rung 4 is the only rung with no silhouette in the picker.
  It shows up in the venue's card as a blank slot with a "?" and nothing else.
- **Discoverable by curiosity, not by grinding.** If the only way to find it is
  to race the venue fifty times, it's a burgee, not a secret.

---

## What must be built or tracked (the honest dependency list)

Revised — the records pass found four of these already shipped.

| System | Status in code | Needed by |
|---|---|---|
| Career store (`regatta_career`): races, wins, podiums, streaks, per-venue wins, per-rival head-to-heads, clean-race streak | **new** | nearly everything |
| Unlock store (`regatta_unlocks`) + fleet-draw from pool + unlock queue | **new** | everything |
| Regatta/series (4, 8, 10, full; low-point scoring **with discards**) | **missing** | 13 achievements |
| Venue record boards, auto + manual, with authored targets | **exists** (`regatta_records`, `doc.records.provisional`) | **32 venue rungs** |
| Per-leg times, top speed, distance sailed, start time — all per boat | **exists** (`legTimes`, `boatTopSpeed`, `boatDistKm`, `boatStartTime`) | 14 achievements |
| Finish place, DNF, start-cross order, gun-to-line delta | exists | 8 achievements |
| Penalty served/cleared, incl. AI penalties, OCS | exists | 9 achievements |
| Per-mark place splits | exists | 12 achievements |
| Average wind for the race | exists | 8 achievements |
| Finish margins (time/distance to boats ahead/behind) | **new, small** | Pulse, Popper, Titan |
| Tack + gybe counters | **new, small** (heading crossings) | Viper, Spin |
| Overtake events (live place swaps, 10s debounce, gross) | **new, small** | Frenzy, Brine, Lance, Hunter burgee |
| Give-way attribution (AI avoidance fires while player holds ROW, with reason) | **new, small** — `rules.js` already computes ROW owner + reason per pair | Spike, Latch, Sawbill, burgees |
| Continuous gap-to-rival sampling (for "held them off for N seconds") | **new, small** | Grip, Popper, Corsair |
| Dirty-air attribution (player's wind shadow on a named rival, sampled) | **new, small** — shadow geometry exists for AI | Corsair |
| Spinnaker-hoist flag + kite-up duration | **new, trivial** | Lateen, Splash |
| Lead-change count / continuous leader | **new, small** | Chroma, Grip |
| Manual-trim-all-race flag | **exists** (`rs.usedAutoTrim`) | 16 trim masters |
| Hazard-contact events, per hazard class (ice, log, gator, rock, bar, cone) | **new, medium** — collisions exist, need typed events | 9 venue mechanic rungs |
| Ambient-interaction events (gulls scattered, gators submerged, flock flushed, orcas sighted) | **new, medium** — the ambient systems exist, the events don't | **most venue secrets** |
| Off-course region visits (islet, bloom, cave, vent field) | **new, small** — point-in-region test per frame | 6 venue secrets |

**The one real new cost in this pass is the last three rows.** Venue mechanics
and secrets need the ambient layer to emit events. That's the price of making
venues the heart of the reward map, and it's worth paying: it's also what makes
the results screen able to say *"you scattered the gulls at the lighthouse"*,
which is the whole charm.

---

# Part 1 · The general families

## A · First Season — general milestones, earnable anywhere (9)

| Character | Title | Earned by |
|---|---|---|
| **Ripple** (Dolphin) | Welcome Aboard | Finish your first race. The day-one gift. |
| **Wiggle** (Axolotl) | Everything Grows Back | Serve a penalty turn and clear it. Deliberately easy: your first penalty is the game's worst moment, and the animal that regrows anything arrives to flip it into a gift. Weak boat (−2), so the gift never bites back. |
| **Scuttle** (Hermit Crab) | Clean Hands | Finish a race with zero penalties. |
| **Skim** (Flying Fish) | Airborne | Hit 10 knots of boatspeed — the planing threshold. The moment the boat leaves the water is the moment you earn the fish that leaves the water. |
| **Zing** (Flying Squirrel) | The Comeback | Win after rounding the **first mark** dead last. |
| **Splat** (Blobfish) | Still Afloat | **Finish last for the first time.** *(was: 5 times)* Hidden. The first-failure gift, and the most reliable pattern in the whole research pass: the moment a player has their worst race, the meme legend turns up and says *me too*. Making them earn it five times over turns a consolation into a punishment. Last-place tiers live on as the Wooden Spoon burgee. |
| **Snap** (Snapping Turtle) | Respect Your Elders | Finish directly ahead of Whiskers (a starter, so always available). |
| **Hug** (Sea Star) | Ironclad | Finish 25 races. |
| **Knot** (Nautilus) | Dead Reckoning | Finish exactly 5th, **three races in a row.** *(was: 3 times, ever)* Wes is right that the loose version happens by accident if you play enough — and an accident is a terrible way to meet the roster's cerebral planner. Consecutive makes it deliberate: you have to *aim* at 5th, three times running, which is a genuinely strange and funny thing to do on purpose. Hidden. |

**On Zing vs Dozer.** Wes floated giving Zing "win after being last over the
line" instead. That feat is already Dozer's (start last → podium), and the two
are worth keeping apart: Dozer is about the *start* — you blew the gun and
recovered; Zing is about the *race* — you were beaten to the first mark by the
whole fleet and still won. Same shape, different lesson, and Zing's is the harder
and more spectacular of the two.

## B · The Start Line (3)

| Character | Title | Earned by |
|---|---|---|
| **Crush** (Mantis Shrimp) | Gun Fighter | Cross the line **within 1.0s of the gun** — confirming Wes's note; the draft already read `< 1s`. The fastest strike in the ocean, earned by timing. Sub-0.1s is the Frame Perfect burgee. |
| **Clutch** (Red Rock Crab) | Line Boss | First across the start, 3 races running. |
| **Skip** (Green Basilisk) | Trigger Happy | Go OCS, restart, and still win. Hidden until your first OCS. |

## C · Clean & Dirty (2)

Regal moved to the series family, where a zero-penalty regatta belongs.

| Character | Title | Earned by |
|---|---|---|
| **Stomp** (Blue-Footed Booby) | Shake It Off | Win a race in which you served a penalty. Properly hard, because Stomp is the 5th-strongest boat in the file (+12): elite stats under clown feet must be earned. |
| **Bramble** (Sea Urchin) | Untouchable | Take zero penalties in a race where **5+ rivals** get penalized. *(was 3+)* Wes: it happens. Five in a ten-boat fleet means half the race fell apart around you. |

*(Stripes' old "10 consecutive penalty-free races" is now the first tier of the
Clean Season burgee — he moved to the shark ladder, per Wes.)*

## D · Close Racing (3)

| Character | Title | Earned by |
|---|---|---|
| **Pulse** (Tree Frog) | Photo Finish | Win by less than a boatlength. |
| **Latch** (Remora) | Inches | **Cross ahead of a starboard-tack boat, on port, within one boat length — with no penalty.** *(was: finish within a boatlength of the winner)* Wes's call, and the species argues for it: a remora rides inches from a shark's jaw and is never bitten. It's also the nerviest legal move in racing — the whole rulebook in one second. Void if you take any penalty that race. The *ducking* version (passing astern within a length) stays the Good Duck burgee, so the pair reads as cross-ahead vs duck-behind. Latch's old criterion becomes a Dead Heat burgee tier. |
| **Popper** (Pufferfish) | The Circle | **Round every mark of a race inside one boat length — without touching one.** *(was: win with 2nd within 3 lengths at the final mark)* This is also Wes's "maybe something about good rounding?" landing where it belongs. White-spotted pufferfish carve perfect geometric circles in the sand; the roster's cutest character gets the game's precision-rounding feat, and precision is a thing a beginner can practise deliberately at any venue. |

*(Flare moved to the series family — see below. His old "beat the same rival 5
races running" was a grind with no story; Wes's replacement is a much better one.)*

## E · Leg & Mark Craft (7)

| Character | Title | Earned by |
|---|---|---|
| **Flaunt** (Anemone Shrimp) | Wire to Wire | Lead at every mark and win. |
| **Vex** (Water Dragon) | Daylight Robbery | Take the lead on the final leg and win. |
| **Needle** (Gharial) | Threading | Gain at least one place on every leg. |
| **Sable** (Cormorant) | Perfect Roundings | Never lose a place at any mark, whole race. |
| **Brine** (Manatee) | Never Passed | **Finish a race without being overtaken once, gun to gun.** *(was: place never worsens after mark 1, top-3)* Wes is right that the old version was Sable with extra steps — both were mark-place checks. This one is continuous, which is a completely different race: Sable asks whether you rounded well, Brine asks whether anyone ever got past you *at all*, including the pass they made and gave back. "Impossible to pass" is the manatee's own roster line. |
| **Flash** (Mackerel) | Run Line | **Sail the fastest downwind leg in the fleet, and finish top-3.** *(was: take the lead on a downwind leg and win)* The old one was Vex on a run. Fleet leg times are already computed for the results screen (`script.js:14395`), so this is free — and it makes the mackerel what he says he is: the fastest thing on the run, whether or not it won him the race. |
| **Splash** (Hippo) | All Kite | **Win a race with the spinnaker up for more than half the elapsed time.** *(was: gain 3+ places on downwind legs)* The exact inverse of Lateen, which is the joke: the sailing purist wins without ever hoisting, and the most joyful heavyweight in the file wins by never taking it down. Rewards reading a course for kite-legs and committing. |

## F · Boat Handling & Conditions (8)

| Character | Title | Earned by |
|---|---|---|
| **Frond** (Leafy Seadragon) | Whisper Wind | Win with average wind ≤ 7 kn. |
| **Bulkhead** (Elephant Seal) | Storm Wall | Win with average wind ≥ 18 kn. |
| **Chroma** (Cuttlefish) | Every Colour | **Win at least once in light air (≤ 8 kn), once in medium, and once in heavy air (≥ 18 kn).** *(was: take the lead 3 times in one race and win)* The old one was a lead-change counter wearing a cuttlefish costume. The cuttlefish's actual trick is becoming whatever the situation requires — so make him the all-conditions master. He also arrives as a natural bookend to Frond and Bulkhead: earn both of those and you're one band from Chroma. |
| **Crimson** (Red Snapper) | Surgical | Win by 30+ seconds. |
| **Viper** (Tree Snake) | Tacking Duel | Win a race with 12+ tacks. |
| **Spin** (Spinner Dolphin) · NEW | Corkscrew | **Win a race with 12+ gybes.** Wes asked for Viper's downwind twin, and the spinner dolphin — the one that leaves the water and rotates on its long axis, for no reason anybody has proved — is the character for a gybing war. Distinct from Ripple: smaller, striped, and always mid-spin in the art. |
| **Grip** (Barnacle) | Never Let Go | **Hold a rival within two boat lengths astern for 60 continuous seconds, and finish ahead of them — no penalties.** *(was: round the top mark top-3 with ≤1 tack)* Wes flagged the old criterion as a weak feat for a genuinely unique character, and separately asked for something about *holding off a passing rival using the clear-ahead rules.* Those are the same note: the barnacle should be the game's defensive achievement. It's the exact mirror of Spike (who makes rivals move) — Grip makes them fail to. The old one-tack idea becomes the One Tacker burgee. |
| **Lateen** (By-the-wind Sailor) | One Sail, Forever | Win without ever hoisting the spinnaker. Hidden; the sailing-nerd badge. |
| **Mola** (Ocean Sunfish) · bench | Sunbather | Win a race in which you were becalmed (under 2 kn boatspeed) for 30+ continuous seconds. Parked like a mola on its side, and won anyway. *(His bench achievement, given a home in this pass — it was the one sketched criterion with no family.)* |

## F2 · Legal Aggression (3)

Racing's third food group after clean and fast: *forcing*. All three reward
making rivals flinch **within the rules**, and all three are void if you take any
penalty that race. The reward is never for contact.

| Character | Title | Earned by |
|---|---|---|
| **Frenzy** (Piranha) | Feeding Frenzy | **15 gross overtakes in one race, no penalties.** *(was 9)* Wes's catch is exact: with a ten-boat fleet, 9 net passes is just *winning*. Gross passes (re-passes of the same boat debounced 10s) in a shifty race can run well past fleet size, so 15 means you genuinely ate through the fleet more than once. The single-race counter; the series version is Lance. |
| **Spike** (Narwhal) | Makes His Own Right of Way | Force 5 rivals to give way in one race — duck, tack or bear away while you hold ROW — no penalties on you. |
| **Corsair** (Frigatebird) · NEW | Air Thief | **Hold a rival in your dirty air for 30 continuous seconds, and beat them.** Wes's "dirtying someone's air for a period of time," and the frigatebird is the character it was waiting for: the kleptoparasite that harasses other seabirds in the air until they give up what they're carrying. It never lands on water, it steals its whole living, and it's the most piratical silhouette in the sky. The one achievement in the game for using your own wind shadow as a weapon. |

## F3 · The Odometer Pair (2)

| Character | Title | Earned by |
|---|---|---|
| **Dart** (Kingfisher) | Beeline | Win having sailed the **shortest** distance in the fleet. Perfect laylines, no overstanding, not a meter wasted. |
| **Flicker** (Arctic Tern) | Longest Migration | Win having sailed the **longest** distance in the fleet. The tern owns Earth's longest migration; speed forgives distance. |

**On a real odometer.** Wes asked whether there's a career distance counter as
well. There is: `unitsToKm` computes race distance today, and the **Passage
Maker** burgee tiers it at 25 / 100 / 250 nm. It stays a burgee — distance
sailed is the definition of a stat, not a story, and the burgee layer exists
precisely so accumulations don't have to spend a character. If it ever wants a
character, the honest threshold is a real ocean crossing (≈3,000 nm), not 100 km.

## G · Prestige (2)

| Character | Title | Earned by |
|---|---|---|
| **Cruz** (California Newt) | World Tour | **Win a race at every venue in the game.** *(swapped with Mistral per Wes)* One of the coolest characters in the file and quietly the strongest total statline (+14), so he should cost the broadest thing a player can do. "Never once out of position" now means *anywhere*. |
| **Muninn** (Raven) | The Rememberer | **Hold the manual-trim track record at every venue in the game.** *(was: unlock all 99 others)* The raven who remembers everything is the one name at the top of every manual board — he is the sum of all sixteen trim masters and then some. This also fixes the moving-target problem Wes raised: a collection target rots every time the roster grows, but a mastery target doesn't — new characters don't touch it, and a new *venue* reads as an honest new summit rather than a chore. **If you hold Muninn and a new venue ships, you keep him.** He remains the only character with a special trait (`windFast`). |

## H · The Shark Pack (9 + capstone)

Wes: *include more sharks in the progression and end with the Whale Shark.* The
pack becomes the roster's flagship collection with **twelve sharks and four ways
in** — a ladder, feats, venues, and a capstone.

**Should Bruce still be first?** Yes — and the question dissolves once you notice
Bruce isn't a *rung*, he's the seed: he's free on screen one. The first *earned*
shark is Blaze. Keeping the great white as the starter is right for the same
reason he was picked for the ten: he's the character the competitive player grabs
without scrolling, and *beating the famous one* is a better opening chapter than
beating an obscure one. A bull shark opening the collection would be a deep cut
in the one slot that needs instant recognition — so Bruiser stays where he's
best, as the shark that turns up in fresh water where no shark belongs.

**The ladder** — each unlock becomes the next opponent:

| Character | Title | Earned by |
|---|---|---|
| **Blaze** (Mako) | Faster Fish | Beat Bruce 3 consecutive races. |
| **Anvil** (Hammerhead) | Harder Fish | Beat Blaze 3 consecutive races. |
| **Stripes** (Tiger Shark) | Eats Everything | **Beat Anvil 3 consecutive races.** *(moved into the ladder per Wes; his old 10-clean-races criterion became a Clean Season burgee tier)* The tiger is the right third rung — after the fastest and the widest comes the one that eats whatever it finds. |
| **Lash** (Thresher) · future | Tail End | Beat Stripes 3 consecutive races. Build when the ladder needs a fourth rung — and vary the rule when it ships; four identical rungs is one too many. |

**The feat sharks:**

| Character | Title | Earned by |
|---|---|---|
| **Dozer** (Nurse Shark) | Wide Awake | Cross the start line dead last, then finish on the podium. He sleeps through the start and wakes up near your transom; so did you. |
| **Woebegone** (Wobbegong) · bench | The Rug Moves | Podium after being last at the halfway mark. |
| **Razor** (Barracuda) | Swims With Sharks | Finish ahead of every shark in a race with **3+ sharks** in the fleet. Not a shark, and not the capstone — the fish that hangs with sharks and fears none. |

**The venue sharks** (counted in their venue tracks below): **Bruiser** the Bull
Shark (win at Stillwater, Sockeye *and* Redrock — the freshwater triple),
**Roam** the Blue Shark (Bluewater Bonanza), **Relic** the Greenland Shark
(Glacier Sound), **Goblin** the Goblin Shark (Glowtide Strait), **Gape** the
Basking Shark (Fallwater Fjord), **Blacktip** (Reef 2).

**The capstone:**

| Character | Title | Earned by |
|---|---|---|
| **Dapple** (Whale Shark) | The Gentle Giant | **Own every shark in the game.** The last one to arrive is the biggest and gentlest fish in the sea. Evaluated against the sharks that have shipped at the time you complete it — **shipping a new shark later never takes Dapple back.** He should ship while the pack is still being collected, not after. |

## S · Series — the consistency family (13)

Wes's biggest structural note: *more achievements around series — that rewards
the consistency that is hard to obtain but represents real skill.* Agreed, and
it's the cleanest gap in the Aug 3 draft — one-race feats reward a good day,
series feats reward being good. This family is now the second largest.

Everything here needs the regatta system (4 / 8 / 10 / full, low-point scoring).
**Four of them need discards**, which real series scoring has anyway — and the
discard is what makes Renew possible.

| Character | Title | Earned by |
|---|---|---|
| **Anchor** (Sea Turtle) | Champion | **Win your first regatta.** *(was: top-5 in 5 consecutive races; the orca held this)* Wes: the top-5 streak was the weaker achievement anyway. Beloved, mellow, brutally consistent — the sea turtle is a better face for *your first championship* than a streak nobody notices they're on. The top-5 streak becomes a burgee. |
| **Regal** (Mute Swan) | White Gloves | Win a regatta with zero penalties. Royalty is earned politely. |
| **Mistral** (Swift) | The Season | **Complete 10 regattas.** *(swapped with Cruz per Wes)* The common swift stays airborne for ten months without landing — attendance is literally its superpower, and a genuinely valuable late unlock (+5 accel, +5 momentum) for the player who keeps showing up. |
| **Flare** (Fighting Fish) | Grudge Match | **Win a regatta you entered the final race trailing on points.** *(was: beat the same rival 5 races running)* Wes's own replacement, and it's much better: the old one asked you to care about a rival the game never told you to care about, while this one manufactures a rival out of the standings automatically. The last race of a series you're losing is the most charged race the game can produce, and the Siamese fighting fish should be the one waiting at the end of it. |
| **Tempo** (Snapping Shrimp) · NEW | Metronome | **Every start of a regatta inside 1.0s of the gun.** Wes's example, taken literally, because "all of them" is a much better feat than "the average." The pistol shrimp's snap is the loudest and one of the fastest actions in the ocean, and it fires on command — Crush is the single perfect strike, Tempo is never missing one. |
| **Titan** (Giant Trevally) · NEW | By Daylight | **Win every race of a regatta by 5+ seconds** (8+ race format). Wes's dominance feat. Winning a race by five seconds is a good race; doing it eight times running is a statement. The GT is the reef's most feared predator and the one gamefish anglers describe as unfair — the right face for total dominance. |
| **Lance** (Sailfish) · NEW | Through the Fleet | **Average 10+ overtakes per race across a regatta.** Wes's series version of Frenzy. The fastest fish in the ocean, which hunts by slashing through a bait ball again and again rather than picking one fish — exactly the shape of the achievement. *(Third billfish after Spar and Torrent — flag for the livery test; the sail itself should carry the silhouette.)* |
| **Huddle** (Emperor Penguin) · NEW | No Discard | **Podium in every race of a full-length regatta.** The endurance feat: no bad day, not even one you're allowed to throw away. Emperors do the hardest sustained thing in the animal world and do it by not breaking formation. |
| **Renew** (Immortal Jellyfish) · NEW | The Discard | **Win a regatta despite finishing last in one of its races.** The most forgiving achievement in the game and the most sailing-literate: the discard is real series scoring, and every club sailor has won a series on the back of one throw-out. *Turritopsis dohrnii* reverts to its juvenile form and starts over, which is the only animal on Earth that is literally a drop race. |
| **Pearl** (Oyster) | Flawless | Sweep a **lagoon** regatta of 8+ races — win every one. *(venue: Pearl Lagoon)* |
| **Scoop** (Pelican) | Club Champion | Win a **full-length** Clubhouse series. *(venue: Clubhouse Point)* Beer-can racing is a season, not a weekend. |
| **Nimbus** (Eagle Ray) | Glide Path | *(moved — now Pearl Lagoon's mechanic rung)* |
| **Snag** (Hellbender) | Older Than the River | *(moved — now Sockeye Run's mechanic rung)* |

**Two more good series ideas, deliberately left as burgees**: win regattas at 5
different venues (that's Cruz's World Tour with extra steps) and lead a series
after every single race (wire-to-wire, which Titan already implies). Both tier
naturally, which is the burgee test.

---

# Part 2 · The sixteen venue tracks

Sixteen racing venues. Fourteen are specced in `venues.md`; **Reef 2** and the
**Tide Pool** are Wes's planned additions and their tracks below are sketches
against an unwritten spec. **Duckling Pond** is the tutorial venue and sits
outside the sixteen — it still carries a light track, because Paddle lives there.

Legend: **1** witness · **2** mechanic · **3** record · **4** secret · **5** trim
master. `NEW` = character to be built. `bench` = already sketched in
`roster-ranking.md`.

## 1 · Lighthouse Cove `bay` — the front door

Mechanics: cargo ship with an enormous moving wind shadow · wing foilers · the
harbour gate · one island with a fixed lee · gulls that scatter on a tight
rounding.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Roll** (Harbor Seal) | The Witness | First win at the Cove. The harbour seal is the harbour's own. |
| 2 | **Wake** (Harbour Porpoise) · NEW | Ahead of the Ship | Win at the Cove **without ever being caught in the cargo ship's wind shadow.** The venue's identity is one enormous slow hazard made of air; this is the feat of reading its schedule and never paying it. Harbour porpoises work the ship channel and cross ahead of everything. *(Silhouette check against Ripple — no beak, stubbier, dark cape.)* |
| 3 | **Ketch** (Osprey) · NEW | Fish Hawk | Set the Cove track record. The harbour's precision diver, and the only bird that hits the water from height and comes out with the thing it aimed at. |
| 4 | **Wheel** (Kittiwake) · NEW | Scatter | **Scatter the gulls at the lighthouse on every lap of a race you win.** The venue already promises this — a tight rounding at the headland puts the gulls up, which is how a good rounding becomes *visible*. Doing it every lap, and winning, is the Cove's secret. |
| 5 | **Piper** (Sanderling) | Home Waters | Set the Cove **manual-trim** record. The precise little bird that never stops adjusting, and the gentlest trim reward in the game (+4) — the home venue hosts most players' first hand-trimmed record. |

## 2 · Stillwater Lake `lake` — glass and puffs

Mechanics: shiftiest wind in the game · glass patches · shoals on the favoured
layline · a pine island that splits the fleet · anchored skiffs that bark.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Lunker** (Largemouth Bass) | Trophy Catch | First win at the Lake. |
| 2 | **Diver** (Common Loon) · NEW | The Split | **Win having taken the less-popular side of the island on the first beat, and led at the top mark.** The venue's whole question in one criterion — you looked at the water, went alone, and came out ahead. The loon is the lake's own sound and it makes its living by choosing a side and disappearing. |
| 3 | **Gasket** (Beaver) | Built This Place | Set the Stillwater track record. Beavers dam streams to make still water; the lake IS his work. |
| 4 | **Timber** (Moose) · NEW | Wake the Neighbours | **Draw a bark from all three anchored skiffs in one race** — pass close enough to each. A secret made entirely of ambient life that already exists, it costs you distance every time, and it is very funny. Moose swim well, dive for pond weed, and are the single most Stillwater animal alive. |
| 5 | **Torpedo** (Pike) | Knows the Water | Set the Stillwater **manual-trim** record. He hunts by feel; so did you. |

## 3 · Pearl Lagoon `lagoon` — the flagship (8)

Mechanics: rain squalls with a payoff curve and a dead-air wake · reef passes on
the reaching leg · coral heads off the rhumb line.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Jester** (Clownfish) | Found Him | First win at the Lagoon. |
| 2 | **Nimbus** (Eagle Ray) | Ride the Cell | **Win having crossed a squall cell's core on the reaching leg.** *(moved from the lagoon regatta)* The venue's signature decision — round it or through it — and the eagle ray is the one that goes *through*, in formation, in the rain. |
| 3 | **Breeze** (Nudibranch) | House Style | Set the lagoon track record. |
| 4 | **Ribbon** (Sea Krait) | Landfall | **Round the sandy palm islet — which is not a mark — during a race you win.** *(was: no place lost at any mark, which was Sable again)* Sea kraits are the reef snake that comes *ashore* on sand islets, the only one that does. A costed detour on the flagship venue, and the shape every other venue secret copies. |
| 5 | **Puff** (Mandarin Dragonet) | Effortless | Set the lagoon **manual-trim** record. Hand trimming only looks effortless when mastered. |
| + | **Saffron** (Seahorse) | Light Touch | Lagoon win with average wind ≤ 8 kn. |
| + | **Pearl** (Oyster) | Flawless | Sweep a lagoon regatta of 8+ races. *(series)* |
| + | **Sovereign** (Napoleon Wrasse) | Reef Royalty | Own all seven lagoon characters above. Capstone. |

*The flagship is allowed extras — the template is a floor, not a ceiling.*
*(Sway the Sea Anemone, on the bench, remains lagoon-adjacent: "win a race with
Jester in the fleet," a soft chain where the clownfish must be unlocked first.)*

## 4 · Gatorgrass Bayou `swamp` — dead air and weed

Mechanics: weakest wind in the game · weed-bed drag · drifting logs · gators that
submerge when you approach and surface somewhere else · the braided fork.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Chomp** (Crocodile) | The Witness | First win at the Bayou. |
| 2 | **Croak** (Bullfrog) | When the Wind Dies | Bayou win with average wind ≤ 6 kn. The venue's chip is KEEP HER MOVING and its ceiling is 8 kn — a light-air win here *is* the mechanic rung, not a condition rung. |
| 3 | **Etienne** (Crayfish) | Bayou Classic | Set the Gatorgrass track record. |
| 4 | **Flit** (Dragonfly) · NEW | Wake the Bayou | **Make five gators submerge in one race.** The gators are the only hazard in the game that *reacts to the player*, which makes them the only hazard that can carry a secret. Every approach costs you speed in a venue with none to spare. Dragonflies spend their entire larval life underwater and their adult life a foot above it — the bayou's own aircraft. |
| 5 | **Beau** (Alligator) · bench | Landlord | Set the Gatorgrass **manual-trim** record. The venue finally keeps its name's promise. Sketched at +5 to clear the trim floor. |

## 5 · Sockeye Run `river` — current and rocks

Mechanics: the game's only current field · three lanes including back-eddies that
run upstream · rapid tongues that boost or stop you · two bridge gates · an
island that asks the opposite question in each direction.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Slipstream** (Sockeye) | The Witness | First win on the Run. |
| 2 | **Snag** (Hellbender) | Reads Every Stone | **Hit the clean tongue at every rapid, both directions, in one race.** *(moved from the river regatta)* The rapids are the venue's precision mechanic — a dark V you can see from upstream, a boost if you find it and a wall if you don't. "In this river longer than the river" should mean he knows where every tongue is. |
| 3 | **Riffle** (American Dipper) | High-Water Mark | Set the river track record. |
| 4 | **Grizzle** (Brown Bear) · NEW | Fishing Rights | **Sail over every salmon shoal on the course in a single race.** The salmon run is already ambient and it is already doing what you're doing — fighting the current — so the secret is noticing where they are, which is exactly what the venue teaches. The bear on the gravel bar is the most photographed animal in this landscape and he is up to his knees in it. |
| 5 | **Seam** (Rainbow Trout) | Reading Water | Set the river **manual-trim** record. The title always meant "by feel"; now the criterion does too. |

## 6 · Bluewater Bonanza `ocean` — swell and speed

Mechanics: swell sets and surfing · cloud-shadow pressure cells · a destination
seamount · the only venue whose hazards are invisible.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Spar** (Blue Marlin) | Big Game | First win on the Bonanza. |
| 2 | **Finley** (Yellowfin) | Full Pressure | **Hold the SURFING cue for 20 continuous seconds on the reach home, and win.** *(was: win with average wind ≥ 16 kn)* Surfing a set on the long reach is the venue's stated signature moment; the heavy-air condition rung is Bulkhead's job and doesn't need a second home. "Relentless pressure" now means the pressure you found. |
| 3 | **Roam** (Blue Shark) · NEW | Ocean Wanderer | Set the Bonanza track record. The blue shark is the great trans-ocean traveller that follows ships for weeks — the roster doc's homeless "ship-following ocean wanderer" hook, finally housed, and the sixth shark. |
| 4 | **Sound** (Humpback Whale) · NEW | The Blow | **Be within three boat lengths of the humpback when it blows.** The venue's own easter egg — a whale that surfaces once a race — turned into an objective. It's pure luck the first time and pure attention afterwards, which is the correct feel for the emptiest venue in the game. |
| 5 | **Torrent** (Swordfish) | Honed | Set the Bonanza **manual-trim** record. The blade sharpened by hand. |

## 7 · Redrock Reservoir `redrock` — the traffic venue

Mechanics: terrain-shaped, learnable wind · 20% of the water under two boat
lengths wide · legs that share water and run head-on · three crossing junctions.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Chisel** (Humpback Chub) | Canyon Endemic | First win at Redrock. The endemic IS the witness — this fish exists nowhere but this canyon water. |
| 2 | **Sawbill** (Common Merganser) · NEW | Right of Way | **Force three rivals to give way in the junctions in one race, no penalties.** Redrock is the one venue where the boat ahead is a wall and the fleet meets itself head-on three times a lap; this is the only place the give-way mechanic can be a *venue* feat rather than a general one. Mergansers run the channel in a line, single file, and do not deviate. |
| 3 | **Ridge** (Razorback Sucker) · NEW | Canyon Record | Set the Redrock track record. The other Colorado endemic, and the deepest cut in the file after Chisel — the two of them are the whole reason this venue's water is worth protecting. |
| 4 | **Echo** (Canyon Bat) · NEW | Answer the Canyon | **Round the spire on the inside on every lap of a race you win.** The canyon's tightest, most optional line — the doc's own "diving inside the spire to break an overlap" as a discipline rather than an accident. Bats drink and hunt on the wing off the reservoir surface at dusk, they navigate the narrows by echo, and no bat exists anywhere in the roster. |
| 5 | **Talon** (Bald Eagle) | Feathered | Set the Redrock **manual-trim** record. Eagles fly by adjusting individual feathers, "feathering" is literal trim vocabulary, and at +13 this is the strongest trim reward in the game — correct, because the eagle owns the canyon. |

## 8 · Glowtide Strait `glowtide` — moonlight and glow (6)

Mechanics: information scarcity · speed-scaled bioluminescent wakes · lit gates ·
unlit rocks with a faint breaking-water tell.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Lure** (Black Seadevil) | First Light | First win at Glowtide. |
| 2 | **Veil** (Vampire Squid) | Trust Your Own Line | **Win without ever sailing in another boat's glowing wake.** *(was: win with zero penalties)* The venue asks exactly one question — *follow the glow, or trust your own line?* — and this is the only achievement in the game that answers it. Refusing the free map is the hardest legal way to sail this course. |
| 3 | **Drift** (Sea Nettle) | Night Passage | Set the Glowtide track record. |
| 4 | **Bloom** (Man-of-War) | Find the Bloom | **Sail through the jellyfish bloom — off the course, unmarked — and still win.** *(was: win having never led until the final gate)* The name was always the criterion; nobody noticed. A drifting glowing mass somewhere off the slalom, visible only if you look away from the gates, in the one venue where looking away from the gates is terrifying. |
| 5 | **Prism** (Maxima Clam) | Refraction | Set the Glowtide **manual-trim** record. Trimming by feel in a venue where you can barely see the sails — the hardest trim record in the game, on purpose. |
| + | **Goblin** (Goblin Shark) · bench | Deep Dark | Win at Glowtide having hit no unlit rock, three races running. The deep-sea nightmare belongs in the dark venue; the eighth shark. |

## 9 · Glacier Sound `arctic` — Wes's own sketch (6)

Mechanics: hardest wind in the game · drifting bergs and floes · a calving front
that reshapes the return leg mid-race · fixed katabatic gust lanes.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Bluff** (Polar Bear) | The Witness | First win at the Sound. |
| 2 | **Tiny** (Krill) | Untouched | **Finish a race at the Sound without hitting any ice.** *(was: Sound win with average wind ≤ 7 kn)* Wes's own replacement, and it fixes a real bug in the draft: Glacier Sound has the highest gust bias in the game (0.75–0.95), so a ≤7 kn average there was somewhere between vanishingly rare and *impossible* — the achievement was a lie. The new one is the venue's actual mechanic, and the smallest critter in the file threading the biggest hazards is the joke the character was built for. |
| 3 | **Pebble** (Adelie Penguin) | Precision | Set the Sound track record. "Precise and unshakable," now demonstrably. |
| 4 | **Chime** (Beluga) · NEW | Count the Pods | **Sight every orca pod on the course in a single race.** Wes's own example. The orca sequence is already a declared manifest asset; this makes the fleet look up. The beluga is the "sea canary" — the arctic whale that talks constantly, and the one that knows where the orcas are because its life depends on it. |
| 5 | **Fathom** (Orca) | Deep Water | Set the Sound **manual-trim** record. *(moved from "win your first regatta," which is now Anchor's)* Wes tied the orca to the arctic hard and the draft had him floating loose on a general milestone. At +13 he's the second-strongest trim reward in the game, arriving at the hardest venue in it — a boss who introduces himself at the moment you master his water. |
| + | **Relic** (Greenland Shark) · bench | Four Centuries | Finish 25 races at Glacier Sound. A 400-year-old shark for the oldest, coldest water — the one place a pure attendance feat is *characterful* rather than a grind. The seventh shark. |

## 10 · Clubhouse Point `seatrials` — the measuring stick (5 + 1)

Mechanics: **none, by design.** This venue is the eval anchor and its course,
wind and conditions must never change. Its rung-2 "mechanic" is therefore the
absence of one — the benchmark itself.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Zeffir** (Herring Gull) | Always Lifted | First win at the Point. The clubhouse local greets you. *(was the trim master; the local should be the witness.)* |
| 2 | **Compass** (Compass Jellyfish) · NEW | True Baseline | **Finish three consecutive races at the Point within 2.0 seconds of each other.** The only venue where repeatability is the entire point, so its mechanic rung is repeatability. A jellyfish whose bell is patterned with a compass rose, at the venue about the number. |
| 3 | **Pilot** (Pilot Fish) · NEW | The Number | Set the Point track record. The fish that holds station on a shark for its whole life, at zero distance, forever. |
| 4 | **Trace** (Ghost Pipefish) · NEW | The Ghost | **Beat your own standing Point record by less than 0.10 seconds.** The measuring-stick venue's perfect secret: you didn't sail a better race, you sailed *the same race, slightly better*, which is the hardest thing on this water and completely invisible to anyone watching. |
| 5 | **Wick** (Storm Petrel) · NEW | Mother Carey's | Set the Point **manual-trim** record. Mother Carey's chickens — the sailor's own bird, tiny, and crossing oceans by pattering on the surface. Sketch at +5 to clear the trim floor. |
| + | **Scoop** (Pelican) | Club Champion | Win a full-length Clubhouse series. *(series)* |

## 11 · Spoonbill Flats `flats` — ebb and sandbar

Mechanics: a single `tidePhase` drives falling depth and building flow · a short
channel that closes mid-race · drying bars that arrive · withies · eddy lines.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Petal** (Spoonbill) | The Witness | First win at the Flats. |
| 2 | **Skitter** (Mudskipper) | Last Passage | **Take the short channel on the final lap it is still passable, and win.** The venue is the only course in the game that is a different racecourse on the last lap; this is the feat of knowing precisely when it stops being one. The fish that thrives exactly where water becomes not-water. |
| 3 | **Curl** (Curlew) · NEW | High Water | Set the Flats track record. The venue was specced as "Curlew Flats" before the art landed on spoonbills — the curlew keeps a place here by right, and its call is the sound of an emptying estuary. |
| 4 | **Wink** (Fiddler Crab) · NEW | The Signal | **Round the withy that only shows at low water.** A marker that is not a mark, on ground that was underwater at the gun, findable only by someone who watched the tide instead of the fleet. Fiddler crabs wave one oversized claw from newly-exposed mud — the flats' own semaphore. |
| 5 | **Rake** (Oystercatcher) · NEW | Prise It Open | Set the Flats **manual-trim** record. The loudest, boldest, most precise bird on any mudflat, with a bill built for one job it does perfectly. |

## 12 · Emberfall Isle `volcanic` — ash and ember

Mechanics: volcanic cones AS the marks, erupting on a learnable cycle · drifting
pumice rafts (soft drag) · steam columns as fixed dead air · submerged glowing
vents.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Ember** (Firefish) | Namesake | First win at Emberfall. |
| 2 | **Torch** (Fire Salamander) | Between Vents | **Round every cone between eruptions in one race** — never waiting, never caught. The venue's question is *round it now or wait for the vent?*, asked at every mark, and this is answering it right every time. |
| 3 | **Basalt** (Marine Iguana) · NEW | Black Rock | Set the Emberfall track record. The only lizard on Earth that feeds in the sea, sunning itself lava-black on volcanic rock — it is this venue in one animal, and it is *at least part aquatic* by a wide margin. |
| 4 | **Vent** (Yeti Crab) · NEW | Vent Hunter | **Sail over every submerged glowing vent on the course in one race.** They already exist as a readable hazard scattered between the marks; the secret is seeking out the thing everyone else is avoiding. Yeti crabs live on hydrothermal vents and farm bacteria on their own furry arms, which is the strangest true fact available to this roster. |
| 5 | **Soot** (Sooty Tern) · NEW | Ash Rider | Set the Emberfall **manual-trim** record. Sooty terns nest by the million on volcanic islands and stay airborne for years at a stretch without landing. |

## 13 · Fallwater Fjord `fjord` — walls and downdrafts

Mechanics: waterfall downdrafts as a slalom of gust bombs, alternating down
opposite walls · scree fans narrowing the channel · sheer walls with no recovery
room.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Skerry** (Puffin) | The Witness | First win in the Fjord. |
| 2 | **Plunge** (Gannet) | Through the Fall | **Punch through every downdraft patch in one race and finish upright, and win.** *(was: fjord win with average wind ≥ 18 kn)* The venue's signature moment is punching through a fall at speed, and the gannet is the bird that hits the water at 60 mph on purpose. A wind-average rung here would just be Bulkhead in a fjord. |
| 3 | **Banks** (Atlantic Cod) · bench | Grand Banks | Set the Fjord track record. |
| 4 | **Gape** (Basking Shark) · NEW | Behind the Fall | **Find the sea cave behind the largest waterfall.** The one venue whose geography can hide a room. Basking sharks cruise fjord surfaces with their mouths open and are the second-largest fish alive — the ninth shark, and a gentle one for a frightening venue. |
| 5 | **Spray** (White-tailed Sea Eagle) · NEW | The Wall | Set the Fjord **manual-trim** record. Europe's largest eagle, which fishes fjords and nests on the cliff faces this venue is made of. The northern echo of Talon, and the same +high trim reward for the same reason. |

## 14 · Flamingo Reach `wetland` — shallows and sedge

Mechanics: braids narrower than the fleet, so boats go single file · sedge
islands blocking sight lines · mud banks at every bend · junctions as the only
place to pass · the flock erupting across your bow.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Strut** (Flamingo) | The Witness | First win at the Reach. |
| 2 | **Silver** (Tarpon) · NEW | The Junction | **Win a race in which every place you gained was taken at a junction.** The venue exists to make passing nearly impossible and then hand you three or four moments where it isn't; this says you took all of them and forced nothing in between. Tarpon roll through shallow marsh channels and are the biggest thing that fits. |
| 3 | **Sedge** (Scarlet Ibis) · NEW | Reach Record | Set the Reach track record. The most saturated bird alive, in the venue whose whole art brief is "own a colour nobody else has." |
| 4 | **Kite** (Snail Kite) · NEW | Flush the Flock | **Put the flock up three times in one race.** Wes's own pattern from the Glacier Sound sketch — the flock erupting across your bow is the venue's signature moment, so make it something you can go and cause. The snail kite is a marsh raptor that hunts apple snails at walking pace, and the name is free spinnaker wordplay the game will never stop earning. |
| 5 | **Quill** (Anhinga) · NEW | Snakebird | Set the Reach **manual-trim** record. Swims submerged with only its neck above water, then has to hang itself out to dry — the least aerodynamic, most committed bird in the marsh. |

## 15 · Reef 2 `TBD` — sketch, venue unspecced

Bench characters already reserved here: **Fizz** (Sea Goldie) and **Blacktip**.
Whatever the spec lands on, it must not repeat Pearl Lagoon's squalls-and-reef-
pass — the obvious unclaimed reef hooks are **a tidal atoll pass** (current
through a gap that reverses) or **a wall/drop-off** (one side of the course has
no bottom and different water).

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Blacktip** (Blacktip Reef Shark) · bench | The Witness | First win at Reef 2. The tenth shark, and the reef needs a reef shark. |
| 2 | **Fizz** (Sea Goldie) · bench | *TBD* | The mechanic rung, once the mechanic exists. |
| 3 | *TBD* · NEW | | Track record. |
| 4 | *TBD* · NEW | | Venue secret. |
| 5 | *TBD* · NEW | | Manual-trim record. |

## 16 · Tide Pool `TBD` — sketch, venue unspecced

**The pitch, since there isn't a spec yet.** The only venue where the *scale* is
the joke: a racecourse the size of a bathtub, boats the size of a thumbnail,
everything enormous. Its unclaimed mechanic is **the surge** — wave sets break
over the rim on a rhythm you can learn, flooding the pool with a shove that
moves every boat and then drains back out through the same gap. That's a timing
mechanic no other venue has (Spoonbill's tide is slow and one-way; this is fast
and cyclic), and it makes every rounding a question of *now or after the next
set?* Add kelp and surfgrass for drag, urchin-studded rock for hard edges, and
the whole thing is a Round the Cans course you could hold in your hands.

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Nook** (Tidepool Sculpin) · NEW | Knows the Pool | First win at the Tide Pool. The fish that can breathe air, survives being stranded, and finds its way back to its own individual pool from anywhere on the shore. |
| 2 | **Surge** (Gooseneck Barnacle) · NEW | Ride the Set | **Round three marks on the surge in one race** — arriving as the set pushes rather than after it. Gooseneck barnacles live only where the water hits hardest, and feed by throwing an arm into the wash. *(Distinct silhouette from Grip's acorn barnacle: stalked, clustered, on wave-battered rock. Flag for the livery test.)* |
| 3 | **Scar** (Owl Limpet) · NEW | Home Scar | Set the Tide Pool track record. Limpets graze away and then return to *the exact same millimetre of rock* every tide, grinding a scar shaped like themselves. There is no better animal for a record. |
| 4 | **Trinket** (Decorator Crab) · NEW | Collector | **Visit every pool on the course in one race** — including the ones no leg touches. The decorator crab glues everything it finds onto its own shell, which is what a completionist looks like from underneath. |
| 5 | **Plate** (Gumboot Chiton) · NEW | Won't Be Moved | Set the Tide Pool **manual-trim** record. The largest chiton alive, brick-red, armoured, and effectively impossible to prise off — the correct reward for the hardest skill gate at the smallest venue. |

## Duckling Pond `pond` — the tutorial (outside the sixteen)

| # | Character | Title | Earned by |
|---|---|---|---|
| 1 | **Paddle** (Mallard Drake) | Graduation | Complete the sailing school. The voice of the whole tutorial and its closing unlock — see `tutorial.md` §13. |
| 2 | **Fuzz** (Duckling) · NEW | Top of the Class | Complete every lesson without a restart. |
| 3 | **Oar** (Water Boatman) · NEW | Pond Record | Set the Pond track record. An insect literally named for rowing, which rows. |
| 4 | **Puddle** (Pond Snail) · NEW | The Long Way | **Sail a full lap of the pond escorted by the whole duckling line.** |
| 5 | **Wisp** (Great Crested Grebe) · NEW | Water Dance | Set the Pond **manual-trim** record. The bird that runs across the water on its feet. |

*Reduced stakes throughout: this is where a seven-year-old meets the game, and
"set the manual-trim record on the pond" should be the friendliest version of
that sentence in the file.*

## Reserved characters whose venues may be cut

| Character | Venue | Fallback if the venue is cut |
|---|---|---|
| **Petal**, **Skitter**, **Curl**, **Wink**, **Rake** | Spoonbill Flats | 10 career podiums · win from last at halfway · a Record Collector tier · Ambush burgee promotion · a general trim feat |
| **Ember**, **Torch**, **Basalt**, **Vent**, **Soot** | Emberfall Isle | win 5 in a row · wire-to-wire twice · a Record Collector tier · Grand Tour promotion · a general trim feat |
| **Skerry**, **Plunge**, **Banks**, **Gape**, **Spray** | Fallwater Fjord | top-3 from the worst start · any win ≥ 20 kn · a Record Collector tier · Shutterbug promotion · a general trim feat |
| **Strut**, **Silver**, **Sedge**, **Kite**, **Quill** | Flamingo Reach | win 3 regattas · 5 junction passes in a race · a Record Collector tier · Hunter tier promotion · a general trim feat |

**Don't leave twenty ghosts.** With four unbuilt venues carrying five characters
each, the "reserved rots if the venue slips" risk is now five times larger than
it was in the Aug 3 draft. Rule: **a venue that slips two build cycles gets its
witness promoted to a general achievement and the other four go back on the
bench** — a silhouette teaser is a promise, and four of them per unbuilt venue is
four promises.

---

# Part 3 · Burgees — the second layer

Characters are the premium currency; burgees absorb everything else. Small
pennant flags (the actual yacht-club object) for micro-feats, shown on your
profile band and as tiny flags up your backstay in the pre-race screen.

- **A character is a story; a burgee is a stat.** Characters mark firsts and
  masteries. Burgees mark moments and accumulations.
- **Burgees tier and repeat; characters never do.**
- **No burgee is ever a prerequisite for a character.** The layers never chain.

Rows added or changed this pass are marked ★ — most of them are criteria that
were demoted out of the character map when a better one arrived.

| Burgee | Earned by | Notes |
|---|---|---|
| Frame Perfect | Start within 0.1s of the gun | Legendary-rare by design. |
| Holeshot | First across the start line | Single-race version of Clutch. |
| Fashionably Late | Cross the start last and still gain a place by mark 1 | The joke version of Dozer's feat. |
| Spin Cycle | Serve 2 penalties in one race and still finish top-half | Sequel to Wiggle's freebie. |
| Silverware | First top-3 finish | |
| ★ Steady On | Top-5 in 5 consecutive races (tiers: 5 / 10 / 20) | Anchor's old criterion — a streak nobody notices they're on is a burgee, not a character. |
| Ambush | Gain 2+ places on a single leg | Rift's old criterion. |
| ★ Dead Heat | Finish within 0.5s of any rival · **finish within a boatlength of the winner without winning** · finish within 0.1s | Latch's old criterion becomes tier 2. |
| ★ One Tacker | Round the top mark top-3 with ≤1 tack on the beat | Grip's old criterion. |
| Venue Regular | 10 races at one venue (tiers: 10 / 25 / 50) | |
| Century | 100 career races (tiers: 100 / 250 / 500) | |
| Hat Stand | Win streak tiers: 3 / 5 / 8 / 10 | |
| Record Collector | Set a venue record / hold 5 at once / hold all 16 | The bests store already exists; now so do the boards. |
| ★ Clean Season | 10 / 25 / 50 consecutive penalty-free races | Tier 1 is Stripes' old criterion, freed when he joined the shark ladder. |
| ★ Wooden Spoon | Finish last overall in a regatta · **finish last 5 times** · 25 times | Splat's old five-times criterion becomes tier 2 — the tiers are the joke; the character is the gift. |
| Hull Speed | Boatspeed tiers: 12 / 14 kn | Continues past Skim's 10. |
| The Doldrums | Finish top-half in a race with a leg you averaged under 5 kn | Parked, and didn't quit. |
| Heavy Weather | Finish a race averaging 20+ kn of wind | |
| Passage Maker | Career distance: 25 / 100 / 250 nm | The odometer flag Wes asked after. |
| Corinthian | Win with auto-trim AND nav aids off | The "I sail it myself" flag. |
| Grand Tour | Start a race at every venue | Before Cruz's winning them all. |
| Negative Split | Sail your fastest leg on the final leg | |
| Good Duck | Pass within a boatlength **astern** of a starboard-tack boat, no penalty | The duck-behind half of Latch's cross-ahead. |
| Starboard! | Force a port-tack boat to duck or tack, holding starboard | |
| Luffing Rights | As leeward boat, force a windward boat to alter course | |
| Hunter | Career overtakes: 50 / 250 / 1000 | Frenzy's career-long shadow. |
| ★ Circuit | Win regattas at 3 / 5 / 10 different venues | A series idea that tiers, so it lands here rather than taking a character. |
| ★ Wire to Wire | Lead a regatta after every race of it | Ditto — and Titan already implies it. |
| Shutterbug | Save a race screenshot | |
| Burgee Burgee | Earn 10 other burgees | |

Two families worth building as systems, not rows:

- **Par times.** Bronze/Silver/Gold/Commodore per venue+course card. The venue
  document's `provisional` field is already the seed for this — one authored
  number per venue exists today; a medal ladder is three more.
- **Skill moments.** One-race counters worth celebrating in the results screen
  with no flag attached: boats passed, gusts ridden, shifts caught, clean
  roundings, gators dodged. The results screen is the audition stage; anything
  consistently thrilling graduates to a burgee.

Anything dreamed up later lands here by default, and is only promoted to a
character criterion if it genuinely improves that character's story.

---

# Part 4 · The audit

## Counts

| Family | Characters |
|---|---|
| Starting ten | 10 |
| A · First Season | 9 |
| B · Start Line | 3 |
| C · Clean & Dirty | 2 |
| D · Close Racing | 3 |
| E · Leg & Mark Craft | 7 |
| F · Boat Handling & Conditions | 8 |
| F2 · Legal Aggression | 3 |
| F3 · Odometer | 2 |
| G · Prestige | 2 |
| F · Boat Handling — Mola (bench) | +1 |
| S · Series | 11 *(+2 counted at their venues)* |
| H · Shark Pack | 8 *(+5 counted at their venues, +Lash future)* |
| Venue tracks (16 racing venues) | 84 |
| Duckling Pond | 5 |
| **Total** | **160** |

**The roster grows by 60%, and that is the correct answer to Wes's "we may need
more characters and that's okay."** The forcing function is arithmetic: five
rungs × sixteen venues is eighty characters before a single general feat, and the
Aug 3 map only had thirty-seven across ten venues.

**60 characters remain unbuilt**, of which 12 were already sketched before this
pass (7 bench: Beau, Woebegone, Bruiser, Banks, Fizz, Sway, Mola · 5 sharks:
Lash, Relic, Goblin, Blacktip, Dapple) and **48 are new in this pass** — 45
named, 3 still unnamed at Reef 2. By venue: Cove 3, Lake 2, Bayou 1, River 1,
Ocean 2, Redrock 3, Arctic 1, Clubhouse 4, Flats 3, Emberfall 3, Fjord 2,
Reach 4, Reef 2 ×3, Tide Pool 5, Pond 4 = 41. General: Spin, Corsair, Tempo,
Titan, Lance, Huddle, Renew = 7. Full build list in `roster-ranking.md`.

**Are there holes?** Three, and they're worth naming:

1. **Crustacean saturation.** Cheer, Pinch, Scuttle, Clutch, Crush, Etienne,
   Wink, Vent, Surge, Trinket — ten, and four of them crabs. The tide pool is
   the worst offender by nature. Before building, check the picker at portrait
   scale: two crabs that read the same is a worse problem than a missing one.
2. **Three billfish** (Spar, Torrent, Lance) and now **twelve sharks**. The
   sharks are a deliberate collection and can carry the load; the billfish are
   not a set and should be differentiated hard in the art or one should change
   species.
3. **The mammal shortage flipped.** The Aug 3 pass stripped mammals out of the
   starting ten for good reasons; this pass adds moose, bear, porpoise, beluga,
   humpback and bat. That's fine — they're spread across six venues — but the
   *aquatic-mammal* slots at any single venue should stay at one.

## Pacing

A first session plausibly earns Ripple, Scuttle, Wiggle and maybe Crush — three
or four real characters with faces in the first hour, several of them in the same
race. Then the venue tracks pay a witness per venue visited, so touring the venue
list is itself a harvest. Mid-game is mechanic rungs and records; late game is
trim boards, series consistency and secrets; endgame is Sovereign, Dapple, Cruz
and Muninn.

Rough phases: **~15 in the first few sessions · ~50 through venue witnesses and
mechanic rungs · ~35 through records and series · ~30 through trim boards and
secrets · ~10 endgame.**

**The secrets are the retention layer and should be paced as such.** Sixteen of
them, worth roughly a tenth of the roster, none of them findable by playing
optimally. That's the mechanism that makes a player go back to a venue they've
already "finished."

## The difficulty curve

Every unlock is also a new opponent, so the achievement map IS the difficulty
curve. The Aug 3 audit's shape survives this pass, with one deliberate change:
**the trim-master cohort is now sixteen boats, not ten, and it is the last power
wave in the game.** The standing rule holds and extends — **a trim master must be
a +3 or better boat**, because manual trim is the hardest skill gate in the game
and a weak reward behind it is an anticlimax. New trim masters to be statted
accordingly: Wick, Rake, Soot, Spray, Quill, Plate, and Reef 2's.

The other rule that survives: **the home venue pays the gentlest trim reward**
(Piper, +4) and **Redrock pays the apex** (Talon, +13), with Fathom (+13) now
matching him at Glacier Sound — correct, because those are the two venues that
punish you hardest for being there.

Two things this pass makes *easier* on purpose:

- **Splat on your first last place** puts a beloved character in the hands of a
  struggling player at the exact moment they need one, and he's a −13 boat, so
  the fleet gets *friendlier* at the moment the player is losing.
- **Tiny's ice rung** replaces a criterion that was unreachable at its own venue.
  A player could have chased the old one forever.

And one this pass makes harder: **Frenzy at 15 overtakes**, which Wes correctly
identified as "you won the race" at 9.

## Risks

- **Ambient-event telemetry is the new long pole.** Nine mechanic rungs and most
  of the sixteen secrets need the ambient layer to emit events (gulls scattered,
  gators submerged, orcas sighted, flock flushed, whale blown). Nothing else in
  this document is expensive; this is. Ship venue rungs 1/3/5 first — they run
  entirely on systems that already exist — and let 2/4 land per venue as the
  events do.
- **Twenty reserved characters across four unbuilt venues.** See the promotion
  rule above.
- **Wind-band achievements must be checked against each venue's actual range**
  before they ship. Tiny's old ≤7 kn at the windiest venue in the game is the
  cautionary tale, and Saffron (≤8 kn at the lagoon) and Croak (≤6 kn at the
  bayou) need the same check when wind regions are tuned.
- **Hidden count.** Now 8 gag/hidden characters (Splat, Knot, Skip, Lateen, plus
  the four gag-adjacent secrets) on top of 16 venue secrets. The venue secrets
  are a *system* with its own affordance — a "?" slot on the venue card — so
  they don't dilute the hidden gags. But the gag count should not grow past 8.
- **Record achievements and course cards.** Records are keyed by leg count. If
  course cards ship with multiple leg counts per venue, "the venue record" must
  pin to the canonical card or it becomes farmable on a 2-leg sprint.

## Ship order

1. **Career store + unlock store + unlock queue.** Nothing works without these.
2. **Venue rungs 1, 3, 5 — all sixteen venues.** 48 achievements on systems that
   already ship (`regatta_records` gives 32 of them for free, and the authored
   provisional targets make them meaningful from race one). This is the single
   biggest block of finished-today content in the document.
3. **General families A–G.** Another ~40, mostly on existing telemetry plus four
   small counters.
4. **The series system**, and the 13 achievements that need it — including
   discards, without which Renew and Huddle can't exist.
5. **Ambient events**, and with them venue rungs 2 and 4, per venue as the events
   land.

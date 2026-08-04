# Achievements — How the Ninety Are Earned

*Aug 3 2026. Companion to `roster-ranking.md`. The starting ten (Bixby, Bruce, Cheer,
Pinch, Glide, Wobble, Sunshine, Tangle, Whiskers, Roll) are free; the other ninety are
achievements. This doc designs the base cases, assigns all ninety, and audits how the
design shakes out against what the code actually tracks today.*

---

## Base cases — the rules the whole system obeys

1. **One achievement, one character.** No points, no currencies, no duplicate paths.
   The achievement IS the character's story: you earned Snap by out-sailing an old
   salt; that's why he's on your shelf.
2. **Evaluated once, at `showResults()`.** Every criterion below is decidable from
   (a) the race that just ended and (b) a small career store. Nothing is checked
   mid-race; nothing needs a server.
3. **Earned characters become opponents.** The fleet you race is drawn from your
   unlocked pool. Day one that pool is exactly ten — a full race, as required. Every
   unlock makes the fleet deeper *and* meaner (unlock order ≈ difficulty curve,
   since monsters like Mistral and Muninn come late).
4. **Rivalry rules.** "Beat X" achievements only count races where X actually raced.
   Early pools are small, so seeded rivals (the starters) are nearly always present;
   chained rivals (Blaze → Anvil) are present because you just unlocked them and new
   unlocks should be **guaranteed a fleet slot for their next 3 races** — the game
   introduces your new rival to you.
5. **Visible but not spoiled.** The character picker shows earned characters plus
   silhouettes with hint text for the *next few achievable* (venue-gated ones appear
   under their venue card, not in the global list). Deep gags (Splat, Grip, Lateen)
   stay hidden until earned — discovery is the reward.
6. **Reserved characters ship with their venues.** Eight characters belong to the
   five unbuilt venues. They stay out of the pool entirely until the venue lands —
   a silhouette teaser on the venue's "coming soon" card, never a dead achievement.
7. **Regatta lengths: 4, 8, 10, or full.** (Planned formats — not built yet.)
   Unless an achievement says otherwise, *any* length counts: winning a 4-race
   regatta earns Fathom just fine, and the longer formats are naturally harder
   versions of the same feat. Only two achievements are length-gated, both
   witness-grade: **Pearl's sweep requires 8+ races** (sweeping a 4-racer is a hot
   streak, not flawlessness) and **Scoop's Club Championship requires the full
   series** (beer-can racing is a season, not a weekend). Everything else stays
   length-blind so short regattas remain the on-ramp, not a loophole.

## What must be built or tracked (the honest dependency list)

| System | Status in code | Needed by |
|---|---|---|
| Career store (`regatta_career`): races, wins, podiums, streaks, per-venue wins, per-rival head-to-heads, clean-race streak | **new** | nearly everything |
| Unlock store (`regatta_unlocks`) + fleet-draw from pool | **new** | everything |
| Regatta/series (4, 8, 10, or full races; low-point scoring) | **missing** — results screen comment already anticipates it (`script.js:7644`) | 12 achievements |
| Finish place, DNF | exists | — |
| Start-cross order | exists (splits record start position) | Clutch, Dozer |
| Gun-to-line delta | exists (`startTimeDisplay`, ms precision, `script.js:13782`) | Crush, Frame Perfect burgee |
| Penalty served/cleared | exists (`penaltyTurnsOwed` queues and drains, `script.js:8247`) | Stomp, Frenzy, Skip |
| Per-mark place splits | exists (`raceState` splits) | 12 achievements |
| Penalties / OCS, incl. AI penalties | exists | 8 achievements |
| Average wind for the race | exists (results header logging, `script.js:8258`) | 7 achievements |
| Venue bests (time + place) | exists (`regatta_bests`) | Skim, record achievements |
| Finish margins (time/distance to boats ahead/behind) | **new, small** — finish times exist, need gaps kept | Pulse, Latch, Popper, Crimson |
| Tack counter | **new, small** (heading crossings) | Viper, Grip |
| Max boatspeed this race | **new, trivial** (speed is on the HUD every frame) | Skim, Hull Speed burgee |
| Per-leg average speed | **new, small** (leg times exist in splits; leg distance from course geometry) | Doldrums, Negative Split burgees |
| Career distance odometer | **new, trivial** (`unitsToKm` already computes race distance) | Passage Maker burgee |
| Assist flags at race end | exists (`settings.autoTrim`, `settings.navAids`) | Corinthian burgee |
| Per-boat sailed distance | exists (`raceState.legDistances`, every boat, `script.js:12759`) | Dart, Flicker |
| Overtake events (live place swaps vs a specific boat, 10s debounce) | **new, small** (live standings already computed for the HUD) | Frenzy, Hunter burgee |
| Give-way attribution (AI avoidance fires while player is `rowBoat`, with reason) | **new, small** — `rules.js` already computes ROW owner + reason per pair; needs only the hook on AI avoidance | Spike, Starboard!/Luffing Rights burgees |
| Spinnaker-hoist flag | **new, trivial** (hoist event exists) | Lateen |
| Lead-change count | **new, small** (derivable from splits + live leader) | Chroma |

---

## The ninety, by family

### A · First Season — general milestones, earnable anywhere (11)

| Character | Title | Earned by |
|---|---|---|
| **Ripple** (Dolphin) | Welcome Aboard | Finish your first race. The day-one gift. |
| **Wiggle** (Axolotl) | On the Podium | First top-3 finish. |
| **Scuttle** (Hermit Crab) | Clean Hands | Finish a race with zero penalties. |
| **Fathom** (Orca) | Champion | Win your first regatta. *(series)* |
| **Anchor** (Sea Turtle) | Steady On | Top-5 in 5 consecutive races. |
| **Skim** (Flying Fish) | Airborne | Hit 10 knots of boatspeed. That's the planing threshold (`PLANING.speedMultiplier` kicks the hull to 13+ in a blow) — the moment the boat leaves the water is the moment you earn the fish that leaves the water. (Her old criterion, "beat a venue record," lives on as the Record Collector burgee's first tier.) |
| **Zing** (Flying Squirrel) | The Comeback | Win after rounding the first mark dead last. |
| **Splat** (Blobfish) | Still Afloat | Finish last 5 times — and keep showing up. Hidden gag; the loss that pays out. |
| **Snap** (Snapping Turtle) | Respect Your Elders | Finish directly ahead of Whiskers (a starter, so always available). |
| **Hug** (Sea Star) | Ironclad | Finish 25 races. |
| **Cruz** (California Newt) | Mid-Fleet Zen | Finish exactly 5th, 3 times. The +2-everything newt, earned by perfect averageness. Hidden gag. |

### B · The Start Line (3)

| Character | Title | Earned by |
|---|---|---|
| **Crush** (Mantis Shrimp) | Gun Fighter | Cross the line within 1.0s of the gun. The fastest strike in the ocean, earned by timing, not luck — `startTimeDisplay` already measures this to the millisecond. (Sub-0.1s is the Frame Perfect burgee, below.) |
| **Clutch** (Red Rock Crab) | Line Boss | First across the start, 3 races running. (First across once is a burgee.) |
| **Skip** (Green Basilisk) | Trigger Happy | Go OCS, restart, and still win. Hidden until first OCS. |

### C · Clean & Dirty (4)

| Character | Title | Earned by |
|---|---|---|
| **Stripes** (Tiger Shark) | No Mistakes | 10 consecutive races without a penalty. |
| **Regal** (Mute Swan) | White Gloves | Win a regatta with zero penalties. *(series)* |
| **Stomp** (Blue-Footed Booby) | Shake It Off | Serve a penalty turn and clear it. Deliberately easy: your first penalty is the game's worst moment, and this flips it into a gift — the clumsy booby arrives to say everyone stomps sometimes. |
| **Bramble** (Sea Urchin) | Untouchable | Take zero penalties in a race where 3+ rivals get penalized. |

### D · Close Racing (4)

| Character | Title | Earned by |
|---|---|---|
| **Pulse** (Tree Frog) | Photo Finish | Win by less than a boatlength. |
| **Latch** (Remora) | Shadow | Finish within a boatlength of the winner — without winning. |
| **Flare** (Fighting Fish) | Grudge Match | Beat the same rival 5 races in a row. |
| **Popper** (Pufferfish) | Hold the Door | Win with 2nd place within 3 lengths at the final mark. |

### E · Leg & Mark Craft (8)

| Character | Title | Earned by |
|---|---|---|
| **Flaunt** (Anemone Shrimp) | Wire to Wire | Lead at every mark and win. |
| **Rift** (Moray Eel) | Ambush | Gain 2+ places on a single leg. |
| **Vex** (Water Dragon) | Daylight Robbery | Take the lead on the final leg and win. |
| **Needle** (Gharial) | Threading | Gain at least one place on every leg. |
| **Sable** (Cormorant) | Perfect Roundings | Never lose a place at any mark, whole race. |
| **Brine** (Manatee) | Immovable | Your place never worsens after mark 1; finish top-3. |
| **Flash** (Mackerel) | Runline | Take the lead on a downwind leg and win. |
| **Splash** (Hippo) | Kite Carnage | Gain 3+ places on downwind legs in one race. |

### F · Boat Handling & Conditions (7)

| Character | Title | Earned by |
|---|---|---|
| **Frond** (Leafy Seadragon) | Whisper Wind | Win with average wind ≤ 7 kn. |
| **Bulkhead** (Elephant Seal) | Storm Wall | Win with average wind ≥ 18 kn. |
| **Chroma** (Cuttlefish) | Mind Changer | Take the lead 3 separate times in one race, and win. |
| **Crimson** (Red Snapper) | Surgical | Win by 30+ seconds. |
| **Viper** (Tree Snake) | Tacking Duel | Win a race with 12+ tacks. |
| **Grip** (Barnacle) | One Tack Mind | Round the top mark top-3 with ≤ 1 tack on the beat. Hidden gag. |
| **Lateen** (By-the-wind Sailor) | One Sail, Forever | Win without ever hoisting the spinnaker. Hidden; the sailing-nerd badge. |

### F2 · Legal Aggression (2)

Racing's third food group after clean and fast: *forcing*. Both feats reward making
rivals flinch **within the rules** — and both are void if you take any penalty that
race. The reward is never for contact; it is for making the rulebook your weapon.
(`rules.js` already computes the right-of-way owner and the reason for every boat
pair, so a "force" = the AI's avoidance firing against a player who holds ROW.)

| Character | Title | Earned by |
|---|---|---|
| **Frenzy** (Piranha) | Feeding Frenzy | Overtake 9 boats in one race, no penalties. Nine gross passes in a ten-boat fleet reads as "ate through the whole fleet" — debounce re-passes of the same boat (10s) so a luffing duel can't be farmed. (Moved from the bayou table; his old win-with-a-penalty criterion is covered by the Spin Cycle burgee.) |
| **Spike** (Narwhal) | Makes His Own Right of Way | Force 5 rivals to give way in one race — duck, tack, or bear away while you hold right of way — with no penalties on you. His personality line already says exactly this; the achievement was hiding in the roster all along. (Moved from the Glacier Sound table.) |

### F3 · The Odometer Pair (2)

Two ways to win a race: sail less than everyone, or sail more than everyone and win
anyway. Per-boat sailed distance already accumulates (`raceState.legDistances`,
summed at `script.js:12759`), so both compare with zero new instrumentation. No
anti-game guard needed on the max side — padding your track while still winning is
self-handicapping, which is its own challenge mode.

| Character | Title | Earned by |
|---|---|---|
| **Dart** (Kingfisher) | Beeline | Win having sailed the *shortest* distance in the fleet. Kingfishers fly dead-straight; his own beat line says "darts only fly straight." Perfect laylines, no overstanding, not a meter wasted. (His old Hat Trick — 3 straight wins — became the Hat Stand burgee's first tier.) |
| **Flicker** (Arctic Tern) | Longest Migration | Win having sailed the *longest* distance in the fleet. The title doesn't even change — the arctic tern owns Earth's longest migration, and now she's earned by going the long way round and winning regardless. Speed forgives distance. (Moved from the Glacier Sound table; her old criterion was the Sound record.) |

### G · Prestige (3)

| Character | Title | Earned by |
|---|---|---|
| **Knot** (Nautilus) | The Long Game | Complete 10 regattas. *(series)* |
| **Mistral** (Swift) | World Tour | Win a race at all 10 venues. |
| **Muninn** (Raven) | The Rememberer | Unlock all 99 other characters. The final character; the only one with a special trait (`windFast`). |

### H · The Shark Pack — a rivalry chain seeded by Bruce (4)

Each unlock becomes the next opponent; the pack is a ladder you climb.

| Character | Title | Earned by |
|---|---|---|
| **Blaze** (Mako) | Faster Fish | Beat Bruce (starter) 3 consecutive races. |
| **Anvil** (Hammerhead) | Harder Fish | Beat Blaze 3 consecutive races. |
| **Dozer** (Nurse Shark) | Wide Awake | Cross the start line dead last, then finish on the podium — he sleeps through the start and wakes up near your transom, and so did you. |
| **Razor** (Barracuda) | Apex | Own every shark: Bruce, Blaze, Anvil, Stripes, Dozer. Capstone. |

### I · Venue tracks — the ten live venues (37)

The template per venue: **first win → the witness/local**, then deeper feats. Venue
achievements live on the venue card, so lagoon players see lagoon goals.

**Lighthouse Cove `bay`** — the starter venue; most general milestones happen here anyway.
| **Piper** (Sanderling) | Home Waters | Win a regatta at the Cove. *(series)* |
|---|---|---|

**Stillwater Lake `lake`**
| Character | Title | Earned by |
|---|---|---|
| **Lunker** (Largemouth Bass) | Trophy Catch | First win at the Lake. |
| **Torpedo** (Pike) | Knows the Water | Win at the Lake 3 times — he hunts from memory; so did you. |

**Pearl Lagoon `lagoon`** — the flagship venue carries the reef pack.
| Character | Title | Earned by |
|---|---|---|
| **Jester** (Clownfish) | Found Him | First win at the Lagoon. |
| **Saffron** (Seahorse) | Light Touch | Lagoon win with average wind ≤ 8 kn. |
| **Puff** (Mandarin Dragonet) | Lagoon Local | 5 lagoon podiums. |
| **Breeze** (Nudibranch) | House Style | Set the lagoon venue record. |
| **Nimbus** (Eagle Ray) | Glide Path | Win a lagoon regatta. *(series)* |
| **Pearl** (Oyster) | Flawless | Sweep a lagoon regatta of 8+ races — win every one. *(series)* |
| **Ribbon** (Sea Krait) | Silk Line | Lagoon win with no place lost at any mark. |
| **Sovereign** (Napoleon Wrasse) | Reef Royalty | Own all seven reef characters above. Capstone. |

**Gatorgrass Bayou `swamp`**
| Character | Title | Earned by |
|---|---|---|
| **Chomp** (Crocodile) | The Witness | First win at the Bayou. |
| **Croak** (Bullfrog) | When the Wind Dies | Bayou win with average wind ≤ 6 kn. |
| **Etienne** (Crayfish) | Bayou Classic | Win a bayou regatta. *(series)* |

**Sockeye Run `river`**
| Character | Title | Earned by |
|---|---|---|
| **Slipstream** (Sockeye) | The Witness | First win on the Run. |
| **Seam** (Rainbow Trout) | Reading Water | Set the river venue record. |
| **Riffle** (American Dipper) | River Regular | 3 river podiums. |
| **Snag** (Hellbender) | Older Than the River | Win a river regatta. *(series)* |

**Bluewater Bonanza `ocean`**
| Character | Title | Earned by |
|---|---|---|
| **Spar** (Blue Marlin) | Big Game | First win on the Bonanza. |
| **Torrent** (Swordfish) | Blue Streak | Set the ocean venue record. |
| **Talon** (Bald Eagle) | The Strike | Ocean win with average wind ≥ 16 kn. |
| **Finley** (Yellowfin) | Bluewater Champion | Win an ocean regatta. *(series)* |

**Redrock Reservoir `redrock`**
| Character | Title | Earned by |
|---|---|---|
| **Gasket** (Beaver) | Built This Place | First win at Redrock — who else builds reservoirs? |
| **Chisel** (Humpback Chub) | Canyon Endemic | Set the Redrock venue record. |

**Glowtide Strait `glowtide`**
| Character | Title | Earned by |
|---|---|---|
| **Lure** (Black Seadevil) | First Light | First win at Glowtide. |
| **Veil** (Vampire Squid) | Dark Passage | Glowtide win with zero penalties. |
| **Drift** (Sea Nettle) | Night Drift | Glowtide podium with average wind ≤ 8 kn. |
| **Bloom** (Man-of-War) | Dumb Luck | Glowtide win having never led until the final gate. Hidden gag. |
| **Prism** (Maxima Clam) | Refraction | Set the Glowtide venue record. |

**Glacier Sound `arctic`**
| Character | Title | Earned by |
|---|---|---|
| **Bluff** (Polar Bear) | The Witness | First win at the Sound. |
| **Tiny** (Krill) | Smallest Sailor | Sound win with average wind ≤ 7 kn. |
| **Pebble** (Adelie Penguin) | Polar Champion | Win a Sound regatta. *(series)* |

*(Glacier Sound is down to 3 unlocks after Spike and Flicker moved to general feats —
same as the Bayou. If it feels thin, the Sound record — Flicker's old criterion — is
an open slot for a future character or a venue burgee.)*

**Clubhouse Point `seatrials`** — the beer-can venue wants series achievements by nature.
| Character | Title | Earned by |
|---|---|---|
| **Zeffir** (Herring Gull) | Regular | Complete a Clubhouse series, any length. *(series)* |
| **Scoop** (Pelican) | Club Champion | Win a full-length Clubhouse series. *(series)* |

### J · Reserved — ship with their venues (8)

Out of the pool until the venue lands; teased as silhouettes on the venue's
coming-soon card. Fallbacks listed in case a venue is cut.

| Character | Venue | Planned criterion | Fallback if venue is cut |
|---|---|---|---|
| **Petal** (Spoonbill) | Spoonbill Flats | First win at the Flats (witness) | 10 career podiums |
| **Skitter** (Mudskipper) | Spoonbill Flats | Win on a falling tide | win from last at halfway |
| **Ember** (Firefish) | Emberfall Isle | First win at Emberfall (namesake) | win 5 races in a row |
| **Torch** (Fire Salamander) | Emberfall Isle | Lead every leg at Emberfall | wire-to-wire twice |
| **Skerry** (Puffin) | Fallwater Fjord | First win in the Fjord | top-3 from worst start |
| **Plunge** (Gannet) | Fallwater Fjord | Fjord win, average wind ≥ 18 kn | any win ≥ 20 kn |
| **Strut** (Flamingo) | Flamingo Reach | First win at the Reach (witness) | win 3 regattas |
| **Paddle** (Mallard) | Duckling Pond | Graduate the sailing school | finish 15 races |

---

## Burgees — the second layer, for everything that doesn't earn a character

Characters are the premium currency: 90 exist, each granted exactly once, and the
supply is fixed. But the game generates far more celebratable moments than 90 —
start feats, speed feats, streak tiers, per-venue oddities — and stapling a
character to every one of them would either exhaust the roster or water down the
criteria. The pressure valve is **burgees**: small pennant flags (the actual yacht
club object — the theme does the work) earned for micro-feats, shown on your
profile band and maybe as tiny flags up your backstay in the pre-race screen.

Rules that keep the two layers distinct:

- **A character is a story; a burgee is a stat.** Characters mark *firsts and
  masteries* (first win, venue conquered, rival beaten). Burgees mark *moments and
  accumulations* (a frame-perfect start, 100 career races, a top-speed record).
- **Burgees can tier and repeat** (bronze/silver/gold thresholds); characters never
  do — you can't earn Ripple twice.
- **No burgee is a prerequisite for a character.** The layers never chain, so
  neither cheapens the other.

Seed set, all trackable today:

| Burgee | Earned by | Notes |
|---|---|---|
| Frame Perfect | Start within 0.1s of the gun | The HUD already shows `+0.083s` — this makes that number a target. Legendary-rare by design. |
| Holeshot | First across the start line | The single-race version of Clutch's streak. |
| Fashionably Late | Cross the start last and still gain a place by mark 1 | The joke version of Dozer's feat. |
| Spin Cycle | Serve 2 penalties in one race and still finish top-half | Sequel to Stomp's freebie. |
| Dead Heat | Finish within 0.5s of any rival | The near-miss version of Pulse/Latch. |
| Venue Regular | 10 races at one venue (tiers: 10/25/50) | Per-venue; pairs with the bests panel. |
| Century | 100 career races (tiers: 100/250/500) | The long-haul flag; picks up where Hug's 25 leaves off. |
| Hat Stand | Win streak tiers: 3 / 5 / 8 / 10 | Tier 3 absorbed Dart's old Hat Trick when he took the Beeline. |
| Record Collector | Set a venue record / hold 5 at once / hold all 10 | Tier 1 is Skim's old criterion; the bests store already exists. |
| Clean Season | 25 consecutive penalty-free races | Extends Stripes. |
| Hull Speed | Boatspeed tiers: 12 / 14 kn | Continues past Skim's 10 kn — 14 needs full planing in a real blow. |
| The Doldrums | Finish top-half in a race with a leg you averaged under 5 kn | The patience flag: parked, and didn't quit. Top-half guard stops sandbagging. |
| Heavy Weather | Finish a race averaging 20+ kn of wind | Sailaway ships "Just a Breeze" for 20 kt — survival as trophy translates directly. |
| Passage Maker | Career distance: 25 / 100 / 250 nm | Race distance already computes (`unitsToKm`); the odometer flag. |
| Corinthian | Win with auto-trim AND nav aids off | Named for the real amateur-sailed trophies; the "I sail it myself" flag. |
| Wooden Spoon | Finish last overall in a regatta | The real tradition — clubs award it, players screenshot it. Companion to Splat. |
| Grand Tour | Start a race at every venue | Racing them all, before Mistral's winning them all. |
| Negative Split | Sail your fastest leg on the final leg | Derivable from leg times; the closer's flag. |
| Good Duck | Pass within a boatlength astern of a starboard-tack boat, no penalty | Forza's near-miss skill, translated to right-of-way. ROW proximity is already computed (`giveWayN`). |
| Starboard! | Force a port-tack boat to duck or tack, holding starboard | The call itself is the name. `rules.js` reasons distinguish this from other forces. |
| Luffing Rights | As leeward boat, force a windward boat to alter course | The other classic force; same reason-string attribution. |
| Hunter | Career overtakes: 50 / 250 / 1000 | The boats-passed skill-moment counter, graduated — Frenzy's single-race feat gets a career-long shadow. |
| Shutterbug | Save a race screenshot | The capture feature exists (`regatta-screenshot.png`); Forza's photo-mode achievements prove people love this. |
| Burgee Burgee | Earn 10 other burgees | Every collection system needs one self-referential flag. |

Two burgee families worth building as systems, not rows:

- **Par times (Trackmania's medal ladder).** Bronze/Silver/Gold/Commodore target
  times per venue, authored per venue+leg-count the way `regatta_bests` is already
  keyed. This is the single most repeatable idea in racing games — it gives every
  venue a solo time-attack game with no new content — but it needs authored pars,
  so it's a system, not a row in this table.
- **Skill moments (Forza's accolade feed).** One-race counters worth celebrating in
  the results screen even with no flag attached: boats passed, gusts ridden,
  shifts caught, clean roundings. If any prove consistently thrilling, they
  graduate to burgees; the results screen is the audition stage.

Anything we dream up later ("round a mark inside a boatlength", "win in the rain at
Pearl Lagoon", "beat Muninn") lands here by default, and only gets promoted to a
character criterion if a character swap genuinely improves the roster's stories.

### What the research pass taught (Aug 3 2026)

Patterns pulled from racing games, sailing games, and real yacht-club tradition,
and where each landed:

- **Trackmania: authored par times** are the highest-replay-value achievement idea
  in all of racing → the Par Times family above.
- **Forza: celebrate moments, not just outcomes** (near-miss, drift, photo mode) →
  Good Duck, Shutterbug, and the skill-moments audition system.
- **Sailaway: the simulator's milestones are conditions and odometry** ("Just a
  Breeze" for 20 kt winds, "Around the World" for cumulative distance) → Heavy
  Weather, Passage Maker.
- **Dark Souls' "This is Dark Souls" / Uncharted's "Stage Fright": forgive failure
  with a joke** — the first-failure gift is beloved everywhere it appears → already
  ours via Stomp's penalty freebie, Splat, and the Wooden Spoon.
- **Real sailing tradition is a trophy cabinet waiting to be raided** — the wooden
  spoon (last place), Corinthian trophies (amateur/no-assists), line honours,
  distance-sailed awards → Wooden Spoon, Corinthian, Passage Maker. When a future
  burgee needs a name, raid the cabinet first; the theme does half the work.
- **What we deliberately did NOT take:** contact rewards (Burnout takedowns,
  Wreckfest) — penalties are the game's morality and paying for contact anywhere
  would poison it; and grind-only counters with no story (win 500 races) — tiers
  stop at numbers a devoted player actually reaches.

---

## How it shakes out — the audit

**Count check.** 11 + 3 + 4 + 4 + 8 + 7 + 2 + 2 + 3 + 4 + 34 + 8 = **90** (general
families + legal aggression + odometer pair + prestige + shark pack + venue tracks
+ reserved). Every non-starter character has exactly one achievement; no achievement
grants two characters. Four characters have migrated from venue tables to general
feats as better criteria surfaced (Frenzy, Spike, Flicker — bayou and Glacier Sound
now hold 3 each — plus Dart out of First Season); the pattern to watch is venue
tables thinning further. Three is the floor: below that, a venue stops feeling like
a place with locals.

**Pacing curve.** A first session plausibly earns Ripple (finish), Wiggle (podium),
Scuttle (clean race), maybe Crush (win a start) — 3–4 unlocks in the first hour, each
a real character with a face. The venue tracks then pay one witness per venue visited,
so exploring the venue list is itself a harvest. Mid-game is feats and regattas;
endgame is capstones (Razor, Sovereign), World Tour (Mistral) and finally Muninn.
Rough phases: **~15 unlocks in the first few sessions, ~45 through venue play, ~20
through skill feats, ~10 endgame.**

**The series system is the long pole.** 12 achievements (Fathom, Regal, Knot, Piper,
Nimbus, Pearl, Etienne, Snag, Finley, Pebble, Zeffir, Scoop) need regattas to exist.
Everything else works on the current single-race game. Ship order: career + unlock
stores first (78 achievements live), series second (the remaining 12 — and Fathom the
orca is the flagship reason to build it). When the 4/8/10/full formats land, only
two achievements care which format you sailed (Pearl, Scoop); the other ten light up
with the shortest format on day one.

**Telemetry gaps are small.** New requirements beyond stores: finish margins, a tack
counter, a spinnaker-hoist flag, lead-change count. Everything else (splits, start
order, penalties incl. AI, wind average, venue bests) already exists in
`script.js`.

**Fleet-growth sanity.** Pool grows 10 → 100. Race fleets stay ~10 boats drawn from
the pool: rivals with pending "beat X" chains and the current venue's locals get
draw priority, new unlocks are guaranteed 3 races. The player never races a fleet
they haven't met.

**Deliberate asymmetries.** Lagoon carries 8 unlocks (it's the flagship, per
`venues.md` "build this first"); Redrock and Clubhouse carry 2; the Cove carries 1
because the general milestones all happen there naturally. If a venue needs more
pull later, move a general feat (e.g. Viper's Tacking Duel) onto its card.

**Risks.**
- *Reserved characters rot if venues slip* — fallbacks are listed; decide per venue
  at cut time, don't leave eight ghosts.
- *"Beat X streak" achievements stall if X stops being drawn* — solved by draw
  priority for pending rivals (base case 4).
- *Light/heavy-wind achievements depend on venue wind ranges* — verify each venue
  can actually produce ≤ 7 kn / ≥ 18 kn averages, or the achievement is a lie.
  Croak's ≤ 6 kn at the Bayou and Spike's ≥ 16 kn at the Sound match those venues'
  stated conditions; Saffron/Tiny/Talon thresholds need the same check when wind
  regions are tuned.
- *Hidden gags must stay rare* — currently 6 (Splat, Cruz, Skip, Grip, Lateen,
  Bloom). That's the right count; more and hidden becomes the norm.

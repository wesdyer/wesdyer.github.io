// regatta/js/game/unlocks.js — CHARACTERS ARE EARNED (guidelines/achievements.md).
//
// The starting ten are free; every other character is one achievement. This file is the
// rulebook and the two stores: `regatta_unlocks` (who you have earned, which ceremonies
// you have not seen yet, and the new-rival queue) and `regatta_career` (the small running
// counts a criterion can need beyond the race that just ended).
//
// ⚠️ ONLY THE STARTING TEN ARE FREE; EVERYONE ELSE IS LOCKED (Wes, Sep 24 2026). A character
// with a row in ACHIEVEMENTS shows in the picker as a silhouette with the way to earn them;
// one without a row yet is simply absent — from the picker and from the fleet — until its
// family lands. Adding a row here is what puts a character on the board.
//
// ⚠️ EVALS NEVER SEE ANY OF THIS. Locking shrinks the fleet draw, and every eval number is a
// fleet drawn from the whole roster. Under a driven browser (navigator.webdriver), the eval
// harness, or node's vm (no navigator at all), `enforced()` is false: nothing is locked,
// the draw is the old draw, nothing is awarded. `window.__UNLOCKS = 'on' | 'off'` overrides
// that for a test of this system itself.
//
// Evaluated once per race, from the results page, once the player's place can no longer
// change — see `poll`. Sailing School never reaches it (it has its own results).
//
// Classic script; global scope. Loads after state.js and before screens.js; reads
// AI_CONFIG (roster.js) and `state` only at call time.

const UNLOCKS_KEY = 'regatta_unlocks';
const CAREER_KEY = 'regatta_career';

// Free from race one — roster-ranking.md. One per personality slot, ten hull colours, all
// eight archetypes in the opposing fleet.
const STARTING_TEN = ['Bixby', 'Bruce', 'Cheer', 'Pinch', 'Glide', 'Wobble', 'Sunshine', 'Tangle', 'Whiskers', 'Rift'];

// THE RULEBOOK. One row per earned character, in the doc's order.
//   title   the achievement's name, shown on the ceremony card and the picker
//   hint    the objective, spelled out — shown under the locked silhouette, on the venue
//           card and on the ceremony. NOTHING IS HIDDEN (Wes, Sep 25 2026): every
//           objective says exactly what to do. A function of the venue's target, if it
//           needs one (see hintOf).
//   venue   the venue the objective belongs to; `rung` which of its objectives it is
//           (first-win · mechanic · explorer · target · four-stars · wildlife)
//   test(r, c)  r = this race (see raceFacts), c = the career AFTER this race counted.
//           true grants; false/null does not. null means "not decidable yet" (Snap waits
//           for the boat behind you to finish) — see `poll`.
//   progress(c) optional [have, need] for a counted criterion, shown in the picker
// THE GRAND TOUR: every racing venue (VENUE_ORDER: the thirteen, Clubhouse Point included, not the Sailing School).
// A venue added later joins the set; a character already earned is kept (unlocks never go down).
const TOUR_VENUES = () => (typeof VENUE_ORDER !== 'undefined' ? VENUE_ORDER : []).filter(v => v !== 'pond' && v !== 'lab');
const tourCount = (c, n) => TOUR_VENUES().filter(v => ((((c.venues || {})[v]) || {}).stars || 0) >= n).length;
// THE SHARK PACK (Sep 27 2026). Every shark in the roster (Razor is a barracuda and Gape waits for the fjord, but
// Gape still counts for Dapple once he ships — a shark that ships later never takes Dapple back, since earned is kept).
const SHARKS = ['Bruce', 'Blaze', 'Stripes', 'Bruiser', 'Anvil', 'Lash', 'Nib', 'Goblin', 'Relic', 'Dapple', 'Dozer', 'Woebegone', 'Roam', 'Mitt', 'Gape'];
const FRESH_WATER = ['lake', 'river', 'redrock'];
const SHARKS_FOR_DAPPLE = () => SHARKS.filter(n => n !== 'Dapple' && n !== 'Bruce' && ACHIEVEMENTS.some(a => a.char === n));
const sharkRow = (char, prey, title, hint, test, progress) => ({ char, family: 'sharks', prey, title, hint, test, progress });
const tourRow = (char, n, title, hint) => ({ char, family: 'tour', title, hint,
    test: (r, c) => TOUR_VENUES().length > 0 && tourCount(c, n) === TOUR_VENUES().length,
    progress: (c) => [tourCount(c, n), TOUR_VENUES().length] });
// Spoonbill Flats' six passages over the mud (the doc's `tide.passages` ids; the point bars don't count)
const FLATS_PASSAGES = ['wantij', 'gamble', 'neck', 'creek', 'headcut', 'delta'];
const ACHIEVEMENTS = [
    // ── A · First Season ──────────────────────────────────────────────────────────
    { char: 'Ripple', family: 'season', title: 'Welcome Aboard',
      hint: 'Finish your first race.',
      test: (r) => r.finished },
    { char: 'Wiggle', family: 'season', title: 'Everything Grows Back',
      hint: 'Serve a penalty turn and clear it.',
      test: (r) => r.served > 0 },
    // Penalties off in Settings would make this free, so it only counts with the rules on.
    { char: 'Scuttle', family: 'season', title: 'Clean Hands',
      hint: 'Finish a race with no penalties, sailing rules on.',
      test: (r) => r.finished && r.rulesOn && r.penalties === 0 },
    { char: 'Skim', family: 'season', title: 'Airborne',
      hint: 'Hit 10 knots of boatspeed.',
      test: (r) => r.topSpeed >= 10 },
    // "Dead last" is only a comeback in a real fleet; a three-boat course would hand it out.
    { char: 'Zing', family: 'season', title: 'The Comeback',
      hint: 'Win after rounding the first mark in last place.',
      test: (r) => r.won && r.fleet >= 5 && r.firstMarkRank === r.fleet },
    { char: 'Splat', family: 'season', title: 'Still Afloat',
      hint: 'Finish last.',
      test: (r) => r.finished && r.fleet >= 3 && r.pos === r.fleet },
    // Whiskers is a starter, so he is always in the pool — but he has to be in THIS race.
    { char: 'Snap', family: 'season', title: 'Respect Your Elders',
      hint: 'Finish directly ahead of Whiskers.',
      test: (r) => r.nextHome === undefined ? null : r.nextHome === 'Whiskers' },
    { char: 'Hug', family: 'season', title: 'Ironclad',
      hint: 'Finish 25 races.',
      test: (r, c) => c.finishes >= 25,
      progress: (c) => [c.finishes || 0, 25] },
    { char: 'Knot', family: 'season', title: 'Dead Reckoning',
      hint: 'Finish exactly 5th, three races in a row.',
      test: (r, c) => c.fifthStreak >= 3 },

    // ── B · The Start Line (built Sep 27 2026) ─────────────────────────────────────
    // Crossing time is raceState.startLegDuration (seconds after the gun); 'start:first' and 'start:ocs' are
    // feats (sim/physics.js at the crossing, script.js at the gun) — never raceState fields.
    { char: 'Crush', family: 'start', title: 'Gun Fighter',
      hint: 'Cross the start line within 1 second of the gun, then finish the race.',
      test: (r) => r.finished && r.startDelay != null && r.startDelay <= 1.0 },
    { char: 'Clutch', family: 'start', title: 'Line Boss',
      hint: 'Be first of the whole fleet across the start line, three races in a row.',
      test: (r, c) => (c.startStreak || 0) >= 3,
      progress: (c) => [Math.min(3, c.startStreak || 0), 3] },
    { char: 'Skip', family: 'start', title: 'Trigger Happy',
      hint: 'Be over early at the gun, go back and restart, and still win the race.',
      test: (r) => r.won && r.feats.includes('start:ocs') },

    // ── C · Clean & Dirty (built Sep 27 2026) ──────────────────────────────────────
    // Grotto takes 'Shake It Off' (Wes: Stomp is Emberfall's four-star character).
    { char: 'Grotto', family: 'clean', title: 'Shake It Off',
      hint: 'Win a race in which you served a penalty turn.',
      test: (r) => r.won && r.served > 0 },
    { char: 'Bramble', family: 'clean', title: 'Untouchable',
      hint: 'Finish with rules on and no penalties while five or more rivals are penalized.',
      test: (r) => r.finished && r.rulesOn && r.penalties === 0 && r.rivalsPenalized >= 5 },

    // ── D · Close Racing (built Sep 27 2026) ───────────────────────────────────────
    // Latch back on 'Inches' (Wes); Mitt took Clubhouse Point's 'Same Every Week'. All three read events (physics.js
    // advanceLeg + finish, collision.js mark contact, sim/course.js checkCloseCrossing) — never raceState fields.
    { char: 'Pulse', family: 'close', title: 'Photo Finish',
      hint: 'Win with the next boat less than a boat length behind at the line.',
      test: (r) => r.won && r.feats.includes('close:photo') },
    { char: 'Latch', family: 'close', title: 'Inches',
      hint: "On port, cross a starboard boat's bow by under a boat length, with no penalty.",
      test: (r) => r.finished && r.feats.includes('close:inches') && r.penalties === 0 },
    { char: 'Popper', family: 'close', title: 'The Circle',
      hint: 'Round every mark within a boat length without touching one, then finish.',
      test: (r) => r.finished && r.feats.includes('close:tight') && !r.feats.includes('close:wide') && !r.feats.includes('close:touch') },   // (tight roundings seen, none wide)

    // ── E · Leg & Mark Craft (built Sep 27 2026) ───────────────────────────────────
    // Wes: Sable and Flash stay at Clubhouse Point, Bruiser and Nib stay in the shark pack; Saffron and Sovereign take
    // Perfect Roundings and Run Line, and Wick (storm petrel, shipped Sep 27) the new Beat Line. Threading needs 3+ legs.
    { char: 'Flaunt', family: 'legs', title: 'Wire to Wire',
      hint: 'Lead at every mark and win the race.',
      test: (r) => r.won && r.legRanks.length >= 2 && r.legRanks.slice(0, -1).every(k => k === 1) },
    { char: 'Vex', family: 'legs', title: 'Daylight Robbery',
      hint: 'Take the lead on the final leg — behind at the last mark — and win.',
      test: (r) => r.won && r.legRanks.length >= 2 && r.legRanks[r.legRanks.length - 2] > 1 },
    { char: 'Needle', family: 'legs', title: 'Threading',
      hint: 'Gain at least one place on every leg of a race of three or more legs.',
      test: (r) => { const q = [r.startRank, ...r.legRanks]; return r.finished && r.legRanks.length >= 3 && r.startRank > 0 && q.every((k, i) => i === 0 || k < q[i - 1]); } },
    { char: 'Saffron', family: 'legs', title: 'Perfect Roundings',
      hint: 'Never lose a place at any mark, all race, and finish in the top three.',
      test: (r) => r.finished && r.pos <= 3 && r.feats.includes('mark:held') && !r.feats.includes('mark:lost') },   // (top three: at the back you cannot lose a place)
    { char: 'Brine', family: 'legs', title: 'Never Passed',
      hint: 'Finish in the top three without being overtaken once, start to finish.',
      test: (r) => r.finished && r.pos <= 3 && !r.feats.includes('pass:overtaken') },
    { char: 'Sovereign', family: 'legs', title: 'Run Line',
      hint: "Sail the fleet's fastest downwind leg and finish in the top three.",
      test: (r) => r.finished && r.pos <= 3 && r.fastestDown },
    { char: 'Wick', family: 'legs', title: 'Beat Line',
      hint: "Sail the fleet's fastest upwind leg and finish in the top three.",
      test: (r) => r.finished && r.pos <= 3 && r.fastestUp },
    { char: 'Splash', family: 'legs', title: 'All Kite',
      hint: 'Win a race with the spinnaker up for more than half of it.',
      test: (r) => r.won && r.time > 0 && ((r.vals || {})['kite:secs'] || 0) > r.time / 2 },

    // ── F · Boat Handling & Conditions (built Sep 27 2026) ─────────────────────────
    // Events from sim/course.js checkHandling. Wes: Grip takes Never Let Go; Lateen is Clubhouse Point's and Mola has a
    // venue row, so One Sail, Forever and Sunbather are new characters — Bluebottle (Portuguese man o' war) and Dab (flounder);
    // Spin (spinner dolphin) was always new. All three shipped Sep 27 2026.
    { char: 'Frond', family: 'handling', title: 'Whisper Wind',
      hint: 'Win a race sailed in an average wind of 7 knots or less.',
      test: (r) => r.won && ((r.vals || {})['wind:avg'] || 99) <= 7 },
    { char: 'Bulkhead', family: 'handling', title: 'Storm Wall',
      hint: 'Win a race sailed in an average wind of 18 knots or more.',
      test: (r) => r.won && ((r.vals || {})['wind:avg'] || 0) >= 18 },
    { char: 'Chroma', family: 'handling', title: 'Every Colour',
      hint: 'Win once in light air (8 kn or less), once in medium, once in heavy (18 kn+).',
      test: (r, c) => ['light', 'medium', 'heavy'].every(b => (c.windBands || []).includes(b)),
      progress: (c) => [(c.windBands || []).length, 3] },
    { char: 'Crimson', family: 'handling', title: 'Surgical',
      hint: 'Win a race by 30 seconds or more.',
      test: (r) => !r.won ? false : r.marginAhead == null ? null : r.marginAhead >= 30 },
    { char: 'Viper', family: 'handling', title: 'Tacking Duel',
      hint: 'Win a race in which you tacked 12 or more times.',
      test: (r) => r.won && ((r.vals || {})['tack:n'] || 0) >= 12 },
    { char: 'Spin', family: 'handling', title: 'Corkscrew',
      hint: 'Win a race in which you gybed 12 or more times.',
      test: (r) => r.won && ((r.vals || {})['gybe:n'] || 0) >= 12 },
    { char: 'Grip', family: 'handling', title: 'Never Let Go',
      hint: 'Hold a rival within two lengths astern for a minute, then beat them. No penalty.',
      test: (r) => r.finished && r.penalties === 0 && r.feats.some(f => f.startsWith('grip:') && r.behind.includes(f.slice(5))) },
    { char: 'Bluebottle', family: 'handling', title: 'One Sail, Forever',
      hint: 'Win a race without ever hoisting the spinnaker.',
      test: (r) => r.won && !r.feats.includes('kite:hoisted') },
    { char: 'Dab', family: 'handling', title: 'Sunbather',
      hint: 'Win a race after being becalmed (under 2 knots) for 30 seconds straight.',
      test: (r) => r.won && r.feats.includes('calm:30') },

    // ── F2 · Legal Aggression (built Sep 27 2026) ──────────────────────────────────
    // Events from sim/course.js checkAggression. Making rivals flinch within the rules: every row is void on a penalty.
    // Wes: Spike (narwhal) takes Makes His Own Right of Way — it is his roster line — and Glacier Sound's Calving Face
    // goes to Chime the beluga. Corsair (frigatebird) is new. Chime and Corsair shipped Sep 27 2026.
    { char: 'Frenzy', family: 'aggression', title: 'Feeding Frenzy',
      hint: 'Make 15 passes in one race and take no penalty. A re-pass counts after 10 seconds.',
      test: (r) => r.finished && r.penalties === 0 && ((r.vals || {})['pass:n'] || 0) >= 15 },
    { char: 'Spike', family: 'aggression', title: 'Makes His Own Right of Way',
      hint: 'Make 5 different rivals give way to you in one race, taking no penalty.',
      test: (r) => r.finished && r.penalties === 0 && ((r.vals || {})['give:n'] || 0) >= 5 },
    { char: 'Corsair', family: 'aggression', title: 'Air Thief',
      hint: 'Keep a rival in your wind shadow for 30 seconds, and finish ahead. No penalty.',
      test: (r) => r.finished && r.penalties === 0 && r.feats.some(f => f.startsWith('air:') && r.behind.includes(f.slice(4))) },

    // ── S · Series (built Sep 27 2026) ─────────────────────────────────────────────
    // Tested once, when a series' last race is scored (Unlocks.seriesFinal, r.series = Series.summary()). A series is a
    // Race of 4 to 12 races (the Race door: drawn or picked), sailed to the end; a Race of 1-3 isn't one, and Cups don't
    // count — they have their own trophies and stars (Wes, Sep 27 2026). Points are 10 for a win down to 1, no discards.
    // Pearl and Scoop left this family (a series never repeats a venue; both have venue rows). Length floors: Tempo and
    // Renew 6+, Titan 8+, Huddle and Crest (the macaroni penguin, Wes) 12+. All six new faces shipped Sep 27 2026.
    { char: 'Anchor', family: 'series', title: 'Champion',
      hint: 'Win a series of four or more races — first in the final standings.',
      test: (r) => !!(r.series && r.series.won) },
    { char: 'Regal', family: 'series', title: 'White Gloves',
      hint: 'Win a series of 4+ races with no penalty and never aground in any race.',
      test: (r) => !!(r.series && r.series.won && r.series.races.every(x => x.clean)) },
    { char: 'Mistral', family: 'series', title: 'The Season',
      hint: 'Sail 10 series of four or more races to the end, any result.',
      test: (r, c) => (c.seriesDone || 0) >= 10,
      progress: (c) => [Math.min(10, c.seriesDone || 0), 10] },
    { char: 'Flare', family: 'series', title: 'Grudge Match',
      hint: 'Win a series of 4+ races you went into the last race behind on points.',
      test: (r) => !!(r.series && r.series.won && r.series.trailing) },
    { char: 'Tempo', family: 'series', title: 'Metronome',
      hint: 'Start within 1.0 seconds of the gun in every race of a series of 6+ races.',
      test: (r) => !!(r.series && r.series.n >= 6 && r.series.races.every(x => x.start != null && x.start <= 1.0)) },
    { char: 'Titan', family: 'series', title: 'By Daylight',
      hint: 'Win every race of a series of 8+ races, each by 5 seconds or more.',
      test: (r) => !!(r.series && r.series.n >= 8 && r.series.races.every(x => x.pos === 1 && x.margin >= 5)) },
    { char: 'Lance', family: 'series', title: 'Through the Fleet',
      hint: 'Win a series of 4+ races having passed every boat in the fleet at least once.',
      test: (r) => { const S = r.series; if (!S || !S.won) return false; const p = new Set(S.races.flatMap(x => x.passed)); return S.fleet.length > 0 && S.fleet.every(n => p.has(n)); } },
    { char: 'Huddle', family: 'series', title: 'Unbroken',
      hint: 'Finish in the top three in every race of a series of 12 or more races.',
      test: (r) => !!(r.series && r.series.n >= 12 && r.series.races.every(x => x.finished && x.pos <= 3)) },
    { char: 'Renew', family: 'series', title: 'Start Over',
      hint: 'Win a series of 6+ races despite finishing last, or not at all, in one race.',
      test: (r) => !!(r.series && r.series.n >= 6 && r.series.won && r.series.races.some(x => x.last)) },
    { char: 'Crest', family: 'series', title: 'Six Months at Sea',
      hint: 'Win a series of 12 or more races.',
      test: (r) => !!(r.series && r.series.n >= 12 && r.series.won) },

    // ── H · The Shark Pack (built Sep 27 2026) ──────────────────────────────────────
    // THE LADDER (Wes): Bruce → Blaze → Stripes → Bruiser → Anvil → Lash → Nib → Goblin → Relic → Dapple. Each rung asks
    // you to beat the one before it (`prey`); that shark is guaranteed a place in your fleet until you have (huntTarget).
    // Any race against the fleet counts — a Race of any length or a Cup race; a Time Trial has no fleet. "In a row"
    // counts the races that shark was in (c.h2h, kept in _count). The rules vary up the ladder so it doesn't read as
    // one row nine times: plain streaks at the bottom, then where and how. Gape waits for the fjord.
    sharkRow('Blaze', 'Bruce', 'Faster Fish', 'Finish ahead of Bruce in 3 races in a row.',
        (r, c) => ((c.h2h || {}).Bruce || {}).streak >= 3, (c) => [Math.min(3, ((c.h2h || {}).Bruce || {}).streak || 0), 3]),
    sharkRow('Stripes', 'Blaze', 'Eats Everything', 'Finish ahead of Blaze in 3 races in a row.',
        (r, c) => ((c.h2h || {}).Blaze || {}).streak >= 3, (c) => [Math.min(3, ((c.h2h || {}).Blaze || {}).streak || 0), 3]),
    sharkRow('Bruiser', 'Stripes', 'Fresh Water', 'Finish ahead of Stripes at Stillwater Lake, Sockeye Run and Redrock Reservoir.',
        (r, c) => FRESH_WATER.every(v => (((c.h2h || {}).Stripes || {}).venues || []).includes(v)),
        (c) => [FRESH_WATER.filter(v => (((c.h2h || {}).Stripes || {}).venues || []).includes(v)).length, 3]),
    sharkRow('Anvil', 'Bruiser', 'Harder Fish', 'Finish ahead of Bruiser in 3 races in a row, with no penalty in any.',
        (r, c) => ((c.h2h || {}).Bruiser || {}).clean >= 3, (c) => [Math.min(3, ((c.h2h || {}).Bruiser || {}).clean || 0), 3]),
    sharkRow('Lash', 'Anvil', 'Tail End', 'Round the first mark behind Anvil, then finish ahead of him.',
        (r) => r.finished && (r.rivals || []).includes('Anvil') && r.feats.includes('mark1:behind:Anvil') && r.behind.includes('Anvil')),
    sharkRow('Nib', 'Lash', 'Reef Runner', 'Finish ahead of Lash at Pearl Lagoon, leading him at every mark.',
        (r) => r.venue === 'lagoon' && r.finished && r.behind.includes('Lash') && (r.rivals || []).includes('Lash') && !r.feats.includes('mark:behind:Lash')),
    sharkRow('Goblin', 'Nib', 'Out of the Deep', 'Finish ahead of Nib at Glowtide Strait.',
        (r) => r.venue === 'glowtide' && r.finished && (r.rivals || []).includes('Nib') && r.behind.includes('Nib')),
    sharkRow('Relic', 'Goblin', 'Four Hundred Winters', 'Finish ahead of Goblin at Glacier Sound in 2 races in a row.',
        (r, c) => r.venue === 'arctic' && ((((c.h2h || {}).Goblin || {}).vs || {}).arctic || 0) >= 2, (c) => [Math.min(2, (((c.h2h || {}).Goblin || {}).vs || {}).arctic || 0), 2]),
    { char: 'Dapple', family: 'sharks', title: 'The Gentle Giant',
      hint: 'Earn every other shark in the pack, from Blaze up the ladder to Relic.',
      test: (r, c) => SHARKS_FOR_DAPPLE().every(n => Unlocks.isEarned(n) || (r.grantedNow || []).includes(n)),
      progress: () => [SHARKS_FOR_DAPPLE().filter(n => Unlocks.isEarned(n)).length, SHARKS_FOR_DAPPLE().length] },
    // THE FEAT SHARKS (the Aug 5 sketches, Wes).
    { char: 'Dozer', family: 'sharks', title: 'Wide Awake',
      hint: 'Cross the start line last of the fleet, then finish in the top three.',
      test: (r) => r.finished && r.pos <= 3 && r.fleet > 1 && r.startRank === r.fleet },
    { char: 'Woebegone', family: 'sharks', title: 'The Rug Moves',
      hint: 'Be last of the fleet at the halfway mark, then finish in the top three.',
      test: (r) => { const L = (r.legRanks || []).length - 1, h = Math.floor((L + 1) / 2) - 1;   // marks rounded, not the finish
          return r.finished && r.pos <= 3 && r.fleet > 1 && h >= 0 && r.legRanks[h] === r.fleet; } },
    { char: 'Razor', family: 'sharks', title: 'Swims With Sharks',
      hint: 'Finish ahead of every shark in a race with three or more sharks in the fleet.',
      test: (r) => { const sh = (r.rivals || []).filter(n => SHARKS.includes(n)); return r.finished && sh.length >= 3 && sh.every(n => r.behind.includes(n)); } },

    // ── Time Trials (Sep 27 2026, Wes) — the one achievement of the solo mode: Phantom the comb jelly, a see-through
    // racer for a ghost race. A ghost beaten is one you already had (timetrial.js emits 'ghost:beaten' only then).
    { char: 'Phantom', family: 'trials', title: 'Ghost Story',
      hint: 'In Time Trials, beat your own ghost at five different venues.',
      test: (r, c) => (c.ghostVenues || []).length >= 5,
      progress: (c) => [Math.min(5, (c.ghostVenues || []).length), 5] },

    // ── F3 · The Odometer Pair (built Sep 27 2026) ─────────────────────────────────
    // Distance sailed is each boat's legDistances; decided when it can be (see _odometer). Flicker is Clubhouse
    // Point's, so Longest Migration is a new character: Meridian the leatherback turtle (Wes), shipped Sep 27 2026.
    { char: 'Dart', family: 'odometer', title: 'Beeline',
      hint: 'Win a race having sailed the shortest distance of anyone in the fleet.',
      test: (r) => !r.won ? false : r.distShortest },
    { char: 'Meridian', family: 'odometer', title: 'Longest Migration',
      hint: 'Win a race having sailed the longest distance of anyone in the fleet.',
      test: (r) => !r.won ? false : r.distLongest },

    // ── The Grand Tour (built Sep 27 2026, Wes): stars at every venue. One star is a win, so the first rung is
    // Cruz's planned World Tour; Muninn, the raven who remembers everything, is the top of it.
    tourRow('Cruz', 1, 'World Tour', 'Win a race at every venue in the game.'),
    tourRow('Strut', 2, 'Two-Star Tour', 'Two stars in a race at every venue: win with no penalties.'),
    tourRow('Breeze', 3, 'Three-Star Tour', 'Three stars in a race at every venue: win, no penalties, lead every mark.'),
    tourRow('Muninn', 4, 'The Rememberer', 'Four stars in a race at every venue.'),

    // ── Lighthouse Cove `bay` (designed Sep 25 2026; Explorer and Wildlife reworked Sep 26) ─
    // Four animals live here — gulls, porpoises, pelicans, harbour seals (js/wildlife.js).
    // Wake (the porpoise) shipped Sep 25 2026 with the Cove. Sep 26 (Wes): the Explorer rung
    // is the three bridges (checkCoveBridges, js/sim/course.js) and the gull rock moved to the
    // Wildlife rung, so Zeffir the gull keeps his own birds and Scoop takes the bridges; the
    // pelicans' bait boil is scenery now (the feat still fires; no row reads it).
    { char: 'Roll', venue: 'bay', rung: 'first-win', title: 'Harbour Master',
      hint: 'Win a race at Lighthouse Cove.',
      test: (r) => r.venue === 'bay' && r.won },
    { char: 'Wake', venue: 'bay', rung: 'mechanic', title: 'Ahead of the Ship',
      hint: "Cross a cargo ship's bow within 3 boat lengths, then finish the race.",
      test: (r) => r.venue === 'bay' && r.finished && r.feats.includes('bay:bow-cross') },
    { char: 'Scoop', venue: 'bay', rung: 'explorer', title: 'Under the Bridges',
      hint: 'Sail under all three of the Cove\'s bridges in one race, then finish the race.',
      test: (r) => r.venue === 'bay' && r.finished && r.feats.includes('bay:bridges') },
    { char: 'Plunge', venue: 'bay', rung: 'target', title: 'Precision Diver',
      hint: (t) => t ? `Beat the Cove's target time of ${fmtTarget(t)} in Time Trials.` : "Beat the Cove's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'bay' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Piper', venue: 'bay', rung: 'four-stars', title: 'Home Waters',
      hint: 'Four stars at Lighthouse Cove: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'bay' && r.stars === 4 },
    { char: 'Zeffir', venue: 'bay', rung: 'wildlife', title: 'Gull Rock',
      hint: 'Put up the gulls on the rock east of the lighthouse island, then finish.',
      test: (r) => r.venue === 'bay' && r.finished && r.feats.includes('bay:gulls') },

    // ── Stillwater Lake `lake` (designed Sep 25 2026) ─────────────────────────────────
    // Animals: loons (Diver), a moose in the west lily bed (Timber), beavers (scenery).
    { char: 'Lunker', venue: 'lake', rung: 'first-win', title: 'Trophy Catch',
      hint: 'Win a race at Stillwater Lake.',
      test: (r) => r.venue === 'lake' && r.won },
    { char: 'Diver', venue: 'lake', rung: 'mechanic', title: 'Through the Glass',
      hint: 'Stay above 4.5 knots through the calm around mark 3, then finish the race.',
      test: (r) => r.venue === 'lake' && r.finished && r.feats.includes('lake:glass') },
    // Sep 27 2026 (Wes): Timber's moose became the Wildlife rung; the Explorer is Barbel the lake sturgeon —
    // a route round every island in the lake (sim/course.js checkLakeRun, 'lake:islands').
    { char: 'Barbel', venue: 'lake', rung: 'explorer', title: 'Round Every Island',
      hint: 'Sail a race whose track goes round every island in the lake.',
      test: (r) => r.venue === 'lake' && r.finished && r.feats.includes('lake:islands') },
    { char: 'Gasket', venue: 'lake', rung: 'target', title: 'Built This Place',
      hint: (t) => t ? `Beat the Lake's target time of ${fmtTarget(t)} in Time Trials.` : "Beat the Lake's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'lake' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Torpedo', venue: 'lake', rung: 'four-stars', title: 'Knows the Water',
      hint: 'Four stars at Stillwater Lake: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'lake' && r.stars === 4 },
    { char: 'Timber', venue: 'lake', rung: 'wildlife', title: 'Wake the Neighbour',
      hint: 'Startle the moose in the lily bed on the west shore, then finish the race.',
      test: (r) => r.venue === 'lake' && r.finished && r.feats.includes('lake:moose') },

    // ── Gatorgrass Bayou `swamp` (designed Sep 25 2026) ──────────────────────────────
    // The bayou is a maze: four passages lead from the start to the windward gate (the
    // Cut over the mud bar, the East channel, the West bayou, the Long Way — ROUTE_GATES in
    // sim/course.js). Animals (js/wildlife.js): alligators on the channel banks (Flit),
    // great egrets on the marsh edges, anhingas drying on snags in the West (Quill). Beau,
    // Flit and Quill shipped Sep 25 2026; Chomp stays a saltwater crocodile (Wes).
    { char: 'Chomp', venue: 'swamp', rung: 'first-win', title: 'Apex of the Bayou',
      hint: 'Win a race at Gatorgrass Bayou.',
      test: (r) => r.venue === 'swamp' && r.won },
    { char: 'Croak', venue: 'swamp', rung: 'mechanic', title: 'Know the Bayou',
      hint: 'Finish races at the Bayou through three different passages.',
      test: (r, c) => r.venue === 'swamp' && r.finished && (((c.venues.swamp || {}).routes) || []).length >= 3,
      progress: (c) => [(((c.venues || {}).swamp || {}).routes || []).length, 3] },
    { char: 'Flit', venue: 'swamp', rung: 'explorer', title: 'Wake the Bayou',
      hint: 'Put down five alligators in one race by sailing close, then finish.',
      test: (r) => r.venue === 'swamp' && r.finished && ((r.vals || {})['swamp:gators'] || 0) >= 5 },
    { char: 'Etienne', venue: 'swamp', rung: 'target', title: 'Bayou Classic',
      hint: (t) => t ? `Beat the Bayou's target time of ${fmtTarget(t)} in Time Trials.` : "Beat the Bayou's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'swamp' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Beau', venue: 'swamp', rung: 'four-stars', title: 'Landlord',
      hint: 'Four stars at Gatorgrass Bayou: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'swamp' && r.stars === 4 },
    { char: 'Quill', venue: 'swamp', rung: 'wildlife', title: 'Snakebird',
      hint: 'Sail the West bayou and put up the anhingas on the dead snags, then finish.',
      test: (r) => r.venue === 'swamp' && r.finished && r.feats.includes('swamp:anhingas') },

    // ── Sockeye Run `river` (designed Sep 25 2026) ───────────────────────────────────
    // The stream runs toward the finish, and the race is decided on the run home down the
    // gorge: rapids cover the whole channel and shove the bow onto the rocks (Snag), and the
    // finish island has a second arm — the chute through the last rapid — that no bot takes
    // and Wes takes most (Grizzle). Both judged in sim/course.js (RIVER_RUN). Animals
    // (js/wildlife.js): a brown bear fishing the chute, the sockeye run leaping the rapids,
    // bald eagles, river otters. Snag stays a hellbender (Wes: "it's unique"). Grizzle
    // shipped Sep 25 2026.
    { char: 'Slipstream', venue: 'river', rung: 'first-win', title: 'Homecoming',
      hint: 'Win a race at Sockeye Run.',
      test: (r) => r.venue === 'river' && r.won },
    { char: 'Snag', venue: 'river', rung: 'mechanic', title: 'Run the Gorge Clean',
      hint: 'Sail the gorge home to the finish without touching a rock, a log or the bank.',
      test: (r) => r.venue === 'river' && r.finished && !r.feats.includes('river:scraped') },
    // Sep 27 2026 (Wes): Grizzle moved to Wildlife (within a boat length of both bears); the Explorer is Pennant the
    // arctic grayling — one race taking the right-hand channel past all three river islands, one the left
    // (sim/course.js checkRiverSplits; the two routes collect in career venues.river.routes).
    { char: 'Pennant', venue: 'river', rung: 'explorer', title: 'Right, Then Left',
      hint: 'Take the right-hand channel past all three islands in one race, the left in another.',
      test: (r, c) => r.venue === 'river' && r.finished && ['keep-right', 'keep-left'].every(k => ((((c.venues || {}).river || {}).routes) || []).includes(k)),
      progress: (c) => [['keep-right', 'keep-left'].filter(k => ((((c.venues || {}).river || {}).routes) || []).includes(k)).length, 2] },
    { char: 'Riffle', venue: 'river', rung: 'target', title: 'White Water',
      hint: (t) => t ? `Beat Sockeye Run's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Sockeye Run's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'river' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Seam', venue: 'river', rung: 'four-stars', title: 'Reads the Seam',
      hint: 'Four stars at Sockeye Run: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'river' && r.stars === 4 },
    { char: 'Grizzle', venue: 'river', rung: 'wildlife', title: 'Close to the Bears',
      hint: 'In one race, pass within a boat length of both fishing grizzlies, then finish.',
      test: (r) => r.venue === 'river' && r.finished && r.feats.includes('river:bears') },

    // ── Bluewater Bonanza `ocean` (designed Sep 25 2026) ─────────────────────────────
    // The run home is the race: a ground swell in SETS running 30° off the course, a slower
    // crossing wind swell, a cape jet under the island and the island's swell shadow — so the
    // skill is catching and LINKING rides and choosing a lane (inshore / offshore / direct).
    // Checks in sim/course.js (OCEAN_RUN) and js/wildlife.js (the whales). Animals: humpback
    // pods with a mother and calf (Song), spinner dolphins, flying fish, Laysan albatross.
    // Mola, Song and Roam shipped Sep 25 2026 (Song was "Sound" — renamed by Wes; Roam's first
    // delivery read as a marlin and was redone from Wes's blue-shark references).
    { char: 'Spar', venue: 'ocean', rung: 'first-win', title: 'Arrives at Speed',
      hint: 'Win a race at Bluewater Bonanza.',
      test: (r) => r.venue === 'ocean' && r.won },
    { char: 'Finley', venue: 'ocean', rung: 'mechanic', title: 'Link the Swells',
      hint: 'On the run home, hold 15+ knots for 30 seconds straight, then finish.',
      test: (r) => r.venue === 'ocean' && r.finished && r.feats.includes('ocean:linked') },
    { char: 'Mola', venue: 'ocean', rung: 'explorer', title: 'The Far Island',
      hint: 'On the run home, sail all the way round the offshore island, then finish.',
      test: (r) => r.venue === 'ocean' && r.finished && r.feats.includes('ocean:far-island') },
    { char: 'Roam', venue: 'ocean', rung: 'target', title: 'Blue Water',
      hint: (t) => t ? `Beat Bluewater Bonanza's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Bluewater Bonanza's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'ocean' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Torrent', venue: 'ocean', rung: 'four-stars', title: 'Straight Line',
      hint: 'Four stars at Bluewater Bonanza: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'ocean' && r.stars === 4 },
    { char: 'Song', venue: 'ocean', rung: 'wildlife', title: 'Mother and Calf',
      hint: 'Shoot the gap south of the island and sail past the humpback and calf, then finish.',
      test: (r) => r.venue === 'ocean' && r.finished && r.feats.includes('ocean:calf') },

    // ── Redrock Reservoir `redrock` (designed Sep 25 2026) ───────────────────────────
    // The traffic venue: every leg crosses the mark-3 junction and legs 2 and 3 meet head-on
    // in the M6 arm, so the skill is holding your right of way where the fleet meets itself.
    // Checks in sim/course.js (REDROCK_RUN) and js/wildlife.js (the striper boils). Animals:
    // desert bighorn on the ledges, coyotes on the shelves, striper boils (Linesider), and
    // California condors roosting on the north-west butte (Trek). Freshwater-fish heavy on
    // purpose (Wes). Trek replaced Echo the canyon bat — no bats at Redrock. Boil Chaser is THREE:
    // the autopilot sails through 2+ in 3 races of 8 by accident, 3 in 1 (eval/_redrock_boils.js).
    // All six shipped Sep 25 2026 (Chisel and Talon were already in the roster).
    { char: 'Chisel', venue: 'redrock', rung: 'first-win', title: 'Canyon Endemic',
      hint: 'Win a race at Redrock Reservoir.',
      test: (r) => r.venue === 'redrock' && r.won },
    { char: 'Sawbill', venue: 'redrock', rung: 'mechanic', title: 'Right of Way',
      hint: 'Make three rivals give way to you round mark 3, with rules on and no penalties.',
      test: (r) => r.venue === 'redrock' && r.finished && r.rulesOn && r.penalties === 0 && ((r.vals || {})['redrock:gave-way'] || 0) >= 3 },
    { char: 'Trek', venue: 'redrock', rung: 'explorer', title: 'Condor Butte',
      hint: 'Sail all the way round the butte island in the north-west basin, then finish.',
      test: (r) => r.venue === 'redrock' && r.finished && r.feats.includes('redrock:butte') },
    { char: 'Ridge', venue: 'redrock', rung: 'target', title: 'Canyon Record',
      hint: (t) => t ? `Beat Redrock Reservoir's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Redrock Reservoir's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'redrock' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Talon', venue: 'redrock', rung: 'four-stars', title: 'Owns the Canyon',
      hint: 'Four stars at Redrock Reservoir: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'redrock' && r.stars === 4 },
    { char: 'Linesider', venue: 'redrock', rung: 'wildlife', title: 'Boil Chaser',
      hint: 'In one race, sail through three striper boils, then finish.',
      test: (r) => r.venue === 'redrock' && r.finished && ((r.vals || {})['redrock:boils'] || 0) >= 3 },

    // ── Glacier Sound `arctic` (designed Sep 25 2026) ────────────────────────────────
    // The pack ice is the race: 112 drifting floes on an out-and-back up the hooked fjord, and
    // the skill is threading them clean. Wes made the WILDLIFE Antarctic (orcas; emperor, Adélie,
    // gentoo and macaroni penguins; leopard seals; Antarctic terns) but kept both poles in the
    // cast: Bluff the polar bear stays. The explorer rung was Spike the narwhal's until Sep 27 2026, when Wes
    // moved Spike to Legal Aggression; Chime the beluga (belugas feed at tidewater glacier fronts) takes it. Checks in sim/course.js (ARCTIC_RUN) and
    // js/wildlife.js (the colonies). Grin is unshipped until Wes delivers the portrait.
    { char: 'Bluff', venue: 'arctic', rung: 'first-win', title: 'Top of the World',
      hint: 'Win a race at Glacier Sound.',
      test: (r) => r.venue === 'arctic' && r.won },
    { char: 'Tiny', venue: 'arctic', rung: 'mechanic', title: 'Untouched',
      hint: 'Finish at Glacier Sound without touching any ice: floe, ice island or shore.',
      test: (r) => r.venue === 'arctic' && r.finished && !r.feats.includes('arctic:iced') },
    { char: 'Chime', venue: 'arctic', rung: 'explorer', title: 'The Calving Face',
      hint: 'Come within 350 units of the glacier face beyond the rounding island, then finish.',
      test: (r) => r.venue === 'arctic' && r.finished && r.feats.includes('arctic:face') },
    { char: 'Pebble', venue: 'arctic', rung: 'target', title: 'Precision',
      hint: (t) => t ? `Beat Glacier Sound's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Glacier Sound's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'arctic' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Fathom', venue: 'arctic', rung: 'four-stars', title: 'Deep Water',
      hint: 'Four stars at Glacier Sound: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'arctic' && r.stars === 4 },
    { char: 'Grin', venue: 'arctic', rung: 'wildlife', title: 'Four Colonies',
      hint: 'In one race, sail past all four penguin colonies, then finish.',
      test: (r) => r.venue === 'arctic' && r.finished && ((r.vals || {})['arctic:colonies'] || 0) >= 4 },

    // ── Glowtide Strait `glowtide` (designed Sep 26 2026) ────────────────────────────
    // A Palau-like karst strait by moonlight: every wake glows for 9 s, and the venue asks
    // "follow the glow, or trust your own line?". Checks in sim/course.js (GLOW_RUN). Animals
    // (js/wildlife.js): the golden jellyfish bloom (Bloom's), manta rays feeding in the glowing
    // plankton, Palau flying foxes crossing the strait, hawksbill turtles (nesting on the
    // beaches, swimming the reefs), dugongs grazing the seagrass shallows. All five characters
    // were already in the roster.
    { char: 'Lure', venue: 'glowtide', rung: 'first-win', title: 'First Light',
      hint: 'Win a race at Glowtide Strait.',
      test: (r) => r.venue === 'glowtide' && r.won },
    { char: 'Veil', venue: 'glowtide', rung: 'mechanic', title: 'Trust Your Own Line',
      hint: "Win at Glowtide Strait spending no more than 5 seconds in another boat's wake.",
      test: (r) => r.venue === 'glowtide' && r.won && ((r.vals || {})['glowtide:glow'] || 0) <= 5 },
    // Sep 27 2026 (Wes): Bloom's jellyfish bloom became the Wildlife rung; the Explorer is Blink the flashlight fish —
    // the far south-west shoal behind the west peninsula, by the bonfire, where three mantas feed.
    { char: 'Blink', venue: 'glowtide', rung: 'explorer', title: 'Where the Mantas Feed',
      hint: 'Find the mantas feeding in the far south-west shoal, by the bonfire, then finish.',
      test: (r) => r.venue === 'glowtide' && r.finished && r.feats.includes('glowtide:mantas') },
    { char: 'Drift', venue: 'glowtide', rung: 'target', title: 'Night Passage',
      hint: (t) => t ? `Beat Glowtide Strait's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Glowtide Strait's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'glowtide' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Prism', venue: 'glowtide', rung: 'four-stars', title: 'Full Spectrum',
      hint: 'Four stars at Glowtide Strait: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'glowtide' && r.stars === 4 },
    { char: 'Bloom', venue: 'glowtide', rung: 'wildlife', title: 'Find the Bloom',
      hint: 'Sail into the golden jellyfish bloom in the north-west lagoon, then finish.',
      test: (r) => r.venue === 'glowtide' && r.finished && r.feats.includes('glowtide:bloom') },

    // ── Emberfall Isle `volcanic` (designed Sep 26 2026) ─────────────────────────────────
    // Galápagos (Wes). The lightning is the venue: one bolt in four is AIMED at a boat (the player
    // weighted 3:1), marked on the water 2.8 s before it lands; the ash plumes (made heavier Sep 26)
    // kill the wind downwind of an erupting cone. Checks in js/volcano.js (the dodge) and
    // sim/course.js (VOLC_RUN, the outside loop); the booby plunge in js/wildlife.js. Animals: marine
    // iguanas, blue-footed boobies, great frigatebirds, Sally Lightfoot crabs, scalloped hammerheads.
    // All six in the roster (Vent, Basalt and Soot shipped Sep 26 2026).
    { char: 'Ember', venue: 'volcanic', rung: 'first-win', title: 'Trial by Fire',
      hint: 'Win a race at Emberfall Isle.',
      test: (r) => r.venue === 'volcanic' && r.won },
    { char: 'Torch', venue: 'volcanic', rung: 'mechanic', title: 'Outrun the Bolt',
      hint: 'At Emberfall, be 8+ boat lengths clear of three bolts aimed at you, then finish.',
      test: (r) => r.venue === 'volcanic' && r.finished && ((r.vals || {})['volcanic:dodge'] || 0) >= 3 },
    { char: 'Vent', venue: 'volcanic', rung: 'explorer', title: 'Round the Archipelago',
      hint: 'At Emberfall Isle, sail outside every island of the archipelago, then finish.',
      test: (r) => r.venue === 'volcanic' && r.finished && r.feats.includes('volcanic:outer') },
    { char: 'Basalt', venue: 'volcanic', rung: 'target', title: 'Cooled Lava',
      hint: (t) => t ? `Beat Emberfall Isle's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Emberfall Isle's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'volcanic' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Stomp', venue: 'volcanic', rung: 'four-stars', title: 'Blue Feet, Black Rock',
      hint: 'Four stars at Emberfall Isle: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'volcanic' && r.stars === 4 },
    { char: 'Soot', venue: 'volcanic', rung: 'wildlife', title: 'Booby Shower',
      hint: 'At Emberfall Isle, be under the boobies as they plunge-dive, then finish.',
      test: (r) => r.venue === 'volcanic' && r.finished && r.feats.includes('volcanic:boobies') },

    // ── Clubhouse Point `seatrials` (designed Sep 26 2026) ────────────────────────────
    // The eval anchor: its course, wind and conditions never change, and nothing here touches a boat. A
    // North Atlantic club off a rocky point (Wes): great cormorants drying their wings on the cans, fleets
    // of by-the-wind sailors, mackerel boils on the flanks and just past the gates, arctic terns diving on
    // them — all picture only (js/wildlife.js). Every can: sim/course.js SEA_RUN. All six already drawn.
    { char: 'Sable', venue: 'seatrials', rung: 'first-win', title: 'The Regular',
      hint: 'Win a race at Clubhouse Point.',
      test: (r) => r.venue === 'seatrials' && r.won },
    { char: 'Mitt', venue: 'seatrials', rung: 'mechanic', title: 'Same Every Week',
      hint: 'Finish three races in a row at Clubhouse Point within 3 seconds of each other.',
      test: (r, c) => { const q = (((c.venues || {}).seatrials || {}).recent) || []; return r.venue === 'seatrials' && r.finished && q.length === 3 && q.every(t => t != null) && Math.max(...q) - Math.min(...q) <= 3.0; } },
    { char: 'Lateen', venue: 'seatrials', rung: 'explorer', title: 'Every Can',
      hint: 'At Clubhouse Point, round both top marks and use both halves of the bottom line.',
      test: (r) => r.venue === 'seatrials' && r.finished && r.feats.includes('seatrials:everycan') },
    { char: 'Flash', venue: 'seatrials', rung: 'target', title: 'The Number',
      hint: (t) => t ? `Beat Clubhouse Point's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Clubhouse Point's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'seatrials' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Skerry', venue: 'seatrials', rung: 'four-stars', title: 'Clean Sheet',
      hint: 'Four stars at Clubhouse Point: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'seatrials' && r.stars === 4 },
    { char: 'Flicker', venue: 'seatrials', rung: 'wildlife', title: 'Under the Birds',
      hint: 'At Clubhouse Point, sail under the terns diving on a mackerel boil, then finish.',
      test: (r) => r.venue === 'seatrials' && r.finished && r.feats.includes('seatrials:birds') },

    // ── Spoonbill Flats `flats` (designed Sep 26 2026) ───────────────────────────────
    // The Wadden. The tide is the venue: a 60 s sine on the race clock drains and floods the
    // flats, and the marked passages across them (doc.tide.passages, risk rungs 1-3) are open
    // only briefly near high water. The flats and passages are read in sim/course.js (FLATS_RUN); a grounding
    // is `flats:aground` and costs the clean star (js/tide.js touches, Series.raceFacts).
    // Animals (js/wildlife.js, Wes): roseate spoonbills, grey seals, shore crabs, pied avocets.
    // Petal and Skitter stay as drawn (Wes); Scythe (pied avocet) and Zee (grey seal —
    // "for the Zealand reference") shipped Sep 26; Curl and Rake shipped Sep 27.
    { char: 'Petal', venue: 'flats', rung: 'first-win', title: 'Pink on the Flats',
      hint: 'Win a race at Spoonbill Flats.',
      test: (r) => r.venue === 'flats' && r.won },
    { char: 'Skitter', venue: 'flats', rung: 'mechanic', title: 'Mud Runner',
      hint: 'At the Flats, sail 50 seconds over the flats in one race without running aground.',
      test: (r) => r.venue === 'flats' && r.finished && ((r.vals || {})['flats:mud'] || 0) >= 50 && !r.feats.includes('flats:aground') },
    { char: 'Scythe', venue: 'flats', rung: 'explorer', title: 'Chart the Flats',
      hint: 'Across your races at the Flats, sail all six passages over the mud.',
      test: (r, c) => r.venue === 'flats' && r.finished && FLATS_PASSAGES.every(p => ((((c.venues || {}).flats || {}).routes) || []).includes(p)),
      progress: (c) => [FLATS_PASSAGES.filter(p => ((((c.venues || {}).flats || {}).routes) || []).includes(p)).length, FLATS_PASSAGES.length] },
    { char: 'Curl', venue: 'flats', rung: 'target', title: 'Beat the Tide',
      hint: (t) => t ? `Beat the Flats' target time of ${fmtTarget(t)} in Time Trials.` : "Beat the Flats' target time in Time Trials (target coming).",
      test: (r) => r.venue === 'flats' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Rake', venue: 'flats', rung: 'four-stars', title: 'Full Tide',
      hint: 'Four stars at the Flats: win, clean and never aground, lead every mark, manual trim.',
      test: (r) => r.venue === 'flats' && r.stars === 4 },
    { char: 'Zee', venue: 'flats', rung: 'wildlife', title: 'Keep Your Distance',
      hint: 'At low water, pass close to the grey seals without one sliding in, then finish.',
      test: (r) => r.venue === 'flats' && r.finished && r.feats.includes('flats:seals') },

    // ── Otter Point `otter` (designed Sep 26 2026) ────────────────────────────────────────
    // Monterey's kelp coast: the fleet runs a kilometre offshore of the north-coast kelp beds, and
    // the water inside them is rock and otters. Checks in sim/course.js (OTTER_RUN) and the hunt in
    // js/wildlife.js. Animals: sea otters rafting in the kelp, California sea lions on the stacks
    // and bird rocks (commuting, rafting, riding a shark's tail), great whites patrolling and
    // hunting them, blue whales offshore. Barker, Gilt, Grotto, Azure, Freckle, Maw and Ruby all
    // shipped Sep 26; Grotto (the wolf eel) has no rung here yet.
    { char: 'Barker', venue: 'otter', rung: 'first-win', title: 'King of the Rock',
      hint: 'Win a race at Otter Point.',
      test: (r) => r.venue === 'otter' && r.won },
    { char: 'Ruby', venue: 'otter', rung: 'mechanic', title: 'Inside the Kelp Line',
      hint: 'At Otter Point, sail inside three of the five kelp beds without touching a rock.',
      test: (r) => r.venue === 'otter' && r.finished && ((r.vals || {})['otter:inside'] || 0) >= 3 && !r.feats.includes('otter:scraped') },
    { char: 'Gilt', venue: 'otter', rung: 'explorer', title: 'Tip and Arch',
      hint: "Round the outside of Otter Point's north-west tip, shoot the arch, then finish.",
      test: (r) => r.venue === 'otter' && r.finished && r.feats.includes('otter:arch') },
    { char: 'Freckle', venue: 'otter', rung: 'target', title: 'Point to Point',
      hint: (t) => t ? `Beat Otter Point's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Otter Point's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'otter' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Maw', venue: 'otter', rung: 'four-stars', title: 'Boss of the Reef',
      hint: 'Four stars at Otter Point: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'otter' && r.stars === 4 },
    { char: 'Azure', venue: 'otter', rung: 'wildlife', title: 'Witness the Hunt',
      hint: 'At Otter Point, watch a great white take a sea lion, then finish the race.',
      test: (r) => r.venue === 'otter' && r.finished && r.feats.includes('otter:hunt') },

    // ── Pearl Lagoon `lagoon` (designed Sep 25 2026) ─────────────────────────────────
    // The squalls are the venue: Wes made them 25% larger and 50% slower the same day so a
    // front can be ridden. Animals (js/wildlife.js): green sea turtles on the seagrass,
    // spotted eagle rays over the sand, blacktip reef sharks in the reef-flat shallows — all
    // scenery; Landfall's cay is shape-5. All five characters were already in the roster.
    { char: 'Pearl', venue: 'lagoon', rung: 'first-win', title: 'Found in the Lagoon',
      hint: 'Win a race at Pearl Lagoon.',
      test: (r) => r.venue === 'lagoon' && r.won },
    { char: 'Nimbus', venue: 'lagoon', rung: 'mechanic', title: 'Ride the Cell',
      hint: "Ride a squall's gust front for 15 seconds without falling off it, then finish.",
      test: (r) => r.venue === 'lagoon' && r.finished && r.feats.includes('lagoon:squall-ride') },
    { char: 'Ribbon', venue: 'lagoon', rung: 'explorer', title: 'Landfall',
      hint: 'Sail round the lagoon side of the palm cay south of mark 5, then finish.',
      test: (r) => r.venue === 'lagoon' && r.finished && r.feats.includes('lagoon:landfall') },
    { char: 'Jester', venue: 'lagoon', rung: 'target', title: 'Found Him',
      hint: (t) => t ? `Beat the Lagoon's target time of ${fmtTarget(t)} in Time Trials.` : "Beat the Lagoon's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'lagoon' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Puff', venue: 'lagoon', rung: 'four-stars', title: 'Effortless',
      hint: 'Four stars at Pearl Lagoon: win, clean, lead every mark, manual trim.',
      test: (r) => r.venue === 'lagoon' && r.stars === 4 },
    // Sep 27 2026 (Wes): the Wildlife rung — Fizz the sea goldie; all five reef schools in one race (yellow and blue
    // tangs, sea goldies on the course; green chromis and humbugs to find off it — js/wildlife.js).
    { char: 'Fizz', venue: 'lagoon', rung: 'wildlife', title: 'Scatter the Reef',
      hint: 'In one race, scatter all five reef schools round the lagoon\'s coral heads.',
      test: (r) => r.venue === 'lagoon' && r.finished && r.feats.includes('lagoon:shoals') },

    // ── Sailing School, Duckling Pond `pond` (designed Sep 25 2026) ───────────────────
    // Judged from the school's own events (Unlocks.schoolEvent), never from a race's results
    // page — school races stay out of the general families. Earnable again on a replay.
    // The pond's animals: the ducklings (school.js), painted turtles on a log and grebes.
    // Fuzz, Oar, Bask and Wisp shipped Sep 25 2026.
    { char: 'Paddle', venue: 'pond', rung: 'first-win', title: 'Graduation Day',
      hint: 'Win the graduation race at Sailing School.',
      test: (r) => r.school === 'race' && r.won },
    { char: 'Fuzz', venue: 'pond', rung: 'lessons', title: 'Top of the Class',
      hint: 'Finish all four Sailing School sections without skipping any.',
      test: (r) => !!r.school && r.unitsAll },
    { char: 'Oar', venue: 'pond', rung: 'start', title: 'Off the Mark',
      hint: 'In start practice, cross within 2 seconds of the gun without being over early.',
      test: (r) => r.school === 'start' && r.startOk },
    // Sep 27 2026 (Wes): the pond's Explorer — Pip the pumpkinseed; a full turn round the swim raft (sim/course.js).
    { char: 'Pip', venue: 'pond', rung: 'explorer', title: 'Round the Raft',
      hint: 'Sail a full circle round the swim raft in Sailing School, then finish that section.',
      test: (r) => !!r.school && r.sectionDone && r.feats.includes('pond:raft') },
    { char: 'Bask', venue: 'pond', rung: 'wildlife', title: 'Sunbathers',
      hint: 'Send the turtles sliding off their log in Sailing School, then finish that section.',
      test: (r) => !!r.school && r.sectionDone && r.feats.includes('pond:turtles') },
    // Not four stars: the school runs on auto trim and never teaches manual. Instead, the
    // graduation debrief's best report — none of the three classmates' mistakes, no penalty.
    { char: 'Wisp', venue: 'pond', rung: 'report', title: 'Clean Report Card',
      hint: 'Graduate with a clean report card: on time, no pinching, kite down, no penalties.',
      test: (r) => r.school === 'race' && r.clean },
];

function fmtTarget(s) { return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`; }

// A new unlock is promised three races in your fleet; at most two such promises are kept
// in any one race, oldest first, so a five-unlock race cannot hijack the next fleet.
const RIVAL_RACES = 3;
const RIVAL_SLOTS_PER_RACE = 2;

const Unlocks = {
    ACHIEVEMENTS,
    STARTING_TEN,

    enforced() {
        const o = window.__UNLOCKS;
        if (o === 'on') return true;
        if (o === 'off') return false;
        if (window.evalHarness) return false;
        return typeof navigator !== 'undefined' && !navigator.webdriver;
    },

    // Which legs run upwind or downwind (the leg from the previous target to this one, against the course wind:
    // within 60 deg), and whether the player sailed the fastest of either kind of anyone in the fleet.
    _legBests(order, me) {
        const out = { fastestUp: false, fastestDown: false };
        if (typeof routeLeg !== 'function' || !state.course || !state.wind) return out;
        const M = state.course.marks || [], ctr = (e) => { const idx = e && (e.marks || (e.mark && e.mark.markIdx != null ? [e.mark.markIdx] : [])); if (!idx || !idx.length) return null; let x = 0, y = 0; for (const i of idx) { x += M[i].x; y += M[i].y; } return { x: x / idx.length, y: y / idx.length }; };
        const up = state.wind.direction, kind = [];
        for (let leg = 1; leg <= (state.race.totalLegs || 0); leg++) { const a = ctr(routeLeg(leg - 1)), b = ctr(routeLeg(leg)); if (!a || !b) { kind.push(null); continue; }
            const brg = Math.atan2(b.x - a.x, -(b.y - a.y)), dUp = Math.abs(Math.atan2(Math.sin(brg - up), Math.cos(brg - up)));
            kind.push(dUp < Math.PI / 3 ? 'up' : dUp > Math.PI * 2 / 3 ? 'down' : null); }
        for (const k of ['up', 'down']) { let best = Infinity, bestMe = false;
            for (const b of order) { const T = (b.raceState && b.raceState.legTimes) || []; T.forEach((t, i) => { if (kind[i] === k && t > 0 && t < best - 1e-9) { best = t; bestMe = b === me; } else if (kind[i] === k && Math.abs(t - best) < 1e-9 && b !== me) bestMe = false; }); }
            out[k === 'up' ? 'fastestUp' : 'fastestDown'] = bestMe; }
        return out;
    },

    // The winner's margin over second, or null while it can't be known (second still sailing and the clock not yet past
    // the winner's time + 30 s — Crimson asks only 'was it 30 s or more?').
    _margin(order, me) {
        if (order[0] !== me || !me.raceState.finished) return 0;
        const second = order[1]; if (!second) return Infinity;
        if (second.raceState.finished && !second.raceState.resultStatus) return second.raceState.finishTime - me.raceState.finishTime;
        const over = state.race && (state.race.status === 'finished' || order.every(b => b.raceState.finished || b.raceState.resultStatus));
        if (over || state.race.timer - me.raceState.finishTime >= 30) return Math.max(30, state.race.timer - me.raceState.finishTime);
        return null;
    },
    // THE ODOMETER PAIR: is the player's distance sailed the shortest / the longest in the fleet? true / false, or
    // null while it can't be known yet — the winner finishes first, so the rest are still sailing; poll() keeps
    // asking. A boat still out there with more already sailed can't be shorter; with more, it is already longer.
    _odometer(order, me) {
        const dist = (b) => ((b.raceState && b.raceState.legDistances) || []).reduce((a, c) => a + c, 0), mine = dist(me);
        const over = state.race && (state.race.status === 'finished' || order.every(b => b.raceState.finished || b.raceState.resultStatus));
        let short = true, long = true;
        for (const b of order) { if (b === me || b.raceState.resultStatus) continue; const d = dist(b), done = b.raceState.finished;
            if (done && d < mine) short = false; if (!done && d < mine && !over) short = short === false ? false : null;
            if (d > mine) long = false; if (!done && d <= mine && !over) long = long === false ? false : null; }
        return { distShortest: short, distLongest: long };
    },

    // ── the stores ────────────────────────────────────────────────────────────────
    _read(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } },
    _write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* no store: this session only */ } },
    store() {
        const s = this._read(UNLOCKS_KEY);
        s.earned = s.earned || {};
        s.unseen = s.unseen || [];
        s.rivals = s.rivals || [];
        return s;
    },
    career() {
        const c = this._read(CAREER_KEY);
        for (const k of ['races', 'finishes', 'wins', 'podiums', 'fifthStreak']) c[k] = c[k] || 0;
        c.venues = c.venues || {};
        return c;
    },

    // ── who is available ──────────────────────────────────────────────────────────
    achievementFor(name) { return ACHIEVEMENTS.find(a => a.char === name) || null; },
    gated(name) { return !!this.achievementFor(name); },
    // A character with an objective but no art yet (Wake): earnable, remembered, and shown
    // on the venue card — but not in the picker, the fleet or a ceremony until he ships.
    shipped(name) { return typeof AI_CONFIG !== 'undefined' && AI_CONFIG.some(c => c.name === name); },
    // The objective text, with the venue's current target time filled in where it needs one.
    hintOf(a) {
        if (typeof a.hint !== 'function') return a.hint;
        const d = a.venue && window.VenueDoc && window.VenueDoc.get(a.venue);
        return a.hint(d && d.records && d.records.provisional);
    },
    forVenue(key) { return ACHIEVEMENTS.filter(a => a.venue === key); },
    isEarned(name) { return !!this.store().earned[name]; },
    isUnlocked(name) {
        if (!this.enforced() || STARTING_TEN.includes(name)) return true;
        return !!this.store().earned[name];
    },
    // The opponents a single race may draw from. Unchanged (same array, same order) when
    // nothing is enforced, so the rng stream and every eval fleet stay exactly as they were.
    fleetPool(available) {
        if (!this.enforced()) return available;
        const earned = this.store().earned;
        return available.filter(c => STARTING_TEN.includes(c.name) || earned[c.name]);
    },
    // New rivals owed a place in this fleet: up to two, oldest first, from the pool given.
    // Read-only — the promise is only spent when a race actually starts (onRaceStart), so
    // browsing venues, which rebuilds the fleet, costs nobody a race.
    rivalsFor(pool) {
        if (!this.enforced()) return [];
        const out = [];
        for (const r of this.store().rivals) {
            if (out.length >= RIVAL_SLOTS_PER_RACE) break;
            const c = pool.find(p => p.name === r.name);
            if (c) out.push(c);
        }
        // THE SHARK YOU ARE HUNTING always sails too: the ladder's next rung asks you to beat it, so a fleet without
        // it would make the rung a lottery. A slot of its own, on top of the new unlocks' two.
        const hunt = this.huntTarget(), hc = hunt && pool.find(p => p.name === hunt);
        if (hc && !out.includes(hc)) out.push(hc);
        return out;
    },
    // The shark the ladder's next unearned rung asks you to beat (its `prey`), once you have it; else null.
    huntTarget() {
        const earned = this.store().earned;
        for (const a of ACHIEVEMENTS) {
            if (a.family !== 'sharks' || !a.prey || earned[a.char]) continue;
            return (STARTING_TEN.includes(a.prey) || earned[a.prey]) ? a.prey : null;
        }
        return null;
    },
    onRaceStart(boats) {
        if (!this.enforced()) return;
        const s = this.store();
        if (!s.rivals.length) return;
        // Any race a new rival sails counts toward their three — the owed slot or a lucky draw.
        const racing = new Set(boats.filter(b => !b.isPlayer).map(b => b.name));
        for (const r of s.rivals) if (racing.has(r.name)) r.left--;
        s.rivals = s.rivals.filter(r => r.left > 0);
        this._write(UNLOCKS_KEY, s);
    },

    // ── this race ─────────────────────────────────────────────────────────────────
    // Everything a criterion may ask of the race just sailed, from the results page's own
    // finish order. `nextHome` is left undefined until the boat right behind you is known.
    raceFacts(order) {
        const me = order.find(b => b.isPlayer);
        if (!me) return null;
        const rs = me.raceState;
        const finished = rs.finished && !rs.resultStatus;
        const pos = order.indexOf(me) + 1;
        const tops = rs.legTopSpeeds || [];
        const r = {
            venue: settings.venue,
            finished, status: rs.resultStatus || (rs.finished ? 'FIN' : null),
            pos: finished ? pos : null,
            fleet: order.length,
            // A SOLO race — Time Trials, just you and your ghost (Wes, Sep 27 2026). It counts only for the rows about
            // the course (soloCounts), and never for a win, a place, a star or a career count.
            solo: order.length === 1,
            won: finished && pos === 1 && order.length > 1,
            penalties: rs.totalPenalties || 0,
            // how many of the fleet were penalized this race (Bramble's 'Untouchable')
            rivalsPenalized: order.filter(b => !b.isPlayer && ((b.raceState && b.raceState.totalPenalties) || 0) > 0).length,
            served: (state.race.unlocks && state.race.unlocks.served) || 0,
            rulesOn: !!settings.penaltiesEnabled,
            time: rs.finishTime,
            timeTrial: typeof recordsEligible === 'function' ? !!recordsEligible() : false,
            target: (() => { const d = window.VenueDoc && VenueDoc.get(settings.venue); return (d && d.records && d.records.provisional) || 0; })(),
            stars: (finished && order.length > 1 && window.Series) ? Series.raceFacts(rs, pos).stars : 0,
            // LEG & MARK CRAFT: your rank at each mark (the last is the finish), where the start put you, and the
            // fleet's fastest up- and downwind legs (is yours the fastest of anyone's?)
            legRanks: (rs.legRanks || []).slice(), startRank: rs.startRank || 0,
            ...Unlocks._legBests(order, me),
            ...Unlocks._odometer(order, me),
            // who finished behind you (or never did) — Grip's held rival must be one of them; your margin over second
            behind: order.slice(pos).map(b => b.name), marginAhead: Unlocks._margin(order, me),
            // who raced (the Shark Pack's 'beat X' rows only count races X was in)
            rivals: order.filter(b => !b.isPlayer).map(b => b.name),
            // seconds after the gun you crossed the start line (null if you never started)
            startDelay: rs.startLegDuration != null ? rs.startLegDuration : null,
            feats: Object.keys((state.race.unlocks && state.race.unlocks.feats) || {}),
            // A feat may carry a value — the passage you came through last, how many alligators
            // you have put down — kept per race, the latest value winning.
            vals: Object.assign({}, (state.race.unlocks && state.race.unlocks.vals) || {}),
            topSpeed: tops.length ? Math.max(...tops) : 0,
            firstMarkRank: (rs.legRanks && rs.legRanks.length) ? rs.legRanks[0] : null,
            nextHome: undefined,
        };
        // The boat directly behind you in the results. Known once a boat has crossed after
        // you AND the clock has passed its time — a penalty turn converts to +15s at the
        // line, so someone crossing later could still slot in between until then.
        if (finished) {
            const behind = order[pos];
            const settled = behind && behind.raceState.finished && !behind.raceState.resultStatus
                && (state.race.status === 'finished' || state.race.timer >= behind.raceState.finishTime);
            if (settled) r.nextHome = behind.name;
            else if (!behind || behind.raceState.resultStatus) r.nextHome = null;   // nobody finished behind you
            else if (state.race.status === 'finished') r.nextHome = null;
        }
        return r;
    },

    // Is the player's own place final? Their crossing may carry +15s per un-taken turn, so a
    // boat still out there can slip ahead until the clock passes the player's time.
    _settled(order) {
        const me = order.find(b => b.isPlayer);
        if (!me || !me.raceState.finished) return false;
        return state.race.status === 'finished' || !!me.raceState.resultStatus
            || state.race.timer >= me.raceState.finishTime
            || order.every(b => b.raceState.finished);
    },

    // Called on every results-page tick. Counts the race into the career once, when the
    // player's place is final, and grants what it earned; then keeps checking only the
    // criteria that were still undecided (Snap), until the race is torn down.
    poll(order) {
        if (!this.enforced() || !state.race) return [];
        const ctx = state.race.unlocks;
        if (!ctx || !ctx.eligible) return [];
        if (!ctx.counted) {
            if (!this._settled(order)) return [];
            return this._count(order, ctx);
        }
        if (!ctx.pending || !ctx.pending.length) return [];
        const r = this.raceFacts(order);
        return r ? this._grantFrom(ctx.pending, r, this.career(), ctx) : [];
    },
    // Leaving the race (Rematch, the clubhouse, the standings) before the place settled
    // counts it with the order as it stands — the same order the series table takes.
    flush(order) {
        if (!this.enforced() || !state.race) return [];
        const ctx = state.race.unlocks;
        if (!ctx || !ctx.eligible) return [];
        if (ctx.counted) return [];
        const me = order.find(b => b.isPlayer);
        if (!me || !me.raceState.finished) return [];
        return this._count(order, ctx);
    },
    _count(order, ctx) {
        ctx.counted = true;
        const r = this.raceFacts(order);
        if (!r) return [];
        const c = this.career();
        const v = c.venues[r.venue] || (c.venues[r.venue] = { races: 0, finishes: 0, wins: 0 });
        // the career counts and streaks are races against the fleet: a solo trial neither adds to them nor breaks them
        if (!r.solo) {
        c.races++;
        if (r.finished) c.finishes++;
        if (r.won) c.wins++;
        if (r.finished && r.pos <= 3) c.podiums++;
        c.fifthStreak = (r.finished && r.pos === 5) ? c.fifthStreak + 1 : 0;
        c.startStreak = (r.feats || []).includes('start:first') ? (c.startStreak || 0) + 1 : 0;   // first across the start, races running
        v.races++;
        if (r.finished) v.finishes++;
        if (r.won) v.wins++;
        }
        v.stars = Math.max(v.stars || 0, r.stars || 0);
        // the wind bands won in (Chroma's Every Colour): light <= 8 kn, medium, heavy >= 18 kn
        const aw = (r.vals || {})['wind:avg'];
        if (r.won && aw != null) { const band = aw <= 8 ? 'light' : aw >= 18 ? 'heavy' : 'medium'; c.windBands = [...new Set([...(c.windBands || []), band])]; }   // the best stars ever at this venue, any race (the Grand Tour rungs)
        // The passages a venue's races were finished by (Gatorgrass Bayou's maze): the race's
        // '<venue>:route' value, added to the venue's set on a finish.
        const route = r.finished && r.vals && r.vals[r.venue + ':route'];
        if (route) v.routes = [...new Set([...(v.routes || []), route])];
        // ...or several a race, as feats '<venue>:route:<id>' (Spoonbill Flats' passages)
        const many = r.finished ? (r.feats || []).filter(f => f.startsWith(r.venue + ':route:')).map(f => f.slice(r.venue.length + 7)) : [];
        if (many.length) v.routes = [...new Set([...(v.routes || []), ...many])];
        // the last three results at the venue, in order (a DNF is a null and breaks a run) — Clubhouse Point's
        // consistency rung reads them
        v.recent = [...(v.recent || []), r.finished ? r.time : null].slice(-3);
        // the venues where you have beaten your own ghost in Time Trials (Phantom's 'Ghost Story')
        if (r.finished && (r.feats || []).includes('ghost:beaten')) c.ghostVenues = [...new Set([...(c.ghostVenues || []), r.venue])];
        // HEAD TO HEAD, per rival, over the races that rival was in (the Shark Pack ladder): `streak` = races in a
        // row you finished ahead of them (a race they sat out neither counts nor breaks it), `venues` = where you
        // have beaten them at least once. Solo trials never reach here with rivals.
        const h2h = c.h2h || (c.h2h = {});
        for (const n of r.rivals || []) {
            const e = h2h[n] || (h2h[n] = { streak: 0, clean: 0, venues: [], vs: {} });
            const beat = r.finished && (r.behind || []).includes(n);
            e.streak = beat ? e.streak + 1 : 0;
            e.clean = (beat && r.penalties === 0) ? (e.clean || 0) + 1 : 0;           // ...and without a penalty
            e.vs = e.vs || {}; e.vs[r.venue] = beat ? (e.vs[r.venue] || 0) + 1 : 0;    // ...in a row at this venue
            if (beat && !e.venues.includes(r.venue)) e.venues.push(r.venue);
        }
        this._write(CAREER_KEY, c);
        const earned = this.store().earned;
        return this._grantFrom(ACHIEVEMENTS.filter(a => !earned[a.char]), r, c, ctx);
    },
    // Which rows a SOLO race may earn: the venue rungs about the course — mechanic, explorer, target, wildlife — but
    // not Redrock's give-way, which needs rivals. Everything else is about the fleet (Wes, Sep 27 2026).
    soloCounts(a) { return a.family === 'trials' || (['mechanic', 'explorer', 'target', 'wildlife'].includes(a.rung) && a.char !== 'Sawbill'); },
    _grantFrom(list, r, c, ctx) {
        const got = [], pending = [];
        if (r.solo) list = list.filter(a => this.soloCounts(a));
        for (const a of list) {
            let v = null;
            try { v = a.test(r, c); } catch (e) { v = false; }
            if (v === true) got.push(a.char);
            else if (v === null) pending.push(a);
        }
        // A row that reads what you have EARNED (Dapple: every other shark) gets a second look with this race's
        // grants counted, so the last shark and the whale shark can arrive together.
        if (got.length) { r.grantedNow = got.slice();
            for (const a of list) { if (got.includes(a.char)) continue; let v = false; try { v = a.test(r, c); } catch (e) { v = false; } if (v === true) got.push(a.char); } }
        ctx.pending = pending.filter(a => !got.includes(a.char));
        if (got.length) this.grant(got, r.venue);
        return got;
    },

    grant(names, venue) {
        const s = this.store();
        // Names without art yet are earned all the same (see `shipped`); the ceremony and the
        // rival guarantee wait for them — unseen() and the pool only ever hold shipped names.
        const fresh = names.filter(n => !s.earned[n] && this.gated(n));
        if (!fresh.length) return [];
        for (const n of fresh) {
            s.earned[n] = { at: Date.now(), venue: venue || null };
            s.unseen.push(n);
            s.rivals.push({ name: n, left: RIVAL_RACES });
        }
        this._write(UNLOCKS_KEY, s);
        return fresh;
    },

    // ── a Series, when its last race is scored ─────────────────────────────────────
    // Series.summary() (null for a Cup, or a series not sailed to the end). Counts the series into the career
    // and tests the 'series' rows only; every other row reads a single race and ignores `r.series`.
    seriesFinal(S) {
        if (!this.enforced() || !S) return [];
        const c = this.career();
        c.seriesDone = (c.seriesDone || 0) + 1;
        this._write(CAREER_KEY, c);
        const earned = this.store().earned, r = { series: S, venue: null, feats: [], vals: {} }, got = [];
        for (const a of ACHIEVEMENTS) { if (a.family !== 'series' || earned[a.char]) continue;
            let v = false; try { v = a.test(r, c); } catch (e) { v = false; } if (v === true) got.push(a.char); }
        if (got.length) this.grant(got, null);
        return got;
    },

    // ── Sailing School ────────────────────────────────────────────────────────────
    // The school has no results page of its own kind, so it reports what happened:
    //   schoolSection()          a section began — its feats start clean
    //   schoolEvent('unit',  {})  a section was completed (not skipped)
    //   schoolEvent('start', { late, ocs })   a start-practice crossing
    //   schoolEvent('race',  { won, stars })  the graduation race finished
    _schoolFeats: new Set(),
    schoolSection() { this._schoolFeats = new Set(); },
    schoolEvent(kind, d) {
        if (!this.enforced()) return [];
        d = d || {};
        const units = (window.School && School.progress && School.progress().units) || {};
        const r = {
            venue: 'pond', school: kind, finished: true,
            won: !!d.won, clean: !!d.clean,
            startOk: kind === 'start' && !d.ocs && d.late != null && d.late <= 2,
            sectionDone: kind === 'unit' || kind === 'race',
            unitsAll: [1, 2, 3, 4].every(n => !!units[n]),
            feats: [...this._schoolFeats],
        };
        const c = this.career(), earned = this.store().earned;
        const got = [];
        for (const a of ACHIEVEMENTS) {
            if (a.venue !== 'pond' || earned[a.char]) continue;
            let v = false;
            try { v = a.test(r, c); } catch (e) { v = false; }
            if (v === true) got.push(a.char);
        }
        if (got.length) this.grant(got, 'pond');
        return got;
    },

    // ── the ceremony queue ────────────────────────────────────────────────────────
    // Presented weakest to strongest so a pile-up ends on the best thing that happened.
    unseen() {
        const power = (n) => { const c = AI_CONFIG.find(a => a.name === n); return c ? Object.values(c.stats || {}).reduce((a, b) => a + b, 0) : 0; };
        return this.store().unseen.filter(n => this.shipped(n)).sort((a, b) => power(a) - power(b));
    },
    markSeen(names) {
        const s = this.store();
        s.unseen = s.unseen.filter(n => !names.includes(n));
        this._write(UNLOCKS_KEY, s);
    },
};
window.Unlocks = Unlocks;

// Penalty turns the player actually sailed, this race. Counted here from the physics' event
// rather than kept on raceState, whose every field is hashed by the golden traces.
if (typeof GameEvents !== 'undefined') GameEvents.on('player-penalty-served', () => {
    const ctx = state.race && state.race.unlocks;
    if (ctx) ctx.served = (ctx.served || 0) + 1;
});
// Venue feats — a ship's bow crossed (sim/course.js), gulls put up, a bait boil sailed
// through (wildlife.js). Kept per race, read by raceFacts as `feats`.
if (typeof GameEvents !== 'undefined') GameEvents.on('player-feat', (e) => {
    if (!e || !e.id) return;
    const ctx = state.race && state.race.unlocks;
    if (ctx) (ctx.feats || (ctx.feats = {}))[e.id] = true;
    if (ctx && e.value !== undefined) (ctx.vals || (ctx.vals = {}))[e.id] = e.value;
    if (window.School && School.active) Unlocks._schoolFeats.add(e.id);
});

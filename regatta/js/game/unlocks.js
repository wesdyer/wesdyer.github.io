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

    // ── Lighthouse Cove `bay` (designed Sep 25 2026) ──────────────────────────────────
    // Three animals live here — gulls, porpoises, pelicans (js/wildlife.js) — and each has
    // its racer. Wake (the porpoise) shipped Sep 25 2026 with the Cove.
    { char: 'Roll', venue: 'bay', rung: 'first-win', title: 'The Witness',
      hint: 'Win a race at Lighthouse Cove.',
      test: (r) => r.venue === 'bay' && r.won },
    { char: 'Wake', venue: 'bay', rung: 'mechanic', title: 'Ahead of the Ship',
      hint: "Cross a cargo ship's bow within 3 boat lengths, then finish the race.",
      test: (r) => r.venue === 'bay' && r.finished && r.feats.includes('bay:bow-cross') },
    { char: 'Zeffir', venue: 'bay', rung: 'explorer', title: 'Gull Rock',
      hint: 'Put up the gulls on the rock east of the lighthouse island, then finish the race.',
      test: (r) => r.venue === 'bay' && r.finished && r.feats.includes('bay:gulls') },
    { char: 'Plunge', venue: 'bay', rung: 'target', title: 'Precision Diver',
      hint: (t) => t ? `Beat the Cove's target time of ${fmtTarget(t)} in Time Trials.` : "Beat the Cove's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'bay' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Piper', venue: 'bay', rung: 'four-stars', title: 'Home Waters',
      hint: 'Earn four stars in one race at the Cove: win, no penalties, lead at every mark, and sail on manual trim.',
      test: (r) => r.venue === 'bay' && r.stars === 4 },
    { char: 'Scoop', venue: 'bay', rung: 'wildlife', title: 'Pelican Patrol',
      hint: 'Sail through a bait boil while the pelicans are diving, then finish the race.',
      test: (r) => r.venue === 'bay' && r.finished && r.feats.includes('bay:bait-boil') },

    // ── Stillwater Lake `lake` (designed Sep 25 2026) ─────────────────────────────────
    // Animals: loons (Diver), a moose in the west lily bed (Timber), beavers (scenery).
    { char: 'Lunker', venue: 'lake', rung: 'first-win', title: 'Trophy Catch',
      hint: 'Win a race at Stillwater Lake.',
      test: (r) => r.venue === 'lake' && r.won },
    { char: 'Diver', venue: 'lake', rung: 'mechanic', title: 'Through the Glass',
      hint: 'Carry your speed through the calm around mark 3 — never below 4.5 knots from entering the glass until you leave it — then finish the race.',
      test: (r) => r.venue === 'lake' && r.finished && r.feats.includes('lake:glass') },
    { char: 'Timber', venue: 'lake', rung: 'explorer', title: 'Wake the Neighbour',
      hint: 'Startle the moose in the lily bed on the west shore, then finish the race.',
      test: (r) => r.venue === 'lake' && r.finished && r.feats.includes('lake:moose') },
    { char: 'Gasket', venue: 'lake', rung: 'target', title: 'Built This Place',
      hint: (t) => t ? `Beat the Lake's target time of ${fmtTarget(t)} in Time Trials.` : "Beat the Lake's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'lake' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Torpedo', venue: 'lake', rung: 'four-stars', title: 'Knows the Water',
      hint: 'Earn four stars in one race at the Lake: win, no penalties, lead at every mark, and sail on manual trim.',
      test: (r) => r.venue === 'lake' && r.stars === 4 },

    // ── Gatorgrass Bayou `swamp` (designed Sep 25 2026) ──────────────────────────────
    // The bayou is a maze: four passages lead from the start to the windward gate (the
    // Cut over the mud bar, the East channel, the West bayou, the Long Way — ROUTE_GATES in
    // sim/course.js). Animals (js/wildlife.js): alligators on the channel banks (Flit),
    // great egrets on the marsh edges, anhingas drying on snags in the West (Quill). Beau,
    // Flit and Quill shipped Sep 25 2026; Chomp stays a saltwater crocodile (Wes).
    { char: 'Chomp', venue: 'swamp', rung: 'first-win', title: 'The Witness',
      hint: 'Win a race at Gatorgrass Bayou.',
      test: (r) => r.venue === 'swamp' && r.won },
    { char: 'Croak', venue: 'swamp', rung: 'mechanic', title: 'Know the Bayou',
      hint: 'Finish races at the Bayou through three different passages: the Cut over the mud bar, the East channel round the tip of the long ridge, the West bayou, or the Long Way round the south.',
      test: (r, c) => r.venue === 'swamp' && r.finished && (((c.venues.swamp || {}).routes) || []).length >= 3,
      progress: (c) => [(((c.venues || {}).swamp || {}).routes || []).length, 3] },
    { char: 'Flit', venue: 'swamp', rung: 'explorer', title: 'Wake the Bayou',
      hint: 'Put down five alligators in one race (sail close enough that they sink out of sight), then finish the race.',
      test: (r) => r.venue === 'swamp' && r.finished && ((r.vals || {})['swamp:gators'] || 0) >= 5 },
    { char: 'Etienne', venue: 'swamp', rung: 'target', title: 'Bayou Classic',
      hint: (t) => t ? `Beat the Bayou's target time of ${fmtTarget(t)} in Time Trials.` : "Beat the Bayou's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'swamp' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Beau', venue: 'swamp', rung: 'four-stars', title: 'Landlord',
      hint: 'Earn four stars in one race at the Bayou: win, no penalties, lead at every mark, and sail on manual trim.',
      test: (r) => r.venue === 'swamp' && r.stars === 4 },
    { char: 'Quill', venue: 'swamp', rung: 'wildlife', title: 'Snakebird',
      hint: 'Sail the West bayou and put up the anhingas drying their wings on the dead snags, then finish the race.',
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
      hint: 'Sail the run home — down the gorge from the start line to the finish — without touching a rock, a log or the bank, then finish the race.',
      test: (r) => r.venue === 'river' && r.finished && !r.feats.includes('river:scraped') },
    { char: 'Grizzle', venue: 'river', rung: 'explorer', title: 'Shoot the Chute',
      hint: 'On the run home, take the chute: the east arm round the finish island, through the white water past the bear on the gravel bar. Then finish the race.',
      test: (r) => r.venue === 'river' && r.finished && r.feats.includes('river:chute') },
    { char: 'Riffle', venue: 'river', rung: 'target', title: 'White Water',
      hint: (t) => t ? `Beat Sockeye Run's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Sockeye Run's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'river' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Seam', venue: 'river', rung: 'four-stars', title: 'Reads the Seam',
      hint: 'Earn four stars in one race at Sockeye Run: win, no penalties, lead at every mark, and sail on manual trim.',
      test: (r) => r.venue === 'river' && r.stars === 4 },

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
      hint: 'On the run home, hold 15 knots or more for 30 seconds straight — ride one wave onto the next — then finish the race.',
      test: (r) => r.venue === 'ocean' && r.finished && r.feats.includes('ocean:linked') },
    { char: 'Mola', venue: 'ocean', rung: 'explorer', title: 'The Far Island',
      hint: 'On the run home, sail all the way round the offshore island to the south, then finish the race.',
      test: (r) => r.venue === 'ocean' && r.finished && r.feats.includes('ocean:far-island') },
    { char: 'Roam', venue: 'ocean', rung: 'target', title: 'Blue Water',
      hint: (t) => t ? `Beat Bluewater Bonanza's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Bluewater Bonanza's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'ocean' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Torrent', venue: 'ocean', rung: 'four-stars', title: 'Straight Line',
      hint: 'Earn four stars in one race at Bluewater Bonanza: win, no penalties, lead at every mark, and sail on manual trim.',
      test: (r) => r.venue === 'ocean' && r.stars === 4 },
    { char: 'Song', venue: 'ocean', rung: 'wildlife', title: 'Mother and Calf',
      hint: 'Shoot the gap between the island\'s south point and the coral rock, and sail alongside the humpback mother and calf resting in the lee just past it, then finish the race.',
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
      hint: 'In one race, make three different rivals give way to you in the junction round mark 3, and finish with sailing rules on and no penalties.',
      test: (r) => r.venue === 'redrock' && r.finished && r.rulesOn && r.penalties === 0 && ((r.vals || {})['redrock:gave-way'] || 0) >= 3 },
    { char: 'Trek', venue: 'redrock', rung: 'explorer', title: 'Condor Butte',
      hint: 'Sail all the way round the butte island in the north-west basin, where the condors roost, then finish the race.',
      test: (r) => r.venue === 'redrock' && r.finished && r.feats.includes('redrock:butte') },
    { char: 'Ridge', venue: 'redrock', rung: 'target', title: 'Canyon Record',
      hint: (t) => t ? `Beat Redrock Reservoir's target time of ${fmtTarget(t)} in Time Trials.` : "Beat Redrock Reservoir's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'redrock' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Talon', venue: 'redrock', rung: 'four-stars', title: 'Owns the Canyon',
      hint: 'Earn four stars in one race at Redrock Reservoir: win, no penalties, lead at every mark, and sail on manual trim.',
      test: (r) => r.venue === 'redrock' && r.stars === 4 },
    { char: 'Linesider', venue: 'redrock', rung: 'wildlife', title: 'Boil Chaser',
      hint: 'In one race, sail through three striper boils — the patches of white water where striped bass drive shad to the surface — then finish.',
      test: (r) => r.venue === 'redrock' && r.finished && ((r.vals || {})['redrock:boils'] || 0) >= 3 },

    // ── Pearl Lagoon `lagoon` (designed Sep 25 2026) ─────────────────────────────────
    // The squalls are the venue: Wes made them 25% larger and 50% slower the same day so a
    // front can be ridden. Animals (js/wildlife.js): green sea turtles on the seagrass,
    // spotted eagle rays over the sand, blacktip reef sharks in the reef-flat shallows — all
    // scenery; Landfall's cay is shape-5. All five characters were already in the roster.
    { char: 'Pearl', venue: 'lagoon', rung: 'first-win', title: 'Found in the Lagoon',
      hint: 'Win a race at Pearl Lagoon.',
      test: (r) => r.venue === 'lagoon' && r.won },
    { char: 'Nimbus', venue: 'lagoon', rung: 'mechanic', title: 'Ride the Cell',
      hint: "Ride a squall's gust front — the leading edge of the rain — for 15 seconds without falling off it, then finish the race.",
      test: (r) => r.venue === 'lagoon' && r.finished && r.feats.includes('lagoon:squall-ride') },
    { char: 'Ribbon', venue: 'lagoon', rung: 'explorer', title: 'Landfall',
      hint: 'Sail round the lagoon side of the palm cay south of mark 5, from the reef on one side to the reef on the other, then finish the race.',
      test: (r) => r.venue === 'lagoon' && r.finished && r.feats.includes('lagoon:landfall') },
    { char: 'Jester', venue: 'lagoon', rung: 'target', title: 'Found Him',
      hint: (t) => t ? `Beat the Lagoon's target time of ${fmtTarget(t)} in Time Trials.` : "Beat the Lagoon's target time in Time Trials (target coming).",
      test: (r) => r.venue === 'lagoon' && r.finished && r.timeTrial && r.target > 0 && r.time < r.target },
    { char: 'Puff', venue: 'lagoon', rung: 'four-stars', title: 'Effortless',
      hint: 'Earn four stars in one race at the Lagoon: win, no penalties, lead at every mark, and sail on manual trim.',
      test: (r) => r.venue === 'lagoon' && r.stars === 4 },

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
      hint: 'In Sailing School start practice, cross the line within 2 seconds of the gun without being over early.',
      test: (r) => r.school === 'start' && r.startOk },
    { char: 'Bask', venue: 'pond', rung: 'wildlife', title: 'Sunbathers',
      hint: 'Send the turtles sliding off their log during Sailing School, then finish that section.',
      test: (r) => !!r.school && r.sectionDone && r.feats.includes('pond:turtles') },
    // Not four stars: the school runs on auto trim and never teaches manual. Instead, the
    // graduation debrief's best report — none of the three classmates' mistakes, no penalty.
    { char: 'Wisp', venue: 'pond', rung: 'report', title: 'Clean Report Card',
      hint: "Graduate with a clean report card: start on time without being over early, don't pinch on the beat, drop the spinnaker in time, and take no penalties.",
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
        return out;
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
            won: finished && pos === 1,
            penalties: rs.totalPenalties || 0,
            served: (state.race.unlocks && state.race.unlocks.served) || 0,
            rulesOn: !!settings.penaltiesEnabled,
            time: rs.finishTime,
            timeTrial: typeof recordsEligible === 'function' ? !!recordsEligible() : false,
            target: (() => { const d = window.VenueDoc && VenueDoc.get(settings.venue); return (d && d.records && d.records.provisional) || 0; })(),
            stars: (finished && window.Series) ? Series.raceFacts(rs, pos).stars : 0,
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
        c.races++;
        if (r.finished) c.finishes++;
        if (r.won) c.wins++;
        if (r.finished && r.pos <= 3) c.podiums++;
        c.fifthStreak = (r.finished && r.pos === 5) ? c.fifthStreak + 1 : 0;
        const v = c.venues[r.venue] || (c.venues[r.venue] = { races: 0, finishes: 0, wins: 0 });
        v.races++;
        if (r.finished) v.finishes++;
        if (r.won) v.wins++;
        // The passages a venue's races were finished by (Gatorgrass Bayou's maze): the race's
        // '<venue>:route' value, added to the venue's set on a finish.
        const route = r.finished && r.vals && r.vals[r.venue + ':route'];
        if (route) v.routes = [...new Set([...(v.routes || []), route])];
        this._write(CAREER_KEY, c);
        const earned = this.store().earned;
        return this._grantFrom(ACHIEVEMENTS.filter(a => !earned[a.char]), r, c, ctx);
    },
    _grantFrom(list, r, c, ctx) {
        const got = [], pending = [];
        for (const a of list) {
            let v = null;
            try { v = a.test(r, c); } catch (e) { v = false; }
            if (v === true) got.push(a.char);
            else if (v === null) pending.push(a);
        }
        ctx.pending = pending;
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

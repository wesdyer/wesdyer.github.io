// regatta/js/wildlife.js — THE ANIMALS THAT LIVE AT A VENUE (not the ones that race).
//
// Wes, Sep 25 2026: every venue gets three animal types. They are scenery first, and each
// can also be the subject of a venue objective (achievements, js/game/unlocks.js). Lighthouse
// Cove is the first: gulls, porpoises, pelicans.
//
// Three behaviours, written once and configured per venue in WILDLIFE below:
//   · COLONY    birds perched on a shape; a boat coming close puts them up; they wheel over
//               the rock and settle again. `feat` names the objective the player earns.
//   · PODS      porpoises that run ahead of a moving vessel's bow (the harbour porpoise's
//               habit, and Wake's objective), plus a resident pod that loops the harbour.
//   · FEEDERS   a line of big birds on patrol that diverts to a BAIT BOIL — a patch of
//               baitfish breaking the surface, spawned off the course from time to time — and
//               plunge-dives on it. Sailing through a boil while they are feeding is `feat`.
//   · FOLLOWERS birds orbiting astern of a working boat (gulls behind the trawler).
//   · BASKERS   turtles lined up on a log (a prop); a boat close by sends them sliding into
//               the water, one after another; they climb back out later. `feat` as colony.
//   · DIVERS    water birds that swim on the surface and dive, popping up somewhere else
//               (grebes, loons; `pair` keeps two together and lets them dance), and
//               beavers, which slap and dive and sometimes tow a stick.
//   · CRUISERS  animals that live UNDER the surface and are seen through it (race-view.md
//               §10.6): a `depth` sets how far the water veils them and how far their shadow
//               on the bottom sits from them. They wander a home area (shapes or a circle),
//               dart off deeper when a boat comes close; `formation` flies a squadron behind
//               a leader (eagle rays, which now and then leap); `breathe` brings one up so
//               only its head breaks the surface (sea turtles).
//   · POPPERS   animals that live under the water and pop their heads up to look about — the
//               Cove's harbour seals "bottling" — then sink and glide off under the surface,
//               a dim seal-shaped shape you can follow, to surface again nearby. A head turns
//               to watch the nearest boat; a boat too close puts it straight down.
//   · LEAPERS   fish that jump clear somewhere in view now and then and splash back (the
//               Lake's bass); nothing to catch, it just says the water is alive.
//   · SHOALS    schools of small reef fish (the Lagoon's tangs) that drift round a coral head
//               in a loose cloud and scatter from a boat, regrouping after.
//   · FISHERS   a big animal standing in the shallows at the edge of fast water, facing
//               upstream, that lunges for fish and sometimes comes up with one; a boat close
//               by makes it rear up to look (Sockeye Run's brown bears). It does not run.
//   · RUNS      fish holding station in slack water beside the stream, all nosed upstream,
//               that dart off from a boat and drift back (the sockeye run). LEAPERS with
//               `rapids` puts the leaping ones in the white water, jumping upstream.
//   · SOARERS   big raptors circling high over the water that now and then stoop on a run of
//               fish, snatch one and climb away with it (Sockeye Run's bald eagles).
//   · ROMPERS   a family that rests on a logjam, slides in and swims the bank in a line,
//               porpoising, dives together from a boat and surfaces further off (river otters).
//   · WHALES    pods of humpbacks travelling loops across the water: surfacing in slow arcs
//               with a blow, diving fluke-up, and now and then breaching, lobtailing or pec-
//               slapping; one pod is a MOTHER AND CALF (Bluewater Bonanza — Song's objective).
//   · RIDERS    spinner dolphins that come and ride the bow of any boat going fast, and a
//               resident school that spins (Bluewater Bonanza).
//   · FLYERS    flying fish bursting from under the bow of a fast boat and gliding clear.
//   · GLIDERS   albatross dynamic-soaring low over the swell in long banked arcs.
//   BASKERS also carries the Bayou's bullfrogs: `all` puts a group on every matching log
//   that is not under a crown, `banks` adds groups on the mud at the water's edge, and a
//   frog HOPS in where a turtle slides.
//   · LURKERS   big animals lying still at the water's edge that sink out of sight when a boat
//               comes close and surface a little way off (Gatorgrass Bayou's alligators).
//               The player's count of the ones they put down is a feat VALUE.
//   · STALKERS  wading birds on the marsh edges that fly off low when a boat comes close
//               and land further along (the Bayou's great egrets).
//   · PERCHERS  birds drying on a perch (a named prop); a boat close by drops them into
//               the water, where they swim, and later climb back (the Bayou's anhingas).
//   · WADERS    a big animal feeding in a shallow bed (the moose) that walks off to the
//               nearest open bank and into the trees when a boat comes close, then returns.
//               Drawn in drawPerched, above the land it walks onto.
//
// Plus the Sailing School's ducklings, which school.js moves and drawDucklings draws.
//
// SIZE: guidelines/scale.md — 1 unit = 10 cm (the boat is 18 ft). Animals are drawn at true
// size x3 with a 20-unit floor, in their true size order; measure with eval/_animal_sizes.js.
//
// ⚠️ NEVER Math.random(). That is the seeded simulation stream (the eval harness pins it) and
// ambient life must not move a race. Everything here draws from its own PRNG, seeded by the
// venue key, so the same venue always starts with the same birds and nothing else changes.
//
// ⚠️ NOTHING HERE TOUCHES A BOAT. No collision, no wind, no lee. update() runs on the sim
// clock (pause-correct, headless-safe) only so that what the player sees is where the
// objective is judged.
//
// Feats are announced on GameEvents as 'player-feat' { id } — once per race each — and
// unlocks.js listens. Only during 'racing', only for the player, only before they finish.
//
// Classic script; global scope. Loaded after traffic.js; reads `state` and the traffic list
// at call time.

(function () {
    // ── per-venue configuration ──────────────────────────────────────────────────────────
    const WILDLIFE = {
        bay: {
            // Zeffir's objective: the rock east of the lighthouse island (Wes chose shape-36).
            colonies: [{ id: 'gull-rock', shape: 'shape-36', count: 18, kind: 'gull', flushR: 165, feat: 'bay:gulls' }],
            followers: [{ traffic: /trawler/, count: 5, kind: 'gull' }],
            // Wake's pods run ahead of the cargo ships; one pod lives in the harbour.
            pods: { ships: /cargo-ship/, perShip: 3, resident: 3 },
            // Scoop's pelicans and their bait boils.
            feeders: { kind: 'pelican', count: 5, feat: 'bay:bait-boil' },
            // Harbour seals, the Cove's fourth animal (Sep 25 2026, Wes — every venue has four
            // but the pond; Roll, the Cove's first-win character, is one): two round the rocks
            // off the east island by the start, two off the west island on the leg to mark 3,
            // one by the rocks near mark 1. [cx, cy, r] each.
            poppers: { kind: 'seal', reactR: 55, lookR: 350, at: [[2350, 1300, 300], [2600, 1450, 300], [-450, -450, 280], [-700, -700, 280], [900, -1500, 260]] },
        },
        // Duckling Pond (Sailing School). The ducklings are school.js's own; these are the
        // other two animals. The log is whichever drift log Wes places in the pond's water.
        pond: {
            baskers: [{ id: 'turtle-log', prop: /swamp-driftlog|river-log|lake-log-fallen/, count: 6, flushR: 130, feat: 'pond:turtles' }],
            divers: [{ kind: 'grebe', count: 2, r: 420, reactR: 80, pair: true }],
        },
        // Stillwater Lake. The moose stands in the west lily bed (shape-39, Wes's pick) — a
        // real detour into the light west side; the loons work the open middle of the lake and
        // dive when a boat comes close; the beavers live along the east shore (scenery only —
        // Wes may add a beaver dam later).
        lake: {
            waders: [{ id: 'moose', shape: 'shape-39', kind: 'moose', flushR: 170, feat: 'lake:moose' }],
            // Bass jumping clear and splashing back in, somewhere near the player (Sep 25 2026, Wes).
            leapers: { kind: 'bass', every: [4, 9], near: [180, 650] },
            divers: [{ kind: 'loon', count: 2, cx: 1500, cy: -300, r: 650, reactR: 150, pair: true },
                     { kind: 'beaver', count: 2, cx: 2250, cy: 250, r: 320, reactR: 130 }],
        },
        // Gatorgrass Bayou (designed Sep 25 2026). Twenty-one alligators on the channel banks
        // of the maze, every ~450 u along the four passages' own routes, 45-75 u off the mud
        // (placed and measured by the swamp probes): a race through one passage puts down 1-4
        // without trying (fleet mean 1.8, Wes's races 0-3); 7-8 lie within easy reach of the
        // Cut and East lines, so Flit's five takes weaving to the banks on purpose. Great
        // egrets stalk the marsh edges by the Cut and East; the anhingas dry their wings on
        // three cypress knees in the West passage (Quill's objective — the passage nobody sails).
        swamp: {
            lurkers: { kind: 'gator', reactR: 110, feat: 'swamp:gators', at: [
                [-991, 723, 0.79], [-376, 243, 0.00], [-661, -42, -0.79], [-886, -342, -0.79], [-1186, -792, -0.79], [-1606, -1062, -0.79],
                [-1441, -1302, 1.57], [-1096, -1227, 1.57], [779, -1962, 2.36], [-1681, 2508, 1.57], [-586, 1563, 0.79], [-466, 1233, 0.79],
                [14, 1113, 2.36], [224, 1653, 1.57], [734, 1428, 1.57], [1079, 1263, 0.00], [899, 903, 0.00], [1544, -627, 0.00],
                [-2476, 858, 0.00], [-2386, 528, 0.00], [-2491, -342, 0.00]] },
            stalkers: { kind: 'egret', reactR: 130, at: [[-1306, 1248], [-481, 378], [-1891, -1317], [-1396, -1647], [-1246, 2043], [224, 1443], [1064, 3]] },
            // Their own dead snags, in the only open-sky water the West passage has — its
            // channel is a cypress swamp, and a bird under a crown is a bird nobody sees. 100 u
            // off the West route's line, so sailing the West puts them up.
            perchers: { kind: 'anhinga', at: [[-2640, 1160], [-2560, 220], [-2600, -200]], flushR: 150, feat: 'swamp:anhingas' },
            // Bullfrogs (Sep 25 2026, Wes): a few on every drift log out in the open (four of
            // the seven; the rest are under crowns) and on the mud at three banks by the Cut and
            // East. They hop in when a boat comes close and climb back out when it is quiet.
            baskers: [{ id: 'frogs', kind: 'frog', prop: /swamp-driftlog/, all: true, openOnly: true, count: 3, flushR: 70,
                        banks: [[-977, 652, 6.48], [-637, -101, 6.68], [71, 1075, 7.26]] }],
        },
        // Pearl Lagoon (designed Sep 25 2026). Three scenery animals, all seen through clear
        // shallow water: green sea turtles grazing the two seagrass beds the course crosses,
        // a squadron of spotted eagle rays over the open sand between marks 3, 4 and 5, and
        // blacktip reef sharks on the reef-flat shoals beside mark 3 and on the 4→5 leg.
        lagoon: {
            cruisers: [
                { id: 'turtles', kind: 'seaturtle', count: 4, over: ['shape-33', 'shape-32'], reactR: 110, breathe: true },
                { id: 'rays', kind: 'eagleray', count: 5, cx: 600, cy: -500, r: 650, reactR: 150, formation: true },
                { id: 'sharks-3', kind: 'reefshark', count: 3, over: ['shape-34'], pad: 120, reactR: 130 },
                { id: 'sharks-45', kind: 'reefshark', count: 2, over: ['shape-10'], pad: 120, reactR: 130 },
            ],
            // Schools of tangs round three coral heads by the course (Sep 25 2026, Wes): yellow
            // at the staghorn by mark 3 and the brain coral on the leg home, blue at the pillar
            // on the 3->4 leg. A cloud of bright slivers — a tang is flat, so from above it is a
            // thin fleck — that scatters from a boat and gathers again.
            shoals: [{ kind: 'yellowtang', count: 26, prop: 'prop-43', reactR: 110 },
                     { kind: 'bluetang', count: 20, prop: 'prop-34', reactR: 110 },
                     { kind: 'yellowtang', count: 22, prop: 'prop-8', reactR: 110 }],
        },
        // Sockeye Run (designed Sep 25 2026). The stream runs toward the finish; the salmon
        // run the other way. Placed by eval/_river_spots.js in the shallows 20-60 u off the bank.
        //   · Brown bears fishing: one on the island shore at the head of the CHUTE (the east arm
        //     round the finish island, 80 u above its gate — Grizzle's objective sails past it,
        //     the west arm is 250 u off), one on the slack gravel bar of the north eddy on the
        //     run home (190-330 u off everyone's line). [x, y] each.
        //   · The sockeye run holding in slack water beside the rapids — by the chute bear, in
        //     the eddy, below the first logjam, above the rock garden — and leaping up the white
        //     water wherever the player is in it.
        //   · Bald eagles circling over the lower gorge, the eddy and the finish arms — each
        //     within a stoop (900 u) of a run, which it now and then takes. [cx, cy, r] each.
        //   · River otters: a family of four on each logjam.
        river: {
            fishers: { kind: 'bear', lookR: 240, at: [[5500, -6070], [2320, -4300]] },
            runs: { kind: 'sockeye', reactR: 95, at: [[5575, -6190, 34], [2330, -4335, 40], [1180, -1050, 32], [4740, -4990, 28]] },
            // Wes, Sep 25: "more jumping salmon!" — a leap every second or so wherever the player
            // is in white water, two to four at a time one after another (they jump a rapid in
            // bunches), and now and then one out of a holding run in view.
            leapers: { kind: 'salmon', every: [0.5, 1.3], near: [120, 620], rapids: 0.3, burst: [3, 6], fromRuns: [1.5, 4] },
            soarers: { kind: 'eagle', at: [[1350, -1500, 260], [2700, -4000, 300], [5250, -5850, 250]] },
            rompers: { kind: 'otter', count: 4, reactR: 120, homes: ['prop-5', 'prop-6'] },
        },
        // Bluewater Bonanza (designed Sep 25 2026, Wes). Humpback pods travel loops across the
        // water, "mostly travelling, but occasionally breaching, tail splash or fin splash"; the
        // MOTHER AND CALF drift a slow circuit in the lee of the point just past the gap (Wes: you shoot the gap to reach them)
        // between the point and the coral rock — Song's objective is finding them. Spinner
        // dolphins ride the bow of any fast boat; flying fish burst from under bows on the run;
        // Laysan albatross glide low over the swell. Paths checked clear of land and shoal
        // with the whole pod's spread (±180 u).
        ocean: {
            whales: { calfR: 250, feat: 'ocean:calf', pods: [
                { id: 'calf', calf: true, speed: 14, path: [[8350, -4020], [8650, -4100], [8850, -4230], [8550, -4180]] },   // resting in the lee of the point, just past the gap (Wes: players have to shoot the gap) — 800 u from the open route south of the rock
                // Sizes as Hawaiian breeding-ground surveys find them (Wes, Sep 25: "maybe 3-5 other
                // groups with variable number of whales", and more of them — he sailed round and saw
                // none): pairs and singles the commonest, a trio, and one COMPETITIVE GROUP of five —
                // males jostling round a female, fast and splashy. Spread over every leg, not just the run.
                { id: 'D', n: 5, speed: 90, rowdy: true, path: [[-2400, -5000], [-900, -5300], [-700, -4500], [-2300, -4300]] },   // across the beat, clear of the start line
                { id: 'G', n: 2, speed: 50, path: [[-2500, -3900], [300, -4100], [-500, -3300], [-2600, -3100]] },   // below the beat
                { id: 'E', n: 2, speed: 55, path: [[-5000, -4200], [-3700, -1900], [-4200, -400], [-5400, -2600]] },   // along the reach
                { id: 'A', n: 2, speed: 60, path: [[-500, -1900], [5000, -1300], [5200, -300], [-600, -800]] },   // the run, first half
                { id: 'B', n: 1, speed: 50, path: [[3500, -2500], [9500, -2100], [9700, -1300], [3600, -1500]] },   // the run, inshore
                { id: 'C', n: 3, speed: 55, path: [[2000, 600], [9000, 1200], [8800, 2400], [2200, 1700]] },   // the offshore lane
            ] },
            riders: { schools: 3, perSchool: 5, minKn: 10, reach: 1600, resident: { cx: -3200, cy: -4800, r: 700, n: 6 } },
            // Wes, Sep 25: "too many flying fish — patches of ocean that cause them". Schools live in a
            // few patches that drift slowly; only a fast boat inside one puts them up.
            // Wes, Sep 25 (again): "I haven't seen any mahi mahi or flying fish" — random patches missed
            // his lanes. Now ten patches ON the lanes (the beat, the reach, and inshore / direct /
            // offshore on the run), so every route passes some; hunts happen on screen.
            flyers: { minKn: 9, every: [0.6, 1.4], near: 1400, r: [500, 700],
                at: [[-1200, -5200], [-2200, -3700], [-4800, -3000], [-2000, -1200], [2500, -2500], [3500, -500], [3500, 1300], [7500, -1700], [8500, 600], [11500, -1300],
                     [-2600, -6900], [-800, 3300], [800, 8600], [6800, 5600]],   // the far side of the beat, and the far-island route
                // the mahi: packs of 2-3 in most patches, hunting every 12-25 s when a boat is within
                // ~1000 u (on screen), and whenever a boat puts the school up
                hunters: { share: 0.4, n: [2, 3], every: [12, 25], seeR: 1000, rest: 25 } },   // Wes: ~2-3 hunts a race
            gliders: { count: 2, orbit: [350, 900] },   // Wes: "50% less" than three — one always, one about half the time
        },
        // Redrock Reservoir (designed Sep 25 2026, Wes chose the four): Lake Powell's STRIPED BASS
        // boils — stripers drive shad to the surface and the water boils white, drifts with the
        // school, goes down and comes up somewhere else (Linesider's objective counts the ones you
        // sail through); CALIFORNIA CONDORS circling the north-west butte (Vermilion Cliffs is the
        // real release site; Trek's Condor Butte sends you round it), one now and then gliding out
        // over the course; DESERT BIGHORN bands grazing at the foot of the towers and talus, which
        // bound up the rock when a boat comes close; COYOTES trotting the sand islands, stopping
        // to stare at the fleet, going down to the water to drink.
        redrock: {
            // [cx, cy, r] zones of open water on or beside the course (every point ≥180 u from
            // land, eval/_redrock_spots.js): the start basin, the west basin by mark 2, the
            // junction, the mark-5 arm, the mark-4 arm, off mark 7, and the butte's water.
            stripers: { feat: 'redrock:boils', live: 2, life: [40, 70], gap: [6, 16], r: [55, 75],
                zones: [[-1800, -700, 350], [-2200, -750, 250], [-400, -200, 150], [300, 1300, 150], [1150, -580, 120], [-1270, 700, 100], [-2900, -1600, 300]] },
            condors: { roost: [-2401, -1491], circles: [190, 260, 330],
                // the wanderer's glide out over the course and home: start basin, the junction,
                // the mark-5 arm, off mark 7, the west basin
                wander: [[-1700, -800], [-300, -250], [300, 1100], [-1200, 750], [-2200, -600]] },
            bighorn: { lookR: 340, reactR: 150, bands: [['prop-64', 5], ['prop-23', 4], ['prop-22', 6], ['prop-20', 3]] },
            coyotes: { lookR: 280, reactR: 110, on: [['shape-17', 2], ['shape-19', 1], ['shape-18', 1]] },
            // COMMON CARP jumping (Wes, Sep 25 2026 — "we need a jumping fish type"): Powell's
            // carp throw themselves clear near the walls and in the coves, nearly straight up,
            // and fall back flat on their side with a slap; often a second time from the same spot.
            leapers: { kind: 'carp', every: [6, 12], near: [180, 650], shore: [30, 170], repeat: 0.35 },
        },
    };

    // Larger than life on purpose (guidelines/scale.md: a real gull spans 14 units and
    // vanishes); still clearly smaller than a 55-unit hull.
    const GULL_SPAN = 38, PELICAN_SPAN = 58, PORPOISE_LEN = 40;
    // Body lengths (bill/nose to tail) set by guidelines/scale.md — true x3, floor 20, in true
    // order where they share water: duckling 22 < turtle 27 < grebe 29 (pond); loon 32 <
    // beaver 36 < moose (lake). Measured by eval/_animal_sizes.js; were 33/55/65/53 (Sep 25).
    const TURTLE_SCALE = 1.0, GREBE_SCALE = 0.87, LOON_SCALE = 1.0, BEAVER_SCALE = 1.3;
    // Pearl Lagoon's (scale.md): green sea turtle 1.2 m -> ~26 (about 2x: a broad shell with
    // spread flippers reads by its footprint, and Wes found 3x too large); spotted eagle ray
    // body ~24 long, disc ~44 across, ~58 snout to tail tip (about a hull); blacktip reef shark 1.4 m -> ~40
    // (measured by eval/_animal_sizes.js, Sep 25 2026).
    // Gatorgrass Bayou's (scale.md): American alligator 3.5 m -> ~48 nose to tail tip (about
    // 1.4x: a broad animal, and one the size of the boat would read as a monster); great egret
    // 1 m -> ~28 standing, ~42 across the wings; anhinga 0.85 m -> ~24, ~32 with wings spread.
    const GATOR_SCALE = 1.5, EGRET_SCALE = 1.45, ANHINGA_SCALE = 1.35;
    // Under the 20-unit floor on purpose (scale.md's floor is for an animal that must read on
    // its own; these read as a group, or by their splash): bullfrog 15 cm -> ~10 on its log;
    // a jumping bass 40 cm -> ~14 in the air; a tang 20 cm -> ~8 in a school of twenty-odd.
    const FROG_SCALE = 1.4, BASS_LEN = 14, TANG_SCALE = 1.25;
    // A harbour seal: the head that pops up is 0.2 m (under the floor on purpose — it reads by
    // its ring and its watching), ~10 across; the body gliding under the water is 1.6 m, ~28
    // long (about 2x, a broad animal). It swims ~20 u/s under water, under a body length a second.
    const SEAL_HEAD = 2.1, SEAL_BODY = 1.6, SEAL_SWIM = 20;
    const SEATURTLE_SCALE = 1.05, RAY_SCALE = 1.05, SHARK_SCALE = 1.4;
    // Sockeye Run's (scale.md): brown bear 2.2 m -> ~46 nose to rump (about 2x: a broad
    // animal — at 58 it stood as long as the hull and read as a monster); sockeye 0.6 m -> ~18 (a run reads as a group, rule
    // 7); bald eagle 0.9 m long, 2 m across -> ~27 and ~58 (the pelican's span); river otter
    // 1.1 m with its tail -> ~32. Swimming at one to two body lengths a second.
    const BEAR_SCALE = 1.85, SOCKEYE_LEN = 18, EAGLE_SCALE = 1.8, OTTER_SCALE = 2.0;
    const OTTER_SWIM = 30, EAGLE_SOAR = 32;
    // Bluewater Bonanza's (scale.md): a humpback is 14 m — 140 u TRUE, already 2.5 hulls, so it
    // is drawn at true size (the ×3 rule is for animals that would vanish; this one would fill
    // the screen); the calf is ~5 m, ~48. Spinner dolphin 2 m -> ~40 (the Cove porpoise's size);
    // flying fish 0.3 m -> ~12 across the wing-fins (a group, rule 7); Laysan albatross 2 m span
    // -> ~60 (the pelican's). A pod cruises ~0.25 body lengths a second — whales are slow.
    const WHALE_LEN = 132, CALF_LEN = 48, SPINNER_LEN = 26, FLYFISH_SPAN = 20, ALB_SPAN = 60, MAHI_LEN = 30;   // mahi 1 m -> 30 (x3)
    // Spawning sockeye (close-up references, Sep 25): a vivid crimson body, the head a light
    // yellowish olive-green from snout to gill, darker on top, the hooked jaw pale cream; olive
    // tail and fins. Fresh-run fish not yet turned are silver-grey with a grey-green head.
    const SOCKEYE = { body: '#d8232f', head: '#8a9a45', crown: '#5f6f2e', jaw: '#e9e2c6', tail: '#6a7236',
                      silver: '#a7aca6', silverHead: '#70796a', silverTail: '#6c716a' };
    // The ray's whip tail, native units from the tail base. Counted in its size: Wes found the
    // first ray 'huge tip to tail' (46 native x 1.45 = ~100 u, nearly two hulls, Sep 25).
    const RAY_TAIL = 32;
    // Cruise speeds, units a second, and how much faster a startled one goes.
    const CRUISE = { seaturtle: 20, eagleray: 34, reefshark: 42 }, FLEE_MUL = 2.6;
    const BOIL_R = 75;

    let cfg = null, rnd = null, T = 0;
    let colonies = [], followers = [], pods = [], resident = null, flight = null, boil = null, baskers = [], divers = [], waders = [], cruisers = [], lurkers = [], stalkers = [], perchers = [], leaps = [], shoals = [], poppers = [];
    let fishers = [], runs = [], soarers = [], rompers = [];
    let stripers = [], nextStriper = 0, boilsHit = 0, condors = [], bands = [], coyotes = [];
    let whalePods = [], blows = [], splashes = [], riders = [], flyfish = [], gliders = [], nextFly = 0, prints = [], flyPatches = [];
    let lurkWoken = new Set(), nextLeap = 0, nextRunLeap = 0;
    let nextBoil = 0, feats = new Set(), lastRaceSig = null;

    function mulberry(seed) {
        return function () {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
    const R = (a, b) => a + rnd() * (b - a);
    const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    const onLand = (x, y) => (typeof pointOnLand === 'function') ? pointOnLand(x, y) : false;
    // Is (x, y) under a tree's crown? An animal there is drawn under the canopy and nobody sees it.
    function underCrown(x, y) {
        const K = (window.VenueDoc && VenueDoc.PROP_KINDS) || {};
        // a tree is a trunk on the surface plane with a CROWN part drawn over everything
        const crowned = (k) => k && (k.plane === 'canopy' || (k.parts && k.parts.canopy));
        return ((state.course && state.course.props) || []).some(t => crowned(K[t.kind])
            && Math.hypot(t.x - x, t.y - y) < (K[t.kind].world || 100) * (t.scale || 1) * 0.5 + 10);
    }

    function venueKey() { return (state.course && state.course.venueKey) || (typeof settings !== 'undefined' ? settings.venue : null); }

    // ── lifecycle ─────────────────────────────────────────────────────────────────────────
    function init() {
        const key = venueKey();
        cfg = WILDLIFE[key] || null;
        colonies = []; followers = []; pods = []; resident = null; flight = null; boil = null; baskers = []; divers = []; waders = []; cruisers = []; lurkers = []; stalkers = []; perchers = []; leaps = []; shoals = []; poppers = []; lurkWoken = new Set(); nextLeap = 0; nextRunLeap = 0;
        fishers = []; runs = []; soarers = []; rompers = [];
        stripers = []; nextStriper = 0; boilsHit = 0; condors = []; bands = []; coyotes = [];
        whalePods = []; blows = []; splashes = []; riders = []; flyfish = []; gliders = []; nextFly = 0; prints = []; flyPatches = [];
        feats = new Set(); T = 0;
        if (!cfg) return;
        rnd = mulberry(hashStr('wildlife:' + key));
        for (const c of cfg.colonies || []) {
            const isl = (state.course.islands || []).find(s => s.id === c.shape);
            if (!isl || !isl.vertices || isl.vertices.length < 3) continue;
            colonies.push(makeColony(c, isl));
        }
        for (const f of cfg.followers || []) {
            followers.push({ cfg: f, birds: Array.from({ length: f.count }, () => ({ a: R(0, 7), r: R(60, 150), w: R(0.5, 0.9) * (rnd() < 0.5 ? -1 : 1), z: R(28, 55), flap: R(0, 7) })) });
        }
        if (cfg.pods) {
            resident = makeResidentPod(cfg.pods.resident || 0);
        }
        if (cfg.feeders) {
            flight = makeFlight(cfg.feeders);
            nextBoil = R(25, 40);
        }
        for (const c of cfg.baskers || []) {
            const props = (state.course && state.course.props) || [];
            const logs = c.all ? props.filter(p => c.prop.test(p.kind)) : [props.find(p => c.prop.test(p.kind))].filter(Boolean);
            for (const log of logs) if (!c.openOnly || !underCrown(log.x, log.y)) baskers.push(makeBaskers(c, log));
            // a bank: a short stretch of mud at the water's edge, laid along heading h
            for (const [x, y, h] of c.banks || []) baskers.push(makeBaskers(c, { x, y, heading: h, kind: 'bank', scale: 0.55 }));
        }
        if (cfg.leapers) nextLeap = R(2, 5);
        if (cfg.poppers) poppers = cfg.poppers.at.map(([cx, cy, r], i) => {
            const p = popSpot(cx, cy, r) || { x: cx, y: cy };
            return { i, cx, cy, r, x: p.x, y: p.y, h: R(0, 7), look: R(0, 7), mode: i % 2 ? 'up' : 'under', t: R(1, 6), tx: p.x, ty: p.y, vis: i % 2 ? 1 : 0, bob: R(0, 7), ring: 0, ring2: 0, vx: 0, vy: 0 };
        });
        for (const c of cfg.shoals || []) {
            const pr = ((state.course && state.course.props) || []).find(q => q.id === c.prop);
            if (pr) shoals.push(makeShoal(c, pr));
        }
        for (const d of cfg.divers || []) divers.push(makeDivers(d));
        for (const w of cfg.waders || []) {
            const isl = (state.course.islands || []).find(x => x.id === w.shape);
            if (isl) waders.push(makeWader(w, isl));
        }
        for (const c of cfg.cruisers || []) { const G = makeCruisers(c); if (G) cruisers.push(G); }
        if (cfg.lurkers) lurkers = cfg.lurkers.at.map(([x, y, h], i) => ({ i, hx: x, hy: y, x, y, h: h + R(-0.3, 0.3), mode: 'float', t: R(4, 12), sink: 0, ring: 0, bob: R(0, 7), trail: [], trailT: 0 }));
        if (cfg.stalkers) stalkers = cfg.stalkers.at.map(([x, y], i) => ({ i, x, y, h: R(0, 7), mode: 'stand', t: R(2, 6), z: 0, flap: 0, neck: 0, tx: x, ty: y, bob: R(0, 7) }));
        if (cfg.whales) {
            whalePods = cfg.whales.pods.map((P, i) => makeWhalePod(P, i));
            // SPREAD OUT from the start (Wes, Sep 25: "I saw two pods coming together … they should be
            // spaced out and maybe even avoid each other"): each pod starts at the point of its loop
            // farthest from the pods already placed.
            for (let i = 0; i < whalePods.length; i++) { const W = whalePods[i]; let best = W.s, bd = -1;
                for (let k = 0; k < 24; k++) { const s = W.L * k / 24, q = _podAt(W, s); let md = 1e9;
                    for (let j = 0; j < i; j++) { const o = _podAt(whalePods[j], whalePods[j].s); md = Math.min(md, Math.hypot(q.x - o.x, q.y - o.y)); }
                    if (md > bd) { bd = md; best = s; } }
                W.s = best; }
        }
        if (cfg.riders) riders = makeRiders(cfg.riders);
        if (cfg.flyers && cfg.flyers.at) { const F = cfg.flyers;
            for (const [x, y] of F.at) flyPatches.push({ x: x + R(-250, 250), y: y + R(-250, 250), r: R(F.r[0], F.r[1]), vx: R(-1.5, 1.5), vy: R(-1.5, 1.5), ripples: Array.from({ length: 14 }, () => ({ a: R(0, 7), d: Math.sqrt(rnd()), ph: R(0, 7) })) });
            if (F.hunters) for (const P of flyPatches) if (rnd() < F.hunters.share) {
                P.huntT = R(5, F.hunters.every[1]); const n = Math.round(R(F.hunters.n[0], F.hunters.n[1]));
                P.pack = Array.from({ length: n }, (_, i) => ({ i, x: P.x + R(-100, 100), y: P.y + R(-100, 100), h: R(0, 7), a: R(0, 7), dir: rnd() < 0.5 ? -1 : 1, mode: 'patrol', t: 0, top: R(430, 520), leap: 0, spd: 0, size: R(0.9, 1.1) })); } }
        if (cfg.gliders) gliders = Array.from({ length: cfg.gliders.count }, (_, i) => ({ i, x: 0, y: 0, placed: false, h: R(0, 7), ph: R(0, 7), z: 20, bank: 0, rad: R(cfg.gliders.orbit[0], cfg.gliders.orbit[1]), a: R(0, 7), dir: i % 2 ? 1 : -1 }));
        if (cfg.fishers) fishers = cfg.fishers.at.map(([x, y], i) => { const up = upstream(x, y); return { i, hx: x, hy: y, x, y, up, h: up, mode: 'watch', t: R(2, 6), look: 0, lunge: 0, splash: 0, fish: 0, bob: R(0, 7), rear: 0 }; });
        if (cfg.runs) runs = cfg.runs.at.map(([x, y, n]) => makeRun(cfg.runs, x, y, n));
        if (cfg.soarers) soarers = cfg.soarers.at.map(([cx, cy, r], i) => ({ i, cx, cy, r, a: R(0, 7), dir: i % 2 ? -1 : 1, z: R(90, 120), x: cx, y: cy, h: 0, flap: R(0, 7), mode: 'soar', t: R(15, 35), fish: 0, tx: 0, ty: 0, splash: 0, sx: 0, sy: 0 }));
        if (cfg.rompers) for (const id of cfg.rompers.homes) { const pr = ((state.course && state.course.props) || []).find(q => q.id === id); if (pr) { const F = makeRompers(cfg.rompers, pr); if (F) rompers.push(F); } }
        if (cfg.stripers) nextStriper = R(3, 8);
        if (cfg.condors) condors = makeCondors(cfg.condors);
        if (cfg.bighorn) for (const [id, n] of cfg.bighorn.bands) { const pr = ((state.course && state.course.props) || []).find(q => q.id === id); const G = pr && makeBand(pr, n); if (G) bands.push(G); }
        if (cfg.coyotes) coyotes = makeCoyotes(cfg.coyotes);
        if (cfg.perchers) for (const [px, py] of cfg.perchers.at) {
            perchers.push({ px, py, x: px, y: py, h: R(0, 7), ph: R(-0.8, 0.8), snag: R(0, 7), mode: 'dry', t: 0, flap: R(0, 7), sink: 0, splash: 0, trail: [], trailT: 0 });
        }
    }

    // Turtles along the log's length, all facing the same way along it, nose to tail.
    function makeBaskers(c, log) {
        const kinds = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        const len = ((kinds[log.kind] && kinds[log.kind].world) || 80) * (log.scale || 1);
        // Props are drawn with their long axis along the heading's up/down.
        const ax = Math.sin(log.heading || 0), ay = -Math.cos(log.heading || 0);
        const turtles = [];
        for (let i = 0; i < c.count; i++) {
            const t = (i + 0.5) / c.count - 0.5;
            // A little off the log's centre line, alternately, and not all facing one way.
            // Single file along the log's crest, nose to tail, nearly all facing the same way —
            // how every photograph of basking turtles has them — in a spread of sizes.
            const side = i % 2 ? 1 : -1, lat = side * R(0, 1.5);
            const hx = log.x + ax * t * len * 0.8 - ay * lat, hy = log.y + ay * t * len * 0.8 + ax * lat;
            turtles.push({ hx, hy, h: (log.heading || 0) + (i === 4 ? Math.PI : 0) + side * R(0, 0.18) + (c.kind === 'frog' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) + R(-0.5, 0.5) : 0), size: R(0.72, 1.0),
                           side, i, mode: 'bask', t: 0, delay: 0, ox: 0, oy: 0, ux: 0, uy: 0, wet: 0, peek: 0, look: R(0, 7) });
        }
        return { cfg: c, log, ax, ay, turtles };
    }
    // A group that swims between points on open water, dives, and comes up at the next —
    // and dives at once when a boat comes within `reactR`. Grebes, loons, beavers.
    function makeDivers(d) {
        const marks = (state.course && state.course.marks) || [];
        let cx = d.cx, cy = d.cy;
        if (cx == null) { cx = 0; cy = 0; for (const m of marks) { cx += m.x; cy += m.y; } if (marks.length) { cx /= marks.length; cy /= marks.length; } }
        const G = { cfg: d, cx, cy, r: d.r || 400, birds: [] };
        for (let i = 0; i < d.count; i++) {
            const p = waterPoint(G) || { x: cx, y: cy };
            const q = waterPoint(G) || p;
            G.birds.push({ i, x: p.x, y: p.y, h: Math.atan2(q.x - p.x, -(q.y - p.y)), tx: q.x, ty: q.y, mode: 'swim', t: R(6, 14),
                           splash: 0, slap: 0, trail: [], trailT: 0, sink: 0, rise: 0, flap: 0, yaw: 0, bob: R(0, 7),
                           stick: d.kind === 'beaver' && rnd() < 0.5 });
        }
        // A pair keeps company: the second swims just off the first's quarter.
        if (d.pair && G.birds.length > 1) { const a = G.birds[0]; for (const b of G.birds.slice(1)) { b.x = a.x - 30; b.y = a.y + 12; } }
        G.danceT = R(18, 30);
        return G;
    }
    // A point within the group's area, on water with room round it (never hugging a shore).
    function waterPoint(G) {
        for (let k = 0; k < 40; k++) {
            const a = R(0, Math.PI * 2), d = Math.sqrt(rnd()) * G.r;
            const x = G.cx + Math.cos(a) * d, y = G.cy + Math.sin(a) * d;
            if (onLand(x, y)) continue;
            let clear = true;
            for (let s = 0; s < 6 && clear; s++) { const b = s / 6 * Math.PI * 2; if (onLand(x + Math.cos(b) * 45, y + Math.sin(b) * 45)) clear = false; }
            if (clear) return { x, y };
        }
        return null;
    }
    // A wading animal standing in a shape (the moose in its lily bed). A boat close by and it
    // lifts its head, then wades off to the nearest shore and out of sight; it comes back later.
    function makeWader(w, isl) {
        let cx = 0, cy = 0;
        for (const p of isl.vertices) { cx += p.x; cy += p.y; }
        cx /= isl.vertices.length; cy /= isl.vertices.length;
        // WHERE IT WALKS OFF TO: the nearest OPEN bank — land that no tree crown covers, so it
        // is seen climbing out and standing on the shore — and beyond that, the forest it walks
        // into. Only real trees count as cover; knee-high shrubs in the crown layer do not.
        const kinds = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        const trees = ((state.course && state.course.props) || []).filter(p => p.plane === 'canopy' && ((kinds[p.kind] && kinds[p.kind].world) || 0) >= 60)
            .map(p => ({ x: p.x, y: p.y, r: kinds[p.kind].world * (p.scale || 1) * 0.45 }));
        const covered = (x, y) => trees.some(t => Math.hypot(t.x - x, t.y - y) < t.r);
        let best = null, bestD = Infinity;
        for (let k = 0; k < 36; k++) {
            const a = k / 36 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
            for (let d = 40; d < 700; d += 20) {
                const x = cx + ca * d, y = cy + sa * d;
                if (!onLand(x, y) || pointInPoly(x, y, isl.vertices)) continue;
                // the first land on this bearing: look a little inland for open ground
                for (let e = 20; e <= 100; e += 20) {
                    const bx = x + ca * e, by = y + sa * e;
                    if (onLand(bx, by) && !covered(bx, by)) {
                        if (d + e < bestD) {
                            let f = e + 40; while (f < e + 400 && !covered(x + ca * f, y + sa * f)) f += 20;
                            bestD = d + e; best = { bank: { x: bx, y: by }, forest: { x: x + ca * (f + 30), y: y + sa * (f + 30) } };
                        }
                        break;
                    }
                }
                break;
            }
        }
        best = best || { bank: { x: cx + 200, y: cy }, forest: { x: cx + 400, y: cy } };
        const home = Math.atan2(best.bank.x - cx, -(best.bank.y - cy)) + Math.PI;   // feeding, it faces away from the bank
        return { cfg: w, cx, cy, isl, shore: best.bank, forest: best.forest, x: cx, y: cy, h: home + R(-0.6, 0.6), mode: 'graze', t: 0, bob: R(0, 7), alpha: 1,
                 dip: 0, dipT: R(1, 3), under: false, drip: 0, back: 30, sway: 0, stepT: R(6, 12) };
    }

    function makeColony(c, isl) {
        const v = isl.vertices;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, cx = 0, cy = 0;
        for (const p of v) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); cx += p.x; cy += p.y; }
        cx /= v.length; cy /= v.length;
        const inside = (x, y) => (typeof pointInPoly === 'function') ? pointInPoly(x, y, v) : true;
        // Not under a bush: the venue's own props on the rock keep their footprint clear.
        const kinds = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        const covers = ((state.course && state.course.props) || [])
            .filter(p => p.x > minX - 200 && p.x < maxX + 200 && p.y > minY - 200 && p.y < maxY + 200)
            .map(p => ({ x: p.x, y: p.y, r: ((kinds[p.kind] && kinds[p.kind].world) || 40) * (p.scale || 1) / 2 + 8 }));
        // Gulls on a rock all face into the wind.
        const into = (state.wind && isFinite(state.wind.direction)) ? state.wind.direction : 0;
        const birds = [];
        for (let tries = 0; birds.length < c.count && tries < 1500; tries++) {
            const x = R(minX, maxX), y = R(minY, maxY);
            if (!inside(x, y)) continue;
            if (covers.some(p => Math.hypot(p.x - x, p.y - y) < p.r)) continue;
            if (birds.some(b => Math.hypot(b.hx - x, b.hy - y) < 20)) continue;
            birds.push({ hx: x, hy: y, x, y, z: 0, h: into + R(-0.35, 0.35), perchH: 0, mode: 'perched', t: 0, flap: R(0, 7), orbitA: 0, orbitR: 0, orbitW: 0 });
        }
        for (const b of birds) b.perchH = b.h;
        return { cfg: c, isl, cx, cy, birds, airborne: 0 };
    }

    function makeResidentPod(n) {
        if (!n) return null;
        const marks = (state.course && state.course.marks) || [];
        let cx = 0, cy = 0;
        for (const m of marks) { cx += m.x; cy += m.y; }
        if (marks.length) { cx /= marks.length; cy /= marks.length; }
        return { cx, cy, rx: 900, ry: 650, a: R(0, 7), speed: 26, members: Array.from({ length: n }, (_, i) => makePorpoise(i)) };
    }
    function makePorpoise(i) { return { off: (i - 1) * 42 + R(-10, 10), lead: R(-30, 30), next: R(0.5, 4), phase: -1, sx: 0, sy: 0, sh: 0 }; }

    function makeFlight(f) {
        return {
            cfg: f, mode: 'patrol', a: R(0, 7), x: 0, y: 0, h: 0, z: 70,
            birds: Array.from({ length: f.count }, (_, i) => ({ i, x: 0, y: 0, h: 0, z: 70, mode: 'fly', t: 0, flap: R(0, 7), orbitA: R(0, 7), orbitR: R(85, 140) })),
            nextDive: 0,
        };
    }

    // ── update ────────────────────────────────────────────────────────────────────────────
    function feat(id) {
        if (!id || feats.has(id)) return;
        feats.add(id);
        if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id });
    }
    function playerCanEarn() {
        const p = state.boats && state.boats.find(b => b.isPlayer);
        // In a race: from the gun until you finish. In Sailing School: any time (its lessons
        // are not races, and the school's own objective asks only for the section to end).
        if (p && window.School && School.active) return p;
        return (p && state.race && state.race.status === 'racing' && !p.raceState.finished) ? p : null;
    }

    function update(dt) {
        if (!cfg || !(dt > 0)) return;
        // A new race on the same venue (Rematch) re-runs initCourse; if it did not, reset here.
        const sig = state.race ? state.race.unlocks : null;
        if (sig !== lastRaceSig) { lastRaceSig = sig; feats = new Set(); lurkWoken = new Set(); boilsHit = 0; for (const B of stripers) B.hit = false; }
        T += dt;
        const me = playerCanEarn();
        for (const c of colonies) updateColony(c, dt, me);
        for (const f of followers) updateFollowers(f, dt);
        updatePods(dt);
        if (flight) updateFeeders(dt, me);
        for (const b of baskers) updateBaskers(b, dt, me);
        updateDivers(dt);
        updateWaders(dt, me);
        for (const G of cruisers) updateCruisers(G, dt);
        if (lurkers.length) updateLurkers(dt, me);
        if (stalkers.length) updateStalkers(dt);
        if (perchers.length) updatePerchers(dt, me);
        if (cfg.leapers) { updateLeapers(dt); if (cfg.leapers.fromRuns) updateRunLeaps(dt); }
        for (const G of shoals) updateShoal(G, dt);
        if (poppers.length) updatePoppers(dt);
        if (fishers.length) updateFishers(dt);
        for (const G of runs) updateRun(G, dt);
        if (soarers.length) updateSoarers(dt);
        for (const F of rompers) updateRompers(F, dt);
        if (whalePods.length) updateWhales(dt, me);
        if (riders.length) updateRiders(dt);
        if (cfg.flyers) updateFlyers(dt);
        if (gliders.length) updateGliders(dt);
        if (cfg.stripers) updateStripers(dt, me);
        if (condors.length) updateCondors(dt);
        if (bands.length) updateBands(dt);
        if (coyotes.length) updateCoyotes(dt);
    }

    // ── POPPERS: harbour seals ──────────────────────────────────────────────────────────
    function popSpot(cx, cy, r) {
        for (let k = 0; k < 30; k++) { const a = R(0, Math.PI * 2), d = Math.sqrt(rnd()) * r, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
            if (!onLand(x, y) && !onLand(x + 25, y) && !onLand(x - 25, y) && !onLand(x, y + 25) && !onLand(x, y - 25)) return { x, y }; }
        return null;
    }
    function updatePoppers(dt) {
        const c = cfg.poppers;
        for (const s of poppers) {
            s.t -= dt; s.bob += dt; s.ring = Math.max(0, s.ring - dt * 0.8); s.ring2 = Math.max(0, s.ring2 - dt * 0.6);
            const close = boatNear(s.x, s.y, c.reactR);
            if (s.mode === 'up') {
                // curious: the head turns to watch the nearest boat in sight
                const b = boatNear(s.x, s.y, c.lookR);
                const want = b ? Math.atan2(b.x - s.x, -(b.y - s.y)) : s.look + Math.sin(s.bob * 0.4) * 1.2;
                s.h += angDiff(want, s.h) * Math.min(1, dt * 1.6);
                if (close || s.t <= 0) { s.mode = 'sink'; s.t = close ? 0.35 : 0.7; s.ring = 1; if (close) s.away = close; }
            } else if (s.mode === 'sink') {
                s.vis = Math.max(0, s.vis - dt / (s.t > 0.4 ? 0.7 : 0.35));
                if (s.t <= 0) {
                    s.mode = 'under'; s.vis = 0; s.t = R(7, 14);
                    // off to a new spot — away from the boat that put it down
                    let p = null;
                    if (s.away) { const a = Math.atan2(s.x - s.away.x, -(s.y - s.away.y)); const x = s.x + Math.sin(a) * 160, y = s.y - Math.cos(a) * 160; if (!onLand(x, y)) p = { x, y }; s.away = null; }
                    p = p || popSpot(s.cx, s.cy, s.r) || { x: s.x, y: s.y };
                    s.tx = p.x; s.ty = p.y;
                }
            } else if (s.mode === 'under') {
                // gliding under the surface: a velocity eased toward the new spot, capped
                const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
                let wx = d > 1 ? dx / d * Math.min(SEAL_SWIM, d * 0.8) : 0, wy = d > 1 ? dy / d * Math.min(SEAL_SWIM, d * 0.8) : 0;
                const k = Math.min(1, dt * 1.5); s.vx += (wx - s.vx) * k; s.vy += (wy - s.vy) * k;
                const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
                if (!onLand(nx, ny)) { s.x = nx; s.y = ny; } else { s.tx = s.cx; s.ty = s.cy; }
                const sp = Math.hypot(s.vx, s.vy); if (sp > 2) s.h += angDiff(Math.atan2(s.vx, -s.vy), s.h) * Math.min(1, dt * 3);
                s.spd = sp;
                if ((s.t <= 0 && d < 30) || s.t < -6) { if (!boatNear(s.x, s.y, c.reactR * 2)) { s.mode = 'rise'; s.t = 0.7; s.ring2 = 1; } else s.t = 1; }
            } else if (s.mode === 'rise') {
                s.vis = Math.min(1, s.vis + dt / 0.7);
                s.vx *= 0.9; s.vy *= 0.9;
                if (s.t <= 0) { s.mode = 'up'; s.vis = 1; s.t = R(4, 10); s.look = s.h; }
            }
        }
    }

    // ── LEAPERS: a bass jumps clear somewhere near the player and splashes back ────────
    function updateLeapers(dt) {
        const c = cfg.leapers;
        for (const L of leaps) L.t += dt;
        leaps = leaps.filter(L => L.t < L.dur + 2.4);
        nextLeap -= dt;
        const me = state.boats && state.boats.find(b => b.isPlayer);
        if (nextLeap > 0 || !me) return;
        nextLeap = R(c.every[0], c.every[1]);
        for (let k = 0; k < 12; k++) {
            const a = R(0, Math.PI * 2), d = R(c.near[0], c.near[1]), x = me.x + Math.cos(a) * d, y = me.y + Math.sin(a) * d;
            if (onLand(x, y) || onLand(x + 20, y) || onLand(x - 20, y)) continue;
            if ((state.boats || []).some(b => Math.hypot(b.x - x, b.y - y) < 90)) continue;
            // a carp jumps near the shore: land within shore[1], but not within shore[0]
            if (c.shore && (landWithin(x, y, c.shore[0]) || !landWithin(x, y, c.shore[1]))) continue;
            // salmon leap only in the white water, and always upstream, against it
            if (c.rapids && !(typeof rapidsTurbAt === 'function' && rapidsTurbAt(x, y) >= c.rapids)) continue;
            const h = c.rapids ? upstream(x, y) + R(-0.35, 0.35) : R(0, Math.PI * 2);
            const n = c.burst ? Math.round(R(c.burst[0], c.burst[1])) : 1;
            for (let j = 0; j < n; j++) {
                // a bunch: each a little way off the first, starting a beat after the one before
                const ox = j ? R(-35, 35) : 0, oy = j ? R(-35, 35) : 0;
                if (j && (onLand(x + ox, y + oy) || (c.rapids && rapidsTurbAt(x + ox, y + oy) < c.rapids))) continue;
                leaps.push({ kind: c.kind, silver: rnd() < 0.3, x: x + ox, y: y + oy, h: h + (j ? R(-0.2, 0.2) : 0), t: -j * R(0.2, 0.5), dur: c.kind === 'carp' ? R(0.85, 1.1) : R(0.55, 0.8), size: R(0.85, 1.15), hop: c.kind === 'carp' ? R(18, 26) : R(14, 22), roll: rnd() < 0.5 ? -1 : 1 });
            }
            // the same carp, or its neighbour, going again from the same spot a moment later
            if (c.repeat && rnd() < c.repeat) leaps.push({ kind: c.kind, x: x + R(-12, 12), y: y + R(-12, 12), h: R(0, Math.PI * 2), t: -R(1.6, 3.2), dur: R(0.85, 1.1), size: R(0.85, 1.15), hop: R(16, 24), roll: rnd() < 0.5 ? -1 : 1 });
            break;
        }
    }
    // A salmon out of a holding run the player can see: one clears the water and drops back.
    function updateRunLeaps(dt) {
        const c = cfg.leapers;
        nextRunLeap -= dt;
        const me = state.boats && state.boats.find(b => b.isPlayer);
        if (nextRunLeap > 0 || !me || !runs.length) return;
        nextRunLeap = R(c.fromRuns[0], c.fromRuns[1]);
        const seen = runs.filter(G => Math.hypot(G.hx - me.x, G.hy - me.y) < 900);
        const G = seen[Math.floor(rnd() * seen.length)];
        if (!G || G.flee > 0) return;
        const f = G.fish[Math.floor(rnd() * G.fish.length)];
        leaps.push({ kind: c.kind, fromRun: true, silver: !!f.dull, x: f.x, y: f.y, h: G.up + R(-0.5, 0.5), t: 0, dur: R(0.5, 0.7), size: f.size, hop: R(10, 16) });
    }

    // ── SHOALS: tangs round a coral head ──────────────────────────────────────────────
    function makeShoal(c, pr) {
        const G = { cfg: c, hx: pr.x, hy: pr.y, cx: pr.x, cy: pr.y, a: R(0, 7), spread: 1, flee: 0, fx: 0, fy: 0, fish: [] };
        // Reef is water to a fish (the coral head sits on it); only sand and scrub are dry.
        // A coral head's own collider (a prop's `.hit` ring) is a wall to a boat, not to the fish
        // that live on it — the school starts inside it.
        G.dry = (x, y) => (state.course.islands || []).some(s => { if (/\.hit$/.test(s.id)) return false; const k = VenueDoc.traits ? VenueDoc.traits(s) : {}; return k.hard && !k.reef && pointInPoly(x, y, s.vertices); });
        for (let i = 0; i < c.count; i++) G.fish.push({ x: pr.x + R(-40, 40), y: pr.y + R(-40, 40), vx: 0, vy: 0, h: R(0, 7), ox: R(-1, 1), oy: R(-1, 1), ph: R(0, 7), sp: R(0.85, 1.15), size: R(0.8, 1.1) });
        return G;
    }
    function updateShoal(G, dt) {
        const c = G.cfg;
        // The school's centre circles its coral head, 40-90 u out, drifting in and out — slowly:
        // a tang cruises one or two body lengths a second (Wes, Sep 25: the first cut was
        // "way too fast"), so the school moves at ~4 u/s and each fish at up to ~12.
        G.a += dt * 0.05;
        let tx = G.hx + Math.cos(G.a) * (60 + 30 * Math.sin(G.a * 1.7)), ty = G.hy + Math.sin(G.a) * (60 + 30 * Math.sin(G.a * 1.3));
        const b = (state.boats || []).find(bt => Math.hypot(bt.x - G.cx, bt.y - G.cy) < c.reactR + 40);
        if (b) { G.flee = 1.6; const d = Math.hypot(G.cx - b.x, G.cy - b.y) || 1; G.fx = (G.cx - b.x) / d; G.fy = (G.cy - b.y) / d; }
        G.flee = Math.max(0, G.flee - dt);
        if (G.flee > 0) { tx = G.cx + G.fx * 90; ty = G.cy + G.fy * 90; }
        G.spread += ((G.flee > 0 ? 1.8 : 1) - G.spread) * Math.min(1, dt * (G.flee > 0 ? 2 : 0.4));
        // the centre moves toward its target at a capped speed: ~4 u/s cruising, ~30 fleeing
        const cdx = tx - G.cx, cdy = ty - G.cy, cd = Math.hypot(cdx, cdy), cv = Math.min(cd, (G.flee > 0 ? 30 : 4) * dt);
        if (cd > 0.01) { const nx = G.cx + cdx / cd * cv, ny = G.cy + cdy / cd * cv; if (!G.dry(nx, ny)) { G.cx = nx; G.cy = ny; } }
        const vmax = G.flee > 0 ? 45 : 12;
        for (const f of G.fish) {
            f.ph += dt * 2 * f.sp;
            // each keeps its own place in the cloud, which wanders slowly
            f.ox += Math.sin(f.ph * 0.23 + f.size * 9) * dt * 0.08; f.oy += Math.cos(f.ph * 0.19 + f.size * 7) * dt * 0.08;
            const L = Math.hypot(f.ox, f.oy); if (L > 1) { f.ox /= L; f.oy /= L; }
            const px = G.cx + f.ox * 38 * G.spread, py = G.cy + f.oy * 26 * G.spread;
            // steer the VELOCITY toward the place (a spring, capped), eased — no darting
            let wx = (px - f.x) * 0.9, wy = (py - f.y) * 0.9; const w = Math.hypot(wx, wy), cap = vmax * f.sp;
            if (w > cap) { wx *= cap / w; wy *= cap / w; }
            const k = Math.min(1, dt * (G.flee > 0 ? 3 : 1.2));
            f.vx += (wx - f.vx) * k; f.vy += (wy - f.vy) * k;
            const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
            if (!G.dry(nx, ny)) { f.x = nx; f.y = ny; }
            const spd = Math.hypot(f.vx, f.vy);
            if (spd > 1.5) f.h += angDiff(Math.atan2(f.vx, -f.vy), f.h) * Math.min(1, dt * 3);
            f.spd = spd;
        }
    }

    // The nearest boat inside r of (x, y), or null.
    function boatNear(x, y, r) {
        let best = null, bd = r;
        for (const b of state.boats || []) { if (b.opacity !== undefined && b.opacity < 0.2) continue; const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } }
        return best;
    }
    function recordTrail(o, dt, moving) {
        o.trailT += dt;
        if (o.trailT > 0.1) { o.trailT = 0; if (moving) { o.trail.unshift({ x: o.x, y: o.y }); if (o.trail.length > 16) o.trail.pop(); } else if (o.trail.length) o.trail.pop(); }
    }

    // ── LURKERS: alligators ────────────────────────────────────────────────────────────
    function updateLurkers(dt, me) {
        const c = cfg.lurkers;
        for (const g of lurkers) {
            g.t -= dt; g.bob += dt; g.ring = Math.max(0, g.ring - dt * 0.9);
            const moving = g.mode === 'swim';
            recordTrail(g, dt, moving);
            if (g.mode === 'float' || g.mode === 'swim') {
                const b = boatNear(g.x, g.y, c.reactR);
                if (b) {
                    g.mode = 'sink'; g.t = 0.9; g.ring = 1;
                    // Only the player's own approach counts toward the objective.
                    if (b === me && !lurkWoken.has(g.i)) {
                        lurkWoken.add(g.i);
                        if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: c.feat, value: lurkWoken.size });
                    }
                    continue;
                }
                if (g.mode === 'float' && g.t <= 0) { g.mode = 'swim'; g.t = R(3, 6); g.th = g.h + R(-0.9, 0.9); }
                else if (g.mode === 'swim') {
                    g.h += angDiff(g.th, g.h) * Math.min(1, dt * 1.5);
                    const nx = g.x + Math.sin(g.h) * 9 * dt, ny = g.y - Math.cos(g.h) * 9 * dt;
                    if (!onLand(nx, ny) && Math.hypot(nx - g.hx, ny - g.hy) < 70) { g.x = nx; g.y = ny; } else g.th = Math.atan2(g.hx - g.x, -(g.hy - g.y));
                    if (g.t <= 0) { g.mode = 'float'; g.t = R(8, 18); }
                }
            } else if (g.mode === 'sink') {
                g.sink = Math.min(1, g.sink + dt / 0.9);
                if (g.t <= 0) { g.mode = 'under'; g.t = R(9, 15); g.trail = []; }
            } else if (g.mode === 'under') {
                // Gone: it will come up a little way off, away from whatever put it down.
                if (g.t <= 0) {
                    if (boatNear(g.x, g.y, c.reactR * 1.6)) { g.t = 1.5; continue; }
                    let nx = g.x, ny = g.y;
                    for (let k = 0; k < 12; k++) { const a = R(0, Math.PI * 2), d = R(40, 120), x = g.hx + Math.cos(a) * d, y = g.hy + Math.sin(a) * d; if (!onLand(x, y)) { nx = x; ny = y; break; } }
                    g.x = nx; g.y = ny; g.h += R(-1.2, 1.2); g.mode = 'rise'; g.t = 1.2;
                }
            } else if (g.mode === 'rise') {
                g.sink = Math.max(0, g.sink - dt / 1.2);
                if (g.t <= 0) { g.mode = 'float'; g.t = R(8, 18); g.ring = 0.7; g.sink = 0; }
            }
        }
    }

    // ── STALKERS: egrets ───────────────────────────────────────────────────────────────
    function updateStalkers(dt) {
        const c = cfg.stalkers;
        for (const e of stalkers) {
            e.t -= dt; e.bob += dt;
            if (e.mode === 'stand' || e.mode === 'walk') {
                const b = boatNear(e.x, e.y, c.reactR);
                if (b) {
                    // Off low, away from the boat, to another spot along the bank.
                    let best = null, bs = -1;
                    for (const [x, y] of c.at) { const dFrom = Math.hypot(x - e.x, y - e.y), dBoat = Math.hypot(x - b.x, y - b.y);
                        if (dFrom > 120 && dFrom < 900 && dBoat > c.reactR * 2 && dBoat > bs) { bs = dBoat; best = { x, y }; } }
                    if (!best) { const a = Math.atan2(e.x - b.x, -(e.y - b.y)); best = { x: e.x + Math.sin(a) * 300, y: e.y - Math.cos(a) * 300 }; }
                    e.tx = best.x + R(-30, 30); e.ty = best.y + R(-30, 30); e.mode = 'fly'; e.t = 0;
                    continue;
                }
                if (e.mode === 'stand') {
                    // Now and then a slow step or two, or a strike with the neck.
                    e.neck = Math.max(0, e.neck - dt * 2);
                    if (e.t <= 0) { if (rnd() < 0.35) { e.neck = 1; e.t = R(3, 7); } else { e.mode = 'walk'; e.t = R(1.5, 3); e.h += R(-0.8, 0.8); } }
                } else {
                    const nx = e.x + Math.sin(e.h) * 7 * dt, ny = e.y - Math.cos(e.h) * 7 * dt;
                    e.x = nx; e.y = ny;
                    if (e.t <= 0) { e.mode = 'stand'; e.t = R(3, 8); }
                }
            } else if (e.mode === 'fly') {
                e.flap += dt * 5;
                const d = Math.hypot(e.tx - e.x, e.ty - e.y);
                e.z = Math.min(40, e.z + dt * 40) * Math.min(1, d / 120 + 0.25);
                steer(e, e.tx, e.ty, 120, 2.5, dt);
                if (d < 12) { e.mode = 'stand'; e.z = 0; e.t = R(4, 9); }
            }
        }
    }

    // ── PERCHERS: anhingas ─────────────────────────────────────────────────────────────
    function updatePerchers(dt, me) {
        const c = cfg.perchers;
        for (const a of perchers) {
            a.t += dt; a.flap += dt; a.splash = Math.max(0, a.splash - dt * 1.2);
            recordTrail(a, dt, a.mode === 'swim');
            if (a.mode === 'dry') {
                const b = boatNear(a.px, a.py, c.flushR);
                if (b) { a.mode = 'drop'; a.t = 0; if (b === me) feat(c.feat); }
            } else if (a.mode === 'drop') {
                a.sink = Math.min(1, a.t / 0.5);
                if (a.t >= 0.5) { a.mode = 'swim'; a.t = 0; a.splash = 1; a.sink = 0; a.x = a.px + R(-20, 20); a.y = a.py + R(-20, 20); a.h = R(0, 7); a.dur = R(22, 38); }
            } else if (a.mode === 'swim') {
                // The snakebird: body under, neck up, gliding about near its perch.
                const home = Math.hypot(a.x - a.px, a.y - a.py) > 140;
                const tx = home || a.t > a.dur ? a.px : a.x + Math.sin(a.h + Math.sin(a.t * 0.4)) * 50, ty = home || a.t > a.dur ? a.py : a.y - Math.cos(a.h + Math.sin(a.t * 0.4)) * 50;
                const nx = a.x + Math.sin(a.h) * 16 * dt, ny = a.y - Math.cos(a.h) * 16 * dt;
                if (!onLand(nx, ny)) steer(a, tx, ty, 16, 1.2, dt); else a.h += 1.5 * dt;
                if (a.t > a.dur && Math.hypot(a.x - a.px, a.y - a.py) < 18 && !boatNear(a.px, a.py, c.flushR * 1.3)) { a.mode = 'climb'; a.t = 0; }
            } else if (a.mode === 'climb') {
                if (a.t >= 0.8) { a.mode = 'dry'; a.t = 0; a.x = a.px; a.y = a.py; }
            }
        }
    }

    // The way upstream at (x, y): against the current layer's stream there (which runs TO its
    // `direction`, in the sin/-cos heading convention every animal here uses).
    function upstream(x, y) {
        const c = (typeof getCurrentAt === 'function') ? getCurrentAt(x, y) : null;
        return (c && c.speed > 0.05 ? c.direction : 0) + Math.PI;
    }
    const fwd = (h) => [Math.sin(h), -Math.cos(h)];

    // ── FISHERS: brown bears in the shallows ──────────────────────────────────────────
    // Stands facing upstream at the edge of the fast water, head swinging as it watches; lunges
    // a body length forward with a splash, and about half the time comes up with a salmon it
    // stands and eats; then steps back to its spot. A boat close by makes it rear up on its hind
    // legs to look (head turned to the boat) — it never runs.
    function updateFishers(dt) {
        const c = cfg.fishers;
        for (const B of fishers) {
            B.t -= dt; B.bob += dt; B.splash = Math.max(0, B.splash - dt * 1.1);
            const b = boatNear(B.x, B.y, c.lookR);
            B.rear += ((b && B.mode !== 'lunge' ? 1 : 0) - B.rear) * Math.min(1, dt * (b ? 2.5 : 1.2));
            if (b) B.look += angDiff(angDiff(Math.atan2(b.x - B.x, -(b.y - B.y)), B.h), B.look) * Math.min(1, dt * 3);
            else B.look += (Math.sin(B.bob * 0.5) * 0.6 - B.look) * Math.min(1, dt * 1.5);
            B.look = Math.max(-1.2, Math.min(1.2, B.look));
            if (B.mode === 'watch') {
                // drift back to its spot, facing upstream
                const dx = B.hx - B.x, dy = B.hy - B.y, d = Math.hypot(dx, dy);
                if (d > 1) { const v = Math.min(d, 8 * dt); B.x += dx / d * v; B.y += dy / d * v; }
                B.h += angDiff(B.up, B.h) * Math.min(1, dt * 1.2);
                if (B.t <= 0 && B.rear < 0.2) { B.mode = 'lunge'; B.t = 0.55; B.lunge = 0; }
                else if (B.t <= 0) B.t = 1;
            } else if (B.mode === 'lunge') {
                B.lunge = Math.min(1, B.lunge + dt / 0.55);
                const [fx, fy] = fwd(B.h), v = 34 * Math.sin(Math.PI * B.lunge);
                const nx = B.x + fx * v * dt, ny = B.y + fy * v * dt;
                if (!onLand(nx, ny)) { B.x = nx; B.y = ny; }
                if (B.t <= 0) {
                    B.splash = 1; B.lunge = 0;
                    if (rnd() < 0.5) { B.mode = 'eat'; B.fish = 1; B.t = R(5, 9); } else { B.mode = 'watch'; B.t = R(4, 10); }
                }
            } else if (B.mode === 'eat') {
                if (B.t <= 0) { B.mode = 'watch'; B.fish = 0; B.t = R(5, 11); }
            }
        }
    }

    // ── RUNS: sockeye holding in slack water ───────────────────────────────────────────
    function makeRun(c, x, y, n) {
        const G = { cfg: c, hx: x, hy: y, up: upstream(x, y), flee: 0, fx: 0, fy: 0, fish: [] };
        for (let i = 0; i < n; i++) {
            // a comet strung out along the stream (drone references): packed and wide at its
            // upstream head, thinning into a ragged tail behind
            const u = Math.pow(rnd(), 1.6), along = 40 - u * 110, across = R(-1, 1) * (20 - u * 12);
            const [ux, uy] = fwd(G.up);
            G.fish.push({ dull: rnd() < 0.2, oa: along, oc: across, x: x + ux * along - uy * across, y: y + uy * along + ux * across, vx: 0, vy: 0, h: G.up, ph: R(0, 7), size: R(0.85, 1.12) });
        }
        return G;
    }
    function updateRun(G, dt) {
        const c = G.cfg;
        const b = boatNear(G.hx, G.hy, c.reactR + 50);
        if (b) { G.flee = 1.4; const d = Math.hypot(G.hx - b.x, G.hy - b.y) || 1; G.fx = (G.hx - b.x) / d; G.fy = (G.hy - b.y) / d; }
        G.flee = Math.max(0, G.flee - dt);
        const [ux, uy] = fwd(G.up);
        for (const f of G.fish) {
            f.ph += dt * (G.flee > 0 ? 9 : 3.2);
            // hold station: a spring to its place, weaving a little across the stream
            const wob = Math.sin(f.ph * 0.35 + f.size * 5) * 5;
            let px = G.hx + ux * f.oa - uy * (f.oc + wob), py = G.hy + uy * f.oa + ux * (f.oc + wob);
            if (G.flee > 0) { px += G.fx * 110; py += G.fy * 110; }
            let wx = (px - f.x) * 0.8, wy = (py - f.y) * 0.8; const w = Math.hypot(wx, wy), cap = G.flee > 0 ? 55 : 14;
            if (w > cap) { wx *= cap / w; wy *= cap / w; }
            const k = Math.min(1, dt * (G.flee > 0 ? 4 : 1.2));
            f.vx += (wx - f.vx) * k; f.vy += (wy - f.vy) * k;
            const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
            if (!onLand(nx, ny)) { f.x = nx; f.y = ny; }
            // nosed upstream while holding; turned the way it swims when it bolts
            const spd = Math.hypot(f.vx, f.vy);
            const want = G.flee > 0 && spd > 8 ? Math.atan2(f.vx, -f.vy) : G.up + Math.sin(f.ph * 0.5) * 0.12;
            f.h += angDiff(want, f.h) * Math.min(1, dt * 4);
            f.spd = spd;
        }
    }

    // ── SOARERS: bald eagles ──────────────────────────────────────────────────────────
    function updateSoarers(dt) {
        for (const E of soarers) {
            E.t -= dt; E.flap += dt * (E.mode === 'climb' ? 6 : 1.2); E.splash = Math.max(0, E.splash - dt * 1.2);
            if (E.mode === 'soar') {
                E.a += E.dir * EAGLE_SOAR / E.r * dt;
                const x = E.cx + Math.cos(E.a) * E.r, y = E.cy + Math.sin(E.a) * E.r;
                if (Math.hypot(x - E.x, y - E.y) > 0.01) E.h = Math.atan2(x - E.x, -(y - E.y));
                E.x = x; E.y = y; E.z += (105 - E.z) * Math.min(1, dt * 0.3);
                if (E.fish > 0) { E.fish -= dt / 18; if (E.fish < 0) E.fish = 0; }
                if (E.t <= 0) {
                    // stoop on the nearest run in reach, if nobody is on top of it
                    let best = null, bd = 900;
                    for (const G of runs) { const d = Math.hypot(G.hx - E.x, G.hy - E.y); if (d < bd && !boatNear(G.hx, G.hy, 160)) { bd = d; best = G; } }
                    if (best) { E.mode = 'stoop'; const f = best.fish[Math.floor(rnd() * best.fish.length)]; E.tx = f.x; E.ty = f.y; E.z0 = E.z; E.d0 = Math.max(1, bd); E.fish = 0; }
                    else E.t = R(8, 15);
                }
            } else if (E.mode === 'stoop') {
                const d = Math.hypot(E.tx - E.x, E.ty - E.y);
                steer(E, E.tx, E.ty, 75, 2.2, dt);
                E.z = Math.max(2, E.z0 * Math.min(1, d / E.d0));
                if (d < 10) { E.mode = 'grab'; E.t = 0.45; E.splash = 1; E.sx = E.x; E.sy = E.y; }
            } else if (E.mode === 'grab') {
                E.z = 2;
                if (E.t <= 0) { E.mode = 'climb'; E.fish = 1; E.t = 0; }
            } else if (E.mode === 'climb') {
                // back up to its circle, labouring, the salmon in its talons
                const x = E.cx + Math.cos(E.a) * E.r, y = E.cy + Math.sin(E.a) * E.r;
                steer(E, x, y, 42, 1.6, dt);
                E.z = Math.min(105, E.z + dt * 16);
                if (Math.hypot(x - E.x, y - E.y) < 30 && E.z > 80) { E.mode = 'soar'; E.a = Math.atan2(E.y - E.cy, E.x - E.cx); E.t = R(30, 60); }
            }
        }
    }

    // ── ROMPERS: river otters ─────────────────────────────────────────────────────────
    // A family's home is a logjam: they lie up on it, then slide in and swim the banks near it
    // in a line behind the leader — porpoising, one then the next — and come back to rest.
    // A boat close by puts them all under; they swim off below and surface further along.
    function makeRompers(c, jam) {
        const kinds = (window.VenueDoc && VenueDoc.PROP_KINDS) || {};
        const len = ((kinds[jam.kind] && kinds[jam.kind].world) || 130) * (jam.scale || 1);
        const ax = Math.cos(jam.heading || 0), ay = Math.sin(jam.heading || 0);   // the jam's long axis (x in its own frame)
        // the bank water round the jam: 20-70 u from land, within 420 u of it
        const spots = [];
        for (let k = 0; k < 400 && spots.length < 24; k++) {
            const a = R(0, Math.PI * 2), d = R(len * 0.4, 420), x = jam.x + Math.cos(a) * d, y = jam.y + Math.sin(a) * d;
            if (onLand(x, y)) continue;
            let near = 999; for (let r = 20; r <= 70 && near > 70; r += 10) for (let q = 0; q < 12; q++) if (onLand(x + Math.cos(q / 12 * 6.283) * r, y + Math.sin(q / 12 * 6.283) * r)) { near = r; break; }
            if (near >= 20 && near <= 70) spots.push({ x, y });
        }
        if (!spots.length) return null;
        // where they slide in: the bank water nearest the jam
        const entry = spots.reduce((a, b) => Math.hypot(a.x - jam.x, a.y - jam.y) < Math.hypot(b.x - jam.x, b.y - jam.y) ? a : b);
        const F = { cfg: c, jam, len, ax, ay, spots, entry, mode: 'rest', t: R(6, 20), lead: null, crumbs: [], under: 0, ux: 0, uy: 0, members: [] };
        for (let i = 0; i < c.count; i++) {
            // lying along the top of the jam, spread over its middle half
            // side by side across the jam's middle, all lying along it the same way, touching
            const s = (i - (c.count - 1) / 2) * 7.5, t = R(-4, 4);
            const rx = jam.x - ay * s + ax * t, ry = jam.y + ax * s + ay * t;
            F.members.push({ i, rx, ry, rh: (jam.heading || 0) + Math.PI / 2 + R(-0.2, 0.2), x: rx, y: ry, h: R(0, 7), dip: 0, dipT: R(1, 4), ring: 0, trail: [], trailT: 0, curl: R(0, 0.35), size: i === 0 ? 1.08 : R(0.85, 1) });
        }
        return F;
    }
    function updateRompers(F, dt) {
        const c = F.cfg, M = F.members;
        F.t -= dt;
        for (const m of M) { m.ring = Math.max(0, m.ring - dt * 1.1); m.dipT -= dt; }
        if (F.mode === 'rest') {
            if (F.t <= 0 && !boatNear(F.jam.x, F.jam.y, c.reactR * 2)) {
                F.mode = 'swim'; F.t = R(25, 45); F.crumbs = [];
                F.goal = F.spots[Math.floor(rnd() * F.spots.length)];
                for (const m of M) { m.x = F.entry.x + R(-8, 8); m.y = F.entry.y + R(-8, 8); m.ring = 1; m.trail = []; m.h = Math.atan2(F.goal.x - m.x, -(F.goal.y - m.y)); }
            }
            return;
        }
        const lead = M[0];
        const threat = M.map(m => boatNear(m.x, m.y, c.reactR)).find(Boolean);
        if (threat && F.mode === 'swim') { F.mode = 'under'; F.under = R(2.5, 4); const d = Math.hypot(lead.x - threat.x, lead.y - threat.y) || 1; F.ux = (lead.x - threat.x) / d; F.uy = (lead.y - threat.y) / d; for (const m of M) m.ring = 1; }
        if (F.mode === 'under') {
            F.under -= dt;
            for (const m of M) {
                const nx = m.x + F.ux * 45 * dt, ny = m.y + F.uy * 45 * dt;
                if (!onLand(nx, ny)) { m.x = nx; m.y = ny; m.h += angDiff(Math.atan2(F.ux, -F.uy), m.h) * Math.min(1, dt * 4); }
                recordTrail(m, dt, false);
            }
            if (F.under <= 0 && !boatNear(lead.x, lead.y, c.reactR * 1.3)) { F.mode = 'swim'; F.crumbs = []; for (const m of M) { m.ring = 1; m.trail = []; } F.goal = F.spots[Math.floor(rnd() * F.spots.length)]; }
            else if (F.under <= 0) F.under = 0.8;
            return;
        }
        // swimming: the leader heads for a bank spot (then another); the rest follow its track
        const home = F.t <= 0;
        const goal = home ? F.entry : F.goal;
        const gd = Math.hypot(goal.x - lead.x, goal.y - lead.y);
        if (!home && gd < 25) F.goal = F.spots[Math.floor(rnd() * F.spots.length)];
        const nx = lead.x + Math.sin(lead.h) * OTTER_SWIM * dt, ny = lead.y - Math.cos(lead.h) * OTTER_SWIM * dt;
        if (onLand(nx, ny)) lead.h += 2.5 * dt * (lead.i % 2 ? 1 : -1); else steer(lead, goal.x, goal.y, OTTER_SWIM, 1.8, dt);
        F.crumbs.unshift({ x: lead.x, y: lead.y, h: lead.h }); if (F.crumbs.length > 400) F.crumbs.pop();
        for (let j = 1; j < M.length; j++) {
            // each a body length and a bit behind the one ahead, a little off its line — the
            // references show separate heads, each with its own V, never nose to tail
            const m = M[j]; let acc = 0, want = j * 30, p = F.crumbs[0];
            for (let q = 1; q < F.crumbs.length; q++) { const a = F.crumbs[q - 1], b = F.crumbs[q]; acc += Math.hypot(a.x - b.x, a.y - b.y); p = b; if (acc >= want) break; }
            const side = (j % 2 ? 1 : -1) * 9, px = p.x - Math.cos(p.h) * side, py = p.y - Math.sin(p.h) * side;
            const dx = px - m.x, dy = py - m.y, d = Math.hypot(dx, dy);
            if (d > 0.3) { const v = Math.min(d, OTTER_SWIM * 1.4 * dt); m.x += dx / d * v; m.y += dy / d * v; m.h += angDiff(Math.atan2(dx, -dy), m.h) * Math.min(1, dt * 5); }
        }
        for (const m of M) {
            recordTrail(m, dt, true);
            // porpoising: now and then an arc under and up again
            if (m.dipT <= 0 && m.dip <= 0) { m.dip = 1; m.dipT = R(2.5, 6); }
            if (m.dip > 0) { m.dip = Math.max(0, m.dip - dt / 0.9); if (m.dip === 0) m.ring = 0.8; }
        }
        if (home && gd < 20) { F.mode = 'rest'; F.t = R(20, 45); for (const m of M) { m.x = m.rx; m.y = m.ry; m.ring = 0; m.trail = []; } }
    }

    // ── WHALES: humpback pods ──────────────────────────────────────────────────────────
    // A pod travels its loop at a walking pace for a whale. Each member runs its own dive
    // cycle: under the water (a long dim shape with the white flippers glowing through it),
    // up to breathe three or four times — a blow, the back rolling through the surface — then
    // a last arch and the flukes up, and down again. Now and then, on surfacing, one breaches,
    // lobtails (slaps its flukes, again and again) or rolls on its side and slaps a flipper.
    function makeWhalePod(P, i) {
        const segs = [], pts = P.path; let L = 0;
        for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, d, s0: L }); L += d; }
        const n = P.calf ? 2 : P.n;
        const members = Array.from({ length: n }, (_, j) => {
            const calf = P.calf && j === 1;
            return { j, calf, len: calf ? CALF_LEN : WHALE_LEN * R(0.9, 1.05),
                // formation offsets: the calf rides tight at the mother's flank, near her head
                ox: calf ? 38 : (j - (n - 1) / 2) * (P.rowdy ? R(55, 85) : R(110, 170)), oy: calf ? -28 : (P.rowdy ? R(-120, 120) : R(-90, 90) + (j % 2) * 60),
                x: 0, y: 0, h: 0, mode: 'under', t: R(1, 12), depth: 1, breaths: 0, blowT: 0,
                ev: null, evT: 0, ph: R(0, 7), fluke: 0, roll: 0, slick: 0, sx: 0, sy: 0, lift: 0, slaps: 0, sd: 1 };
        });
        return { cfg: P, i, segs, L, s: R(0, L), members, ox: 0, oy: 0, cx: 0, cy: 0, pace: 1 };
    }
    function _podAt(W, s) {
        s = ((s % W.L) + W.L) % W.L;
        const g = W.segs.find(g => s >= g.s0 && s < g.s0 + g.d) || W.segs[0], u = (s - g.s0) / g.d;
        return { x: g.a[0] + (g.b[0] - g.a[0]) * u, y: g.a[1] + (g.b[1] - g.a[1]) * u, h: Math.atan2(g.b[0] - g.a[0], -(g.b[1] - g.a[1])) };
    }
    function updateWhales(dt, me) {
        const c = cfg.whales;
        // KEEPING APART: each pod eases sideways away from any other pod within 1100 u (up to ~500 u,
        // never onto land or a shoal edge), and slows when one lies ahead of it on its track.
        const SEP = 1100;
        for (const W of whalePods) {
            let px = 0, py = 0, slow = 1; const q0 = _podAt(W, W.s), fx0 = Math.sin(q0.h), fy0 = -Math.cos(q0.h);
            for (const O of whalePods) { if (O === W) continue; const dx = W.cx - O.cx, dy = W.cy - O.cy, dd = Math.hypot(dx, dy);
                if (dd < SEP && dd > 1) { const f = 1 - dd / SEP; px += dx / dd * f * 650; py += dy / dd * f * 650;
                    if ((-dx * fx0 - dy * fy0) / dd > 0.3) slow = Math.min(slow, 0.35 + 0.65 * (dd / SEP)); } }
            const L = Math.hypot(px, py); if (L > 520) { px *= 520 / L; py *= 520 / L; }
            if (W.cfg.calf) { px = 0; py = 0; slow = 1; }   // the mother and calf keep to their lee — the others give way
            const k = Math.min(1, dt * 0.4), nx = W.ox + (px - W.ox) * k, ny = W.oy + (py - W.oy) * k;
            if (!onLand(q0.x + nx, q0.y + ny) && !onLand(q0.x + nx * 1.3, q0.y + ny * 1.3)) { W.ox = nx; W.oy = ny; } else { W.ox *= 1 - k; W.oy *= 1 - k; }
            W.pace += (slow - W.pace) * Math.min(1, dt * 0.5);
        }
        for (const W of whalePods) {
            W.s += W.cfg.speed * W.pace * dt;
            const here0 = _podAt(W, W.s), ahead0 = _podAt(W, W.s + 250);
            const here = { x: here0.x + W.ox, y: here0.y + W.oy, h: here0.h }, ahead = { x: ahead0.x + W.ox, y: ahead0.y + W.oy };
            W.cx = here.x; W.cy = here.y;
            const hh = Math.atan2(ahead.x - here.x, -(ahead.y - here.y));
            const fx = Math.sin(hh), fy = -Math.cos(hh);
            for (const m of W.members) {
                m.t -= dt; m.ph += dt;
                // (formation below)
                const tx = here.x + fx * -m.oy + -fy * m.ox, ty = here.y + fy * -m.oy + fx * m.ox;
                if (m.x === 0 && m.y === 0) { m.x = tx; m.y = ty; m.h = hh; }
                const k = Math.min(1, dt * 0.6); m.x += (tx - m.x) * k; m.y += (ty - m.y) * k;
                const dh = angDiff(hh + Math.sin(m.ph * 0.2 + m.j) * 0.08, m.h) * Math.min(1, dt * 0.5);
                m.h += dh; m.turn = (m.turn || 0) * 0.9 + (dt > 0 ? dh / dt : 0) * 0.1;
                m.slick = Math.max(0, m.slick - dt / 10);
                m.rollT = (m.rollT == null ? 99 : m.rollT + dt);
                // FOOTPRINTS (references): the smooth oval slicks a swimming whale leaves at the surface
                // behind it with each fluke stroke — the trail that says a whale went this way
                m.printT = (m.printT || R(0, 4)) - dt;
                if (m.printT <= 0 && (m.mode !== 'under' || m.depth < 0.6)) { m.printT = R(3.5, 5.5);
                    prints.push({ x: m.x - Math.sin(m.h) * m.len * 0.42, y: m.y + Math.cos(m.h) * m.len * 0.42, h: m.h, r: m.len * 0.2, t: 0 }); }
                // the calf keeps its mother's rhythm, but breathes more often
                if (m.mode === 'under') {
                    m.depth = Math.min(1, m.depth + dt / 4);
                    if (m.t < 5) m.depth = Math.max(0.25, m.depth - dt / 3);         // rising: the shape firms up
                    // a whale does not come up under a boat: it waits below until the water above is clear
                    if (m.t <= 0 && boatNear(m.x, m.y, m.len * 0.9)) m.t = 1.5;
                    if (m.t <= 0) { m.mode = 'surface'; m.breaths = m.calf ? 5 : Math.round(R(3, 4)); m.t = 0; m.blowT = 0; m.depth = 0;
                        // a surface event, sometimes, before the breaths
                        // Wes, Sep 25: "mostly move along and surface with a blow, but occasionally
                        // breach, tail slap, pectoral fin slap, or eat" — about one surfacing in three
                        const q = W.cfg.rowdy ? 2.2 : 1, r = rnd() / q;   // a competitive group is all splash — breaches and tail slaps
                        if (r < 0.03) startWhaleEvent(m, 'breach'); else if (r < 0.06) startWhaleEvent(m, 'lobtail'); else if (r < 0.09) startWhaleEvent(m, 'pecslap'); else if (r < 0.12 && !m.calf && !W.cfg.rowdy) startWhaleEvent(m, 'feed'); }   // Wes: "mostly travel like real whales" — about one surfacing in eight
                } else if (m.mode === 'surface') {
                    if (m.ev) { updateWhaleEvent(m, dt); continue; }
                    // a boat just ahead of its head: it sounds rather than swim into it (whales keep
                    // clear of boats; the contact is for the sailor who runs INTO one at the surface)
                    { const b = boatNear(m.x + Math.sin(m.h) * m.len * 0.6, m.y - Math.cos(m.h) * m.len * 0.6, m.len * 0.75);
                      if (b) { m.mode = 'dive'; m.t = 1.25; continue; } }
                    m.blowT -= dt;
                    if (m.blowT <= 0) {
                        if (m.breaths-- <= 0) { m.mode = 'dive'; m.t = 3.2; continue; }
                        m.rollT = 0;      // each breath: the back rolls out of the water, head to tail
                        // a blow: a bushy puff from the blowhole, a quarter of the way back from the snout
                        const bx = m.x + Math.sin(m.h) * m.len * 0.27, by = m.y - Math.cos(m.h) * m.len * 0.27;
                        blows.push({ x: bx, y: by, t: 0, size: m.calf ? 0.55 : 1 });
                        m.blowT = m.calf ? R(4, 6) : R(7, 11);
                    }
                } else if (m.mode === 'dive') {
                    m.fluke = Math.max(0, Math.sin(Math.PI * (1 - m.t / 3.2)));   // the arch, then the flukes up
                    if (m.t <= 0) { m.mode = 'under'; m.fluke = 0; m.depth = 0.3; m.t = m.calf ? R(6, 12) : W.cfg.rowdy ? R(5, 12) : R(10, 24); m.slick = 1; m.sx = m.x; m.sy = m.y; }   // short dives: travelling whales stay near the top
                }
            }
            // the calf feat: the player alongside the mother and calf, racing
            if (W.cfg.calf && me && c.feat) for (const m of W.members) if (Math.hypot(me.x - m.x, me.y - m.y) < c.calfR) { feat(c.feat); break; }
        }
        for (const B of blows) B.t += dt; blows = blows.filter(B => B.t < 3.5);
        for (const F of prints) F.t += dt; prints = prints.filter(F => F.t < 14);
        for (const S of splashes) S.t += dt; splashes = splashes.filter(S => S.t < S.life);
    }
    function startWhaleEvent(m, ev) {
        m.ev = ev; m.evT = 0; m.sd = rnd() < 0.5 ? -1 : 1;
        m.slaps = ev === 'breach' ? 1 : Math.round(R(3, 6));
    }
    function updateWhaleEvent(m, dt) {
        m.evT += dt;
        const tailX = m.x - Math.sin(m.h) * m.len * 0.45, tailY = m.y + Math.cos(m.h) * m.len * 0.45;
        if (m.ev === 'breach') {
            // 0-1.2 s up and out, 1.2-1.8 at the top turning over, 1.8 the crash
            m.lift = m.evT < 1.2 ? m.evT / 1.2 : m.evT < 1.8 ? 1 : Math.max(0, 1 - (m.evT - 1.8) / 0.5);
            m.roll = Math.min(1, Math.max(0, (m.evT - 1) / 0.8));
            if (m.evT >= 1.8 && !m.crashed) { m.crashed = true; splashes.push({ x: m.x + Math.cos(m.h) * m.sd * m.len * 0.12, y: m.y + Math.sin(m.h) * m.sd * m.len * 0.12, t: 0, life: 7, r: m.len * (m.calf ? 0.7 : 0.55), big: true }); }
            if (m.evT > 2.6) { m.ev = null; m.lift = 0; m.roll = 0; m.crashed = false; m.blowT = 1; }
        } else if (m.ev === 'lobtail') {
            // the flukes up and brought down flat, every ~1.6 s
            const cyc = (m.evT % 1.6) / 1.6; m.fluke = Math.sin(Math.PI * Math.min(1, cyc * 1.25));
            if (cyc > 0.78 && !m.slapped) { m.slapped = true; m.slaps--; splashes.push({ x: tailX, y: tailY, t: 0, life: 3.5, r: m.len * 0.28 }); }
            if (cyc < 0.5) m.slapped = false;
            if (m.slaps <= 0 && cyc > 0.85) { m.ev = null; m.fluke = 0; m.blowT = 1; }
        } else if (m.ev === 'feed') {
            // a LUNGE (references): up through a boil of bait, the head thrust vertically out of the
            // water, jaws wide and the pleated throat ballooned, then settling back
            m.lift = m.evT < 0.8 ? m.evT / 0.8 : m.evT < 2.2 ? 1 : Math.max(0, 1 - (m.evT - 2.2) / 0.8);
            if (!m.crashed) { m.crashed = true; const hx = m.x + Math.sin(m.h) * m.len * 0.35, hy = m.y - Math.cos(m.h) * m.len * 0.35;
                splashes.push({ x: hx, y: hy, t: 0, life: 5, r: m.len * 0.3, bait: true }); }
            if (m.evT > 3) { m.ev = null; m.lift = 0; m.crashed = false; m.blowT = 1.5; }
        } else if (m.ev === 'pecslap') {
            // rolled onto one side at the surface, the long white flipper raised and slapped down
            m.roll = Math.min(1, m.evT / 0.8);
            const cyc = ((m.evT - 0.8) % 1.4) / 1.4;
            m.fin = m.evT < 0.8 ? 0 : Math.sin(Math.PI * Math.min(1, cyc * 1.3));
            if (m.evT > 0.8 && cyc > 0.74 && !m.slapped) { m.slapped = true; m.slaps--;
                const fx2 = Math.cos(m.h) * m.sd, fy2 = Math.sin(m.h) * m.sd;
                splashes.push({ x: m.x + fx2 * m.len * 0.36, y: m.y + fy2 * m.len * 0.36, t: 0, life: 3, r: m.len * 0.2 }); }
            if (cyc < 0.4) m.slapped = false;
            if (m.slaps <= 0 && cyc > 0.8) { m.ev = null; m.roll = 0; m.fin = 0; m.blowT = 1; }
        }
    }

    // ── RIDERS: spinner dolphins on the bow ────────────────────────────────────────────
    function makeRiders(c) {
        const mk = (i, n) => ({ i, x: 0, y: 0, h: 0, vx: 0, vy: 0, slot: i, off: (i - (n - 1) / 2), breathT: R(0.5, 4), breath: 0, spin: 0, spinT: R(5, 15), live: false });
        const out = [];
        for (let k = 0; k < c.schools; k++) out.push({ boat: null, free: R(0, 12), state: 'away', members: Array.from({ length: c.perSchool }, (_, i) => mk(i, c.perSchool)) });
        if (c.resident) { const r = c.resident; out.push({ resident: true, a: R(0, 7), cx: r.cx, cy: r.cy, r: r.r, members: Array.from({ length: r.n }, (_, i) => Object.assign(mk(i, r.n), { live: true, x: r.cx + r.r, y: r.cy })) }); }
        return out;
    }
    // BOW RIDING (references, Sep 25 2026): a school comes in fast from abeam, then rides in the
    // pressure wave just ahead of the stem — two or three abreast right under it, more staggered a
    // little further forward and to the sides — swapping places, weaving, and breaking the surface
    // in white spray to breathe; after a while they peel off to the side and are gone.
    function _swimTo(m, tx, ty, maxV, k, dt, fvx, fvy) {
        // feed-forward the boat's own velocity (fvx, fvy), then close on the spot — without it a
        // school chasing a place in front of a 16-knot bow lags back alongside the hull
        let wx = (tx - m.x) * k, wy = (ty - m.y) * k; const w = Math.hypot(wx, wy); if (w > maxV) { wx *= maxV / w; wy *= maxV / w; }
        wx += fvx || 0; wy += fvy || 0;
        m.vx += (wx - m.vx) * Math.min(1, dt * 4); m.vy += (wy - m.vy) * Math.min(1, dt * 4);
        m.x += m.vx * dt; m.y += m.vy * dt;
        const sp = Math.hypot(m.vx, m.vy); if (sp > 5) m.h += angDiff(Math.atan2(m.vx, -m.vy), m.h) * Math.min(1, dt * 6);
        m.spd = sp;
    }
    function _dolphinTick(m, dt, spinP) {
        m.breathT -= dt; m.breath = Math.max(0, m.breath - dt / 0.6);
        if (m.breathT <= 0) { m.breath = 1; m.breathT = R(4, 8); }   // a riding dolphin breathes every ~15-25 s real, ~3x compressed
        m.spinT -= dt; m.spin = Math.max(0, m.spin - dt / 1.2);
        if (m.spinT <= 0) { m.spinT = R(6, 16); if (rnd() < spinP) { m.spin = 1; splashes.push({ x: m.x, y: m.y, t: 0, life: 1.8, r: 14 }); } }
    }
    function updateRiders(dt) {
        const c = cfg.riders, me = state.boats && state.boats[0];
        const fast = (state.boats || []).filter(b => !(b.raceState && b.raceState.finished) && b.speed * 4 >= c.minKn);
        for (const S of riders) {
            if (S.resident) {
                S.a += dt * 65 / S.r;   // a travelling school, ~4-5 kn (it was 1.4 kn — a resting pace)
                const cx = S.cx + Math.cos(S.a) * S.r, cy = S.cy + Math.sin(S.a) * S.r * 0.6, h = Math.atan2(-Math.sin(S.a), Math.cos(S.a) * 0.6) ;
                const fx = Math.sin(h), fy = -Math.cos(h);
                for (const m of S.members) { const tx = cx - fy * m.off * 14 + fx * Math.sin(m.i * 1.7) * 20, ty = cy + fx * m.off * 14 + fy * Math.sin(m.i * 1.7) * 20;
                    _swimTo(m, tx, ty, 110, 1.5, dt); _dolphinTick(m, dt, 0.35); }
                continue;
            }
            S.free -= dt;
            if (S.boat && (S.boat.speed * 4 < c.minKn - 1.5 || (S.boat.raceState && S.boat.raceState.finished))) S.free = 0;
            if (S.state === 'riding' && S.free <= 0) { S.state = 'leaving'; S.free = 4; S.side = rnd() < 0.5 ? -1 : 1; }
            if (S.state === 'leaving' && S.free <= 0) { S.state = 'away'; S.boat = null; S.bx = null; S.free = R(6, 14); for (const m of S.members) m.live = false; }
            if (S.state === 'away' && S.free <= 0) {
                const taken = new Set(riders.map(o => o.boat).filter(Boolean));
                const cand = fast.filter(b => !taken.has(b) && (!me || Math.hypot(b.x - me.x, b.y - me.y) < c.reach));
                // the player's own bow first, when it is going fast
                const b = cand.includes(me) ? me : cand[Math.floor(rnd() * cand.length)];
                if (b) { S.boat = b; S.state = 'riding'; S.free = R(25, 50); S.side = rnd() < 0.5 ? -1 : 1;
                    const fx = Math.sin(b.heading), fy = -Math.cos(b.heading);
                    for (const m of S.members) { m.live = true; const d = R(160, 260); m.x = b.x - fy * S.side * d + fx * R(-60, 80); m.y = b.y + fx * S.side * d + fy * R(-60, 80); m.vx = 0; m.vy = 0; m.h = b.heading - S.side * 1.2; } }
                else S.free = R(2, 4);
            }
            if (!S.boat) continue;
            const b = S.boat, fx = Math.sin(b.heading), fy = -Math.cos(b.heading);
            // the boat's real motion over the ground (it is carried by the sea as well as its speed)
            let bvx = 0, bvy = 0; if (S.bx != null && dt > 0) { bvx = (b.x - S.bx) / dt; bvy = (b.y - S.by) / dt; const bv = Math.hypot(bvx, bvy); if (bv > 900) { bvx = bvy = 0; } }
            S.bx = b.x; S.by = b.y;
            const bow = 30;                                                                                           // the stem, from the hull centre
            // the places in the bow wave: slot 0/1 right under the stem, the rest staggered ahead and wider
            if (Math.floor(T / 5) !== S.swapAt) { S.swapAt = Math.floor(T / 5); const a = Math.floor(rnd() * S.members.length), b2 = Math.floor(rnd() * S.members.length); const t = S.members[a].slot; S.members[a].slot = S.members[b2].slot; S.members[b2].slot = t; }
            for (const m of S.members) {
                const k = m.slot, row = Math.floor((k + 1) / 2), side = k === 0 ? 0 : (k % 2 ? -1 : 1);
                let ahead = bow + 2 + row * 13 + Math.sin(T * 1.1 + m.i * 1.9) * 5, across = side * (7 + row * 7) + Math.sin(T * 0.8 + m.i) * 3;
                if (S.state === 'leaving') { ahead = bow - 20; across = S.side * 260; }
                const tx = b.x + fx * ahead - fy * across, ty = b.y + fy * ahead + fx * across;
                _swimTo(m, tx, ty, S.state === 'leaving' ? 180 : 140, S.state === 'leaving' ? 1 : 3, dt, S.state === 'leaving' ? bvx * 0.5 : bvx, S.state === 'leaving' ? bvy * 0.5 : bvy);
                if (S.state === 'riding' && Math.hypot(tx - m.x, ty - m.y) < 25) m.h += angDiff(b.heading + Math.sin(T * 1.3 + m.i) * 0.12, m.h) * Math.min(1, dt * 5);
                _dolphinTick(m, dt, 0.06);
            }
        }
    }
    function spinTick() {}

    // ── FLYERS: flying fish off the bow ─────────────────────────────────────────────────
    // One flying fish launched: from (sx, sy) heading h. A glide is 1-2.5 s at 22-28 kn; now and
    // then it SKIPS — the tail's lower lobe sculls on the water and it takes off again, turned a
    // little (references: flights are strings of glides, the skip marks show as V-ripples).
    function launchFlyfish(sx, sy, h, delay, hunt) {
        const len = R(450, 800);
        if (onLand(sx, sy) || onLand(sx + Math.sin(h) * len, sy - Math.cos(h) * len)) return null;
        const f = { x0: sx, y0: sy, h, len, t: -delay, dur: len / R(330, 420), z: R(6, 12), size: R(0.85, 1.15), skips: rnd() < 0.35 ? 1 : 0, hunt };
        flyfish.push(f); return f;
    }
    function updateFlyers(dt) {
        const c = cfg.flyers;
        for (const f of flyfish) {
            f.t += dt;
            // the skip: at touch-down it sculls and takes off again on a turned heading
            if (f.skips > 0 && f.t >= f.dur && !f.caught) { f.skips--; const x = f.x0 + Math.sin(f.h) * f.len, y = f.y0 - Math.cos(f.h) * f.len;
                const h2 = f.h + R(-0.4, 0.4), len2 = f.len * R(0.4, 0.7);
                if (!onLand(x + Math.sin(h2) * len2, y - Math.cos(h2) * len2)) { f.x0 = x; f.y0 = y; f.h = h2; f.len = len2; f.dur = len2 / R(300, 380); f.t = 0; f.z *= 0.8; } }
        }
        flyfish = flyfish.filter(f => f.t < f.dur + 1.2 && !(f.caught && f.t > f.dur + 0.1));
        for (const P of flyPatches) { P.x += P.vx * dt; P.y += P.vy * dt; }
        if (c.hunters) updateHunters(dt);
        nextFly -= dt;
        const me = state.boats && state.boats[0];
        if (nextFly > 0 || !me) return;
        nextFly = R(c.every[0], c.every[1]);
        const patchOf = (b) => flyPatches.find(P => Math.hypot(b.x - P.x, b.y - P.y) < P.r);
        const fast = (state.boats || []).filter(b => !(b.raceState && b.raceState.finished) && b.speed * 4 >= c.minKn && Math.hypot(b.x - me.x, b.y - me.y) < c.near && (!flyPatches.length || patchOf(b)));
        if (!fast.length) return;
        const b = fast.includes(me) && rnd() < 0.7 ? me : fast[Math.floor(rnd() * fast.length)], n = Math.round(R(5, 12));
        const P = patchOf(b), made = [];
        for (let k = 0; k < n; k++) {
            // put up from just ahead of the bow, fanning out ahead and to the sides
            const h = b.heading + (rnd() < 0.5 ? -1 : 1) * R(0.25, 1.1), d0 = R(35, 70), sx = b.x + Math.sin(b.heading) * d0 + R(-20, 20), sy = b.y - Math.cos(b.heading) * d0 + R(-20, 20);
            const f = launchFlyfish(sx, sy, h, k * R(0.05, 0.3), P); if (f) made.push(f);
        }
        // the patch's hunters see them go and give chase
        if (P && P.pack) startHunt(P, made);
    }

    // ── HUNTERS: mahi-mahi after the flying fish ──────────────────────────────────────
    // (Wes, Sep 25: "mahi mahi chasing the flying fish". Flying fish fly to escape exactly this.)
    // Most flying-fish patches have a pack of 2-3 mahi. Between hunts they patrol the patch, deep
    // and dim. Every so often they rush the school — or a fast boat puts it up — and the fish
    // burst away in the air; each mahi picks one and tracks it UNDER the surface at 30+ knots,
    // throwing a wake, now and then clearing the water in a leap, and takes it as it drops back
    // in if it is close enough (a white burst). Then back to the patch.
    function startHunt(P, fish) {
        if (!fish.length) return;
        for (const m of P.pack) { m.mode = 'chase'; m.prey = fish[Math.floor(rnd() * fish.length)]; m.t = 0; }
    }
    function updateHunters(dt) {
        const c = cfg.flyers, me = state.boats && state.boats[0];
        for (const P of flyPatches) {
            if (!P.pack) continue;
            // a hunt of their own, now and then — only worth simulating where someone could see it
            P.huntT -= dt; P.since = (P.since == null ? 99 : P.since + dt);
            // a boat coming on to the patch sets them off within a second or two (the school is
            // nervous and the pack uses it), at most once every `rest` seconds
            if (me && P.since > c.hunters.rest && P.huntT > 2 && Math.hypot(me.x - P.x, me.y - P.y) < c.hunters.seeR && P.pack.every(m => m.mode === 'patrol')) P.huntT = R(0.5, 2);
            if (P.huntT <= 0) { P.huntT = R(c.hunters.every[0], c.hunters.every[1]);
                if (me && Math.hypot(me.x - P.x, me.y - P.y) < c.hunters.seeR && P.pack.every(m => m.mode === 'patrol')) {
                    const made = [], hh = R(0, Math.PI * 2), n = Math.round(R(5, 10));
                    for (let k = 0; k < n; k++) { const f = launchFlyfish(P.x + R(-60, 60), P.y + R(-60, 60), hh + R(-0.8, 0.8), k * R(0.05, 0.25), P); if (f) made.push(f); }
                    startHunt(P, made); P.since = 0;
                } }
            for (const m of P.pack) {
                m.t += dt; m.leap = Math.max(0, (m.leap || 0) - dt / 0.7);
                if (m.mode === 'chase') {
                    const f = m.prey;
                    if (!f || f.caught || f.t > f.dur + 1) { m.mode = 'patrol'; m.prey = null; continue; }
                    // under the fish's ground track, a little behind it, closing fast
                    const p = Math.max(0, Math.min(1, f.t / f.dur)), fx = f.x0 + Math.sin(f.h) * f.len * p, fy = f.y0 - Math.cos(f.h) * f.len * p;
                    const dx = fx - m.x, dy = fy - m.y, d = Math.hypot(dx, dy), v = Math.min(d / dt, m.top);
                    if (d > 1) { m.x += dx / d * v * dt; m.y += dy / d * v * dt; m.h += angDiff(Math.atan2(dx, -dy), m.h) * Math.min(1, dt * 8); }
                    m.spd = v;
                    if (m.leap <= 0 && rnd() < dt * 0.35) { m.leap = 1; splashes.push({ x: m.x, y: m.y, t: 0, life: 1.4, r: 12 }); }
                    // the fish comes down: taken if the mahi is right there
                    if (f.t >= f.dur && !f.caught && f.skips <= 0) {
                        if (d < 45) { f.caught = true; splashes.push({ x: fx, y: fy, t: 0, life: 2.2, r: 22 }); m.leap = 0.6; }
                        m.mode = 'patrol'; m.prey = null;
                    }
                } else {
                    // patrol: a slow loose circle round the patch, deep
                    m.a += dt * m.dir * 0.35;
                    const tx = P.x + Math.cos(m.a) * P.r * 0.45, ty = P.y + Math.sin(m.a) * P.r * 0.45;
                    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy), v = Math.min(d / Math.max(dt, 1e-3), 70);
                    if (d > 1) { m.x += dx / d * v * dt; m.y += dy / d * v * dt; m.h += angDiff(Math.atan2(dx, -dy), m.h) * Math.min(1, dt * 3); }
                    m.spd = v;
                }
                m.trail = m.trail || []; m.trailT = (m.trailT || 0) + dt;
                if (m.trailT > 0.05) { m.trailT = 0; if (m.spd > 150) { m.trail.unshift({ x: m.x, y: m.y }); if (m.trail.length > 10) m.trail.pop(); } else if (m.trail.length) m.trail.pop(); }
            }
        }
    }

    // ── GLIDERS: albatross ─────────────────────────────────────────────────────────────
    // Dynamic soaring: long banked arcs across the wind, rising into it at one end and swinging
    // down the other, low over the swell, hardly a wingbeat. Now and then one comes over to a
    // boat and quarters round it for a while.
    function updateGliders(dt) {
        // (Wes, Sep 25: "I didn't see the albatross" — they had a home far down the run. Albatross
        // follow boats: they quarter round the player now, in long banked arcs at a few hundred
        // units, always somewhere in the picture.)
        const me = state.boats && state.boats[0]; if (!me) return;
        for (const G of gliders) {
            // the second bird comes and goes: in view about half the time, on a slow rhythm
            if (G.i > 0) { G.cyc = (G.cyc == null ? R(0, 90) : G.cyc + dt) % 90; const was = G.here; G.here = G.cyc < 45; if (G.here && !was) G.placed = false; }
            if (!G.placed) { G.placed = true; G.x = me.x + Math.cos(G.a) * G.rad; G.y = me.y + Math.sin(G.a) * G.rad; }
            G.ph += dt * 0.9; G.a += G.dir * dt * 0.08;   // one dynamic-soaring arc every ~7 s (~20 s real, compressed)
            const tx = me.x + Math.cos(G.a) * G.rad, ty = me.y + Math.sin(G.a) * G.rad;
            const mean = Math.atan2(tx - G.x, -(ty - G.y)), far = Math.hypot(tx - G.x, ty - G.y);
            const swing = Math.sin(G.ph) * 1.1 * Math.min(1, 300 / (far + 100)), h = mean + swing;
            const v = Math.max(60 + 25 * Math.cos(G.ph), Math.min(400, far * 0.8)) + (me.speed || 0) * 60;
            G.h += angDiff(h, G.h) * Math.min(1, dt * 2);
            G.x += Math.sin(G.h) * v * dt; G.y -= Math.cos(G.h) * v * dt;
            if (far > 2500) { G.x = tx; G.y = ty; }
            G.bank = Math.cos(G.ph);
            G.z = 14 + 26 * (0.5 + 0.5 * Math.sin(G.ph + 1.2));
        }
    }

    // ── CRUISERS ─────────────────────────────────────────────────────────────────────────
    function makeCruisers(c) {
        const polys = (c.over || []).map(id => (state.course.islands || []).find(s => s.id === id)).filter(Boolean).map(s => s.vertices);
        if (c.over && !polys.length) return null;
        let cx = c.cx, cy = c.cy, r = c.r || 400;
        if (polys.length) {
            // The home area's box, padded: sharks patrol the EDGE of a reef flat as well as over it.
            let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
            for (const P of polys) for (const v of P) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); }
            cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; r = Math.hypot(x1 - x0, y1 - y0) / 2 + (c.pad || 0);
        }
        const pad = c.pad || 0;
        const near = (x, y, P) => { if (pointInPoly(x, y, P)) return true; if (!pad) return false;
            for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const q = getClosestPointOnSegment(x, y, a.x, a.y, b.x, b.y); if (Math.hypot(q.x - x, q.y - y) < pad) return true; } return false; };
        const G = { cfg: c, cx, cy, r, fish: [], leapT: R(40, 80) };
        // DRY LAND to a swimmer is only what stands out of the water: a coral reef is a wall to
        // a boat (pointOnLand says so) but a ray or a shark swims straight over it.
        const traits = (s) => (window.VenueDoc && VenueDoc.traits) ? VenueDoc.traits(s) : {};
        const dryPolys = (state.course.islands || []).filter(s => { const k = traits(s); return k.hard && !k.reef; }).map(s => s.vertices);
        G.dry = (x, y) => dryPolys.some(P => pointInPoly(x, y, P));
        G.inArea = (x, y) => !G.dry(x, y) && (polys.length ? polys.some(P => near(x, y, P)) : Math.hypot(x - cx, y - cy) < r);
        G.point = () => { for (let k = 0; k < 60; k++) { const a = R(0, Math.PI * 2), d = Math.sqrt(rnd()) * r, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (G.inArea(x, y)) return { x, y }; } return null; };
        for (let i = 0; i < c.count; i++) {
            const p = G.point() || { x: cx, y: cy }, q = G.point() || p;
            const f = { i, kind: c.kind, x: p.x, y: p.y, h: Math.atan2(q.x - p.x, -(q.y - p.y)), tx: q.x, ty: q.y,
                        depth: R(0.35, 0.65), dT: R(0.35, 0.65), mode: 'cruise', t: R(12, 40), ph: R(0, 7), flee: 0, fx: 0, fy: 0,
                        size: R(0.88, 1.08), splash: 0, splash2: 0, z: 0, ring: 0 };
            if (c.formation && i > 0) {   // a V behind the leader
                const k = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
                f.slot = { back: 40 * k, side: side * 46 * k };   // a disc width of water between them
                f.x = p.x; f.y = p.y;
            }
            G.fish.push(f);
        }
        if (c.formation) { const L = G.fish[0]; for (const f of G.fish.slice(1)) { f.x = L.x - Math.sin(L.h) * f.slot.back + Math.cos(L.h) * f.slot.side; f.y = L.y + Math.cos(L.h) * f.slot.back + Math.sin(L.h) * f.slot.side; f.h = L.h; } }
        return G;
    }
    function updateCruisers(G, dt) {
        const c = G.cfg, base = CRUISE[c.kind] || 30, lead = G.fish[0];
        for (const f of G.fish) {
            f.t -= dt; f.splash = Math.max(0, f.splash - dt * 1.2); f.splash2 = Math.max(0, f.splash2 - dt * 1.2); f.ring = Math.max(0, f.ring - dt * 0.7);
            // Startled: any boat inside reactR sends it off, away and deeper, for a couple of seconds.
            let threat = null, td = c.reactR || 0;
            for (const b of state.boats || []) { const d = Math.hypot(b.x - f.x, b.y - f.y); if (d < td) { td = d; threat = b; } }
            if (threat && f.mode !== 'leap' && (!c.formation || f === lead)) {
                f.flee = R(1.8, 2.6); f.fx = f.x - threat.x; f.fy = f.y - threat.y;
                if (f.mode === 'rise' || f.mode === 'breathe') { f.mode = 'cruise'; f.t = R(20, 35); f.ring = 1; }
            }
            f.flee = Math.max(0, f.flee - dt);
            const fleeing = f.flee > 0 || (c.formation && f !== lead && lead.flee > 0);
            f.dT = fleeing ? 0.9 : (f.mode === 'rise' || f.mode === 'breathe') ? 0 : f.dT > 0.8 ? R(0.35, 0.65) : f.dT;
            f.depth += (f.dT - f.depth) * Math.min(1, dt * (f.mode === 'rise' ? 0.9 : 1.6));
            let spd = base * (fleeing ? FLEE_MUL : 1), turn = fleeing ? 3.2 : 0.9;
            let tx = f.tx, ty = f.ty;
            if (f.mode === 'leap') {
                // Out of the water and back: the arc is drawn from `z`; it carries on its heading.
                f.z = Math.sin(Math.PI * Math.min(1, 1 - f.t / 1.1));
                const lx = f.x + Math.sin(f.h) * base * 1.8 * dt, ly = f.y - Math.cos(f.h) * base * 1.8 * dt;
                if (!G.dry(lx, ly)) { f.x = lx; f.y = ly; }
                if (f.t <= 0) { f.mode = 'cruise'; f.z = 0; f.splash2 = 1; f.depth = 0.2; }
                continue;
            }
            if (f.flee > 0) { tx = f.x + f.fx * 4; ty = f.y + f.fy * 4; }
            else if (c.formation && f !== lead) {
                tx = lead.x - Math.sin(lead.h) * f.slot.back + Math.cos(lead.h) * f.slot.side;
                ty = lead.y + Math.cos(lead.h) * f.slot.back + Math.sin(lead.h) * f.slot.side;
                const d = Math.hypot(tx - f.x, ty - f.y);
                spd = base * (lead.flee > 0 ? FLEE_MUL : 1) * (d > 60 ? 1.6 : d > 20 ? 1.2 : 0.95); turn = 2.2;
            }
            // Keep off dry land and near the home area: take the step, and if it lands somewhere
            // it should not, take it back and turn instead.
            const ox = f.x, oy = f.y, oh = f.h;
            steer(f, tx, ty, spd, turn, dt);
            if (G.dry(f.x, f.y) || (!fleeing && !G.inArea(f.x, f.y) && Math.hypot(f.x - G.cx, f.y - G.cy) > G.r * 1.25)) {
                f.x = ox; f.y = oy; f.h = oh + 1.6 * dt;
            }
            f.ph += dt * (spd / base) * (c.kind === 'eagleray' ? 1.6 : c.kind === 'reefshark' ? 5.5 : 2.2);
            if (!(c.formation && f !== lead) && Math.hypot(f.tx - f.x, f.ty - f.y) < 30) { const q = G.point(); if (q) { f.tx = q.x; f.ty = q.y; } }
            // Turtles come up to breathe; only the head breaks the surface.
            if (c.breathe && !fleeing) {
                if (f.mode === 'cruise' && f.t <= 0) { f.mode = 'rise'; f.t = 3; }
                else if (f.mode === 'rise' && f.t <= 0) { f.mode = 'breathe'; f.t = R(2.2, 3.2); f.ring = 1; }
                else if (f.mode === 'breathe' && f.t <= 0) { f.mode = 'cruise'; f.t = R(25, 45); f.dT = R(0.4, 0.65); f.ring = 0.7; }
            }
        }
        // Now and then one of a formation leaps clear, if no boat is near.
        if (c.formation) {
            G.leapT -= dt;
            if (G.leapT <= 0) {
                G.leapT = R(45, 100);
                const quiet = !(state.boats || []).some(b => Math.hypot(b.x - G.fish[0].x, b.y - G.fish[0].y) < (c.reactR || 0) * 2);
                const f = G.fish[1 + Math.floor(rnd() * (G.fish.length - 1))];
                if (quiet && f && f.mode === 'cruise') { f.mode = 'leap'; f.t = 1.1; f.splash = 1; f.sx = f.x; f.sy = f.y; }
            }
        }
    }

    function updateColony(c, dt, me) {
        // Who is close? Any boat puts the birds up; only the player earns the objective.
        let flusher = null;
        for (const b of state.boats || []) {
            if (b.opacity !== undefined && b.opacity < 0.2) continue;
            const near = c.birds.some(g => Math.hypot(g.hx - b.x, g.hy - b.y) < c.cfg.flushR);
            if (near) { flusher = b; if (b === me) feat(c.cfg.feat); if (b.isPlayer) break; }
        }
        for (const g of c.birds) {
            g.flap += dt * (g.mode === 'perched' ? 0 : 9);
            if (g.mode === 'perched') {
                if (flusher) {
                    g.mode = 'up'; g.t = 0;
                    g.orbitA = Math.atan2(g.hy - c.cy, g.hx - c.cx) + R(-0.4, 0.4);
                    g.orbitR = R(110, 240); g.orbitW = R(0.5, 0.9) * (rnd() < 0.5 ? -1 : 1);
                    g.t = R(0, 0.35);   // not all at once
                }
                continue;
            }
            g.t += dt;
            if (g.mode === 'up' || g.mode === 'wheel') {
                if (g.mode === 'up' && g.t > 1.2) g.mode = 'wheel';
                g.orbitA += g.orbitW * dt;
                const tx = c.cx + Math.cos(g.orbitA) * g.orbitR, ty = c.cy + Math.sin(g.orbitA) * g.orbitR;
                steer(g, tx, ty, 150, 3.2, dt);
                g.z = Math.min(60, g.z + 45 * dt);
                // Settle again once nothing has been close for a while.
                if (g.mode === 'wheel' && g.t > 22 + (g.orbitR / 60) && !flusher) { g.mode = 'down'; g.t = 0; }
            } else if (g.mode === 'down') {
                steer(g, g.hx, g.hy, 90, 4, dt);
                g.z = Math.max(0, g.z - 30 * dt);
                if (Math.hypot(g.x - g.hx, g.y - g.hy) < 6 && g.z < 4) { g.mode = 'perched'; g.x = g.hx; g.y = g.hy; g.z = 0; g.h = g.perchH; }
                if (flusher) { g.mode = 'wheel'; g.t = 0; }
            }
        }
    }

    function steer(o, tx, ty, speed, turn, dt) {
        const want = Math.atan2(tx - o.x, -(ty - o.y));
        const d = angDiff(want, o.h);
        o.h += Math.max(-turn * dt, Math.min(turn * dt, d));
        o.x += Math.sin(o.h) * speed * dt;
        o.y -= Math.cos(o.h) * speed * dt;
    }

    function updateFollowers(f, dt) {
        const v = (state.traffic || []).find(s => s.active && f.cfg.traffic.test(s.kind));
        f.ship = v || null;
        for (const b of f.birds) { b.a += b.w * dt; b.flap += dt * 8; }
    }

    function updatePods(dt) {
        if (!cfg.pods) return;
        // One pod per active matching vessel, created as ships appear.
        const ships = (state.traffic || []).filter(s => s.active && cfg.pods.ships.test(s.kind));
        for (const s of ships) {
            if (!pods.find(p => p.ship === s)) pods.push({ ship: s, members: Array.from({ length: cfg.pods.perShip }, (_, i) => makePorpoise(i)) });
        }
        pods = pods.filter(p => p.ship.active);
        for (const p of pods) {
            const s = p.ship, fx = Math.sin(s.heading), fy = -Math.cos(s.heading);
            const bow = s.hullLen / 2;
            for (const m of p.members) {
                const ahead = bow + 110 + m.lead + Math.sin(T * 0.7 + m.off) * 40;
                const side = m.off + Math.sin(T * 0.45 + m.off * 0.1) * 55;
                surfaceCycle(m, dt, s.x + fx * ahead - fy * side, s.y + fy * ahead + fx * side, s.heading + Math.sin(T * 0.45 + m.off) * 0.5);
            }
        }
        if (resident) {
            resident.a += (resident.speed / Math.max(resident.rx, resident.ry)) * dt;
            const x = resident.cx + Math.cos(resident.a) * resident.rx, y = resident.cy + Math.sin(resident.a) * resident.ry;
            const h = Math.atan2(-Math.sin(resident.a) * resident.rx, -(Math.cos(resident.a) * resident.ry));
            const fx = Math.sin(h), fy = -Math.cos(h);
            for (const m of resident.members) {
                const px = x - fy * m.off + fx * m.lead, py = y + fx * m.off + fy * m.lead;
                surfaceCycle(m, dt, px, py, h);
            }
        }
    }
    // A porpoise is seen for a second and a bit — the roll — and then is gone for a few.
    function surfaceCycle(m, dt, x, y, h) {
        if (m.phase < 0) {
            m.slick = Math.max(0, (m.slick || 0) - dt / 3);
            m.next -= dt;
            if (m.next <= 0 && !onLand(x, y)) { m.phase = 0; m.sx = x; m.sy = y; m.sh = h; }
        } else {
            m.phase += dt / 1.35;
            // It moves with the pod while it is up, so the roll travels.
            m.sx += Math.sin(m.sh) * 40 * dt; m.sy -= Math.cos(m.sh) * 40 * dt;
            if (m.phase >= 1) { m.phase = -1; m.next = R(2.2, 5.5); m.fx = m.sx; m.fy = m.sy; m.slick = 1; }
        }
    }

    // ── turtles on the log ────────────────────────────────────────────────────────────
    // A boat close by and they go in one after another — a push off the log, a plop. Under
    // water each drifts away from the log, and now and then pokes its head up to look. When
    // nothing has been close for a while they climb back one at a time, wet and shining.
    function updateBaskers(b, dt, me) {
        let flusher = null;
        for (const boat of state.boats || []) {
            if (boat.opacity !== undefined && boat.opacity < 0.2) continue;
            if (Math.hypot(boat.x - b.log.x, boat.y - b.log.y) < b.cfg.flushR + 40) { flusher = boat; if (boat === me) feat(b.cfg.feat); if (boat.isPlayer) break; }
        }
        if (flusher) b.quiet = 0; else b.quiet = (b.quiet || 0) + dt;
        for (const t of b.turtles) {
            t.t += dt; t.look += dt;
            t.wet = Math.max(0, t.wet - dt / 12);
            const nx = -b.ay * t.side, ny = b.ax * t.side;
            if (t.mode === 'bask' && flusher) { t.mode = 'wait'; t.t = 0; t.delay = t.i * 0.18 + R(0, 0.35); }
            else if (t.mode === 'wait' && t.t >= t.delay) { t.mode = 'slide'; t.t = 0; }
            else if (t.mode === 'slide' && t.t >= 0.55) {
                t.mode = 'under'; t.t = 0; t.plop = 1;
                t.ux = t.hx + nx * 26; t.uy = t.hy + ny * 26;
                t.uh = Math.atan2(nx, -ny) + R(-0.6, 0.6);
            } else if (t.mode === 'under') {
                // Swims off a little way and stays there.
                const go = Math.max(0, 1 - t.t / 5);
                t.ux += Math.sin(t.uh) * 16 * go * dt; t.uy -= Math.cos(t.uh) * 16 * go * dt;
                if (t.peek > 0) t.peek = Math.max(0, t.peek - dt);
                else if (t.t > 4 && rnd() < dt * 0.12) t.peek = 1.6;
                // Back one at a time, in order along the log, once it has been quiet 18 s.
                if (!flusher && b.quiet > 18 + t.i * 2.2) { t.mode = 'climb'; t.t = 0; t.cx0 = t.ux; t.cy0 = t.uy; }
            } else if (t.mode === 'climb') {
                if (flusher) { t.mode = 'under'; t.t = 0; }
                else if (t.t >= 1.6) { t.mode = 'bask'; t.t = 0; t.wet = 1; }
            }
            t.plop = Math.max(0, (t.plop || 0) - dt * 1.5);
            const k = t.mode === 'slide' ? t.t / 0.55 : t.mode === 'under' ? 1 : t.mode === 'climb' ? 1 - Math.min(1, t.t / 1.6) : 0;
            t.ox = nx * 24 * k; t.oy = ny * 24 * k;
        }
    }

    // ── swimmers: grebes, loons, beavers ──────────────────────────────────────────────────
    // They swim between points on open water with a wake behind them; they dive as a forward
    // roll and travel on under water, surfacing ahead — not somewhere random — and a boat
    // coming close puts them down at once. Loons sometimes rear up and flap after surfacing;
    // a pair of grebes sometimes meets face to face and head-shakes (their courtship); a
    // beaver slaps its tail before it dives, and half of them tow a leafy branch.
    const SWIM = { loon: 15, grebe: 12, beaver: 19 };
    const UNDER = { loon: 42, grebe: 30, beaver: 24 };
    function updateDivers(dt) {
        for (const G of divers) {
            const kind = G.cfg.kind, reactR = G.cfg.reactR || 0;
            // The grebes' dance: now and then, if both are up and near each other.
            if (kind === 'grebe' && G.birds.length > 1) {
                G.danceT -= dt;
                const [a, c] = G.birds;
                if (G.danceT <= 0 && a.mode === 'swim' && c.mode === 'swim' && Math.hypot(a.x - c.x, a.y - c.y) < 220) {
                    const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
                    if (!onLand(mx, my)) { a.mode = c.mode = 'dance'; a.t = c.t = 7; a.mx = c.mx = mx; a.my = c.my = my; }
                    G.danceT = R(30, 50);
                }
            }
            for (const g of G.birds) {
                g.t -= dt; g.bob += dt;
                g.splash = Math.max(0, g.splash - dt * 1.3);
                g.slap = Math.max(0, g.slap - dt * 1.1);
                g.rise = Math.max(0, g.rise - dt * 1.5);
                let spooked = false;
                if (reactR && g.mode !== 'under' && g.mode !== 'dive') for (const b of state.boats || []) { if (Math.hypot(b.x - g.x, b.y - g.y) < reactR) { spooked = true; break; } }
                // The wake: a short history of where it has been — recorded only while it is
                // actually travelling. Still (dancing, flapping) the old wake runs out behind it.
                g.trailT += dt;
                if (g.trailT > 0.1) {
                    g.trailT = 0;
                    const last = g.trail[0];
                    const moving = g.mode === 'swim' && (!last || Math.hypot(g.x - last.x, g.y - last.y) > 0.8);
                    if (moving) { g.trail.unshift({ x: g.x, y: g.y }); if (g.trail.length > 18) g.trail.pop(); }
                    else if (g.trail.length) g.trail.pop();
                }
                if (g.mode === 'swim') {
                    let tx = g.tx, ty = g.ty;
                    const lead = G.birds[0];
                    if (G.cfg.pair && g !== lead && lead.mode !== 'dance') {
                        // Keep station off the leader's quarter.
                        tx = lead.x - Math.sin(lead.h) * 22 + Math.cos(lead.h) * 26;
                        ty = lead.y + Math.cos(lead.h) * 22 + Math.sin(lead.h) * 26;
                    }
                    const dist = Math.hypot(tx - g.x, ty - g.y);
                    steer(g, tx, ty, SWIM[kind] * (g !== lead ? (dist > 120 ? 2.2 : dist > 50 ? 1.5 : 1) : 1), g !== lead ? 1.4 : 0.8, dt);
                    if (Math.hypot(g.tx - g.x, g.ty - g.y) < 20) { const q = waterPoint(G); if (q) { g.tx = q.x; g.ty = q.y; } }
                    if (g.t <= 0 || spooked) {
                        g.mode = 'dive'; g.t = 0.6; g.sink = 0;
                        if (kind === 'beaver' && spooked) g.slap = 1;   // the tail-slap warning
                    }
                } else if (g.mode === 'dance') {
                    // Face each other across a couple of lengths, heads shaking.
                    const other = G.birds.find(o => o !== g);
                    const ang = Math.atan2(g.x - g.mx, -(g.y - g.my));
                    // Ease onto a point 26 u out from the pair's centre (never swim toward the
                    // partner — the heading below faces it, so moving along it would close them up).
                    const px = g.mx + Math.sin(ang) * 26, py = g.my - Math.cos(ang) * 26;
                    g.x += (px - g.x) * Math.min(1, dt * 1.5); g.y += (py - g.y) * Math.min(1, dt * 1.5);
                    g.h += angDiff(Math.atan2(other.x - g.x, -(other.y - g.y)), g.h) * Math.min(1, dt * 3);
                    g.yaw = Math.sin(g.bob * 7) * 0.55 * Math.min(1, g.t);
                    if (g.t <= 0 || spooked) { g.mode = 'swim'; g.yaw = 0; g.t = R(4, 8); if (spooked) { g.mode = 'dive'; g.t = 0.6; } }
                } else if (g.mode === 'flap') {
                    g.flap = Math.min(1, g.flap + dt * 4);
                    if (g.t <= 0) { g.mode = 'swim'; g.flap = 0; g.t = R(8, 14); }
                } else if (g.mode === 'dive') {
                    g.sink = Math.min(1, g.sink + dt / 0.6);
                    g.x += Math.sin(g.h) * SWIM[kind] * dt; g.y -= Math.cos(g.h) * SWIM[kind] * dt;
                    if (g.t <= 0) { g.mode = 'under'; g.t = R(4, 8); g.splash = 1; g.trail = []; }
                } else if (g.mode === 'under') {
                    // On along its heading, turning gently, until it runs out of breath.
                    const nx = g.x + Math.sin(g.h) * UNDER[kind] * dt, ny = g.y - Math.cos(g.h) * UNDER[kind] * dt;
                    if (!onLand(nx, ny) && Math.hypot(nx - G.cx, ny - G.cy) < G.r * 1.2) { g.x = nx; g.y = ny; }
                    else g.h += 1.5 * dt;
                    if (g.t <= 0) {
                        const boatNear = (state.boats || []).some(b => Math.hypot(b.x - g.x, b.y - g.y) < reactR * 1.4);
                        if (onLand(g.x, g.y) || boatNear) { g.t = 0.8; }
                        else {
                            g.mode = 'swim'; g.t = R(8, 16); g.splash = 1; g.rise = 1; g.sink = 0;
                            const q = waterPoint(G); if (q) { g.tx = q.x; g.ty = q.y; }
                            if (kind === 'loon' && rnd() < 0.3) { g.mode = 'flap'; g.t = 1.3; g.flap = 0; }
                            if (kind === 'beaver') g.stick = rnd() < 0.5;
                        }
                    }
                }
            }
        }
    }

    // ── the moose ─────────────────────────────────────────────────────────────────────────
    // Feeding, it puts its whole head under water for a few seconds (moose eat water plants),
    // brings it up streaming, chews and looks about, and shifts a step now and then. A boat
    // close by: head up, turned toward the noise; then it wades off to the shore and away.
    function updateWaders(dt, me) {
        for (const w of waders) {
            w.t += dt; w.bob += dt;
            w.ashore = onLand(w.x, w.y);
            w.drip = Math.max(0, w.drip - dt * 0.8);
            let near = null;
            for (const b of state.boats || []) {
                if (b.opacity !== undefined && b.opacity < 0.2) continue;
                if (Math.hypot(b.x - w.cx, b.y - w.cy) < w.cfg.flushR) { near = b; if (b === me) feat(w.cfg.feat); if (b.isPlayer) break; }
            }
            if (w.mode === 'graze') {
                w.dipT -= dt;
                if (w.dipT <= 0) {
                    w.under = !w.under;
                    if (!w.under) w.drip = 1;
                    w.dipT = w.under ? R(3, 5.5) : R(2.5, 5);
                }
                w.dip += ((w.under ? 1 : 0) - w.dip) * Math.min(1, dt * 3);
                // A step now and then, staying in its bed.
                w.stepT -= dt;
                if (w.stepT <= 0) { w.stepT = R(7, 14); w.goal = { x: w.cx + R(-18, 18), y: w.cy + R(-18, 18) }; }
                if (w.goal) {
                    const d = Math.hypot(w.goal.x - w.x, w.goal.y - w.y);
                    if (d > 2) { w.x += (w.goal.x - w.x) / d * 6 * dt; w.y += (w.goal.y - w.y) / d * 6 * dt; w.sway += dt * 4; }
                    else w.goal = null;
                }
                if (near) { w.mode = 'alert'; w.t = 0; w.under = false; w.drip = w.dip > 0.4 ? 1 : 0; w.turnTo = Math.atan2(near.x - w.x, -(near.y - w.y)); }
            } else if (w.mode === 'alert') {
                w.dip += (0 - w.dip) * Math.min(1, dt * 5);
                w.h += angDiff(w.turnTo, w.h) * Math.min(1, dt * 2.5);
                if (w.t > 1.4) { w.mode = 'leave'; w.t = 0; w.from = { x: w.x, y: w.y }; }
            } else if (w.mode === 'leave') {
                // out of the water and up onto the open bank
                w.h += angDiff(Math.atan2(w.shore.x - w.x, -(w.shore.y - w.y)), w.h) * Math.min(1, dt * 2);
                const k = Math.min(1, w.t / 5);
                w.x = w.from.x + (w.shore.x - w.from.x) * k; w.y = w.from.y + (w.shore.y - w.from.y) * k;
                w.sway += dt * 6;
                if (k >= 1) { w.mode = 'bank'; w.t = 0; w.lookFrom = w.h; }
            } else if (w.mode === 'bank') {
                // stands on the shore and looks back at the water a moment
                const back = Math.atan2(w.cx - w.x, -(w.cy - w.y));
                w.h += angDiff(w.t < 2 ? back : Math.atan2(w.forest.x - w.x, -(w.forest.y - w.y)), w.h) * Math.min(1, dt * 2);
                if (w.t > 3.2) { w.mode = 'forest'; w.t = 0; w.from = { x: w.x, y: w.y }; }
            } else if (w.mode === 'forest') {
                // and off into the trees
                const k = Math.min(1, w.t / 4);
                w.x = w.from.x + (w.forest.x - w.from.x) * k; w.y = w.from.y + (w.forest.y - w.from.y) * k;
                w.sway += dt * 6;
                w.alpha = 1 - Math.max(0, (k - 0.5) / 0.5);
                if (k >= 1) { w.mode = 'gone'; w.t = 0; w.back = R(28, 40); }
            } else if (w.mode === 'gone') {
                if (w.t > w.back && !near) { w.mode = 'return'; w.t = 0; w.x = w.forest.x; w.y = w.forest.y; }
            } else if (w.mode === 'return') {
                // out of the trees, over the bank, back into its bed
                const k = Math.min(1, w.t / 9);
                const via = w.shore, from = w.forest;
                const P = k < 0.4 ? { x: from.x + (via.x - from.x) * (k / 0.4), y: from.y + (via.y - from.y) * (k / 0.4) }
                                  : { x: via.x + (w.cx - via.x) * ((k - 0.4) / 0.6), y: via.y + (w.cy - via.y) * ((k - 0.4) / 0.6) };
                w.h += angDiff(Math.atan2(P.x - w.x, -(P.y - w.y)), w.h) * Math.min(1, dt * 3);
                w.x = P.x; w.y = P.y;
                w.sway += dt * 6;
                w.alpha = Math.min(1, k / 0.3);
                if (k >= 1) { w.mode = 'graze'; w.t = 0; w.dipT = R(2, 4); }
                if (near) { w.mode = 'alert'; w.t = 0; w.turnTo = Math.atan2(near.x - w.x, -(near.y - w.y)); }
            }
        }
    }

    // ── bait boils and the pelicans that find them ───────────────────────────────────────
    function spawnBoil() {
        const legs = (state.course && state.course.dmc && state.course.dmc.legs) || [];
        const pts = [];
        for (const L of legs) for (const p of (L.pts || [])) pts.push(p);
        if (!pts.length) return null;
        for (let tries = 0; tries < 40; tries++) {
            // Off the course, never on it: a boil is a detour you choose.
            const i = Math.floor(rnd() * (pts.length - 1));
            const a = pts[i], b = pts[i + 1] || pts[i];
            const k = rnd(), x0 = a.x + (b.x - a.x) * k, y0 = a.y + (b.y - a.y) * k;
            const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
            const off = R(300, 650) * (rnd() < 0.5 ? -1 : 1);
            const x = x0 + nx * off, y = y0 + ny * off;
            let clear = !onLand(x, y);
            for (let s = 0; clear && s < 8; s++) {
                const t = s / 8 * Math.PI * 2;
                if (onLand(x + Math.cos(t) * (BOIL_R + 40), y + Math.sin(t) * (BOIL_R + 40))) clear = false;
            }
            // And not sitting on the course somewhere else either.
            if (clear && pts.some(p => Math.hypot(p.x - x, p.y - y) < 220)) clear = false;
            if (clear) return { x, y, t: 0, life: R(38, 50), seed: Math.floor(rnd() * 1e9) };
        }
        return null;
    }

    function updateFeeders(dt, me) {
        const f = flight;
        if (boil) {
            boil.t += dt;
            if (boil.t > boil.life) { boil = null; nextBoil = R(45, 75); if (f.mode !== 'patrol') f.mode = 'return'; }
        } else {
            nextBoil -= dt;
            if (nextBoil <= 0) { boil = spawnBoil(); if (!boil) nextBoil = 10; else f.mode = 'transit'; }
        }
        // The squadron: a leader on a patrol ellipse or heading to the boil; the rest in line.
        const marks = (state.course && state.course.marks) || [];
        let cx = 0, cy = 0;
        for (const m of marks) { cx += m.x; cy += m.y; }
        if (marks.length) { cx /= marks.length; cy /= marks.length; }
        if (f.x === 0 && f.y === 0) { f.x = cx + 1200; f.y = cy; }
        if (f.mode === 'patrol' || f.mode === 'return') {
            f.a += dt * 0.07;
            const tx = cx + Math.cos(f.a) * 1500, ty = cy + Math.sin(f.a) * 1100;
            steer(f, tx, ty, 130, 0.7, dt);
            if (f.mode === 'return' && f.birds.every(b => b.mode === 'fly')) f.mode = 'patrol';
        } else if (f.mode === 'transit' && boil) {
            steer(f, boil.x, boil.y, 150, 1.2, dt);
            if (Math.hypot(f.x - boil.x, f.y - boil.y) < 170) { f.mode = 'feeding'; f.nextDive = 0.4; }
        } else if (f.mode === 'feeding' && boil) {
            f.x = boil.x; f.y = boil.y;
            f.nextDive -= dt;
            if (f.nextDive <= 0) {
                const idle = f.birds.filter(b => b.mode === 'fly');
                if (idle.length) { const b = idle[Math.floor(rnd() * idle.length)]; b.mode = 'dive'; b.t = 0; b.dx = boil.x + R(-BOIL_R, BOIL_R) * 0.7; b.dy = boil.y + R(-BOIL_R, BOIL_R) * 0.7; }
                f.nextDive = R(0.8, 1.6);
            }
            if (me && Math.hypot(me.x - boil.x, me.y - boil.y) < BOIL_R + 25) feat(f.cfg.feat);
        }
        for (const b of f.birds) {
            b.flap += dt * (b.mode === 'fly' ? 4.5 : 0);
            if (b.mode === 'fly') {
                if (f.mode === 'feeding') {
                    b.orbitA += dt * 0.9;
                    steer(b, f.x + Math.cos(b.orbitA) * b.orbitR, f.y + Math.sin(b.orbitA) * b.orbitR, 120, 2.2, dt);
                } else {
                    // In line astern of the leader, a little staggered.
                    const back = 44 * (b.i + 1), side = (b.i % 2 ? 1 : -1) * 10;
                    const tx = f.x - Math.sin(f.h) * back + Math.cos(f.h) * side;
                    const ty = f.y + Math.cos(f.h) * back + Math.sin(f.h) * side;
                    if (b.x === 0 && b.y === 0) { b.x = tx; b.y = ty; b.h = f.h; }
                    const d = Math.hypot(tx - b.x, ty - b.y);
                    steer(b, tx, ty, Math.min(190, 110 + d * 0.8), 2.4, dt);
                }
                b.z += (70 - b.z) * Math.min(1, dt * 1.5);
            } else if (b.mode === 'dive') {
                b.t += dt;
                steer(b, b.dx, b.dy, 110, 5, dt);
                b.z = Math.max(0, 70 * (1 - b.t / 0.75));
                if (b.t >= 0.75) { b.mode = 'sit'; b.t = 0; b.x = b.dx; b.y = b.dy; b.z = 0; b.splash = 0; }
            } else if (b.mode === 'sit') {
                b.t += dt; b.splash = b.t;
                if (b.t > 1.9) { b.mode = 'fly'; b.t = 0; }
            }
        }
    }

    // ── REDROCK: striper boils, condors, bighorn, coyotes (Sep 25 2026) ──────────────────
    // Sizes (guidelines/scale.md): a striper 0.8 m in a boil -> 18 (a school, rule 7); the
    // condor spans 2.9 m -> 80 (2.35× its 34-unit body, per the soaring references — bigger
    // than the eagle's 58, as it should be); a bighorn 1.6 m -> 34 and a coyote 1.6 m with its
    // tail -> 32 (≈2×, like the bear). Speeds are drawn body lengths a second, like the others.
    const STRIPER_LEN = 18, CONDOR_SPAN = 80, CONDOR_SOAR = 38, CONDOR_GLIDE = 70;
    // Is (x, y) land (or water) and so is everything within m of it?
    function ringClear(x, y, m, wantLand) {
        if (onLand(x, y) !== wantLand) return false;
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; if (onLand(x + Math.cos(a) * m, y + Math.sin(a) * m) !== wantLand) return false; }
        return true;
    }
    function landWithin(x, y, r) {
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (onLand(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true; }
        return false;
    }
    function landSpot(cx, cy, r, m) {
        for (let k = 0; k < 30; k++) { const a = R(0, 7), d = Math.sqrt(rnd()) * r, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (ringClear(x, y, m, true)) return { x, y }; }
        return null;
    }
    // Walk (never slide sideways): turn toward the target, go forward, slower while turning.
    // On land (a walker): never a step onto water — it stops there and the caller picks again.
    function moveTo(o, tx, ty, v, turn, dt, land) {
        const d = Math.hypot(tx - o.x, ty - o.y); if (d < 0.5) return true;
        const want = Math.atan2(tx - o.x, -(ty - o.y));
        o.h += Math.max(-turn * dt, Math.min(turn * dt, angDiff(want, o.h)));
        const s = Math.min(d, v * dt * Math.max(0.25, Math.cos(angDiff(want, o.h))));
        const nx = o.x + Math.sin(o.h) * s, ny = o.y - Math.cos(o.h) * s;
        if (land && !onLand(nx + Math.sin(o.h) * 4, ny - Math.cos(o.h) * 4)) return false;
        o.x = nx; o.y = ny; return true;
    }

    // STRIPERS. A boil comes up in one of the open-water zones (nearer the player more often —
    // what you can see is what you can chase), drifts with the school, wanders, turns off the
    // shore, and goes down after 40-70 s; another comes up somewhere else. Sailing into one
    // counts it (value = boils this race) for Linesider.
    function spawnStriperBoil(me) {
        const c = cfg.stripers;
        const w = c.zones.map(([x, y]) => { const d = me ? Math.hypot(me.x - x, me.y - y) : 2000; return 1 / (1 + (d / 900) ** 2); });
        const tot = w.reduce((a, b) => a + b, 0);
        for (let tries = 0; tries < 12; tries++) {
            let u = rnd() * tot, zi = 0; while (zi < w.length - 1 && u > w[zi]) { u -= w[zi]; zi++; }
            const [zx, zy, zr] = c.zones[zi], a = R(0, 7), d = Math.sqrt(rnd()) * zr, x = zx + Math.cos(a) * d, y = zy + Math.sin(a) * d;
            const r = R(c.r[0], c.r[1]);
            if (!ringClear(x, y, r + 25, false) || stripers.some(b => Math.hypot(b.x - x, b.y - y) < 400)) continue;
            return { x, y, zx, zy, zr, h: R(0, 7), v: R(7, 13), r, t: 0, life: R(c.life[0], c.life[1]), seed: Math.floor(rnd() * 1e9), hit: false,
                fish: Array.from({ length: 9 }, () => ({ a: R(0, 7), d: R(0.15, 0.85), per: R(1.6, 3.2), ph: R(0, 3), dir: rnd() < 0.5 ? -1 : 1, size: R(0.85, 1.15) })) };
        }
        return null;
    }
    function boilK(B) { return Math.max(0, Math.min(1, B.t / 3, (B.life - B.t) / 5)); }
    function updateStripers(dt, me) {
        const c = cfg.stripers;
        for (const B of stripers) {
            B.t += dt;
            B.h += Math.sin(T * 0.21 + B.seed) * 0.25 * dt;
            const nx = B.x + Math.sin(B.h) * B.v * dt, ny = B.y - Math.cos(B.h) * B.v * dt;
            // shore ahead, or wandered out of its reach: turn away
            if (!ringClear(nx + Math.sin(B.h) * 30, ny - Math.cos(B.h) * 30, B.r + 10, false) || Math.hypot(nx - B.zx, ny - B.zy) > B.zr + 150) B.h += 2.1 * dt;
            else { B.x = nx; B.y = ny; }
            if (me && !B.hit && boilK(B) > 0.4 && Math.hypot(me.x - B.x, me.y - B.y) < B.r * 0.85) {
                B.hit = true; boilsHit++;
                if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: c.feat, value: boilsHit });
            }
        }
        stripers = stripers.filter(B => B.t < B.life);
        nextStriper -= dt;
        if (stripers.length < c.live && nextStriper <= 0) {
            const B = spawnStriperBoil(me || (state.boats && state.boats[0]));
            if (B) stripers.push(B);
            nextStriper = R(c.gap[0], c.gap[1]);
        }
    }

    // CONDORS. They ride the thermal over the butte in wide slow circles, rising and sinking
    // on it, wings flat and fingers spread — a condor almost never flaps. The first one now and
    // then leaves the thermal on a long straight glide out over the course and back home.
    function makeCondors(c) {
        const [rx, ry] = c.roost;
        return c.circles.map((r, i) => {
            const C = { i, cx: rx + R(-60, 60), cy: ry + R(-60, 60), r, a: R(0, 7), dir: i % 2 ? -1 : 1, z: R(130, 175), zp: R(0, 7), x: 0, y: 0, h: 0, bank: 0, mode: 'circle', wi: 0, t: i === 0 ? R(25, 50) : 1e9 };
            C.x = C.cx + Math.cos(C.a) * C.r; C.y = C.cy + Math.sin(C.a) * C.r; C.h = C.a + (C.dir > 0 ? Math.PI : 0);
            return C;
        });
    }
    function updateCondors(dt) {
        const c = cfg.condors;
        for (const C of condors) {
            const h0 = C.h; C.zp += dt * 0.05;
            if (C.mode === 'circle') {
                C.a += C.dir * CONDOR_SOAR / C.r * dt;
                const x = C.cx + Math.cos(C.a) * C.r, y = C.cy + Math.sin(C.a) * C.r;
                if (Math.hypot(x - C.x, y - C.y) > 0.01) C.h = Math.atan2(x - C.x, -(y - C.y));
                C.x = x; C.y = y; C.z = 150 + 25 * Math.sin(C.zp);
                C.t -= dt; if (C.t <= 0) { C.mode = 'glide'; C.wi = 0; }
            } else {
                const home = C.wi >= c.wander.length;
                const tx = home ? C.cx + Math.cos(C.a) * C.r : c.wander[C.wi][0], ty = home ? C.cy + Math.sin(C.a) * C.r : c.wander[C.wi][1];
                steer(C, tx, ty, CONDOR_GLIDE, 0.35, dt);
                C.z += (125 - C.z) * Math.min(1, dt * 0.2);
                if (Math.hypot(tx - C.x, ty - C.y) < (home ? 60 : 180)) {
                    if (home) { C.mode = 'circle'; C.a = Math.atan2(C.y - C.cy, C.x - C.cx); C.x = C.cx + Math.cos(C.a) * C.r; C.y = C.cy + Math.sin(C.a) * C.r; C.t = R(60, 110); }
                    else C.wi++;
                }
            }
            // how hard it is turning, eased: the high wing reaches, the low one shortens
            const turn = dt > 0 ? angDiff(C.h, h0) / dt : 0;
            C.bank += (Math.max(-1, Math.min(1, turn * 3)) - C.bank) * Math.min(1, dt * 2);
        }
    }

    // BIGHORN. A band lives at the foot of a tower or talus slope, on the land just back from
    // the water. They graze and walk about; a boat in sight stops one to watch it; a boat close
    // in sends it bounding up the rock, away, where it stops and looks back.
    function makeBand(pr, n) {
        let home = null, bd = 1e9;
        for (let k = 0; k < 200; k++) {
            const a = R(0, 7), d = R(20, 180), x = pr.x + Math.cos(a) * d, y = pr.y + Math.sin(a) * d;
            if (!ringClear(x, y, 24, true) || ringClear(x, y, 50, true)) continue;   // on land, with water within 50
            if (d < bd) { bd = d; home = { x, y }; }
        }
        if (!home) return null;
        const members = Array.from({ length: n }, (_, i) => {
            const p = landSpot(home.x, home.y, 35, 12) || home;
            return { i, x: p.x, y: p.y, h: R(0, 7), look: 0, head: 1, mode: 'graze', t: R(1, 6), tx: p.x, ty: p.y, step: R(0, 7),
                ram: i === 0 || (n >= 5 && i === 1), lamb: n >= 4 && i === n - 1, moving: 0 };
        });
        return { home, members };
    }
    function updateBands(dt) {
        const c = cfg.bighorn;
        for (const G of bands) for (const s of G.members) {
            s.t -= dt;
            const near = boatNear(s.x, s.y, c.reactR), seen = boatNear(s.x, s.y, c.lookR);
            if (near && s.mode !== 'bound') {
                // up the rock: of sixteen ways, the one most away from the boat and furthest
                // from the water's edge
                const away = Math.atan2(s.x - near.x, -(s.y - near.y));
                let best = null, bs = -1e9;
                for (let i = 0; i < 16; i++) {
                    const a = away + (i / 16) * Math.PI * 2, d = R(70, 110), x = s.x + Math.sin(a) * d, y = s.y - Math.cos(a) * d;
                    if (!ringClear(x, y, 10, true)) continue;
                    const inland = ringClear(x, y, 40, true) ? 1 : ringClear(x, y, 22, true) ? 0.5 : 0;
                    const sc = Math.cos(angDiff(a, away)) + inland + Math.hypot(x - near.x, y - near.y) / 200;
                    if (sc > bs) { bs = sc; best = { x, y }; }
                }
                if (best) { s.mode = 'bound'; s.tx = best.x; s.ty = best.y; }
            }
            if (s.mode === 'bound') {
                const go = moveTo(s, s.tx, s.ty, 85, 5, dt, true); s.step += dt * 16;
                if (!go || Math.hypot(s.tx - s.x, s.ty - s.y) < 4) { s.mode = 'look'; s.t = R(5, 9); }
            } else if (s.mode === 'walk') {
                const go = moveTo(s, s.tx, s.ty, 16, 2.5, dt, true); s.step += dt * 6.3;
                if (!go || Math.hypot(s.tx - s.x, s.ty - s.y) < 3) { s.mode = 'graze'; s.t = R(3, 9); }
            } else if (s.mode === 'look') {
                if (s.t <= 0 && !seen) { s.mode = 'graze'; s.t = R(2, 5); }
            } else {
                if (seen && rnd() < dt * 0.6) { s.mode = 'look'; s.t = R(2, 5); }
                else if (s.t <= 0) { const p = landSpot(G.home.x, G.home.y, 40, 10); if (p) { s.mode = 'walk'; s.tx = p.x; s.ty = p.y; } else s.t = R(2, 5); }
            }
            const want = (s.mode === 'look' && seen) ? angDiff(Math.atan2(seen.x - s.x, -(seen.y - s.y)), s.h) : 0;
            s.look += (Math.max(-1.1, Math.min(1.1, want)) - s.look) * Math.min(1, dt * 4);
            s.head += ((s.mode === 'graze' ? 1 : 0) - s.head) * Math.min(1, dt * 3);
            s.moving += ((s.mode === 'bound' ? 2 : s.mode === 'walk' ? 1 : 0) - s.moving) * Math.min(1, dt * 6);
        }
    }

    // COYOTES. Each has a sand island. It trots from place to place, stops and looks about,
    // sits, goes down to the water's edge to drink; a pair keeps together. A boat in sight gets
    // stared at; one close in sends it off at a lope to the far side.
    function makeCoyotes(c) {
        const out = [];
        for (const [id, n] of c.on) {
            const isl = (state.course.islands || []).find(s => s.id === id); if (!isl || !isl.vertices) continue;
            const V = isl.vertices, cx = V.reduce((a, v) => a + v.x, 0) / V.length, cy = V.reduce((a, v) => a + v.y, 0) / V.length;
            const spot = () => {
                for (let k = 0; k < 40; k++) { const v = V[Math.floor(rnd() * V.length)], u = R(0.1, 0.85), x = cx + (v.x - cx) * u, y = cy + (v.y - cy) * u; if (pointInPoly(x, y, V) && ringClear(x, y, 12, true)) return { x, y }; }
                return { x: cx, y: cy };
            };
            const edge = () => {   // a spot on the sand just up from the water, and which way the water is
                for (let k = 0; k < 40; k++) {
                    const v = V[Math.floor(rnd() * V.length)], L = Math.hypot(cx - v.x, cy - v.y) || 1, s = R(9, 14);
                    const x = v.x + (cx - v.x) / L * s, y = v.y + (cy - v.y) / L * s;
                    if (ringClear(x, y, 4, true) && !onLand(v.x - (cx - v.x) / L * 6, v.y - (cy - v.y) / L * 6)) return { x, y, h: Math.atan2(v.x - cx, -(v.y - cy)) };
                }
                return null;
            };
            let mate = null;
            for (let i = 0; i < n; i++) {
                const p = spot();
                const K = { i: out.length, cx, cy, V, spot, edge, x: p.x, y: p.y, h: R(0, 7), mode: 'stand', t: R(1, 5), tx: p.x, ty: p.y, step: R(0, 7), look: 0, head: 0, sit: 0, drink: null, mate, moving: 0 };
                out.push(K); mate = K;
            }
        }
        return out;
    }
    function updateCoyotes(dt) {
        const c = cfg.coyotes;
        for (const K of coyotes) {
            K.t -= dt;
            const near = boatNear(K.x, K.y, c.reactR), seen = boatNear(K.x, K.y, c.lookR);
            if (near && K.mode !== 'lope') {
                let best = null, bd = -1;
                for (let k = 0; k < 8; k++) { const p = K.spot(), d = Math.hypot(p.x - near.x, p.y - near.y); if (d > bd) { bd = d; best = p; } }
                K.mode = 'lope'; K.tx = best.x; K.ty = best.y; K.drink = null;
            }
            if (K.mode === 'trot' || K.mode === 'lope') {
                const lope = K.mode === 'lope';
                const go = moveTo(K, K.tx, K.ty, lope ? 110 : 45, lope ? 4 : 2.6, dt, true); K.step += dt * (lope ? 18 : 15);
                if (!go) { K.drink = null; K.mode = 'stand'; K.t = R(0.5, 2); }
                else if (Math.hypot(K.tx - K.x, K.ty - K.y) < 3) {
                    if (K.drink) { K.mode = 'drink'; K.t = R(4, 7); }
                    else { K.mode = 'stand'; K.t = R(2, 6); }
                }
            } else if (K.mode === 'drink') {
                K.h += Math.max(-2 * dt, Math.min(2 * dt, angDiff(K.drink.h, K.h)));
                if (K.t <= 0 || seen) { K.drink = null; K.mode = 'stand'; K.t = R(1, 3); }
            } else if (K.t <= 0 && !(seen && rnd() < 0.8)) {
                const r = rnd(), m = K.mate;
                if (m && Math.hypot(m.x - K.x, m.y - K.y) > 70) { K.mode = 'trot'; K.tx = m.x; K.ty = m.y; }
                else if (r < 0.2) { K.mode = 'sit'; K.t = R(5, 10); }
                else if (r < 0.45) { const p = K.edge(); if (p) { K.mode = 'trot'; K.drink = p; K.tx = p.x; K.ty = p.y; } else K.t = R(1, 3); }
                else { const p = K.spot(); K.mode = 'trot'; K.tx = p.x; K.ty = p.y; }
            }
            const want = (K.mode === 'stand' || K.mode === 'sit') && seen ? angDiff(Math.atan2(seen.x - K.x, -(seen.y - K.y)), K.h) : 0;
            K.look += (Math.max(-1.2, Math.min(1.2, want)) - K.look) * Math.min(1, dt * 4);
            K.head += ((K.mode === 'drink' ? 1 : 0) - K.head) * Math.min(1, dt * 3);
            K.sit += ((K.mode === 'sit' ? 1 : 0) - K.sit) * Math.min(1, dt * 3);
            K.moving += ((K.mode === 'lope' ? 2 : K.mode === 'trot' ? 1 : 0) - K.moving) * Math.min(1, dt * 6);
        }
    }

    // ── drawing ───────────────────────────────────────────────────────────────────────────
    const OUT = 'rgba(28,34,44,0.9)';

    function shadow(ctx, x, y, z, rx, ry) {
        if (z <= 1) return;
        ctx.save();
        ctx.fillStyle = `rgba(10,25,40,${0.22 * Math.max(0.3, 1 - z / 120)})`;
        ctx.beginPath(); ctx.ellipse(x + z * 0.35, y + z * 0.55, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // Top-down gull: white body, grey mantle, black wingtips, a yellow bill.
    // HERRING GULL in flight, from above (drone references): long narrow wings CROOKED at the
    // wrist — the arm angled forward, the hand swept back — pale grey above with a white
    // trailing edge, black tips with a white "mirror" spot, a white head and a short white tail
    // fan. The wingbeat changes the wing's shape, not just its span: on the upstroke the hand
    // folds back and in. Its shadow on the water is its own silhouette.
    function gullWingPath(ctx, sd, beat) {
        // beat: 0 = fully spread (glide/downstroke), 1 = upstroke (hands swept back and in)
        const wx = 7.5 - 1.5 * beat, wy = -2.2 + 1.5 * beat;          // the wrist
        const tx = 16 - 6 * beat, ty = 3.5 + 5.5 * beat;               // the tip
        ctx.beginPath();
        ctx.moveTo(sd * 1.6, -2.2);
        ctx.quadraticCurveTo(sd * 4.5, -3.6, sd * wx, wy);             // leading edge of the arm
        ctx.quadraticCurveTo(sd * (wx + 5), wy + 0.2, sd * tx, ty);    // leading edge of the hand
        ctx.quadraticCurveTo(sd * (tx - 3.2), ty + 0.6, sd * (wx + 1), wy + 3.8);   // trailing edge of the hand
        ctx.quadraticCurveTo(sd * 4.5, 2.6, sd * 1.6, 2.4);            // trailing edge of the arm
        ctx.closePath();
        return { wx, wy, tx, ty };
    }
    function drawGullFlying(ctx, x, y, h, z, flap) {
        const beat = Math.max(0, Math.sin(flap));                      // 0..1, upstroke half the cycle
        const s = (1 + z * 0.004) * 1.2;
        // shadow on the water: the same silhouette, dark, offset by height
        ctx.save(); ctx.translate(x + z * 0.35, y + z * 0.55); ctx.rotate(h); ctx.scale(s * 0.95, s * 0.95);
        ctx.fillStyle = `rgba(10,25,40,${0.2 * Math.max(0.3, 1 - z / 120)})`;
        for (const sd of [-1, 1]) { gullWingPath(ctx, sd, beat); ctx.fill(); }
        ctx.beginPath(); ctx.ellipse(0, 0.5, 2.4, 7.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(s, s);
        ctx.lineJoin = 'round'; ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(40,46,56,0.6)';
        // tail fan
        ctx.beginPath(); ctx.moveTo(-1.6, 4.5); ctx.lineTo(-2.6, 9.4); ctx.quadraticCurveTo(0, 10.4, 2.6, 9.4); ctx.lineTo(1.6, 4.5); ctx.closePath();
        ctx.fillStyle = '#f7f8f9'; ctx.fill(); ctx.stroke();
        for (const sd of [-1, 1]) {
            const w = gullWingPath(ctx, sd, beat);
            ctx.fillStyle = '#c3ccd5'; ctx.fill(); ctx.stroke();
            // white trailing edge along the arm
            ctx.strokeStyle = 'rgba(250,251,252,0.95)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(sd * 2, 2.2); ctx.quadraticCurveTo(sd * 4.5, 2.4, sd * (w.wx + 0.8), w.wy + 3.4); ctx.stroke();
            // black tip with a white mirror
            ctx.beginPath();
            ctx.moveTo(sd * (w.tx - (w.tx - w.wx) * 0.38), w.ty - (w.ty - w.wy) * 0.38 - 0.4);
            ctx.lineTo(sd * w.tx, w.ty);
            ctx.lineTo(sd * (w.tx - (w.tx - w.wx) * 0.3), w.ty - (w.ty - w.wy) * 0.3 + 1.8);
            ctx.closePath(); ctx.fillStyle = '#1d2229'; ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath();
            ctx.arc(sd * (w.tx - (w.tx - w.wx) * 0.2), w.ty - (w.ty - w.wy) * 0.2 + 0.55, 0.32, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(40,46,56,0.6)';
        }
        // body: grey mantle on a white bird
        ctx.beginPath(); ctx.ellipse(0, 0.5, 2.5, 7.2, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 1, 1.6, 3.8, 0, 0, Math.PI * 2); ctx.fillStyle = '#c3ccd5'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -5.8, 1.6, 1.9, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.moveTo(-0.55, -7.4); ctx.lineTo(0, -9.8); ctx.lineTo(0.55, -7.4); ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    // Sitting: a white head forward, the grey folded wings making the back, black wingtips
    // crossed over the tail, a yellow bill. 18 units nose to tail — a third of a hull.
    function drawGullPerched(ctx, x, y, h) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(h);
        ctx.fillStyle = 'rgba(10,25,40,0.22)';
        ctx.beginPath(); ctx.ellipse(1.5, 2, 5.2, 8.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.lineJoin = 'round'; ctx.lineWidth = 1.3; ctx.strokeStyle = OUT;
        // body
        ctx.beginPath(); ctx.ellipse(0, 1, 4.6, 8, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
        // folded wings (the grey mantle), tapering to crossed black tips past the tail
        ctx.beginPath(); ctx.moveTo(-4.2, -1); ctx.quadraticCurveTo(-4.8, 6, -1.2, 10.5); ctx.lineTo(1.2, 10.5); ctx.quadraticCurveTo(4.8, 6, 4.2, -1);
        ctx.quadraticCurveTo(0, -3, -4.2, -1); ctx.closePath(); ctx.fillStyle = '#aeb8c3'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, 7.5); ctx.lineTo(0.6, 12); ctx.lineTo(2, 7.5); ctx.lineTo(-0.6, 12); ctx.closePath(); ctx.fillStyle = '#1f242b'; ctx.fill();
        // head and bill
        ctx.beginPath(); ctx.arc(0, -6.5, 3.4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-0.9, -9.4); ctx.lineTo(0, -13); ctx.lineTo(0.9, -9.4); ctx.closePath(); ctx.fillStyle = '#f2c14e'; ctx.fill();
        ctx.fillStyle = '#d9412b'; ctx.fillRect(-0.5, -11.6, 1, 0.9);   // the herring gull's red gonys spot
        ctx.restore();
    }
    // BROWN PELICAN from above (references: formation flight over the Pacific, plunge-dives):
    // very long broad wings with FINGERED primaries — the dark tip feathers splayed apart —
    // silvery grey-brown coverts over a dark trailing edge, the neck folded back so the pale
    // head sits close in with the long bill laid forward along it, and a short tail. Diving,
    // the wings sweep back into an arrowhead and the bill points the way down.
    const PEL_OUT = 'rgba(40,36,32,0.55)';
    function pelicanWing(ctx, sd, half, sweep) {
        // sweep: 0 = spread, 1 = dive (hand swept back from the wrist into an arrowhead)
        const wx = half * (0.45 - 0.12 * sweep), wy = -1 + 3 * sweep;
        const tx = half * (1 - 0.45 * sweep), ty = -0.5 + 13 * sweep;
        ctx.beginPath();
        ctx.moveTo(sd * 2.4, -4.2);
        ctx.quadraticCurveTo(sd * wx * 0.55, -6.2 + sweep * 2, sd * wx, wy - 3.6);       // leading edge, arm
        ctx.quadraticCurveTo(sd * (wx + (tx - wx) * 0.6), wy - 3.4 + (ty - wy) * 0.5, sd * tx, ty - 2);   // leading edge, hand
        ctx.lineTo(sd * tx, ty + 2);
        ctx.quadraticCurveTo(sd * (wx + (tx - wx) * 0.4), ty + 2.6 + (wy - ty) * 0.3, sd * wx, wy + 4.2);  // trailing edge, hand
        ctx.quadraticCurveTo(sd * wx * 0.5, 6.4 + sweep * 2, sd * 2.4, 5.4);          // trailing edge, arm: deep chord at the body
        ctx.closePath();
        return { wx, wy, tx, ty };
    }
    function pelicanShape(ctx, half, sweep, fill) {
        for (const sd of [-1, 1]) {
            const w = pelicanWing(ctx, sd, half, sweep);
            ctx.fillStyle = fill || '#aaa194'; ctx.fill(); if (!fill) ctx.stroke();
            if (fill) continue;
            // the darker flight feathers along the trailing edge, a narrow band that widens out
            // toward the hand
            ctx.beginPath();
            ctx.moveTo(sd * 3.5, 5.2);
            ctx.quadraticCurveTo(sd * w.wx * 0.5, 6.2 + sweep * 2, sd * w.wx, w.wy + 4.1);
            ctx.quadraticCurveTo(sd * (w.wx + (w.tx - w.wx) * 0.4), w.ty + 2.5 + (w.wy - w.ty) * 0.3, sd * w.tx, w.ty + 2);
            ctx.lineTo(sd * (w.tx - 2), w.ty - 0.2);
            ctx.quadraticCurveTo(sd * (w.wx + (w.tx - w.wx) * 0.4), w.ty + 0.4 + (w.wy - w.ty) * 0.3, sd * w.wx, w.wy + 2.4);
            ctx.quadraticCurveTo(sd * w.wx * 0.5, 4.6 + sweep * 2, sd * 3.5, 4.2);
            ctx.closePath(); ctx.fillStyle = '#5a5047'; ctx.fill();
            // the fingers: five dark primaries splayed at the tip
            // the dark hand, then the fingers: slim primary tips just separated at the end
            ctx.beginPath(); ctx.moveTo(sd * (w.tx - 4.5), w.ty - 2.2 + 0.4); ctx.lineTo(sd * w.tx, w.ty - 2.2); ctx.lineTo(sd * w.tx, w.ty + 2.4); ctx.lineTo(sd * (w.tx - 4.5), w.ty + 1.6); ctx.closePath();
            ctx.fillStyle = '#3d3630'; ctx.fill();
            ctx.strokeStyle = '#3d3630'; ctx.lineCap = 'round'; ctx.lineWidth = 0.75;
            for (let f = 0; f < 5; f++) {
                const fy = w.ty - 1.9 + f * 1.05, fx = sd * w.tx;
                ctx.beginPath(); ctx.moveTo(fx - sd * 0.5, fy); ctx.lineTo(fx + sd * (1.9 - Math.abs(f - 1.5) * 0.35), fy + (f - 2) * 0.55 + sweep * 1.6); ctx.stroke();
            }
            ctx.lineWidth = 1; ctx.strokeStyle = PEL_OUT;
        }
    }
    function pelicanHead(ctx, billLen, y0) {
        const y = y0 == null ? -7.5 : y0;
        ctx.beginPath(); ctx.ellipse(0, y, 2.8, 3.4, 0, 0, Math.PI * 2); ctx.fillStyle = '#f6efdc'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(214,190,120,0.8)'; ctx.beginPath(); ctx.ellipse(0, y - 0.9, 1.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();   // the yellow crown
        ctx.beginPath(); ctx.moveTo(-1.3, y - 2.6); ctx.lineTo(-0.5, y - 2.6 - billLen); ctx.lineTo(0.5, y - 2.6 - billLen); ctx.lineTo(1.3, y - 2.6); ctx.closePath();
        ctx.fillStyle = '#d9b77a'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d0622a'; ctx.fillRect(-0.5, y - 2.6 - billLen, 1, 1.4);
    }
    function drawPelicanFlying(ctx, x, y, h, z, flap, fold) {
        const sweep = fold ? 1 : 0;
        const s = (1 + z * 0.004) * 1.25;
        const half = PELICAN_SPAN / 2 / 1.25 * (fold ? 1 : (0.86 + 0.14 * Math.abs(Math.cos(flap))));
        // shadow: its own silhouette on the water, offset by height
        ctx.save(); ctx.translate(x + z * 0.35, y + z * 0.55); ctx.rotate(h); ctx.scale(s * 0.95, s * 0.95);
        pelicanShape(ctx, half, sweep, `rgba(10,25,40,${0.2 * Math.max(0.3, 1 - z / 120)})`);
        ctx.beginPath(); ctx.ellipse(0, 1.5, 3.8, 8.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(s, s);
        ctx.lineJoin = 'round'; ctx.lineWidth = 1; ctx.strokeStyle = PEL_OUT;
        // short tail
        ctx.beginPath(); ctx.moveTo(-2.2, 7); ctx.lineTo(-2.6, 10.5); ctx.quadraticCurveTo(0, 11.5, 2.6, 10.5); ctx.lineTo(2.2, 7); ctx.closePath();
        ctx.fillStyle = '#6e655b'; ctx.fill(); ctx.stroke();
        pelicanShape(ctx, half, sweep);
        ctx.beginPath(); ctx.ellipse(0, 1.5, 3.8, 8.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#8d8377'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(210,200,184,0.5)'; ctx.beginPath(); ctx.ellipse(0, 0.5, 2, 5, 0, 0, Math.PI * 2); ctx.fill();
        // neck folded back: the head sits close, bill laid forward (straight down the line in a dive)
        pelicanHead(ctx, fold ? 13 : 11, fold ? -8.5 : -6.5);
        ctx.restore();
    }
    function drawPelicanSitting(ctx, x, y, h, t) {
        ctx.save();
        // The splash as it hits: a crown of white, then a ring spreading from where it went in.
        if (t < 0.55) {
            const k = 1 - t / 0.55;
            const g = ctx.createRadialGradient(x, y, 2, x, y, 16 + t * 30);
            g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16 + t * 30, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
            for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (8 + t * 10), y + Math.sin(a) * (8 + t * 10)); ctx.lineTo(x + Math.cos(a) * (12 + t * 28), y + Math.sin(a) * (12 + t * 28)); ctx.stroke(); }
        }
        ctx.strokeStyle = `rgba(255,255,255,${0.3 * Math.max(0, 1 - t / 1.9)})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y, 14 + t * 14, 0, Math.PI * 2); ctx.stroke();
        // Sitting: wings folded along a boat-shaped body, darker primaries crossed over the tail,
        // the head up with the bill resting down its chest (seen from above: laid forward).
        ctx.translate(x, y); ctx.rotate(h); ctx.scale(1.25, 1.25);
        ctx.lineJoin = 'round'; ctx.lineWidth = 1; ctx.strokeStyle = PEL_OUT;
        ctx.beginPath(); ctx.moveTo(0, -4); ctx.bezierCurveTo(7, -3, 7, 9, 0, 14); ctx.bezierCurveTo(-7, 9, -7, -3, 0, -4); ctx.closePath();
        ctx.fillStyle = '#8f867a'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#aaa194'; ctx.beginPath(); ctx.ellipse(-2.4, 4, 2.6, 7.5, 0.08, 0, Math.PI * 2); ctx.ellipse(2.4, 4, 2.6, 7.5, -0.08, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3b352f'; ctx.beginPath(); ctx.moveTo(-2.5, 9); ctx.lineTo(0.8, 15.5); ctx.lineTo(2.5, 9); ctx.lineTo(-0.8, 15.5); ctx.closePath(); ctx.fill();
        pelicanHead(ctx, 10, -6);
        ctx.restore();
    }
    // A porpoise roll, from above: a tapered dark back — blunt head forward, narrowing to the
    // tail stock — that rises and slides forward through the roll, the small triangular fin
    // at mid-roll, a puff of spray as the blowhole breaks, and a V of wash off the head.
    function drawPorpoise(ctx, m) {
        // The footprint: a smooth slick left where it went down, fading.
        if (m.phase < 0) {
            if (m.slick > 0) {
                ctx.save(); ctx.translate(m.fx, m.fy);
                const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
                g.addColorStop(0, `rgba(170,205,225,${0.22 * m.slick})`); g.addColorStop(1, 'rgba(170,205,225,0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            return;
        }
        const p = m.phase, vis = Math.sin(Math.PI * p);
        ctx.save(); ctx.translate(m.sx, m.sy); ctx.rotate(m.sh);
        // 1. The whole animal under the surface, faint: a spindle with flippers and flukes —
        //    every overhead shot of a porpoise shows the body beyond the part that breaks water.
        const L = PORPOISE_LEN;
        ctx.globalAlpha = Math.min(1, 0.35 + vis * 0.5);
        ctx.fillStyle = 'rgba(30,48,62,0.42)';
        ctx.beginPath(); ctx.moveTo(0, -L * 0.52);
        ctx.bezierCurveTo(L * 0.2, -L * 0.45, L * 0.2, L * 0.2, L * 0.05, L * 0.42);
        ctx.lineTo(-L * 0.05, L * 0.42);
        ctx.bezierCurveTo(-L * 0.2, L * 0.2, -L * 0.2, -L * 0.45, 0, -L * 0.52); ctx.fill();
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * L * 0.2, -L * 0.18, L * 0.04, L * 0.12, sd * 0.7, 0, Math.PI * 2); ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(0, L * 0.4); ctx.quadraticCurveTo(L * 0.2, L * 0.46, L * 0.24, L * 0.56); ctx.quadraticCurveTo(L * 0.08, L * 0.52, 0, L * 0.5);
        ctx.quadraticCurveTo(-L * 0.08, L * 0.52, -L * 0.24, L * 0.56); ctx.quadraticCurveTo(-L * 0.2, L * 0.46, 0, L * 0.4); ctx.fill();
        ctx.globalAlpha = 1;
        // 2. The part that breaks the surface: head, then back and fin, rolling forward.
        const Lb = L * (0.5 + 0.5 * vis), W = 6.8 * (0.55 + 0.45 * vis);
        const head = -Lb / 2 + L * (0.2 - 0.4 * p);
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * vis})`; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-W - 3, head + 10); ctx.quadraticCurveTo(-W * 0.4, head - 3, 0, head - 4);
        ctx.quadraticCurveTo(W * 0.4, head - 3, W + 3, head + 10); ctx.stroke();
        if (p < 0.22) {
            const q = p / 0.22;
            const g = ctx.createRadialGradient(0, head + 3, 0, 0, head + 3, 6 + q * 12);
            g.addColorStop(0, `rgba(255,255,255,${0.85 * (1 - q)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, head + 3, 6 + q * 12, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = Math.min(1, vis * 1.8);
        ctx.lineJoin = 'round'; ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(18,22,28,0.85)';
        ctx.beginPath();
        ctx.moveTo(0, head);
        ctx.bezierCurveTo(W, head + 1, W, head + Lb * 0.45, W * 0.45, head + Lb * 0.8);
        ctx.lineTo(0, head + Lb);
        ctx.lineTo(-W * 0.45, head + Lb * 0.8);
        ctx.bezierCurveTo(-W, head + Lb * 0.45, -W, head + 1, 0, head);
        ctx.closePath();
        ctx.fillStyle = '#39424d'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-W * 0.3, head + Lb * 0.35, W * 0.22, Lb * 0.25, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(190,205,220,0.45)'; ctx.fill();
        if (p > 0.3 && p < 0.75) {
            const fy = head + Lb * 0.5;
            // the fin stands up, so from above it shows as a small dark triangle with a shadow
            ctx.fillStyle = 'rgba(10,20,30,0.3)'; ctx.beginPath(); ctx.moveTo(-1, fy + 3); ctx.lineTo(4, fy - 3); ctx.lineTo(3, fy + 4); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-2.6, fy + 3); ctx.lineTo(0, fy - 6); ctx.lineTo(2.6, fy + 3); ctx.closePath();
            ctx.fillStyle = '#20262e'; ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    }
    // A BAIT BOIL is churned water, not a disc: a lighter, greener patch with a ragged edge,
    // connected sheets of foam that swell and fade across it, and fish breaking the surface
    // in little white crowns. No outlines — a hard ring reads as UI (and dots read as rain).
    function drawBoil(ctx) {
        if (!boil) return;
        const k = Math.min(1, boil.t / 4, (boil.life - boil.t) / 5);
        if (k <= 0) return;
        const r = mulberry(boil.seed);
        ctx.save();
        // The ball itself wanders a little and breathes.
        const bx = boil.x + Math.sin(T * 0.37 + boil.seed) * 14, by = boil.y + Math.cos(T * 0.29) * 12;
        const R0 = BOIL_R * (0.9 + 0.08 * Math.sin(T * 0.8));
        // 1. The ball under the surface: a dense dark mass with a fairly crisp edge, deformed
        //    into slow lobes, and a paler hollow at its heart where the school turns (drone
        //    shots of bait balls show exactly this doughnut).
        const lob = (a) => 1 + 0.12 * Math.sin(3 * a + T * 0.5 + boil.seed) + 0.07 * Math.sin(5 * a - T * 0.8);
        // Soft overlapping blobs round the ring — lobed, feathered at the edge, and leaving the
        // paler hollow in the middle where the school turns.
        for (let i = 0; i < 9; i++) {
            const a = i / 9 * Math.PI * 2 + T * 0.12, rr = R0 * 0.5 * lob(a);
            const x = bx + Math.cos(a) * rr, y = by + Math.sin(a) * rr, rad = R0 * (0.42 + 0.08 * Math.sin(T * 0.7 + i));
            const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
            g.addColorStop(0, `rgba(6,22,36,${0.5 * k})`); g.addColorStop(0.6, `rgba(6,22,36,${0.28 * k})`); g.addColorStop(1, 'rgba(6,22,36,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
        }
        // 2. The school, swirling: dark fish packed densest in the ring, circling on their own
        //    radii and speeds and drawn along the way they swim, so the whole mass turns; a few
        //    catch the light as they turn — the silver flicker of a real bait ball.
        for (let i = 0; i < 190; i++) {
            const u = r(), ring = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(u * Math.PI * 7) * 0.4 + (u - 0.5) * 0.8);
            const rad = Math.max(0.2, Math.min(0.92, ring)) * R0 * 0.82;
            const w = (0.6 + r() * 0.6) * (1.3 - rad / R0);
            const a0 = r() * Math.PI * 2, a = a0 + T * w;
            const rr = rad * lob(a);
            const x = bx + Math.cos(a) * rr, y = by + Math.sin(a) * rr;
            const hd = a + Math.PI / 2;
            const flash = Math.sin(T * 4 + i * 1.7) > 0.9;
            ctx.save(); ctx.translate(x, y); ctx.rotate(hd);
            ctx.fillStyle = flash ? `rgba(215,232,242,${0.85 * k})` : `rgba(8,20,30,${0.6 * k})`;
            ctx.beginPath(); ctx.ellipse(0, 0, 3.4, 0.85, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        // 3. The surface over it boils: nervous water — short bright arcs dancing in rings —
        //    and connected sheets of foam that swell and fade.
        ctx.lineCap = 'round';
        for (let i = 0; i < 26; i++) {
            const a = r() * Math.PI * 2 + T * (0.3 + r() * 0.4), d = Math.sqrt(r()) * R0 * 0.8;
            const x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d, len = 4 + r() * 5, ph = r() * 7;
            const tw = 0.5 + 0.5 * Math.sin(T * (4 + r() * 4) + ph);
            ctx.strokeStyle = `rgba(230,245,255,${0.55 * tw * k})`; ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.arc(x, y, len, a, a + 1.2); ctx.stroke();
        }
        for (let i = 0; i < 6; i++) {
            const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R0 * 0.6, rr = 9 + r() * 12, sp = 0.6 + r() * 0.9, ph = r() * 10;
            const pulse = Math.max(0, Math.sin(T * sp * 2 + ph));
            const x = bx + Math.cos(a + T * 0.08) * d, y = by + Math.sin(a + T * 0.08) * d;
            const g = ctx.createRadialGradient(x, y, 0, x, y, rr * (0.7 + 0.5 * pulse));
            g.addColorStop(0, `rgba(250,255,255,${0.6 * pulse * k})`); g.addColorStop(0.6, `rgba(240,250,255,${0.22 * pulse * k})`); g.addColorStop(1, 'rgba(240,250,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr * (0.7 + 0.5 * pulse), 0, Math.PI * 2); ctx.fill();
        }
        // 4. Fish breaking out: a crown of spray that pops and falls back, all over the ball.
        for (let i = 0; i < 16; i++) {
            const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R0 * 0.75, per = 0.8 + r() * 1.4, ph = r() * per;
            const u = ((T + ph) % per) / per;
            if (u > 0.35) continue;
            const x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d, q = u / 0.35;
            ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - q) * k})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + q * 2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - q) * k})`; ctx.lineWidth = 1.2;
            for (let j = 0; j < 6; j++) {
                const b = j / 6 * Math.PI * 2 + a;
                ctx.beginPath(); ctx.moveTo(x + Math.cos(b) * (2 + q * 2), y + Math.sin(b) * (2 + q * 2)); ctx.lineTo(x + Math.cos(b) * (4 + q * 8), y + Math.sin(b) * (4 + q * 8)); ctx.stroke();
            }
        }
        ctx.restore();
    }

    // ── drawing the pond and lake animals ─────────────────────────────────────────────────
    // Same house style as the Cove's: a light warm outline (never black), two or three flat
    // tones per animal with one highlight, the identity marks drawn bold enough to read at a
    // pixel a unit. Anything on the water gets the water's response — a wake or a ring.
    const SOFT = 'rgba(28,24,20,0.6)';

    // A swimmer's wake: two faint lines peeling back from its shoulders along the path it has
    // actually swum, widening and fading — one connected sheet, never dots.
    function drawWakeTrail(ctx, g, halfW, spread, alpha) {
        const tr = g.trail;
        if (!tr || tr.length < 2) return;
        const pts = [{ x: g.x, y: g.y }, ...tr];
        const n = pts.length;
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // The disturbed water down the middle: a soft, wide, faint band.
        for (let i = 1; i < n; i++) {
            const a = pts[i - 1], b = pts[i], k = 1 - i / n;
            ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.22 * k})`; ctx.lineWidth = halfW * 1.4 * (0.6 + 0.4 * k);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        // The two arms of the V: peeling off the shoulders, fanning out, thinning and fading,
        // each drawn twice (a soft halo and a crisp crest) so it reads as a ridge of water.
        for (const sd of [-1, 1]) {
            const arm = [];
            for (let i = 0; i < n; i++) {
                const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
                const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
                const w = halfW + i * spread;
                arm.push({ x: pts[i].x - dy / L * w * sd, y: pts[i].y + dx / L * w * sd });
            }
            // fine chevron crests trailing inside the V (the many parallel ripples of a swimmer)
            for (let i = 2; i < n - 1; i += 2) {
                const k = 1 - i / n, c = pts[i];
                ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.55 * k * k})`; ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.moveTo(arm[i].x, arm[i].y); ctx.quadraticCurveTo(c.x, c.y, (arm[Math.min(n - 1, i + 2)].x + c.x) / 2, (arm[Math.min(n - 1, i + 2)].y + c.y) / 2); ctx.stroke();
            }
            for (const [lw, aMul] of [[3.2, 0.3], [1.1, 1]]) {
                for (let i = 1; i < n; i++) {
                    const k = 1 - i / n;
                    ctx.strokeStyle = `rgba(255,255,255,${alpha * aMul * k * k})`; ctx.lineWidth = lw * (0.5 + 0.5 * k);
                    ctx.beginPath(); ctx.moveTo(arm[i - 1].x, arm[i - 1].y); ctx.lineTo(arm[i].x, arm[i].y); ctx.stroke();
                }
            }
        }
        ctx.restore();
    }
    function drawRing(ctx, x, y, k, r0, grow, a) {
        if (k <= 0) return;
        ctx.strokeStyle = `rgba(255,255,255,${(a || 0.6) * k})`; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(x, y, r0 + (1 - k) * grow, 0, Math.PI * 2); ctx.stroke();
    }
    function drawDiveRing(ctx, x, y, k) { drawRing(ctx, x, y, k, 6, 18, 0.6); }

    // PAINTED TURTLE from above: a low domed carapace in dark olive with pale seams between
    // the scutes and the red-orange marks round its rim, the head stretched out with bold
    // yellow stripes, four splayed legs sunning. `wet` brightens the shell's shine.
    function drawTurtle(ctx, x, y, h, alpha, wet, size) {
        if (alpha <= 0.02) return;
        const sz = TURTLE_SCALE * (size || 1);
        ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(sz, sz); ctx.globalAlpha = alpha;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        // shadow on the log
        ctx.fillStyle = 'rgba(20,16,10,0.25)'; ctx.beginPath(); ctx.ellipse(1.2, 1.8, 8, 9.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 0.9; ctx.strokeStyle = SOFT;
        // legs, splayed, with a yellow stripe each
        for (const [fx, fy, a] of [[-7.8, -5.5, -0.75], [7.8, -5.5, 0.75], [-7.2, 6.2, 0.6], [7.2, 6.2, -0.6]]) {
            ctx.save(); ctx.translate(fx, fy); ctx.rotate(a);
            ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 1.9, 0, 0, Math.PI * 2); ctx.fillStyle = '#3f4a36'; ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(242,201,76,0.9)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-2.6, 0); ctx.lineTo(2.6, 0); ctx.stroke();
            ctx.restore(); ctx.lineWidth = 0.9; ctx.strokeStyle = SOFT;
        }
        ctx.beginPath(); ctx.moveTo(-1.1, 8.6); ctx.lineTo(0, 12.4); ctx.lineTo(1.1, 8.6); ctx.closePath(); ctx.fillStyle = '#3f4a36'; ctx.fill();
        // neck and head, stretched toward the sun
        ctx.beginPath(); ctx.ellipse(0, -11.8, 2.9, 4.4, 0, 0, Math.PI * 2); ctx.fillStyle = '#2f3a2c'; ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(-1.5, -15.5); ctx.lineTo(-1.3, -8.4); ctx.moveTo(0, -16); ctx.lineTo(0, -8.2); ctx.moveTo(1.5, -15.5); ctx.lineTo(1.3, -8.4); ctx.stroke();
        ctx.fillStyle = '#d9542b'; ctx.fillRect(-2.6, -12.5, 0.9, 1.6); ctx.fillRect(1.7, -12.5, 0.9, 1.6);
        // carapace: rim first (the marginal scutes), then the dome
        ctx.lineWidth = 1; ctx.strokeStyle = SOFT;
        ctx.beginPath(); ctx.ellipse(0, 0.5, 7.4, 9.2, 0, 0, Math.PI * 2); ctx.fillStyle = '#26302b'; ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#df5a2c'; ctx.lineWidth = 1.1;
        for (let k = 0; k < 18; k++) {
            const a0 = k / 18 * Math.PI * 2 + 0.08, a1 = a0 + 0.2;
            ctx.beginPath(); ctx.ellipse(0, 0.5, 6.8, 8.6, 0, a0, a1); ctx.stroke();
        }
        const dome = ctx.createRadialGradient(-2, -2.5, 0.5, 0, 0.5, 7.5);
        dome.addColorStop(0, wet ? '#6f8a78' : '#56685c'); dome.addColorStop(1, '#2b3833');
        ctx.beginPath(); ctx.ellipse(0, 0.5, 6.1, 7.8, 0, 0, Math.PI * 2); ctx.fillStyle = dome; ctx.fill();
        // scute seams: a spine of three plates, ribs out to the rim
        ctx.strokeStyle = 'rgba(206,196,120,0.55)'; ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.moveTo(-2, -5.5); ctx.lineTo(2, -5.5); ctx.lineTo(2.4, -1.8); ctx.lineTo(-2.4, -1.8); ctx.closePath();
        ctx.moveTo(-2.4, -1.8); ctx.lineTo(-2.4, 2.6); ctx.lineTo(2.4, 2.6); ctx.lineTo(2.4, -1.8);
        ctx.moveTo(-2.4, 2.6); ctx.lineTo(-1.8, 6.3); ctx.lineTo(1.8, 6.3); ctx.lineTo(2.4, 2.6);
        for (const sd of [-1, 1]) { ctx.moveTo(sd * 2.2, -3.6); ctx.lineTo(sd * 5.6, -4.8); ctx.moveTo(sd * 2.4, 0.4); ctx.lineTo(sd * 6.1, 0.6); ctx.moveTo(sd * 2.1, 4.4); ctx.lineTo(sd * 5.2, 5.8); }
        ctx.stroke();
        ctx.fillStyle = `rgba(230,245,238,${wet ? 0.55 : 0.28})`; ctx.beginPath(); ctx.ellipse(-2.2, -3, 1.4, 2.6, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    // A turtle under water: a dim shape; when it peeks, just the striped head at the surface.
    function drawTurtleUnder(ctx, t) {
        ctx.save(); ctx.translate(t.ux, t.uy); ctx.rotate(t.uh);
        ctx.scale(TURTLE_SCALE / 1.2 * (t.size || 1), TURTLE_SCALE / 1.2 * (t.size || 1));   // drawn at the old 1.2
        ctx.fillStyle = 'rgba(30,45,38,0.28)'; ctx.beginPath(); ctx.ellipse(0, 1, 9, 11.5, 0, 0, Math.PI * 2); ctx.fill();
        if (t.peek > 0) {
            const k = Math.min(1, t.peek / 0.4, (1.6 - t.peek) / 0.3 + 0.001);
            ctx.globalAlpha = Math.max(0, Math.min(1, k));
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(0, -15, 6, 5, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(0, -15, 3.8, 4.6, 0, 0, Math.PI * 2); ctx.fillStyle = '#2f3a2c'; ctx.fill();
            ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-1.6, -18.5); ctx.lineTo(-1.4, -12); ctx.moveTo(1.6, -18.5); ctx.lineTo(1.4, -12); ctx.stroke();
        }
        ctx.restore();
    }

    // GREAT CRESTED GREBE from above: a slim pointed grey-brown body with white showing at
    // the flanks, the long white neck, and the head that is the whole read — a chestnut-and-
    // black ruff fanned either side, a dark double crest, the fine pink bill. `yaw` turns the
    // head (the dance's head-shake); `sink` rolls it under on a dive.
    function drawGrebe(ctx, g) {
        const sink = g.sink || 0;
        if (sink >= 1) return;
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.h); ctx.scale(GREBE_SCALE * (1 - 0.35 * sink), GREBE_SCALE * (1 - 0.35 * sink));
        ctx.globalAlpha = 1 - sink;
        ctx.lineJoin = 'round'; ctx.lineWidth = 0.9; ctx.strokeStyle = SOFT;
        // the feet, paddling out behind (lobed, dark) — they show in every overhead shot
        {
            const kick = Math.sin((g.bob || 0) * 5) * 0.35;
            ctx.fillStyle = 'rgba(40,44,48,0.8)';
            for (const sd of [-1, 1]) {
                ctx.save(); ctx.translate(sd * 2.2, 12.5); ctx.rotate(sd * (0.5 + (sd > 0 ? kick : -kick)));
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sd * 0.6, 4.5); ctx.quadraticCurveTo(sd * 2.4, 6.5, sd * 1.2, 7.4); ctx.quadraticCurveTo(0, 6.8, -sd * 0.2, 4.6); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
        }
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.bezierCurveTo(7, -3.5, 6.8, 8, 0, 13.5); ctx.bezierCurveTo(-6.8, 8, -7, -3.5, 0, -5); ctx.closePath();
        ctx.fillStyle = '#76685a'; ctx.fill(); ctx.stroke();
        // the folded wings' pale scalloped feather edges over the back
        ctx.strokeStyle = 'rgba(214,200,180,0.3)'; ctx.lineWidth = 0.5;
        for (let r = 0; r < 3; r++) for (const sd of [-1, 1]) {
            const y = 0.5 + r * 2.4, x = sd * (1.4 + r * 0.25);
            ctx.beginPath(); ctx.arc(x, y, 1.6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
            ctx.beginPath(); ctx.arc(x + sd * 2.4, y + 0.8, 1.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
        }
        ctx.lineWidth = 0.9; ctx.strokeStyle = SOFT;
        // white just showing along the flanks, darker along the back
        ctx.strokeStyle = 'rgba(236,228,214,0.9)'; ctx.lineWidth = 0.9;
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 4.8, -2.4); ctx.quadraticCurveTo(sd * 6.2, 2, sd * 5, 7); ctx.stroke(); }
        ctx.lineWidth = 0.9; ctx.strokeStyle = SOFT;
        // the long neck, slimmer toward the head
        ctx.beginPath(); ctx.moveTo(-1.7, -3.2); ctx.quadraticCurveTo(-1.1, -6.5, -0.9, -9.2); ctx.lineTo(0.9, -9.2); ctx.quadraticCurveTo(1.1, -6.5, 1.7, -3.2); ctx.closePath();
        ctx.fillStyle = '#f2ede4'; ctx.fill();
        ctx.fillStyle = '#6e5a49'; ctx.fillRect(-0.35, -8.8, 0.7, 5.4);   // the dark line down the back of the neck
        // head, turned by yaw about the top of the neck
        ctx.save(); ctx.translate(0, -9); ctx.rotate(g.yaw || 0);
        // the ruff: a chestnut collar fanned either side of the face, sweeping BACK, black-tipped
        for (const sd of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(sd * 1.6, -3.4);
            ctx.quadraticCurveTo(sd * 5.2, -3.2, sd * 5.4, 0.8);
            ctx.quadraticCurveTo(sd * 4.6, 2.8, sd * 1.4, 1.2);
            ctx.closePath(); ctx.fillStyle = '#b8551f'; ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sd * 4.4, -1.8); ctx.quadraticCurveTo(sd * 5.6, -0.4, sd * 5.2, 1.4); ctx.quadraticCurveTo(sd * 4.8, 0.4, sd * 4.1, -0.4); ctx.closePath();
            ctx.fillStyle = '#231b16'; ctx.fill();
        }
        // the white face and throat, the dark cap and its two crest points at the back
        ctx.beginPath(); ctx.ellipse(0, -2.4, 2, 2.7, 0, 0, Math.PI * 2); ctx.fillStyle = '#f7f2ea'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -2.2, 1.35, 1.9, 0, 0, Math.PI * 2); ctx.fillStyle = '#211b17'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-1.3, -1.2); ctx.lineTo(-1.9, 1.4); ctx.lineTo(-0.3, -0.6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(1.3, -1.2); ctx.lineTo(1.9, 1.4); ctx.lineTo(0.3, -0.6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-0.6, -4.9); ctx.lineTo(0, -10.8); ctx.lineTo(0.6, -4.9); ctx.closePath(); ctx.fillStyle = '#e39a98'; ctx.fill();
        ctx.fillStyle = '#c2251d'; ctx.fillRect(-1.75, -3.6, 0.7, 0.7); ctx.fillRect(1.05, -3.6, 0.7, 0.7);
        ctx.restore();
        ctx.restore();
    }

    // COMMON LOON from above: a long low body, black, chequered white across the back in bold
    // rows and finely spotted on the flanks; the black head with its striped white necklace,
    // the heavy grey dagger bill, red eyes. `flap` spreads its wings (the rear-up after a dive).
    function drawLoon(ctx, g) {
        const sink = g.sink || 0;
        if (sink >= 1) return;
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.h);
        const sc = LOON_SCALE * (1 - 0.3 * sink) * (1 + 0.08 * (g.flap || 0));
        ctx.scale(sc, sc); ctx.globalAlpha = 1 - sink;
        ctx.lineJoin = 'round'; ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(10,12,14,0.55)';
        if (g.flap > 0) {
            const span = 16 * g.flap;
            for (const sd of [-1, 1]) {
                ctx.beginPath(); ctx.moveTo(sd * 2, -2); ctx.quadraticCurveTo(sd * span * 0.6, -5, sd * span, 1);
                ctx.quadraticCurveTo(sd * span * 0.6, 3, sd * 2, 5); ctx.closePath(); ctx.fillStyle = '#1a1e21'; ctx.fill(); ctx.stroke();
                ctx.fillStyle = 'rgba(240,244,246,0.85)';
                for (let k = 2; k < 6; k++) ctx.fillRect(sd * span * k / 7 - 0.5, -0.5, 1, 1);
            }
        }
        ctx.beginPath(); ctx.moveTo(0, -5.5); ctx.bezierCurveTo(6.8, -4.5, 7, 7, 0, 15); ctx.bezierCurveTo(-7, 7, -6.8, -4.5, 0, -5.5); ctx.closePath();
        ctx.fillStyle = '#16191c'; ctx.fill(); ctx.stroke();
        // the chequer: dense rows of small white spots over the whole back, finer toward the
        // flanks and tail — at a distance it greys the black, close up it is a pattern
        {
            const jr = mulberry(7);
            for (let r = 0; r < 10; r++) {
                const y = -2.6 + r * 1.3;
                const half = 5.2 * Math.sin(Math.PI * Math.min(1, (r + 1.2) / 11)) ;
                for (let x = -half; x <= half + 0.01; x += 0.95) {
                    const edge = Math.abs(x) / (half + 0.01);
                    const sz = (0.62 - edge * 0.3) * (1 - r * 0.03);
                    ctx.fillStyle = `rgba(236,240,242,${0.92 - edge * 0.35})`;
                    ctx.fillRect(x - sz / 2 + (jr() - 0.5) * 0.15 + (r % 2 ? 0.45 : 0), y, sz, sz * 0.85);
                }
            }
        }
        // neck with the necklace
        ctx.fillStyle = '#121518'; ctx.beginPath(); ctx.ellipse(0, -6, 2.3, 2.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(236,240,242,0.9)'; ctx.lineWidth = 0.45;
        for (let k = 0; k < 4; k++) { const x = -2.2 + k * 0.35; ctx.beginPath(); ctx.moveTo(x, -6.8); ctx.lineTo(x, -5.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-x, -6.8); ctx.lineTo(-x, -5.2); ctx.stroke(); }
        // head: black with a green sheen, red eyes
        ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(10,12,14,0.55)';
        ctx.beginPath(); ctx.ellipse(0, -9.4, 2.7, 3.4, 0, 0, Math.PI * 2); ctx.fillStyle = '#101315'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(60,110,90,0.45)'; ctx.beginPath(); ctx.ellipse(-0.8, -10.2, 0.9, 1.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d23a2a'; ctx.fillRect(-2.3, -9.8, 0.8, 0.8); ctx.fillRect(1.5, -9.8, 0.8, 0.8);
        ctx.beginPath(); ctx.moveTo(-1.2, -12.2); ctx.lineTo(0, -19); ctx.lineTo(1.2, -12.2); ctx.closePath(); ctx.fillStyle = '#3a3f44'; ctx.fill();
        ctx.restore();
    }

    // BEAVER swimming: its head and the hump of its back just out of the water, glistening;
    // the body and the flat tail dark just under the surface behind. Half of them tow a
    // leafy branch in their teeth. `sink` takes it under.
    function drawBeaver(ctx, g) {
        const sink = g.sink || 0;
        if (sink >= 1) return;
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.h); ctx.scale(BEAVER_SCALE, BEAVER_SCALE);
        ctx.globalAlpha = 1 - sink;
        // under the surface: the long body and the flat tail trailing, clearly visible
        ctx.fillStyle = 'rgba(52,34,20,0.5)';
        ctx.beginPath(); ctx.ellipse(0, 10, 5.6, 11.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, 25, 3, 5.5, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(36,26,20,0.5)'; ctx.fill();
        // the bow wave: a white moustache curling back from the nose
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
        for (const sd of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(sd * 0.8, -5.8); ctx.quadraticCurveTo(sd * 4.6, -5.2, sd * 6.4, -0.5); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.moveTo(sd * 1.5, -6.8); ctx.quadraticCurveTo(sd * 6, -6, sd * 8.2, 0.8); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        }
        // the branch, if it has one, trailing along its side
        if (g.stick) {
            ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-1, -4.2); ctx.lineTo(6, 2); ctx.lineTo(9, 14); ctx.stroke();
            ctx.fillStyle = '#5f8f3c';
            for (const [lx, ly, a] of [[7.8, 7, 0.4], [10, 10, -0.5], [8.6, 13.5, 0.3], [10.6, 15.5, -0.2]]) { ctx.beginPath(); ctx.ellipse(lx, ly, 1.4, 2.4, a, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.lineJoin = 'round'; ctx.lineWidth = 0.8; ctx.strokeStyle = SOFT;
        ctx.beginPath(); ctx.ellipse(0, 5, 3.9, 3.4, 0, 0, Math.PI * 2); ctx.fillStyle = '#5f3d22'; ctx.fill(); ctx.stroke();   // the back
        ctx.beginPath(); ctx.ellipse(0, -0.5, 3.8, 4.8, 0, 0, Math.PI * 2); ctx.fillStyle = '#7a4f2c'; ctx.fill(); ctx.stroke();   // the head
        ctx.beginPath(); ctx.arc(-3.3, 1.3, 1.1, 0, Math.PI * 2); ctx.arc(3.3, 1.3, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#4e321c'; ctx.fill();
        ctx.fillStyle = '#2a1a0e'; ctx.beginPath(); ctx.ellipse(0, -4.6, 1.3, 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#120b06'; ctx.fillRect(-2.2, -2.2, 0.8, 0.8); ctx.fillRect(1.4, -2.2, 0.8, 0.8);
        ctx.fillStyle = 'rgba(255,240,220,0.45)'; ctx.beginPath(); ctx.ellipse(-1.2, -1.5, 0.8, 1.8, -0.2, 0, Math.PI * 2); ctx.fill();   // the wet shine
        ctx.restore();
    }
    // A beaver's tail-slap: a crown of spray where the tail hit, then rings spreading.
    function drawSlap(ctx, x, y, k) {
        if (k <= 0) return;
        ctx.save();
        // Sized to the beaver as drawn (36 units, guidelines/scale.md): a slap is a burst of
        // spray about a body length across, not a ring bigger than the animal.
        const r = 6 + (1 - k) * 20;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.85 * k})`); g.addColorStop(0.6, `rgba(255,255,255,${0.3 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        // Thrown spray, uneven: spokes at irregular angles and lengths (a fixed pattern, so no
        // PRNG draw), never a regular sunburst, which reads as an icon.
        for (let i = 0; i < 9; i++) {
            const j = Math.sin(i * 12.9898) * 43758.5453 % 1, a = (i + 0.6 * j) / 9 * Math.PI * 2, L = 0.62 + 0.3 * Math.abs(j);
            ctx.lineWidth = 0.9 + 0.8 * Math.abs(j);
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4); ctx.lineTo(x + Math.cos(a) * r * L, y + Math.sin(a) * r * L); ctx.stroke();
        }
        drawRing(ctx, x, y, k, 10, 20, 0.5);
        ctx.restore();
    }

    // MOOSE from above, knee-deep: a boxy dark body with the humped shoulders, the huge long
    // face widening to the overhanging muzzle, big ears, two short velvet stubs. Feeding, the
    // head goes under — just a dark shape and rings — and comes up streaming.
    function drawMoose(ctx, w) {
        const dip = w.dip || 0;
        const sway = Math.sin(w.sway || 0) * 0.05;
        ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.h + sway); ctx.globalAlpha = w.alpha; ctx.scale(1.1, 1.1);
        const rp = (w.bob * 0.6) % 1;
        const land = !!w.ashore;
        // its shadow: on the shallow bottom in the water, cast on the ground ashore
        ctx.fillStyle = land ? 'rgba(20,16,8,0.32)' : 'rgba(10,20,26,0.22)';
        ctx.beginPath(); ctx.ellipse(land ? 7 : 5, 9, land ? 14 : 12, 26, 0, 0, Math.PI * 2); ctx.fill();
        if (land) {
            // ashore the long legs show beyond the body, striding as it walks
            const st = Math.sin(w.sway || 0);
            ctx.strokeStyle = '#3a2a1f'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
            for (const [lx, ly, ph] of [[-8, -8, 1], [8, -8, -1], [-7, 20, -1], [7, 20, 1]]) {
                const dy = st * ph * 4;
                ctx.beginPath(); ctx.moveTo(lx * 0.8, ly); ctx.lineTo(lx * 1.25, ly + dy); ctx.stroke();
                ctx.fillStyle = '#1c140e'; ctx.beginPath(); ctx.arc(lx * 1.25, ly + dy, 1.4, 0, Math.PI * 2); ctx.fill();
            }
        }
        for (const [lx, ly] of (land ? [] : [[-9, -8], [9, -8], [-7, 21], [7, 21]])) {
            ctx.fillStyle = 'rgba(30,22,16,0.35)'; ctx.beginPath(); ctx.ellipse(lx, ly, 2.4, 2.4, 0, 0, Math.PI * 2); ctx.fill();   // the leg, seen through the water
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(lx, ly, 4.8, 3.4, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${0.3 * (1 - rp)})`; ctx.beginPath(); ctx.ellipse(lx, ly, 5 + rp * 7, 3.6 + rp * 5, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.lineJoin = 'round'; ctx.lineWidth = 1.1; ctx.strokeStyle = SOFT;
        // the body: long and even, a touch deeper at the shoulders — seen from above a moose is
        // a long brown plank with a dark mane ridge running up to the head
        ctx.beginPath();
        ctx.moveTo(-9, -13);
        ctx.bezierCurveTo(-11.5, -4, -11, 14, -8.5, 24);
        ctx.quadraticCurveTo(0, 28, 8.5, 24);
        ctx.bezierCurveTo(11, 14, 11.5, -4, 9, -13);
        ctx.quadraticCurveTo(0, -17, -9, -13);
        ctx.closePath(); ctx.fillStyle = '#4b3627'; ctx.fill(); ctx.stroke();
        // the lighter saddle over the back, the darker legs' shoulders and haunches
        {   // the lighter saddle over the back, fading out at its edges
            const sg = ctx.createRadialGradient(0, 7, 0, 0, 7, 11);
            sg.addColorStop(0, 'rgba(138,110,82,0.45)'); sg.addColorStop(1, 'rgba(138,110,82,0)');
            ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, 7, 8, 13, 0, 0, Math.PI * 2); ctx.fill();
        }
        // the short thick neck, and the dark mane ridge from the hump to the head
        ctx.beginPath(); ctx.moveTo(-6, -12); ctx.quadraticCurveTo(-5.5, -17, -4.6, -19); ctx.lineTo(4.6, -19); ctx.quadraticCurveTo(5.5, -17, 6, -12); ctx.closePath();
        ctx.fillStyle = '#3f2d20'; ctx.fill();
        // the dark stripe down the whole spine, broadest over the hump (every drone shot shows it)
        ctx.fillStyle = '#231710';
        ctx.beginPath(); ctx.moveTo(0, -19); ctx.quadraticCurveTo(3, -9, 1.6, 4); ctx.quadraticCurveTo(0.9, 16, 0, 25);
        ctx.quadraticCurveTo(-0.9, 16, -1.6, 4); ctx.quadraticCurveTo(-3, -9, 0, -19); ctx.closePath(); ctx.fill();
        // the head reaches down and forward when it feeds; up and back when it listens
        const hy = -18 - dip * 7 - (w.mode === 'alert' ? 3 : 0);
        ctx.save(); ctx.globalAlpha = w.alpha * (1 - 0.72 * dip);
        // ears: big, swung forward, lighter inside
        for (const sd of [-1, 1]) {
            // long ears, laid back and out from the crown
            ctx.save(); ctx.translate(sd * 4.2, hy + 1.5); ctx.rotate(sd * 2.05);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(3.1, -4, 0, -9.5); ctx.quadraticCurveTo(-3.1, -4, 0, 0); ctx.closePath();
            ctx.fillStyle = '#5a4130'; ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -1.3); ctx.quadraticCurveTo(1.4, -4.2, 0, -7.6); ctx.quadraticCurveTo(-1.4, -4.2, 0, -1.3); ctx.closePath();
            ctx.fillStyle = '#8a6a50'; ctx.fill();
            ctx.restore();
        }
        // the long face: narrow between the eyes, swelling to the huge overhanging muzzle
        ctx.beginPath();
        ctx.moveTo(-4.2, hy + 2);
        ctx.bezierCurveTo(-4.4, hy - 6, -4, hy - 12, -5.6, hy - 18);
        ctx.bezierCurveTo(-7, hy - 24, 7, hy - 24, 5.6, hy - 18);
        ctx.bezierCurveTo(4, hy - 12, 4.4, hy - 6, 4.2, hy + 2);
        ctx.quadraticCurveTo(0, hy + 4.5, -4.2, hy + 2);
        ctx.closePath(); ctx.fillStyle = '#513b2c'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, hy - 19, 5.4, 3.9, 0, 0, Math.PI * 2); ctx.fillStyle = '#6e533f'; ctx.fill();   // the muzzle
        ctx.fillStyle = '#1c130d'; ctx.beginPath(); ctx.ellipse(-2.1, hy - 20.8, 0.9, 1.4, 0.2, 0, Math.PI * 2); ctx.ellipse(2.1, hy - 20.8, 0.9, 1.4, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#120c08'; ctx.fillRect(-4.6, hy - 6, 0.9, 0.9); ctx.fillRect(3.7, hy - 6, 0.9, 0.9);   // the eyes, set wide
        ctx.restore();
        // The rack stays OUT of the water when the head goes under — the palms lie on the
        // surface with the water ringing them — so it draws at full strength, after the head.
        if (dip > 0.3 && !land) {
            const q = (w.bob * 0.7) % 1;
            for (const sd of [-1, 1]) drawRing(ctx, sd * 11, hy - 3.8, 1 - q, 3.5, 5, 0.3 * dip);
        }
        // THE RACK, from above: two broad pale palms spreading sideways off the top of the head
        // just behind the ears, curving a little forward, each edged with tines — about one and
        // a half times the body's width across (top-down references, Sep 25 2026).
        for (const sd of [-1, 1]) {
            ctx.save(); ctx.translate(sd * 2.6, hy - 3.2);
            ctx.lineJoin = 'round'; ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(70,52,34,0.85)';
            // the beam, out from the burr
            ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(sd * 3, -0.6, sd * 5.5, -0.4); ctx.lineTo(sd * 5.5, 1.6); ctx.quadraticCurveTo(sd * 3, 1.4, 0, 1.2); ctx.closePath();
            ctx.fillStyle = '#b89c74'; ctx.fill(); ctx.stroke();
            // the palm, a broad cupped blade reaching out and a little forward, with its tines
            ctx.beginPath();
            ctx.moveTo(sd * 5, -0.8);
            ctx.quadraticCurveTo(sd * 9, -5.6, sd * 15.5, -6.4);            // front edge
            const tines = 5;
            for (let k = 0; k <= tines; k++) {
                const u = k / tines;
                const bx = sd * (15.5 + 1.5 * Math.sin(u * Math.PI)), by = -6.4 + u * 9.5;
                ctx.lineTo(bx + sd * (k % tines === 0 ? 0 : 2.4), by - 0.4);   // tine point
                ctx.lineTo(bx, by + 0.9);                                        // notch
            }
            ctx.quadraticCurveTo(sd * 10, 4.4, sd * 5.2, 2);                   // back edge
            ctx.closePath();
            ctx.fillStyle = '#dccbaa'; ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(150,120,85,0.35)'; ctx.beginPath(); ctx.ellipse(sd * 10.5, -0.6, 3.4, 2.1, sd * -0.3, 0, Math.PI * 2); ctx.fill();   // the cup's shading
            ctx.restore();
        }
        if (dip > 0.3 && !land) { const k = ((w.bob * 0.8) % 1); drawRing(ctx, 0, hy - 12, 1 - k, 7, 13, 0.55 * dip); }
        if (w.drip > 0) {
            ctx.strokeStyle = `rgba(255,255,255,${0.75 * w.drip})`; ctx.lineWidth = 1; ctx.lineCap = 'round';
            for (const sx of [-4, -1.5, 1.5, 4]) { ctx.beginPath(); ctx.moveTo(sx, hy - 17); ctx.lineTo(sx * 1.4, hy - 22 - (1 - w.drip) * 6); ctx.stroke(); }
            drawRing(ctx, 0, hy - 12, w.drip, 9, 15, 0.6);
        }
        ctx.restore();
    }

    // On the water, under land and hulls: porpoises and the boil (and a pelican sitting on it).
    function drawWater(ctx) {
        if (!cfg) return;
        for (const G of shoals) drawShoal(ctx, G);
        for (const s of poppers) drawSeal(ctx, s);
        for (const G of cruisers) for (const f of G.fish) if (f.mode !== 'leap') drawCruiser(ctx, f);
        for (const b of baskers) if (b.cfg.kind === 'frog') drawFrogGroup(ctx, b, 'water');
        for (const F of prints) drawPrint(ctx, F);
        for (const W of whalePods) for (const m of W.members) drawWhaleSlick(ctx, m);
        for (const W of whalePods) for (const m of W.members) drawWhale(ctx, m);
        for (const S of splashes) drawSplash(ctx, S);
        for (const P of flyPatches) drawNervousWater(ctx, P);
        for (const S of riders) for (const m of S.members) drawSpinner(ctx, m);
        for (const P of flyPatches) if (P.pack) for (const m of P.pack) if (!(m.leap > 0)) drawMahi(ctx, m);
        for (const G of runs) drawRun(ctx, G);
        for (const F of rompers) if (F.mode !== 'rest') for (const m of F.members) { if (F.mode === 'swim' && (m.dip || 0) < 0.3) drawWakeTrail(ctx, m, 3.6, 1.2, 0.65); drawOtter(ctx, m, false); }
        for (const L of leaps) drawLeap(ctx, L);
        for (const g of lurkers) {
            if (g.mode === 'swim' && g.trail.length > 2) drawWakeTrail(ctx, g, 4.5, 1.2, 0.35);
            drawGator(ctx, g);
            if (g.ring > 0) { drawRing(ctx, g.x, g.y, g.ring, 10, 26, 0.5); drawRing(ctx, g.x, g.y, Math.max(0, g.ring - 0.3), 6, 16, 0.4); }
        }
        for (const a of perchers) if (a.mode === 'swim') drawAnhinga(ctx, a);
        for (const G of cruisers) for (const f of G.fish) { if (f.mode === 'leap') drawCruiser(ctx, f); drawCruiserSplashes(ctx, f); }
        drawBoil(ctx);
        for (const B of stripers) drawStriperBoil(ctx, B);
        for (const p of pods) for (const m of p.members) drawPorpoise(ctx, m);
        if (resident) for (const m of resident.members) drawPorpoise(ctx, m);
        if (flight) for (const b of flight.birds) if (b.mode === 'sit') drawPelicanSitting(ctx, b.x, b.y, b.h, b.t);
        // The log sits IN the water: a slow ripple along its waterline, under the log itself.
        for (const b of baskers) {
            const kinds = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
            const len = ((kinds[b.log.kind] && kinds[b.log.kind].world) || 80) * (b.log.scale || 1);
            ctx.save(); ctx.translate(b.log.x, b.log.y); ctx.rotate(b.log.heading || 0);
            // short broken arcs hugging the log, each drifting out and fading on its own clock
            const L = len * 0.5, W = len * 0.17;
            const arcs = [[0, -L - 2, 0.9, 2.2], [0, L + 2, 0.9 + Math.PI, 2.2], [-W - 2, -L * 0.4, Math.PI * 0.5, 0.9], [W + 2, L * 0.3, -Math.PI * 0.5, 0.9], [-W - 2, L * 0.45, Math.PI * 0.55, 0.7], [W + 2, -L * 0.5, -Math.PI * 0.45, 0.8]];
            arcs.forEach(([x, y, a, span], k) => {
                const q = (T * 0.3 + k * 0.37) % 1;
                ctx.strokeStyle = `rgba(255,255,255,${0.38 * (1 - q)})`; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(x, y, 6 + q * 12, a - Math.PI / 2 - span / 2 + Math.PI / 2, a - Math.PI / 2 + span / 2 + Math.PI / 2); ctx.stroke();
            });
            ctx.restore();
        }
        // Turtles in the water: going in, under (a dim shape, a head now and then), coming out.
        for (const b of baskers) for (const t of b.turtles) {
            if (b.cfg.kind === 'frog') continue;
            if (t.mode === 'under') drawTurtleUnder(ctx, t);
            else if (t.mode === 'slide') drawTurtle(ctx, t.hx + t.ox, t.hy + t.oy, t.h, 1 - 0.85 * (t.t / 0.55), 1, t.size);
            else if (t.mode === 'climb') {
                const k = Math.min(1, t.t / 1.6);
                drawTurtle(ctx, t.cx0 + (t.hx - t.cx0) * k, t.cy0 + (t.hy - t.cy0) * k, t.h, 0.25 + 0.75 * k, 1, t.size);
            }
            if (t.plop > 0) { drawRing(ctx, t.ux, t.uy, t.plop, 6, 22, 0.75); drawRing(ctx, t.ux, t.uy, Math.max(0, t.plop - 0.3), 4, 14, 0.5); }
        }
        for (const G of divers) {
            const kind = G.cfg.kind;
            for (const g of G.birds) {
                if (g.mode !== 'under') drawWakeTrail(ctx, g, kind === 'beaver' ? 7 : 5.5, kind === 'beaver' ? 2.4 : 1.3, kind === 'beaver' ? 0.6 : 0.4);
                if (g.mode !== 'under') (kind === 'loon' ? drawLoon : kind === 'beaver' ? drawBeaver : drawGrebe)(ctx, g);
                if (g.slap > 0) drawSlap(ctx, g.x, g.y, g.slap);
                drawDiveRing(ctx, g.x, g.y, g.splash);
                if (g.rise > 0) drawRing(ctx, g.x, g.y, g.rise, 10, 14, 0.5);
            }
        }
    }
    // On the rock, over the land and under the fleet.
    function drawPerched(ctx) {
        if (!cfg) return;
        for (const c of colonies) for (const g of c.birds) if (g.mode === 'perched') drawGullPerched(ctx, g.x, g.y, g.h);
        for (const b of baskers) {
            if (b.cfg.kind === 'frog') { drawFrogGroup(ctx, b, 'perched'); continue; }
            for (const t of b.turtles) if (t.mode === 'bask' || t.mode === 'wait') drawTurtle(ctx, t.hx, t.hy, t.h, 1, t.wet, t.size);
        }
        // The moose stands in the shallows or walks up the bank, so it draws OVER the land (and
        // under the tree crowns, which is where it disappears into the forest).
        for (const w of waders) if (w.mode !== 'gone') drawMoose(ctx, w);
        // egrets on the marsh edges, anhingas drying on their cypress knees
        for (const e of stalkers) if (e.mode !== 'fly') drawEgret(ctx, e);
        for (const a of perchers) drawSnag(ctx, a);
        for (const a of perchers) if (a.mode !== 'swim') drawAnhinga(ctx, a);
        // otters lying up on their logjam; the bears standing in the shallows
        for (const F of rompers) if (F.mode === 'rest') for (const m of F.members) drawOtter(ctx, m, true);
        for (const B of fishers) drawBear(ctx, B);
        for (const G of bands) for (const s of G.members) drawBighorn(ctx, s);
        for (const K of coyotes) drawCoyote(ctx, K);
    }
    // In the air, over the fleet.
    function drawAir(ctx) {
        if (!cfg) return;
        for (const e of stalkers) if (e.mode === 'fly') drawEgret(ctx, e);
        for (const c of colonies) for (const g of c.birds) if (g.mode !== 'perched') drawGullFlying(ctx, g.x, g.y, g.h, g.z, g.flap);
        for (const f of followers) {
            if (!f.ship) continue;
            const s = f.ship, bx = s.x - Math.sin(s.heading) * (s.hullLen / 2 + 60), by = s.y + Math.cos(s.heading) * (s.hullLen / 2 + 60);
            for (const b of f.birds) {
                const x = bx + Math.cos(b.a) * b.r, y = by + Math.sin(b.a) * b.r * 0.7;
                drawGullFlying(ctx, x, y, b.a + (b.w > 0 ? Math.PI : 0), b.z, b.flap);
            }
        }
        if (flight) for (const b of flight.birds) if (b.mode === 'fly' || b.mode === 'dive') drawPelicanFlying(ctx, b.x, b.y, b.h, b.z, b.flap, b.mode === 'dive');
        for (const E of soarers) drawEagle(ctx, E);
        for (const f of flyfish) if (!f.caught) drawFlyfish(ctx, f);
        for (const P of flyPatches) if (P.pack) for (const m of P.pack) if (m.leap > 0) drawMahi(ctx, m);
        for (const B of blows) drawBlow(ctx, B);
        for (const G of gliders) if (G.i === 0 || G.here) drawAlbatross(ctx, G);
        for (const C of condors) drawCondor(ctx, C);
    }

    // ── CRUISERS, drawn: under the surface, seen through it (race-view.md §10.6) ──────────
    // Each shape function draws in native units, heading up, in one of three modes:
    //   'body'   the animal in its colours and detail
    //   'flat'   the silhouette only, in whatever fillStyle is set — its shadow on the
    //            bottom, and the water's own colour washed back over it with depth
    // The veil is the depth: a deeper animal is fainter and bluer, with less detail; its
    // shadow sits under it on the sand, offset down-right (light from the upper left) by how
    // far above the bottom it swims.
    const CRUISER_SCALE = { seaturtle: SEATURTLE_SCALE, eagleray: RAY_SCALE, reefshark: SHARK_SCALE };
    let _tint = null, _tintDoc = null;
    function waterTint() {
        const d = state.course && state.course.doc;
        if (d !== _tintDoc) {
            _tintDoc = d;
            const h = ((d && d.palette && (d.palette.heroColor || d.palette.baseColor)) || '#3bd5e4').replace('#', '');
            _tint = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
        }
        return _tint;
    }
    function drawCruiser(ctx, f) {
        const k = CRUISER_SCALE[f.kind] * (f.size || 1);
        const shape = f.kind === 'seaturtle' ? seaTurtleShape : f.kind === 'eagleray' ? eagleRayShape : reefSharkShape;
        if (f.mode === 'leap') {
            // Clear of the water: its shadow on the surface drops away with height; no veil.
            const z = f.z * 26;
            ctx.save(); ctx.translate(f.x + z * 0.35, f.y + z * 0.55); ctx.rotate(f.h); ctx.scale(k * 0.95, k * 0.95);
            ctx.fillStyle = 'rgba(10,25,40,0.22)'; shape(ctx, f, 'flat'); ctx.restore();
            ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.h); ctx.scale(k * (1 + 0.14 * f.z), k * (1 + 0.14 * f.z));
            shape(ctx, f, 'body'); ctx.restore();
            return;
        }
        const d = Math.max(0, Math.min(1, f.depth));
        const hgt = 6 + (1 - d) * 18;                    // height above the sand
        ctx.save(); ctx.translate(f.x + hgt * 0.35, f.y + hgt * 0.55); ctx.rotate(f.h); ctx.scale(k, k);
        ctx.globalAlpha *= 0.2 + 0.12 * d;               // darker the nearer the bottom; over pale sand it is half the read
        ctx.fillStyle = 'rgb(10,25,40)'; shape(ctx, f, 'flat'); ctx.restore();
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.h); ctx.scale(k, k);
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * (0.92 - 0.42 * d);
        shape(ctx, f, 'body');
        ctx.globalAlpha = a0 * (0.08 + 0.36 * d);
        ctx.fillStyle = `rgb(${waterTint()})`; shape(ctx, f, 'flat');
        ctx.globalAlpha = a0;
        // A turtle up for air: the head breaks the surface, crisp, with a ring round it.
        if (f.kind === 'seaturtle' && d < 0.15) { seaTurtleHead(ctx, 1 - d / 0.15); }
        ctx.restore();
        if (f.kind === 'seaturtle' && f.ring > 0) {
            const hx = f.x + Math.sin(f.h) * 10.2 * k, hy = f.y - Math.cos(f.h) * 10.2 * k;
            drawRing(ctx, hx, hy, f.ring, 3.5, 11, 0.55);
        }
    }
    function drawCruiserSplashes(ctx, f) {
        if (f.splash > 0) drawSlap(ctx, f.sx, f.sy, f.splash);
        if (f.splash2 > 0) drawSlap(ctx, f.x, f.y, f.splash2);
    }

    // GREEN SEA TURTLE from above (drone references, Sep 25): a smooth broad heart of a shell,
    // widest at the shoulders, big mosaic scutes in amber and brown with pale seams (five down
    // the spine, four either side); LONG swept front flippers that do the swimming, small
    // rear ones; a small pale head with a scale mosaic.
    function seaTurtleShape(ctx, f, mode) {
        const body = mode === 'body', st = Math.sin(f.ph);
        const skin = '#8f7a52', edge = 'rgba(214,196,146,0.8)';
        const flipper = (sd, ax, ay, len, wd, ang) => {
            ctx.save(); ctx.translate(sd * ax, ay); ctx.scale(sd, 1); ctx.rotate(ang);
            ctx.beginPath(); ctx.moveTo(0, -wd * 0.55); ctx.quadraticCurveTo(len * 0.55, -wd * 1.05, len, wd * 0.35);
            ctx.quadraticCurveTo(len * 0.5, wd * 1.0, 0, wd * 0.6); ctx.closePath();
            if (body) { ctx.fillStyle = skin; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 0.4; ctx.stroke(); } else ctx.fill();
            ctx.restore();
        };
        for (const sd of [-1, 1]) {
            flipper(sd, 4.6, -3.6, 12, 3.2, 0.35 + 0.38 * st);      // the long front flippers: the stroke
            flipper(sd, 3.0, 6.8, 4.6, 1.8, 1.05 + 0.15 * st);      // the small rear ones steer
        }
        seaTurtleHead(ctx, body ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(0, -8.2);
        ctx.bezierCurveTo(5.2, -8.6, 7.4, -5, 7.1, -1);
        ctx.bezierCurveTo(6.8, 3.6, 3.6, 8.2, 0, 9.6);
        ctx.bezierCurveTo(-3.6, 8.2, -6.8, 3.6, -7.1, -1);
        ctx.bezierCurveTo(-7.4, -5, -5.2, -8.6, 0, -8.2);
        ctx.closePath();
        if (!body) { ctx.fill(); return; }
        const g = ctx.createRadialGradient(0, -1.5, 1, 0, 0, 8);
        g.addColorStop(0, '#9a7442'); g.addColorStop(0.7, '#6c4b2a'); g.addColorStop(1, '#4e3620');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(38,26,14,0.55)'; ctx.lineWidth = 0.5; ctx.stroke();
        // the scute mosaic: a chain of five down the spine, four costals either side
        ctx.strokeStyle = 'rgba(222,200,146,0.6)'; ctx.lineWidth = 0.42;
        const ys = [-6.4, -3.4, -0.3, 2.8, 5.6, 7.9];
        ctx.beginPath();
        for (let i = 0; i < ys.length - 1; i++) {
            const w0 = 2.3 - (i === 0 ? 0.6 : 0), w1 = 2.3 - (i === ys.length - 2 ? 1.1 : 0);
            ctx.moveTo(-w0, ys[i]); ctx.lineTo(w0, ys[i]);
            for (const sd of [-1, 1]) { ctx.moveTo(sd * w0, ys[i]); ctx.lineTo(sd * (w0 + 0.5), (ys[i] + ys[i + 1]) / 2); ctx.lineTo(sd * w1, ys[i + 1]); }
        }
        for (const y of [-3.4, -0.3, 2.8]) for (const sd of [-1, 1]) { ctx.moveTo(sd * 2.4, y); ctx.lineTo(sd * 6.9, y + (y > 0 ? 0.8 : -0.2)); }
        ctx.stroke();
        // amber flecks radiating in the costals: the "sunburst" every photograph shows
        ctx.strokeStyle = 'rgba(214,160,84,0.35)'; ctx.lineWidth = 0.35; ctx.beginPath();
        for (const [cx, cy] of [[4.4, -4.6], [4.8, -1.8], [4.6, 1.2], [3.6, 4.6]]) for (const sd of [-1, 1]) for (let r = 0; r < 3; r++) {
            const a = r * 1.1 + 0.4; ctx.moveTo(sd * cx, cy); ctx.lineTo(sd * (cx + Math.cos(a) * 1.4), cy + Math.sin(a) * 1.4 - 0.7);
        }
        ctx.stroke();
    }
    // The head alone (drawn again, crisp, when it breaks the surface to breathe). `k` > 0 draws
    // it in colour at that strength; k < 0 only adds it to the current flat silhouette path.
    function seaTurtleHead(ctx, k) {
        if (k < 0) { ctx.beginPath(); ctx.ellipse(0, -10.3, 2.6, 3.2, 0, 0, Math.PI * 2); ctx.fill(); return; }
        ctx.save(); ctx.globalAlpha *= Math.min(1, k);
        ctx.beginPath(); ctx.ellipse(0, -10.3, 2.6, 3.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#b39a66'; ctx.fill(); ctx.strokeStyle = 'rgba(60,44,24,0.6)'; ctx.lineWidth = 0.45; ctx.stroke();
        ctx.fillStyle = 'rgba(70,52,30,0.55)';
        for (const [x, y] of [[-0.9, -11.3], [0.9, -11.3], [0, -9.8]]) { ctx.beginPath(); ctx.arc(x, y, 0.3, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }

    // SPOTTED EAGLE RAY from above (drone references): a swept diamond with pointed wings that
    // bend in slow waves, a distinct rounded snout lobe ahead of them, near-black with white
    // spots and rings all over, and a whip tail two or three times the body's length.
    const RAY_SPOTS = (() => { const out = []; let h = 7; const rr = () => ((h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0) % 1000) / 1000;
        while (out.length < 46) { const x = (rr() * 2 - 1) * 15, y = -8 + rr() * 15; if (Math.abs(x) < 3 + (y + 9) * 0.9 && Math.abs(x) < 16.5 - Math.abs(y - 0.5) * 1.2) out.push([x, y, 0.3 + rr() * 0.3, rr() < 0.25]); } return out; })();
    function eagleRayShape(ctx, f, mode) {
        const body = mode === 'body', w = Math.sin(f.ph);
        // The flap bends the tips up and down: from above that shortens the span a little and
        // barely moves the tips fore and aft (moving them back is what made it read as a bell).
        const W = 21 * (1 - 0.08 * Math.abs(w)), tip = 1.2 + 0.8 * w;
        // the whip tail first, under the disc
        // The tail as ONE stroke per width band (overlapping round-capped segments bead where
        // they double up under a translucent fill), tapering in three steps.
        ctx.save(); ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
        ctx.strokeStyle = body ? '#1d232c' : ctx.fillStyle;
        const tailAt = (s) => [Math.sin(f.ph * 0.9 - s * 0.16) * 1.6 * (s / RAY_TAIL), 10.4 + s];
        [[0, 12, 0.9], [12, 24, 0.6], [24, RAY_TAIL, 0.32]].forEach(([s0, s1, lw]) => {
            ctx.lineWidth = lw; ctx.beginPath();
            for (let s = s0; s <= s1; s += 2) { const [x, y] = tailAt(s); s === s0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
            ctx.stroke();
        });
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(0, -12.2);
        ctx.quadraticCurveTo(2.2, -12.1, 2.4, -9.6);                  // the snout lobe, small and round
        ctx.lineTo(3.6, -8.4);
        ctx.bezierCurveTo(8.8, -5.7, 14.6, -2.3, W, tip);             // leading edge: straight, swept back
        ctx.quadraticCurveTo(12.6, 2.4, 4.6, 5.8);                    // trailing edge, concave, from a sharp tip
        ctx.quadraticCurveTo(2.8, 7.4, 2.2, 8.8); ctx.quadraticCurveTo(1.1, 10.4, 0, 10.5);
        ctx.quadraticCurveTo(-1.1, 10.4, -2.2, 8.8); ctx.quadraticCurveTo(-2.8, 7.4, -4.6, 5.8);
        ctx.quadraticCurveTo(-12.6, 2.4, -W, tip);
        ctx.bezierCurveTo(-14.6, -2.3, -8.8, -5.7, -3.6, -8.4);
        ctx.lineTo(-2.4, -9.6);
        ctx.quadraticCurveTo(-2.2, -12.1, 0, -12.2);
        ctx.closePath();
        if (!body) { ctx.fill(); return; }
        ctx.fillStyle = '#20262f'; ctx.fill();
        ctx.strokeStyle = 'rgba(8,10,14,0.6)'; ctx.lineWidth = 0.5; ctx.stroke();
        // the raised back down the middle, a shade lighter, and the eyes on the head's shoulders
        ctx.fillStyle = 'rgba(70,80,94,0.45)'; ctx.beginPath(); ctx.ellipse(0, -1.5, 2.6, 7.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0c0e11'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 2.1, -9.3, 0.5, 0, Math.PI * 2); ctx.fill(); }
        // the spots and rings: white, fading with depth so a deep ray is a dark diamond
        const vis = Math.max(0, 1 - (f.depth || 0) * 1.1);
        if (vis > 0.05) {
            ctx.save(); ctx.globalAlpha *= vis;
            for (const [x, y, r, ring] of RAY_SPOTS) {
                const xx = x * (W / 18.5), yy = y + (Math.abs(x) / 18.5) * (tip - 1.2);
                if (ring) { ctx.strokeStyle = 'rgba(240,244,248,0.8)'; ctx.lineWidth = 0.28; ctx.beginPath(); ctx.arc(xx, yy, r * 1.1, 0, Math.PI * 2); ctx.stroke(); }
                else { ctx.fillStyle = 'rgba(240,244,248,0.85)'; ctx.beginPath(); ctx.arc(xx, yy, r * 0.7, 0, Math.PI * 2); ctx.fill(); }
            }
            ctx.restore();
        }
    }

    // BLACKTIP REEF SHARK from above (drone references): a slim torpedo, pale sandy tan, blunt
    // round snout, broad pectorals swept back like wings a third of the way down, black tips
    // on the dorsal, the pectorals and the tail; the body bends in an S as the tail sweeps.
    // In shallow water its crisp shark-shaped shadow on the sand is half the read.
    function reefSharkShape(ctx, f, mode) {
        const body = mode === 'body', N = 18, pts = [];
        const off = (s) => Math.sin(f.ph - s * 3.2) * 2.3 * Math.pow(s, 1.5);
        const wid = (s) => 3.4 * (s < 0.12 ? 0.35 + 0.4 * Math.sqrt(s / 0.12) : s < 0.34 ? 0.75 + 0.25 * (s - 0.12) / 0.22 : 1 - (s - 0.34) / 0.66 * 0.83);
        for (let i = 0; i <= N; i++) { const s = i / N; pts.push({ s, x: off(s), y: -13 + s * 22, w: wid(s) }); }
        const at = (s) => { const i = Math.min(N - 1, Math.floor(s * N)), t = s * N - i, a = pts[i], b = pts[i + 1]; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t }; };
        const tan = '#b6a383', ink = '#15181b';
        // pectorals, swept back like wings
        const P = at(0.3);
        for (const sd of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(P.x + sd * P.w * 0.8, P.y - 1.6); ctx.lineTo(P.x + sd * 9.4, P.y + 4.6); ctx.lineTo(P.x + sd * P.w * 0.7, P.y + 2.2); ctx.closePath();
            if (body) { ctx.fillStyle = tan; ctx.fill(); ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(P.x + sd * 8.1, P.y + 3.4); ctx.lineTo(P.x + sd * 9.4, P.y + 4.6); ctx.lineTo(P.x + sd * 7.6, P.y + 4.1); ctx.closePath(); ctx.fill(); }
            else ctx.fill();
        }
        // small pelvic fins
        const V = at(0.74);
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(V.x + sd * V.w * 0.7, V.y - 0.6); ctx.lineTo(V.x + sd * 3.2, V.y + 1.8); ctx.lineTo(V.x + sd * V.w * 0.5, V.y + 1.2); ctx.closePath(); if (body) ctx.fillStyle = tan; ctx.fill(); }
        // the caudal fin: seen from above, a blade trailing the tail and swinging with it
        const T0 = pts[N], tx = T0.x + Math.sin(f.ph - 3.6) * 2.4, ty = T0.y + 6.8;
        ctx.beginPath(); ctx.moveTo(T0.x - 0.7, T0.y - 0.4); ctx.quadraticCurveTo((T0.x + tx) / 2 - 1.1, (T0.y + ty) / 2, tx, ty); ctx.quadraticCurveTo((T0.x + tx) / 2 + 1.1, (T0.y + ty) / 2, T0.x + 0.7, T0.y - 0.4); ctx.closePath();
        if (body) {
            ctx.fillStyle = tan; ctx.fill();
            // the black tip: the last quarter of the blade, not a spot
            const bx = T0.x + (tx - T0.x) * 0.7, by = T0.y + (ty - T0.y) * 0.7;
            ctx.beginPath(); ctx.moveTo(bx - 0.55, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + 0.55, by); ctx.closePath(); ctx.fillStyle = ink; ctx.fill();
        } else ctx.fill();
        // the body
        ctx.beginPath();
        pts.forEach((p, i) => { const x = p.x + p.w, y = p.y; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        for (let i = N; i >= 0; i--) ctx.lineTo(pts[i].x - pts[i].w, pts[i].y);
        ctx.quadraticCurveTo(0, -14.6, pts[0].x + pts[0].w, pts[0].y);
        ctx.closePath();
        if (!body) { ctx.fill(); return; }
        ctx.fillStyle = tan; ctx.fill();
        ctx.strokeStyle = 'rgba(70,58,40,0.5)'; ctx.lineWidth = 0.45; ctx.stroke();
        // the darker back and the dorsal fin standing on it, black-tipped
        ctx.strokeStyle = 'rgba(128,108,76,0.55)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
        ctx.beginPath(); pts.slice(2, N - 1).forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
        // the dorsal fin, edge-on from above: a thin blade along the back, its rear tip black
        const D0 = at(0.38), D1 = at(0.5), D2 = at(0.56);
        ctx.lineCap = 'round'; ctx.lineWidth = 0.9;
        ctx.strokeStyle = '#8d7b5c'; ctx.beginPath(); ctx.moveTo(D0.x, D0.y); ctx.lineTo(D1.x, D1.y); ctx.stroke();
        ctx.strokeStyle = ink; ctx.beginPath(); ctx.moveTo(D1.x, D1.y); ctx.lineTo(D2.x, D2.y); ctx.stroke();
    }

    // AMERICAN ALLIGATOR from above (drone references, Sep 25): long and low, most of it under
    // the water; what breaks the surface is the top of the broad U-snouted head (eyes and
    // nostrils) and the band of pale-tipped scute rows down the back and tail — a zipper.
    // Legs splay back along the flanks under water; the tail tapers under its double crest.
    function drawGator(ctx, g) {
        const vis = 1 - (g.sink || 0);
        if (g.mode === 'under') return;
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.h); ctx.scale(GATOR_SCALE, GATOR_SCALE);
        const sw = g.mode === 'swim' ? Math.sin(g.bob * 3) : Math.sin(g.bob * 0.6) * 0.25;
        const tailX = (s) => sw * 2.2 * Math.pow(s, 1.6);          // the tail's sweep, s 0..1 along it
        // the body under the water: one dim flat shape — head, trunk, legs, tail
        ctx.globalAlpha *= vis;
        ctx.fillStyle = 'rgba(38,44,30,0.5)';
        ctx.beginPath();
        ctx.moveTo(0, -16.2);
        ctx.quadraticCurveTo(1.7, -16.1, 1.9, -13.5); ctx.lineTo(2.3, -10.8);
        ctx.quadraticCurveTo(2.9, -9, 2.6, -7.5); ctx.quadraticCurveTo(4.6, -4.5, 4.4, 0.5); ctx.quadraticCurveTo(4.2, 3.5, 2.4, 5);
        for (let i = 1; i <= 8; i++) { const sT = i / 8; ctx.lineTo(tailX(sT) + 2.4 * (1 - sT) + 0.15, 5 + sT * 12); }
        for (let i = 8; i >= 1; i--) { const sT = i / 8; ctx.lineTo(tailX(sT) - 2.4 * (1 - sT) - 0.15, 5 + sT * 12); }
        ctx.lineTo(-2.4, 5); ctx.quadraticCurveTo(-4.2, 3.5, -4.4, 0.5); ctx.quadraticCurveTo(-4.6, -4.5, -2.6, -7.5);
        ctx.quadraticCurveTo(-2.9, -9, -2.3, -10.8); ctx.lineTo(-1.9, -13.5); ctx.quadraticCurveTo(-1.7, -16.1, 0, -16.2);
        ctx.closePath(); ctx.fill();
        // legs, splayed back along the flanks (they paddle a little when it swims)
        // (floating, the legs hang tucked back against the flanks and barely show; a stroke
        // outward reads as a lizard walking on land)
        ctx.strokeStyle = 'rgba(38,44,30,0.22)'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
        for (const [y, sp] of [[-5.5, 0], [2.5, 1]]) for (const sd of [-1, 1]) {
            const k = g.mode === 'swim' ? Math.sin(g.bob * 3 + sp * 2 + sd) * 0.6 : 0;
            ctx.beginPath(); ctx.moveTo(sd * 3.9, y); ctx.lineTo(sd * 5.2, y + 2.6 + k); ctx.stroke();
        }
        // what breaks the surface, crisp: fading first when it sinks
        const up = Math.max(0, 1 - (g.sink || 0) * 1.6);
        if (up > 0) {
            ctx.globalAlpha *= up;
            // the head top: a broad U snout, the eye bumps, the nostril bump
            ctx.fillStyle = '#3d4230';
            ctx.beginPath(); ctx.moveTo(0, -15.8); ctx.quadraticCurveTo(1.5, -15.7, 1.6, -13.4); ctx.lineTo(2.0, -10.6); ctx.quadraticCurveTo(0, -9.4, -2.0, -10.6); ctx.lineTo(-1.6, -13.4); ctx.quadraticCurveTo(-1.5, -15.7, 0, -15.8); ctx.fill();
            ctx.fillStyle = '#2b2f22'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 1.35, -11.1, 0.75, 0.9, 0, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = 'rgba(214,196,96,0.9)'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 1.45, -11.25, 0.28, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = '#2b2f22'; ctx.beginPath(); ctx.ellipse(0, -15.1, 0.8, 0.5, 0, 0, Math.PI * 2); ctx.fill();
            // the zipper: two rows of pale-tipped scutes down the back, one down the tail
            ctx.fillStyle = 'rgba(190,186,150,0.75)';
            for (let y = -6.5; y <= 4.5; y += 1.45) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 0.95, y, 0.36, 0, Math.PI * 2); ctx.fill(); }
            for (let i = 1; i <= 7; i++) { const sT = i / 8; ctx.beginPath(); ctx.arc(tailX(sT), 5 + sT * 12, 0.32 * (1 - sT * 0.6), 0, Math.PI * 2); ctx.fill(); }
            ctx.strokeStyle = 'rgba(30,34,24,0.6)'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(0, -6.8); ctx.lineTo(0, 4.8); ctx.stroke();
            // the waterline round the head: short broken arcs, drifting out
            const q = (T * 0.35 + g.i * 0.37) % 1;
            ctx.strokeStyle = `rgba(255,255,255,${0.18 * (1 - q)})`; ctx.lineWidth = 0.5;
            for (const [a0, a1] of [[-2.9, -2.2], [-0.9, -0.2], [0.9, 1.6], [2.3, 2.9]]) { ctx.beginPath(); ctx.ellipse(0, -11.5, 4.8 + q * 3.5, 6 + q * 3.5, 0, a0, a1); ctx.stroke(); }
        }
        ctx.restore();
    }

    // GREAT EGRET from above: all white, a slim body, the S of the neck (drawn out when it
    // strikes), a yellow dagger bill; black legs, which show from above only as the long thin
    // shadow they cast. In flight: broad rounded white wings, neck tucked, legs trailing.
    function drawEgret(ctx, e) {
        const k = EGRET_SCALE;
        if (e.mode === 'fly') {
            const beat = Math.sin(e.flap), z = e.z;
            const wing = (fill) => {
                for (const sd of [-1, 1]) {
                    ctx.beginPath(); ctx.moveTo(sd * 1.6, -2.2);
                    ctx.quadraticCurveTo(sd * 8, -4.2 - beat * 1.5, sd * 14.5, -1 + beat * 1.2);
                    ctx.quadraticCurveTo(sd * 12, 2.4, sd * 7, 2.8);
                    ctx.quadraticCurveTo(sd * 3.5, 3.2, sd * 1.6, 2.6); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
                }
            };
            const shade = () => { ctx.beginPath(); ctx.ellipse(0, 1, 1.9, 5.2, 0, 0, Math.PI * 2); ctx.fill(); };
            ctx.save(); ctx.translate(e.x + z * 0.35, e.y + z * 0.55); ctx.rotate(e.h); ctx.scale(k * 0.95, k * 0.95);
            ctx.fillStyle = `rgba(10,25,40,${0.2 * Math.max(0.3, 1 - z / 120)})`; wing(ctx.fillStyle); shade(); ctx.restore();
            ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.h); ctx.scale(k, k);
            ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 0.55; ctx.lineCap = 'round';
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 0.5, 5); ctx.lineTo(sd * 0.6, 11); ctx.stroke(); }   // legs trailing
            wing('#f5f5f0');
            ctx.strokeStyle = 'rgba(150,150,140,0.5)'; ctx.lineWidth = 0.4;
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 1.6, -2.2); ctx.quadraticCurveTo(sd * 8, -4.2 - beat * 1.5, sd * 14.5, -1 + beat * 1.2); ctx.stroke(); }
            ctx.fillStyle = '#f7f7f2'; ctx.beginPath(); ctx.ellipse(0, 1, 1.9, 5.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -4.4, 1.2, 0, Math.PI * 2); ctx.fill();                       // neck tucked, head close
            ctx.fillStyle = '#e8b722'; ctx.beginPath(); ctx.moveTo(-0.4, -5.4); ctx.lineTo(0, -8.8); ctx.lineTo(0.4, -5.4); ctx.closePath(); ctx.fill();
            ctx.restore();
            return;
        }
        const strike = e.neck || 0;
        const hy = -6.4 - strike * 5.5, hx = Math.sin(e.bob * 0.7) * 0.6 * (1 - strike);
        const bird = (fill, neckCol) => {
            ctx.fillStyle = fill;
            ctx.beginPath(); ctx.moveTo(0, -3.2); ctx.bezierCurveTo(2.9, -2.6, 2.7, 5, 0, 8.6); ctx.bezierCurveTo(-2.7, 5, -2.9, -2.6, 0, -3.2); ctx.fill();
            ctx.strokeStyle = neckCol; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, -2.6); ctx.bezierCurveTo(1.5 * (1 - strike), -3.9, -1.5 * (1 - strike), -5.2, hx, hy); ctx.stroke();
            ctx.beginPath(); ctx.arc(hx, hy, 1.4, 0, Math.PI * 2); ctx.fill();
        };
        // Its shadow: the bird's own silhouette cast down-right on the water — a bird a metre
        // tall throws it well clear — joined to the bird by the thin dark lines of its legs.
        const sx = 4.6, sy = 7.2;
        ctx.save(); ctx.translate(e.x, e.y); ctx.scale(k, k);
        ctx.strokeStyle = 'rgba(10,20,15,0.32)'; ctx.lineWidth = 0.5; ctx.lineCap = 'round';
        for (const sd of [-0.6, 0.6]) { ctx.beginPath(); ctx.moveTo(sd, 1.5); ctx.lineTo(sx + sd, sy + 1.5); ctx.stroke(); }
        ctx.translate(sx, sy); ctx.rotate(e.h); bird('rgba(10,20,15,0.22)', 'rgba(10,20,15,0.22)');
        ctx.restore();
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.h); ctx.scale(k, k);
        bird('#f5f5f0', '#f5f5f0');
        ctx.strokeStyle = 'rgba(120,120,110,0.45)'; ctx.lineWidth = 0.35;
        ctx.beginPath(); ctx.moveTo(0, -3.2); ctx.bezierCurveTo(2.9, -2.6, 2.7, 5, 0, 8.6); ctx.bezierCurveTo(-2.7, 5, -2.9, -2.6, 0, -3.2); ctx.stroke();
        ctx.fillStyle = '#e8b722'; ctx.beginPath(); ctx.moveTo(hx - 0.4, hy - 1); ctx.lineTo(hx, hy - 5); ctx.lineTo(hx + 0.4, hy - 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(hx + 0.55, hy - 0.3, 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // ANHINGA from above: the snakebird. Drying on a perch: a dark body with the wings held
    // wide, the upper wings streaked silver-white, the long fan tail, the thin neck and a
    // dagger bill. Swimming: only the S of the neck and head above the water, the body a dim
    // shape below, a small V from the neck.
    // A dead snag standing in the water — the anhinga's perch: a pale grey broken stump, one
    // stub of branch, its shadow down-right and the water ringing its base.
    function drawSnag(ctx, a) {
        ctx.save(); ctx.translate(a.px, a.py); ctx.rotate(a.snag);
        const q = (T * 0.3 + a.snag) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${0.3 * (1 - q)})`; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.arc(0, 0, 7 + q * 7, 0.3, 2.6); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 7 + q * 7, 3.4, 5.6); ctx.stroke();
        ctx.fillStyle = 'rgba(10,20,15,0.3)'; ctx.beginPath(); ctx.ellipse(5, 8, 5, 3, 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8e8a80'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-3, 1); ctx.lineTo(15, -4.5); ctx.stroke();
        ctx.fillStyle = '#9d988c'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(60,56,50,0.6)'; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.fillStyle = 'rgba(70,66,58,0.6)'; ctx.beginPath(); ctx.arc(-0.8, 0.6, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    function drawAnhinga(ctx, a) {
        const k = ANHINGA_SCALE;
        if (a.mode === 'swim') {
            if (a.trail.length > 2) drawWakeTrail(ctx, a, 2.4, 0.9, 0.35);
            ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.h); ctx.scale(k, k);
            ctx.fillStyle = 'rgba(20,24,26,0.35)';
            ctx.beginPath(); ctx.ellipse(0, 3.5, 2.4, 5.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-1.2, 7.5); ctx.lineTo(0, 13); ctx.lineTo(1.2, 7.5); ctx.closePath(); ctx.fill();
            const w = Math.sin(a.t * 1.6) * 0.8;
            ctx.strokeStyle = '#26292b'; ctx.lineWidth = 0.95; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, -0.5); ctx.bezierCurveTo(1.6 + w, -2.5, -1.6 + w, -4.5, w * 0.6, -6.6); ctx.stroke();
            ctx.fillStyle = '#26292b'; ctx.beginPath(); ctx.arc(w * 0.6, -6.8, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#d9a64a'; ctx.beginPath(); ctx.moveTo(w * 0.6 - 0.3, -7.3); ctx.lineTo(w * 0.6, -10.4); ctx.lineTo(w * 0.6 + 0.3, -7.3); ctx.closePath(); ctx.fill();
            drawRing(ctx, 0, -0.5, 0.6 + 0.4 * Math.sin(a.t * 2), 1.4, 1.5, 0.35);
            ctx.restore();
            return;
        }
        const vis = a.mode === 'drop' ? 1 - a.sink : a.mode === 'climb' ? Math.min(1, a.t / 0.8) : 1;
        // It sits out on the snag's branch, so the pale stump shows beside it.
        const bx = a.px + Math.cos(a.snag) * 13 - Math.sin(a.snag) * -4, by = a.py + Math.sin(a.snag) * 13 + Math.cos(a.snag) * -4;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(a.ph); ctx.scale(k, k); ctx.globalAlpha *= vis;
        const flex = Math.sin(a.flap * 1.3) * 0.5;
        const wings = (dark) => {
            for (const sd of [-1, 1]) {
                ctx.beginPath(); ctx.moveTo(sd * 1.6, -2);
                ctx.quadraticCurveTo(sd * 6.5, -3.4, sd * 11.6, -0.6 + flex);
                ctx.lineTo(sd * 11.2, 1.2 + flex); ctx.quadraticCurveTo(sd * 6, 2.4, sd * 1.8, 2.8); ctx.closePath();
                ctx.fillStyle = dark; ctx.fill();
            }
        };
        // its shadow on the water below the perch
        ctx.save(); ctx.translate(3.2, 5); ctx.globalAlpha *= 0.5; wings('rgba(10,20,15,0.35)'); ctx.restore();
        // the fan tail, dark with a pale tip band
        ctx.fillStyle = '#1d2023'; ctx.beginPath(); ctx.moveTo(-0.9, 3.5); ctx.lineTo(-2.6, 11.2); ctx.quadraticCurveTo(0, 12.2, 2.6, 11.2); ctx.lineTo(0.9, 3.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(200,180,140,0.7)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-2.4, 10.6); ctx.quadraticCurveTo(0, 11.5, 2.4, 10.6); ctx.stroke();
        wings('#1c1f22');
        // the silver streaks on the upper wings
        ctx.strokeStyle = 'rgba(206,210,214,0.85)'; ctx.lineWidth = 0.4;
        for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) { const x = sd * (2.6 + i * 1.2); ctx.beginPath(); ctx.moveTo(x, -1.6 + i * 0.1); ctx.lineTo(x + sd * 1.4, 0.8 + i * 0.1); ctx.stroke(); }
        ctx.fillStyle = '#23262a'; ctx.beginPath(); ctx.ellipse(0, 0.5, 2.2, 4, 0, 0, Math.PI * 2); ctx.fill();
        // the neck in its kink, the head, the dagger bill
        ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = 0.95; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, -3); ctx.bezierCurveTo(1.4, -4.6, -1.3, -6, 0.3, -7.6); ctx.stroke();
        ctx.fillStyle = '#2a2d31'; ctx.beginPath(); ctx.arc(0.3, -7.8, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d9a64a'; ctx.beginPath(); ctx.moveTo(0, -8.3); ctx.lineTo(0.3, -11.4); ctx.lineTo(0.6, -8.3); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (a.splash > 0) drawSlap(ctx, a.x, a.y, a.splash * 0.7);
    }

    // AMERICAN BULLFROG from above: an olive-green pear of a body with darker mottling, a broad
    // head with the eyes raised in bumps and the round eardrum behind each, the long hind legs
    // folded in a Z along the flanks. In the water only the eyes and the top of the head show.
    function drawFrog(ctx, x, y, h, size, mode, k) {
        const s = FROG_SCALE * (size || 1);
        ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(s, s);
        if (mode === 'swim') {
            ctx.fillStyle = 'rgba(60,80,40,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0.8, 2.3, 3.4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5b7438'; ctx.beginPath(); ctx.ellipse(0, -2.4, 1.9, 1.1, 0, 0, Math.PI * 2); ctx.fill();
            for (const sd of [-1, 1]) { ctx.fillStyle = '#6d8a41'; ctx.beginPath(); ctx.arc(sd * 1.1, -2.6, 0.75, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#d8b33a'; ctx.beginPath(); ctx.arc(sd * 1.15, -2.7, 0.3, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore(); return;
        }
        const stretch = mode === 'hop' ? k : 0;              // legs trailing straight back mid-hop
        ctx.fillStyle = '#4c6331';
        for (const sd of [-1, 1]) {
            ctx.beginPath();
            if (stretch > 0.3) { ctx.moveTo(sd * 1.4, 2.4); ctx.lineTo(sd * 1.9, 6.5); ctx.lineTo(sd * 2.6, 8.4); ctx.lineTo(sd * 1.2, 7.2); ctx.lineTo(sd * 0.6, 3); }
            else { ctx.moveTo(sd * 1.6, 2.6); ctx.lineTo(sd * 3.1, 0.2); ctx.lineTo(sd * 3.4, 3.4); ctx.lineTo(sd * 2.6, 5.2); ctx.lineTo(sd * 3.6, 5.8); ctx.lineTo(sd * 2.2, 6.2); ctx.lineTo(sd * 1.2, 3.6); }
            ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(sd * 1.3, -1.4); ctx.lineTo(sd * 2.5, -0.4); ctx.lineTo(sd * 1.5, -0.2); ctx.closePath(); ctx.fill();
        }
        ctx.beginPath(); ctx.moveTo(0, -4.4);
        ctx.bezierCurveTo(2.6, -4.3, 2.6, -1.2, 2.3, 1); ctx.bezierCurveTo(2.1, 3.4, 0.9, 4, 0, 4);
        ctx.bezierCurveTo(-0.9, 4, -2.1, 3.4, -2.3, 1); ctx.bezierCurveTo(-2.6, -1.2, -2.6, -4.3, 0, -4.4); ctx.closePath();
        ctx.fillStyle = '#6a8a3f'; ctx.fill(); ctx.strokeStyle = 'rgba(30,40,18,0.6)'; ctx.lineWidth = 0.35; ctx.stroke();
        ctx.fillStyle = 'rgba(52,70,32,0.7)';
        for (const [mx, my, r] of [[-0.8, 0.6, 0.5], [0.9, 1.5, 0.45], [0.2, 2.8, 0.4], [-1.2, 2.2, 0.35]]) { ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill(); }
        for (const sd of [-1, 1]) {
            ctx.fillStyle = '#7d9c4c'; ctx.beginPath(); ctx.arc(sd * 1.25, -3.1, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#d8b33a'; ctx.beginPath(); ctx.arc(sd * 1.3, -3.2, 0.34, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(60,70,40,0.8)'; ctx.beginPath(); ctx.arc(sd * 1.7, -1.9, 0.45, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
    function drawFrogGroup(ctx, b, layer) {
        const nx = -b.ay, ny = b.ax;
        for (const t of b.turtles) {
            if (layer === 'perched') {
                if (t.mode === 'bask' || t.mode === 'wait') {
                    ctx.save(); ctx.fillStyle = 'rgba(10,20,15,0.28)'; ctx.beginPath(); ctx.ellipse(t.hx + 1.2, t.hy + 1.8, 4 * (t.size || 1), 5 * (t.size || 1), t.h, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                    drawFrog(ctx, t.hx, t.hy, t.h, t.size, 'sit');
                }
                continue;
            }
            // In the air: an arc out to the water, its shadow on the water under it.
            if (t.mode === 'slide' || t.mode === 'climb') {
                const k = t.mode === 'slide' ? t.t / 0.55 : 1 - Math.min(1, t.t / 1.6);
                const z = Math.sin(Math.PI * Math.min(1, k)) * 9, x = t.hx + t.ox, y = t.hy + t.oy;
                const hh = Math.atan2(t.side * nx, -(t.side * ny)) + (t.mode === 'slide' ? 0 : Math.PI);   // out to the water, or back to the log
                ctx.save(); ctx.fillStyle = 'rgba(10,20,15,0.25)'; ctx.beginPath(); ctx.ellipse(x + z * 0.35, y + z * 0.55, 3.5, 5, hh, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                drawFrog(ctx, x, y, hh, (t.size || 1) * (1 + z * 0.02), 'hop', k);
            } else if (t.mode === 'under') {
                drawFrog(ctx, t.ux, t.uy, t.uh, t.size, 'swim');
                const q = (T * 0.5 + t.i * 0.3) % 1; drawRing(ctx, t.ux, t.uy - 1, 1 - q, 4, 6, 0.3);
            }
            if (t.plop > 0) { drawRing(ctx, t.ux, t.uy, t.plop, 3, 12, 0.7); drawRing(ctx, t.ux, t.uy, Math.max(0, t.plop - 0.3), 2, 8, 0.5); }
        }
    }

    // A LAKE BASS JUMPING from above: silver-olive with a dark lateral stripe, arcing clear —
    // its shadow on the water dropping away with height — a crown of spray as it leaves and
    // another as it goes back in, then rings spreading from the entry.
    function drawLeap(ctx, L) {
        if (L.t < 0) return;   // one of a bunch, not off yet
        if (L.kind === 'carp') return drawCarpLeap(ctx, L);
        const p = Math.min(1, L.t / L.dur), z = Math.sin(Math.PI * p) * L.hop;
        const x = L.x + Math.sin(L.h) * (p - 0.5) * 26, y = L.y - Math.cos(L.h) * (p - 0.5) * 26;
        const x0 = L.x - Math.sin(L.h) * 13, y0 = L.y + Math.cos(L.h) * 13, x1 = L.x + Math.sin(L.h) * 13, y1 = L.y - Math.cos(L.h) * 13;
        if (L.t < L.dur) {
            const len = (L.kind === 'salmon' ? SOCKEYE_LEN : BASS_LEN) * L.size, pitch = Math.cos(Math.PI * p);    // nose up, then down: foreshortened at the top
            const body = (fill, sx, sy) => {
                ctx.save(); ctx.translate(sx, sy); ctx.rotate(L.h + Math.sin(L.t * 14) * 0.15);
                const l = len * (0.75 + 0.25 * Math.abs(pitch));
                ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(0, 0, l * 0.18, l * 0.5, 0, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.moveTo(0, l * 0.42); ctx.lineTo(-l * 0.2, l * 0.68); ctx.lineTo(0, l * 0.56); ctx.lineTo(l * 0.2, l * 0.68); ctx.closePath(); ctx.fill();
                ctx.restore();
            };
            body('rgba(10,25,40,0.22)', x + z * 0.35, y + z * 0.55);
            const salmon = L.kind === 'salmon';
            // a salmon clears white water, so it gets a dark rim to stand off the foam
            if (salmon) { ctx.save(); ctx.globalAlpha *= 0.55; body('#2a1a18', x, y); ctx.restore(); ctx.save(); ctx.translate(x, y); ctx.scale(0.88, 0.94); ctx.translate(-x, -y); body(L.silver ? SOCKEYE.silver : SOCKEYE.body, x, y); ctx.restore(); }
            else body('#8f9e6c', x, y);
            ctx.save(); ctx.translate(x, y); ctx.rotate(L.h + Math.sin(L.t * 14) * 0.15);
            if (salmon) {
                // the sockeye's green head, a hooked jaw, and the white water streaming off it
                // the head: the front quarter of the body, tapering to the snout — never wider than it
                ctx.fillStyle = L.silver ? SOCKEYE.silverHead : SOCKEYE.head; ctx.beginPath(); ctx.moveTo(0, -len * 0.5); ctx.quadraticCurveTo(len * 0.15, -len * 0.4, len * 0.14, -len * 0.25); ctx.quadraticCurveTo(0, -len * 0.21, -len * 0.14, -len * 0.25); ctx.quadraticCurveTo(-len * 0.15, -len * 0.4, 0, -len * 0.5); ctx.fill();
                ctx.fillStyle = SOCKEYE.jaw; ctx.beginPath(); ctx.ellipse(0, -len * 0.47, len * 0.05, len * 0.05, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(0, len * 0.1, len * 0.05, len * 0.3, 0, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.strokeStyle = 'rgba(40,50,30,0.8)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, -len * 0.38); ctx.lineTo(0, len * 0.4); ctx.stroke();
                ctx.fillStyle = 'rgba(235,240,220,0.7)'; ctx.beginPath(); ctx.ellipse(0, -len * 0.1, len * 0.06, len * 0.25, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
        const out = 1 - Math.min(1, L.t / 0.45); if (out > 0) drawFishSplash(ctx, x0, y0, out, L.size, 1);
        const inT = L.t - L.dur;
        if (inT >= 0) {
            const k = 1 - Math.min(1, inT / 0.5); if (k > 0) drawFishSplash(ctx, x1, y1, k, L.size, 7);
            for (let r = 0; r < 3; r++) { const q = 1 - Math.min(1, (inT - r * 0.3) / 1.4); if (q > 0 && q < 1) drawRing(ctx, x1, y1, q, 3 + r * 1.5, 12, 0.45); }
        }
    }

    // COMMON CARP (Redrock). References: a heavy, deep-bodied fish — olive-bronze back, a
    // brassy gold flank netted with big scales, a paler belly, orange-red lower fins and tail.
    // It jumps NEARLY STRAIGHT UP, often twisting, so from above it is foreshortened, then it
    // tips over and falls back FLAT ON ITS SIDE: a broad slap, a torn sheet of white the length
    // of the fish, and rings. 0.7 m -> 21 u (bigger than the Lake's bass, 14, and the salmon, 17).
    const CARP_LEN = 21, CARP = { back: [86, 83, 47], flank: [185, 140, 62], belly: '#e2c27e', fin: '#c8643a', net: 'rgba(90,62,24,0.3)' };
    function carpShape(ctx, len, wide) {
        // from above, head toward -y: broad head and shoulders, a narrow wrist, a forked tail
        const P = [[-0.5, 0.03], [-0.44, 0.09], [-0.3, 0.125], [-0.12, 0.135], [0.08, 0.115], [0.24, 0.065], [0.32, 0.04]];
        ctx.beginPath(); ctx.moveTo(0, -0.5 * len);
        for (const [y, w] of P) ctx.lineTo(w * len * wide, y * len);
        ctx.lineTo(0.13 * len, 0.52 * len); ctx.lineTo(0, 0.43 * len); ctx.lineTo(-0.13 * len, 0.52 * len);
        for (let i = P.length - 1; i >= 0; i--) ctx.lineTo(-P[i][1] * len * wide, P[i][0] * len);
        ctx.closePath();
    }
    // A torn sheet of white: a lobed patch, never a ring or a spray of dots.
    function whiteSheet(ctx, x, y, rx, ry, h, seed, a) {
        if (a <= 0) return;
        ctx.save(); ctx.translate(x, y); ctx.rotate(h);
        const pts = [];
        for (let v = 0; v < 16; v++) { const q = v / 16 * Math.PI * 2, k = 0.72 + 0.2 * Math.sin(q * 3 + seed) + 0.08 * Math.sin(q * 5 + seed * 2.3); pts.push([Math.cos(q) * rx * k, Math.sin(q) * ry * k]); }
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.7, `rgba(248,252,252,${a * 0.75})`); g.addColorStop(1, `rgba(240,250,250,${a * 0.2})`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo((pts[15][0] + pts[0][0]) / 2, (pts[15][1] + pts[0][1]) / 2);
        for (let v = 0; v < 16; v++) { const n = pts[(v + 1) % 16]; ctx.quadraticCurveTo(pts[v][0], pts[v][1], (pts[v][0] + n[0]) / 2, (pts[v][1] + n[1]) / 2); }
        ctx.fill(); ctx.restore();
    }
    function drawCarpLeap(ctx, L) {
        const len = CARP_LEN * L.size, p = Math.min(1, L.t / L.dur), z = Math.sin(Math.PI * p) * L.hop;
        const fx = Math.sin(L.h), fy = -Math.cos(L.h);
        // it barely travels: up nearly on the spot, over, and down a body length on
        const x = L.x + fx * (p - 0.2) * 14, y = L.y + fy * (p - 0.2) * 14;
        const x1 = L.x + fx * 11, y1 = L.y + fy * 11;
        if (L.t < L.dur) {
            // pitch: near vertical going up (short from above), level at the top, and flat as it drops
            const up = p < 0.45 ? 1 - p / 0.45 * 0.6 : Math.max(0, 0.4 - (p - 0.45) / 0.25 * 0.4);
            const vis = 0.32 + 0.68 * Math.cos(up * 1.35);
            const roll = Math.min(1, Math.max(0, (p - 0.3) / 0.45));   // turning onto its side
            const tw = Math.sin(L.t * 11) * 0.12 * (1 - roll);          // the tail's thrash going up
            const body = (fill, sx, sy, wide) => { ctx.save(); ctx.translate(sx, sy); ctx.rotate(L.h + tw); ctx.scale(1, vis); ctx.fillStyle = fill; carpShape(ctx, len, wide); ctx.fill(); ctx.restore(); };
            body('rgba(10,25,40,0.24)', x + z * 0.35, y + z * 0.55, 1 + 0.6 * roll);   // its shadow on the water
            const mix = (k) => `rgb(${CARP.back.map((c, i) => Math.round(c + (CARP.flank[i] - c) * k)).join(',')})`;
            body(mix(roll * 0.9), x, y, 1 + 0.6 * roll);
            ctx.save(); ctx.translate(x, y); ctx.rotate(L.h + tw); ctx.scale(1, vis);
            // the flank coming round: brass gold, a pale belly edge, the scale net
            if (roll > 0.05) {
                ctx.save(); ctx.clip(); ctx.globalAlpha *= roll;
                ctx.fillStyle = CARP.belly; ctx.beginPath(); ctx.ellipse(L.roll * len * 0.14, -len * 0.06, len * 0.05, len * 0.28, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(80,70,40,0.5)'; ctx.beginPath(); ctx.ellipse(-L.roll * len * 0.12, -len * 0.05, len * 0.04, len * 0.3, 0, 0, Math.PI * 2); ctx.fill();   // the darker back edge
                // the big scales: a few soft rows of scallops along the flank
                ctx.strokeStyle = CARP.net; ctx.lineWidth = 0.3;
                for (let r = -1; r <= 1; r++) for (let i = 0; i < 6; i++) { const cy = -len * 0.3 + i * len * 0.1, cx = r * len * 0.07; ctx.beginPath(); ctx.arc(cx, cy, len * 0.035, 0.2, Math.PI - 0.2); ctx.stroke(); }
                ctx.restore();
            }
            // orange-red tail and lower fins, the darker head
            ctx.fillStyle = CARP.fin;
            ctx.beginPath(); ctx.moveTo(0, len * 0.42); ctx.lineTo(-len * 0.2, len * 0.52); ctx.lineTo(-len * 0.13, len * 0.35); ctx.lineTo(len * 0.13, len * 0.35); ctx.lineTo(len * 0.2, len * 0.52); ctx.closePath(); ctx.fill();
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * len * 0.15, -len * 0.2, len * 0.06, len * 0.025, sd * 0.7, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = 'rgba(70,64,36,0.35)'; ctx.beginPath(); ctx.ellipse(0, -len * 0.4, len * 0.07, len * 0.08, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(230,200,150,0.9)'; ctx.beginPath(); ctx.ellipse(0, -len * 0.49, len * 0.04, len * 0.025, 0, 0, Math.PI * 2); ctx.fill();   // the mouth
            ctx.restore();
            // water streaming off it on the way up
            if (p < 0.5) whiteSheet(ctx, x, y, len * 0.22, len * 0.16, L.h, L.x, 0.35 * (1 - p / 0.5));
        }
        // the column of white it bursts out of
        const out = 1 - Math.min(1, L.t / 0.6);
        if (out > 0) { whiteSheet(ctx, L.x, L.y, len * (0.35 + 0.25 * (1 - out)), len * (0.3 + 0.2 * (1 - out)), L.h, L.y, 0.75 * out); drawFishSplash(ctx, L.x, L.y, out, L.size * 1.4, 3); }
        // the slap: flat on its side, a sheet of white the length of the fish, spray, and rings
        const inT = L.t - L.dur;
        if (inT >= 0) {
            const k = 1 - Math.min(1, inT / 0.9);
            whiteSheet(ctx, x1, y1, len * (0.3 + 0.18 * (1 - k)), len * (0.62 + 0.2 * (1 - k)), L.h, L.x + L.y, 0.8 * k);
            const ks = 1 - Math.min(1, inT / 0.5); if (ks > 0) drawFishSplash(ctx, x1, y1, ks, L.size * 1.8, 9);
            for (let r = 0; r < 3; r++) {
                const q = 1 - Math.min(1, (inT - r * 0.3) / 1.6); if (!(q > 0 && q < 1)) continue;
                const rad = 6 + r * 2 + (1 - q) * 22;
                ctx.strokeStyle = `rgba(255,255,255,${0.45 * q})`; ctx.lineWidth = 1.1;
                for (const [a0, a1] of [[0.3, 1.5], [1.9, 2.8], [3.3, 4.7], [5.0, 5.9]]) { ctx.beginPath(); ctx.ellipse(x1, y1, rad * 0.85, rad * 1.1, L.h, a0 + r, a1 + r); ctx.stroke(); }
            }
        }
    }

    // A fish-sized splash (a beaver's slap is five times the animal): a small white burst and a
    // few uneven droplets thrown out, then gone. `seed` varies the droplets between splashes.
    function drawFishSplash(ctx, x, y, k, size, seed) {
        const r = (3 + (1 - k) * 6) * (size || 1);
        ctx.save();
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.85 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
        for (let i = 0; i < 7; i++) {
            const j = Math.abs(Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
            const a = (i + j) / 7 * Math.PI * 2, d = r * (0.8 + j * 0.9);
            ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.6 + j * 0.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
    // TANGS from above: a tang is flat side to side, so from above it is a thin bright sliver —
    // yellow, or royal blue with a yellow tail — and a school is a cloud of them, all facing the
    // way it moves, a shade of shadow on the sand under each.
    function drawShoal(ctx, G) {
        const blue = G.cfg.kind === 'bluetang';
        const tint = waterTint();
        for (const f of G.fish) {
            const s = TANG_SCALE * f.size, w = Math.sin(f.ph * 3) * 0.12 * Math.min(1, 0.3 + (f.spd || 0) / 12);
            ctx.save(); ctx.translate(f.x + 2.2, f.y + 3.4); ctx.rotate(f.h); ctx.scale(s, s);
            ctx.fillStyle = 'rgba(10,25,40,0.16)'; ctx.beginPath(); ctx.ellipse(0, 0, 1.1, 3.4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.h); ctx.scale(s, s);
            ctx.globalAlpha *= 0.9;
            ctx.fillStyle = blue ? '#2f63ee' : '#ffd21f';
            ctx.beginPath(); ctx.moveTo(0, -3.8); ctx.quadraticCurveTo(1.35, -1.2, 0.9, 2.2); ctx.lineTo(0, 2.6); ctx.lineTo(-0.9, 2.2); ctx.quadraticCurveTo(-1.35, -1.2, 0, -3.8); ctx.fill();
            ctx.fillStyle = blue ? '#ffd21f' : '#f5c400';
            ctx.beginPath(); ctx.moveTo(0, 2.3); ctx.lineTo(-1.3 + w, 4.4); ctx.lineTo(0, 3.7); ctx.lineTo(1.3 + w, 4.4); ctx.closePath(); ctx.fill();
            ctx.globalAlpha *= 0.3; ctx.fillStyle = `rgb(${tint})`;
            ctx.beginPath(); ctx.moveTo(0, -3.8); ctx.quadraticCurveTo(1.35, -1.2, 0.9, 2.2); ctx.lineTo(-0.9, 2.2); ctx.quadraticCurveTo(-1.35, -1.2, 0, -3.8); ctx.fill();
            ctx.restore();
        }
    }

    // HARBOUR SEAL from above (references, Sep 25): "bottling" — upright in the water with only
    // the head up: a round spotted grey crown, the big dark eyes on its front corners, a paler
    // whiskered muzzle, the V of the nostrils; a ring of water round the neck. Under the water
    // between pop-ups: a dim plump seal-shaped shape, front flippers out, hind flippers
    // together, gliding — the shadow Wes asked for, so you can follow one.
    function drawSealUnder(ctx, s, a) {
        if (a <= 0.02) return;
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.h); ctx.scale(SEAL_BODY, SEAL_BODY);
        ctx.globalAlpha *= a;
        const u = Math.sin(s.bob * 4) * 0.5 * Math.min(1, (s.spd || 0) / 10);
        ctx.fillStyle = 'rgba(32,44,52,0.42)';
        // a cigar: round head on a narrower neck, widest at the chest, tapering to the hips
        ctx.beginPath(); ctx.moveTo(0, -9.4);
        ctx.bezierCurveTo(1.3, -9.3, 1.6, -7.6, 1.3, -6.4);            // the round head
        ctx.quadraticCurveTo(1.2, -5.6, 1.7, -4.6);                    // the neck
        ctx.bezierCurveTo(2.6, -3.4, 2.7, -0.5, 2.3, 1.6);             // chest to belly
        ctx.bezierCurveTo(1.9, 3.8, 1.1, 5.2, 0.6 + u, 6.2);           // hips
        ctx.lineTo(-0.6 + u, 6.2);
        ctx.bezierCurveTo(-1.1, 5.2, -1.9, 3.8, -2.3, 1.6);
        ctx.bezierCurveTo(-2.7, -0.5, -2.6, -3.4, -1.7, -4.6);
        ctx.quadraticCurveTo(-1.2, -5.6, -1.3, -6.4);
        ctx.bezierCurveTo(-1.6, -7.6, -1.3, -9.3, 0, -9.4); ctx.fill();
        // the two hind flippers held together behind, fanning a little as it swims
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 0.3 + u, 6); ctx.quadraticCurveTo(sd * 1.6 + u * 1.5, 7.6, sd * 1.4 + u * 2, 9.4); ctx.lineTo(u * 1.6, 8.6); ctx.closePath(); ctx.fill(); }
        // the fore flippers, small, held back along the chest
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 2.5, -2.2, 0.55, 1.5, sd * 0.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }
    function drawSealHead(ctx, s, a) {
        if (a <= 0.02) return;
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.h); ctx.scale(SEAL_HEAD, SEAL_HEAD);
        ctx.globalAlpha *= a;
        const bob = Math.sin(s.bob * 1.8) * 0.15;
        // the neck in the water: the ring the head sits in, broken, drifting out
        const q = (T * 0.4 + s.i * 0.3) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - q)})`; ctx.lineWidth = 0.35;
        for (const [a0, a1] of [[0.2, 1.5], [1.9, 3.0], [3.4, 4.5], [4.9, 6.0]]) { ctx.beginPath(); ctx.arc(0, 0.6, 3.6 + q * 3, a0, a1); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.ellipse(0, 0.6, 3.3, 3.1, 0, 0, Math.PI * 2); ctx.stroke();
        // a little of the body just below, dark through the water
        ctx.fillStyle = 'rgba(32,44,52,0.35)'; ctx.beginPath(); ctx.ellipse(0, 2.4, 2.6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
        // the crown, and the muzzle standing forward of it (which way it is looking)
        ctx.translate(0, bob);
        ctx.fillStyle = '#8c949a';
        ctx.beginPath(); ctx.moveTo(0, -3.6);
        ctx.bezierCurveTo(1.3, -3.6, 1.7, -2.6, 2.3, -1.4); ctx.bezierCurveTo(2.9, 0, 2.8, 2.6, 1.6, 3.3);
        ctx.quadraticCurveTo(0, 3.9, -1.6, 3.3); ctx.bezierCurveTo(-2.8, 2.6, -2.9, 0, -2.3, -1.4); ctx.bezierCurveTo(-1.7, -2.6, -1.3, -3.6, 0, -3.6); ctx.fill();
        ctx.strokeStyle = 'rgba(40,46,52,0.6)'; ctx.lineWidth = 0.3; ctx.stroke();
        ctx.fillStyle = 'rgba(60,68,74,0.8)';
        for (const [x, y, r] of [[-1, 1.3, 0.28], [0.9, 1.9, 0.24], [0.2, 0.2, 0.22], [-1.6, -0.2, 0.2], [1.5, 0.3, 0.2], [0, 2.6, 0.22]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#c3c7c2'; ctx.beginPath(); ctx.ellipse(0, -2.5, 1.35, 1.25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#16191c';
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 1.55, -0.9, 0.55, 0.65, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#2a2e32'; ctx.lineWidth = 0.28; ctx.beginPath(); ctx.moveTo(-0.45, -3.3); ctx.lineTo(0, -2.8); ctx.lineTo(0.45, -3.3); ctx.stroke();
        ctx.strokeStyle = 'rgba(240,240,236,0.6)'; ctx.lineWidth = 0.14;
        for (const sd of [-1, 1]) for (let w = 0; w < 3; w++) { ctx.beginPath(); ctx.moveTo(sd * 0.9, -2.2 + w * 0.3); ctx.lineTo(sd * (2.4 + w * 0.2), -2.7 + w * 0.5); ctx.stroke(); }
        ctx.restore();
    }
    function drawSeal(ctx, s) {
        // the gliding shape fades out as the head comes up, and back in as it slips under
        if (s.mode === 'under') drawSealUnder(ctx, s, 1);
        else if (s.mode === 'rise') { drawSealUnder(ctx, s, 1 - s.vis); drawSealHead(ctx, s, s.vis); }
        else if (s.mode === 'sink') { drawSealUnder(ctx, s, 1 - s.vis); drawSealHead(ctx, s, s.vis); }
        else drawSealHead(ctx, s, 1);
        if (s.ring > 0) drawRing(ctx, s.x, s.y, s.ring, 5, 16, 0.55);
        if (s.ring2 > 0) drawRing(ctx, s.x, s.y, s.ring2, 4, 12, 0.45);
    }

    // MALLARD DUCKLINGS — the Sailing School's line. js/game/school.js moves them; this draws
    // them. From the drone shots: not rubber-duck yellow but a ball of down, dark olive-brown
    // down the back with the four pale yellow spots (two on the wing stubs, two on the rump),
    // a yellow fringe showing all round the flanks, a round head with a dark crown and yellow
    // cheeks cut by the dark eye stripe, a small dark bill. They swim in a tight file and each
    // pushes its own small V; the Vs braid together behind the line. At rest: a faint ring.
    // Larger than life (~23 units bill to tail) — the first card tells the player to follow them.
    const DUCKLING_SCALE = 1.35;
    // The wake is kept on the duck object from what the draw sees (school.js owns the motion):
    // a point each few units moved, stamped with the sim clock, aged out after ~1.2 s, so a
    // duck that stops lets its V run out behind it and a paused game freezes it.
    function trackDuckling(d, t) {
        const tr = d.trail || (d.trail = []);
        const last = tr[0];
        // a restart (the clock went back) or a teleport to a new section: start clean
        if (last && (last.t > t || Math.hypot(d.x - last.x, d.y - last.y) > 60)) tr.length = 0;
        while (tr.length && t - tr[tr.length - 1].t > 1.2) tr.pop();
        if (!tr.length || Math.hypot(d.x - tr[0].x, d.y - tr[0].y) > 3.5) { tr.unshift({ x: d.x, y: d.y, t }); if (tr.length > 14) tr.pop(); }
        // how much it is swimming, 0..1: a fresh head point means it is moving
        const fresh = tr.length > 1 ? Math.max(0, 1 - (t - tr[0].t) / 0.35) : 0;
        d.swim = (d.swim || 0) + (fresh - (d.swim || 0)) * 0.2;
    }
    function drawDucklings(ctx, ducks) {
        const t = (window.state && state.time) || 0;
        for (const d of ducks) trackDuckling(d, t);
        // all the water first, so no wake crosses the duckling in front of it
        for (const d of ducks) if (d.trail.length > 2) drawWakeTrail(ctx, d, 5, 1.9, 0.45 * Math.max(0.35, d.swim));
        ducks.forEach((d, i) => drawDuckling(ctx, d, t, i));
    }
    function drawDuckling(ctx, d, t, i) {
        const sw = d.swim || 0;
        ctx.save(); ctx.translate(d.x, d.y);
        // at rest: a slow ring breathing out from the bob; swimming: the bow ripple
        const ph = (t * 0.6 + i * 0.37) % 1;
        ctx.save(); ctx.globalAlpha *= 1 - sw;
        drawRing(ctx, 0, 0, 1 - ph, 7, 9, 0.3);
        ctx.restore();
        ctx.rotate(d.h + Math.sin(t * 0.9 + i * 1.7) * 0.06 * (1 - sw));
        ctx.scale(DUCKLING_SCALE, DUCKLING_SCALE);
        // the contact shade: the body sits IN the water
        ctx.fillStyle = 'rgba(8,24,30,0.28)';
        ctx.beginPath(); ctx.ellipse(0.5, 1.8, 5.4, 6.4, 0, 0, Math.PI * 2); ctx.fill();
        if (sw > 0.05) {
            ctx.strokeStyle = `rgba(255,255,255,${0.55 * sw})`; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 2.2, -2.6); ctx.quadraticCurveTo(sd * 5.2, -1.2, sd * 5.8, 2.2); ctx.stroke(); }
        }
        // the feet, paddling behind (dark, small; they flicker when it swims)
        const kick = Math.sin(t * 11 + i * 2) * sw;
        if (sw > 0.05) {
            ctx.fillStyle = `rgba(70,60,40,${0.45 * sw})`;
            for (const sd of [-1, 1]) {
                ctx.save(); ctx.translate(sd * 1.5, 5.6 + (sd > 0 ? kick : -kick) * 0.8); ctx.rotate(sd * 0.3);
                ctx.beginPath(); ctx.ellipse(0, 1.3, 0.8, 1.4, 0, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        }
        // the down: a fuzzy round body, yellow at the fringe
        ctx.beginPath();
        for (let k = 0; k <= 36; k++) {
            const a = k / 36 * Math.PI * 2, fz = 1 + 0.025 * Math.sin(a * 11 + i * 3);
            // a touch broader behind the wings, narrower at the chest
            const x = Math.cos(a) * 4.4 * fz * (1 + 0.08 * Math.sin(a)), y = 1.6 + Math.sin(a) * 5.2 * fz;
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fillStyle = '#e6c653'; ctx.fill();
        ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(60,44,18,0.45)'; ctx.stroke();
        // the dark olive-brown back, ending in a tail nub
        ctx.beginPath(); ctx.moveTo(0, -1.6);
        ctx.bezierCurveTo(3.6, -1.2, 3.8, 5, 0.6, 7.6); ctx.lineTo(-0.6, 7.6);
        ctx.bezierCurveTo(-3.8, 5, -3.6, -1.2, 0, -1.6); ctx.closePath();
        ctx.fillStyle = '#6a5431'; ctx.fill();
        // the four pale spots
        ctx.fillStyle = '#ead27a';
        for (const sd of [-1, 1]) {
            ctx.beginPath(); ctx.ellipse(sd * 2.3, 1.4, 0.75, 1.1, sd * 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(sd * 1.2, 5.0, 0.6, 0.75, 0, 0, Math.PI * 2); ctx.fill();
        }
        // the head, turning a little as it looks about (steadier when swimming)
        ctx.save(); ctx.translate(0, -3.6); ctx.rotate(Math.sin(t * 1.7 + i * 2.3) * (0.28 - 0.18 * sw));
        ctx.beginPath(); ctx.arc(0, -1, 3.0, 0, Math.PI * 2); ctx.fillStyle = '#f0d25c'; ctx.fill();
        ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(60,44,18,0.4)'; ctx.stroke();
        // the dark crown running back into the nape
        ctx.beginPath(); ctx.moveTo(0, -2.6);
        ctx.quadraticCurveTo(1.15, -2.1, 0.9, 1.9); ctx.lineTo(-0.9, 1.9); ctx.quadraticCurveTo(-1.15, -2.1, 0, -2.6); ctx.closePath();
        ctx.fillStyle = '#6a5431'; ctx.fill();
        // the fine eye line back from the bill, and the eye on it
        ctx.strokeStyle = 'rgba(80,60,30,0.75)'; ctx.lineWidth = 0.35; ctx.lineCap = 'round';
        for (const sd of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(sd * 0.9, -3.4); ctx.quadraticCurveTo(sd * 2.2, -2.2, sd * 2.5, -0.6); ctx.stroke();
            ctx.fillStyle = '#1c150e'; ctx.beginPath(); ctx.arc(sd * 2.1, -2.1, 0.42, 0, Math.PI * 2); ctx.fill();
        }
        // the bill
        ctx.beginPath(); ctx.moveTo(-0.9, -3.6); ctx.quadraticCurveTo(-0.9, -5.6, 0, -5.8); ctx.quadraticCurveTo(0.9, -5.6, 0.9, -3.6); ctx.closePath();
        ctx.fillStyle = '#4b4238'; ctx.fill();
        ctx.fillStyle = '#d99a7c'; ctx.beginPath(); ctx.arc(0, -5.3, 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.restore();
    }

    // ── Sockeye Run, drawn ───────────────────────────────────────────────────────────
    // BROWN BEAR from above (references, re-checked Sep 25 against straight-down shots — bears
    // walking away across tundra, one standing in shallow water, one photographed from a
    // slope above, the Katmai fishers): a broad EGG, ~0.6 as wide as it is long, the round
    // haunches the widest part and the shoulders only a little narrower — never a capsule.
    // The head sits straight on the shoulders on a thick neck: a rounded wedge, broad across
    // the big round ears on its back corners, narrowing to a paler blunt muzzle; the eyes
    // barely show from above. Reddish-brown, grizzled golden over the shoulder hump and the
    // head, a darker saddle behind the hump. Standing in the river its flanks are under
    // (dimmed and washed with the water) and only the back is dry. Rearing, from above, it
    // foreshortens to a rounder, shorter shape with its forepaws out and a longer shadow.
    function bearShape(ctx, L) {
        // A GRIZZLY (Wes, Sep 25: "the head should be broader and the hind quarters a bit
        // narrower for grizzlies specifically" — and the ID references agree): the shoulder hump
        // is the heaviest, widest part; the body tapers back to haunches ~0.85 of it; the neck
        // runs out of the shoulders broad and short.
        ctx.beginPath();
        ctx.moveTo(-3.4, -8.0 * L); ctx.quadraticCurveTo(0, -8.6 * L, 3.4, -8.0 * L);   // the broad short neck
        ctx.bezierCurveTo(5.8, -7.4 * L, 7.1, -6.0 * L, 7.1, -3.8 * L);       // out over the shoulder hump
        ctx.bezierCurveTo(7.1, -1.4 * L, 6.0, 1.0 * L, 5.7, 3.6 * L);         // tapering back along the flank
        ctx.bezierCurveTo(5.5, 7.6 * L, 3.3, 9.6 * L, 0, 9.6 * L);            // the lower, smaller rump
        ctx.bezierCurveTo(-3.3, 9.6 * L, -5.5, 7.6 * L, -5.7, 3.6 * L);
        ctx.bezierCurveTo(-6.0, 1.0 * L, -7.1, -1.4 * L, -7.1, -3.8 * L);
        ctx.bezierCurveTo(-7.1, -6.0 * L, -5.8, -7.4 * L, -3.4, -8.0 * L);
        ctx.closePath();
    }
    function bearHead(ctx, detail) {
        // A grizzly's head from above: BROAD — ~0.55 of the shoulders — flat across the crown,
        // the cheek ruff flaring out at the sides; short rounded ears on the outer back
        // corners; the face dishes in to a short blunt muzzle; the eyes barely show.
        ctx.fillStyle = '#b07440';
        ctx.beginPath(); ctx.moveTo(0, 2.5);
        ctx.bezierCurveTo(2.6, 2.6, 3.9, 1.8, 3.9, 0.2);                          // the flat back of the skull, out to the ruff
        ctx.bezierCurveTo(3.9, -1.2, 2.9, -1.9, 1.7, -2.4);                       // the cheek ruff, dishing in
        ctx.quadraticCurveTo(1.3, -2.7, 1.2, -3.0);
        ctx.lineTo(-1.2, -3.0); ctx.quadraticCurveTo(-1.3, -2.7, -1.7, -2.4);
        ctx.bezierCurveTo(-2.9, -1.9, -3.9, -1.2, -3.9, 0.2);
        ctx.bezierCurveTo(-3.9, 1.8, -2.6, 2.6, 0, 2.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#bd8550'; ctx.beginPath(); ctx.moveTo(-1.3, -2.4); ctx.quadraticCurveTo(-1.35, -4.0, 0, -4.2); ctx.quadraticCurveTo(1.35, -4.0, 1.3, -2.4); ctx.closePath(); ctx.fill();
        // the ears, short and round, standing on the skull's back corners (on top of the ruff)
        for (const sd of [-1, 1]) {
            ctx.fillStyle = '#6e4626'; ctx.beginPath(); ctx.arc(sd * 2.75, 2.0, 0.9, 0, Math.PI * 2); ctx.fill();
            if (detail) { ctx.fillStyle = 'rgba(47,32,22,0.55)'; ctx.beginPath(); ctx.ellipse(sd * 2.7, 1.75, 0.45, 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
        }
        if (!detail) return;
        // the grizzled crown and the paler tips of the ruff
        const crown = ctx.createRadialGradient(0, 0.5, 0.2, 0, 0.5, 3.4);
        crown.addColorStop(0, 'rgba(225,160,95,0.65)'); crown.addColorStop(1, 'rgba(225,160,95,0)');
        ctx.fillStyle = crown; ctx.beginPath(); ctx.arc(0, 0.5, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(215,170,120,0.45)'; ctx.lineWidth = 0.25; ctx.lineCap = 'round';
        for (const sd of [-1, 1]) for (const [y, d] of [[-0.9, 0.5], [0, 0.6], [0.9, 0.5]]) { ctx.beginPath(); ctx.moveTo(sd * 3.5, y); ctx.lineTo(sd * (3.5 + d), y + 0.3); ctx.stroke(); }
        ctx.fillStyle = '#2a1d15'; ctx.beginPath(); ctx.ellipse(0, -3.95, 0.5, 0.3, 0, 0, Math.PI * 2); ctx.fill();
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 1.35, -1.6, 0.22, 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    function drawBear(ctx, B) {
        const rear = B.rear, lunge = B.mode === 'lunge' ? Math.sin(Math.PI * B.lunge) : 0;
        const L = 1 - rear * 0.36 + lunge * 0.1;
        const k = BEAR_SCALE;
        // How hard the stream runs here decides the water round it (references: a bear in the
        // current throws white; one fishing a slack pool sits in calm rings, no foam at all).
        if (B.kn === undefined) { const c = (typeof getCurrentAt === 'function') ? getCurrentAt(B.hx, B.hy) : null; B.kn = c ? c.speed : 0; }
        const flow = Math.max(0, Math.min(1, (B.kn - 0.8) / 2));
        // In the stream's own frame (downstream is +y): the wash off its legs — a soft fading
        // sheet, the two arms of the V peeling off the haunches, short crests drifting down.
        if (flow > 0.05) {
            ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.up); ctx.scale(k, k);
            const g = ctx.createLinearGradient(0, 6, 0, 28);
            g.addColorStop(0, `rgba(255,255,255,${0.2 * flow})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(6, 6); ctx.lineTo(11, 28); ctx.lineTo(-11, 28); ctx.closePath(); ctx.fill();
            ctx.lineCap = 'round';
            for (const sd of [-1, 1]) for (let i = 0; i < 8; i++) {
                const q0 = i / 8, q1 = (i + 1) / 8, pt = (q) => [sd * (6.4 + 1.8 * q + 2.8 * q * q), 5 + 22 * q];
                const [x0, y0] = pt(q0), [x1, y1] = pt(q1), f = 1 - q0;
                ctx.strokeStyle = `rgba(255,255,255,${0.16 * flow * f})`; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
                ctx.strokeStyle = `rgba(255,255,255,${0.55 * flow * f * f})`; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
            }
            for (let r = 0; r < 3; r++) {
                const u = (T * 0.8 + r / 3 + B.i * 0.2) % 1, y = 11 + u * 13, w = 3.5 + u * 5;
                ctx.strokeStyle = `rgba(255,255,255,${0.35 * flow * (1 - u)})`; ctx.lineWidth = 0.7;
                ctx.beginPath(); ctx.moveTo(-w, y + 1.4); ctx.quadraticCurveTo(0, y - 1, w, y + 1.4); ctx.stroke();
            }
            ctx.restore();
        }
        // slow rings breathing out from where it stands, broken and uneven
        for (let r = 0; r < 3; r++) {
            const u = (T * 0.22 + r / 3 + B.i * 0.3) % 1;
            ctx.strokeStyle = `rgba(255,255,255,${0.32 * (1 - u) * (1 - flow * 0.6)})`; ctx.lineWidth = 1.1;
            for (const [a0, a1] of [[0.2, 1.3], [1.7, 2.9], [3.3, 4.4], [4.8, 6.0]]) { ctx.beginPath(); ctx.ellipse(B.x, B.y, (15 + u * 22) * k * 0.5, (17 + u * 24) * k * 0.5, B.h, a0, a1); ctx.stroke(); }
        }
        // its shadow, down-right; longer when it stands up
        const sh = 2.5 + rear * 7;
        ctx.save(); ctx.translate(B.x + sh * 0.35 * k, B.y + sh * 0.55 * k); ctx.rotate(B.h); ctx.scale(k, k);
        ctx.fillStyle = 'rgba(10,25,30,0.22)'; bearShape(ctx, L); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -8.3 * L - 1.4, 3.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.h); ctx.scale(k, k);
        // forepaws: out in front when it rears, reaching when it lunges
        if (rear > 0.15 || lunge > 0.1) {
            ctx.fillStyle = '#4e3421';
            const py = -8.2 * L - 0.8 - lunge * 2.6, spread = 3.9 + rear * 0.6;
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * spread, py, 1.4, 1.8, sd * 0.2, 0, Math.PI * 2); ctx.fill(); }
            ctx.strokeStyle = 'rgba(235,225,200,0.8)'; ctx.lineWidth = 0.25;
            for (const sd of [-1, 1]) for (let c2 = -1; c2 <= 1; c2++) { ctx.beginPath(); ctx.moveTo(sd * spread + c2 * 0.55, py - 1.5); ctx.lineTo(sd * spread + c2 * 0.6, py - 2.2); ctx.stroke(); }
        }
        // Standing in the shallows (the reference standing in shallow water shows the whole body
        // plainly): the body out of the water, only a rim along its sides dimmed where the
        // water laps its flanks.
        // ⚠️ No clip ellipse for the "dry back": an ellipse is widest mid-body, so it trimmed the
        // shoulders into the water and turned the grizzly back into an egg, whatever the outline
        // said (found by measuring the silhouette, Sep 25). The wet line is a rim that follows
        // the outline itself, drawn after the coat.
        ctx.save(); bearShape(ctx, L); ctx.clip();
        // (colours sampled off the overhead reference: body #5d3c2e, the spine #3c180b, the
        // crown #d18b4e) — a dark red-brown coat, grizzled a little lighter on the flanks
        bearShape(ctx, L); ctx.fillStyle = '#5b3826'; ctx.fill();
        const flank = ctx.createRadialGradient(0, 3 * L, 2, 0, 3 * L, 8);
        flank.addColorStop(0, 'rgba(120,80,56,0)'); flank.addColorStop(1, 'rgba(120,80,56,0.35)');
        ctx.fillStyle = flank; bearShape(ctx, L); ctx.fill();
        // the golden cape: over the neck and the fronts of the shoulders, fading back
        const cape = ctx.createRadialGradient(0, -6.5 * L, 0.5, 0, -4.5 * L, 7);
        cape.addColorStop(0, 'rgba(206,140,78,0.95)'); cape.addColorStop(0.55, 'rgba(180,118,64,0.55)'); cape.addColorStop(1, 'rgba(160,100,56,0)');
        ctx.fillStyle = cape; bearShape(ctx, L); ctx.fill();
        // the long dark streak down the spine, from behind the shoulders to the rump
        // (soft-edged: a radial falloff stretched along the spine, darkest at the withers)
        ctx.save(); ctx.translate(0, -1.2 * L); ctx.scale(1, 3.2 * L);
        const spine = ctx.createRadialGradient(0, 0.2, 0.1, 0, 0.5, 2.4);
        spine.addColorStop(0, 'rgba(46,20,10,0.7)'); spine.addColorStop(0.5, 'rgba(46,20,10,0.32)'); spine.addColorStop(1, 'rgba(46,20,10,0)');
        ctx.fillStyle = spine; ctx.beginPath(); ctx.arc(0, 0.5, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // the wet line: where the water laps its flanks, a soft darker, water-washed rim
        ctx.save(); ctx.globalAlpha *= 0.4 * (1 - rear); ctx.strokeStyle = `rgb(${waterTint()})`; ctx.lineWidth = 1.6; bearShape(ctx, L); ctx.stroke(); ctx.restore();
        // grizzled: pale fur tips scattered over the coat, lying back along the body
        ctx.strokeStyle = 'rgba(190,140,95,0.2)'; ctx.lineWidth = 0.26; ctx.lineCap = 'round';
        const hsh = (n) => { const t = Math.sin(n * 127.1) * 43758.5453; return t - Math.floor(t); };   // independent per axis, so no rows
        for (let i = 0; i < 26; i++) {
            const u = hsh(i + 1.3) * 2 - 1, v = hsh(i * 3.7 + 9.1);
            const y = (-4 + v * 13) * L, x = u * (4.2 + 2.2 * Math.min(1, (y + 4) / 8));
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + u * 0.25, y + 0.9); ctx.stroke();
        }
        ctx.restore();
        // foam where the water meets its sides — as much as the stream makes: heaped on the
        // upstream shoulder in current, a clean thin waterline in a slack pool
        ctx.save(); ctx.globalAlpha *= (1 - rear) * (0.35 + 0.65 * flow); ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, -0.8, 6.9, 8.4 * L, 0, Math.PI * 1.22, Math.PI * 1.78); ctx.stroke();
        for (const sd of [-1, 1]) for (const [y0, y1, a] of [[-3.2, 0.8, 0.5], [2, 5, 0.35], [6.2, 8.6, 0.22]]) {
            const w = (T * 1.3 + y0 * 0.3 + sd) % 1;
            ctx.strokeStyle = `rgba(255,255,255,${a * (0.7 + 0.3 * Math.sin(w * 6.283))})`; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(sd * (6.0 + (y0 + 4) * 0.1), y0 * L); ctx.quadraticCurveTo(sd * 7.3, (y0 + y1) / 2 * L, sd * (6.8 + (y1 + 4) * 0.05), y1 * L); ctx.stroke();
        }
        ctx.restore();
        // the head, straight on the shoulders, turned to whatever it watches; down to eat
        ctx.save(); ctx.translate(0, -8.3 * L - (B.mode === 'eat' ? 0.2 : 0.9)); ctx.rotate(B.look * (1 - lunge));
        if (B.fish > 0) {
            // a sockeye held crosswise in its jaws, drawn FIRST so the snout lies over its middle
            // (Wes, Sep 25): the olive head out one side, the tail flapping out the other
            ctx.save(); ctx.translate(0, -3.0); ctx.rotate(Math.PI / 2 + Math.sin(T * 9) * 0.15);
            ctx.fillStyle = SOCKEYE.body; ctx.beginPath(); ctx.ellipse(0, 0, 0.9, 3.4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = SOCKEYE.head; ctx.beginPath(); ctx.ellipse(0, -2.6, 0.8, 1.1, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = SOCKEYE.tail; ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(-1, 4.4 + Math.sin(T * 12) * 0.4); ctx.lineTo(1, 4.4 - Math.sin(T * 12) * 0.4); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        bearHead(ctx, true);
        ctx.restore();
        ctx.restore();
        // the lunge's splash, thrown out ahead of it
        if (B.splash > 0) {
            const [fx, fy] = fwd(B.h), d = 18 * k;
            drawFishSplash(ctx, B.x + fx * d, B.y + fy * d, B.splash, 1.1, B.i + 3);
        }
    }

    // SOCKEYE from above (references): bright red spindles with olive-green heads and darker
    // forked tails, strung out along the stream and all nosed into it; seen through the water,
    // so washed with its colour, each with a faint shadow on the gravel under it.
    function sockeyeShape(ctx) {
        ctx.beginPath(); ctx.moveTo(0, -4.6); ctx.quadraticCurveTo(1.35, -2.6, 1.1, 1.2); ctx.quadraticCurveTo(0.8, 3.2, 0, 3.6); ctx.quadraticCurveTo(-0.8, 3.2, -1.1, 1.2); ctx.quadraticCurveTo(-1.35, -2.6, 0, -4.6); ctx.closePath();
    }
    function drawSockeye(ctx, x, y, h, size, w, veil, dull) {
        const s = SOCKEYE_LEN / 10 * size;
        ctx.save(); ctx.translate(x + 2.4, y + 3.6); ctx.rotate(h); ctx.scale(s, s);
        ctx.fillStyle = 'rgba(10,20,20,0.18)'; sockeyeShape(ctx); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(s, s);
        // (references: most flushed red, a few still dull olive-grey, all with the dark head)
        ctx.fillStyle = dull ? SOCKEYE.silver : SOCKEYE.body; sockeyeShape(ctx); ctx.fill();
        // the head, gill to snout, with the darker crown down its middle and the pale jaw tip
        ctx.fillStyle = dull ? SOCKEYE.silverHead : SOCKEYE.head; ctx.beginPath(); ctx.moveTo(0, -4.6); ctx.quadraticCurveTo(1.25, -3, 1.1, -1.7); ctx.quadraticCurveTo(0, -1.2, -1.1, -1.7); ctx.quadraticCurveTo(-1.25, -3, 0, -4.6); ctx.fill();
        if (!dull) { ctx.fillStyle = SOCKEYE.crown; ctx.beginPath(); ctx.ellipse(0, -2.9, 0.45, 1.3, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = SOCKEYE.jaw; ctx.beginPath(); ctx.ellipse(0, -4.35, 0.32, 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = dull ? SOCKEYE.silverTail : SOCKEYE.tail; ctx.beginPath(); ctx.moveTo(0, 3.2); ctx.lineTo(-1.3 + w, 5.4); ctx.lineTo(0, 4.6); ctx.lineTo(1.3 + w, 5.4); ctx.closePath(); ctx.fill();
        if (veil > 0) { ctx.globalAlpha *= veil; ctx.fillStyle = `rgb(${waterTint()})`; sockeyeShape(ctx); ctx.fill(); }
        ctx.restore();
    }
    function drawRun(ctx, G) {
        for (const f of G.fish) drawSockeye(ctx, f.x, f.y, f.h, f.size, Math.sin(f.ph * 3) * 0.3, 0.28, f.dull);
    }

    // BALD EAGLE from above (references, re-checked Sep 25 against 40+ soaring shots): a long
    // broad wing, widest across the secondaries a third of the way out, with a softly scalloped
    // trailing edge; SIX separate primaries at the tip, slotted, fanning from pointing forward
    // to swept back; the white head a wedge thrust well forward on its neck, carrying a heavy
    // hooked yellow bill; a broad, rounded white tail fan about as long as the head projects;
    // dark chocolate flight feathers with the inner wing's coverts a shade paler. Stooping,
    // the wings fold back; climbing with a fish, it beats hard, the salmon in its yellow feet.
    // Its shadow on the water is this same shape.
    function eagleWing(ctx, sd, fold, beat) {
        const S = 17.5 * (1 - fold * 0.45) * (1 - beat * 0.12), sw = fold * 5 + beat * 1.2;
        const Y = (x, y) => y + sw * (x / S);                                     // fold sweeps the wing back
        const P = (x, y) => [sd * x, Y(x, y)];
        // the arm and the hand, as one outline: leading edge out to the finger bases, the
        // finger bases down the tip, then the trailing edge home in soft scallops
        ctx.beginPath();
        ctx.moveTo(...P(1.3, -1.9));
        ctx.quadraticCurveTo(...P(S * 0.4, -3.1), ...P(S * 0.5, -3.0));           // up to the wrist
        ctx.quadraticCurveTo(...P(S * 0.66, -2.9), ...P(S * 0.76, -2.4));         // the hand's leading edge
        ctx.lineTo(...P(S * 0.75, 1.9));                                          // the finger bases
        const n = 8;
        for (let i = 1; i <= n; i++) {                                            // the secondaries, scalloped
            const q = i / n, x = S * 0.75 + (1.4 - S * 0.75) * q;
            const bulge = Math.sin(Math.min(1, q * 1.25) * Math.PI) * 1.6;        // broadest a third of the way out
            const y = 1.9 + (2.6 - 1.9) * q + bulge;
            const xm = x + (S * 0.75 - 1.4) / n * 0.5, ym = y + 0.15;
            ctx.quadraticCurveTo(...P(xm, ym), ...P(x, y));
        }
        ctx.closePath(); ctx.fill();
        // the six fingers: tapered, separate, fanning
        for (let f = 0; f < 6; f++) {
            const q = f / 5, bx = S * (0.76 - q * 0.02), by = -2.2 + q * 3.9;
            const a = (-0.32 + q * 0.62) + fold * 0.5, L = S * (0.2 + 0.05 * Math.sin(q * Math.PI)) * (1 - fold * 0.35);
            const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L, w = 0.34;
            const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
            ctx.beginPath(); ctx.moveTo(...P(bx - nx * 1.3, by - ny * 1.3)); ctx.lineTo(...P(tx, ty)); ctx.lineTo(...P(bx + nx * 1.3, by + ny * 1.3)); ctx.closePath(); ctx.fill();
        }
        return { S, sw, P };
    }
    function eagleShape(ctx, fold, beat, detail) {
        const fill = ctx.fillStyle;
        for (const sd of [-1, 1]) {
            ctx.fillStyle = fill; const W = eagleWing(ctx, sd, fold, beat);
            if (detail) {
                // the paler coverts over the inner wing's leading half
                ctx.fillStyle = 'rgba(120,88,58,0.45)';
                ctx.beginPath(); ctx.moveTo(...W.P(1.4, -1.6)); ctx.quadraticCurveTo(...W.P(W.S * 0.4, -2.8), ...W.P(W.S * 0.5, -2.7));
                ctx.quadraticCurveTo(...W.P(W.S * 0.45, -0.6), ...W.P(W.S * 0.25, 0.4)); ctx.quadraticCurveTo(...W.P(W.S * 0.1, 0.6), ...W.P(1.4, 0.6)); ctx.closePath(); ctx.fill();
                // a few feather lines across the flight feathers
                ctx.strokeStyle = 'rgba(20,12,6,0.35)'; ctx.lineWidth = 0.18;
                for (let i = 1; i < 7; i++) { const x = 1.4 + (W.S * 0.72 - 1.4) * i / 7; ctx.beginPath(); ctx.moveTo(...W.P(x, 0.5)); ctx.lineTo(...W.P(x + 0.15 * sd, 2.4 + Math.sin(i / 7 * Math.PI) * 1.2)); ctx.stroke(); }
            }
        }
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.ellipse(0, 0.6, 1.95, 4.6, 0, 0, Math.PI * 2); ctx.fill();                   // body
        // neck and head, thrust forward
        ctx.beginPath(); ctx.moveTo(-1.25, -2.8); ctx.quadraticCurveTo(-1.35, -5.4, -0.6, -6.3); ctx.quadraticCurveTo(0, -6.7, 0.6, -6.3); ctx.quadraticCurveTo(1.35, -5.4, 1.25, -2.8); ctx.closePath(); ctx.fill();
        // the tail: a broad rounded fan
        ctx.beginPath(); ctx.moveTo(-1.1, 4); ctx.lineTo(-2.7, 8.2); ctx.quadraticCurveTo(0, 9.6, 2.7, 8.2); ctx.lineTo(1.1, 4); ctx.closePath(); ctx.fill();
    }
    function drawEagle(ctx, E) {
        const k = EAGLE_SCALE, fold = E.mode === 'stoop' ? 1 : E.mode === 'grab' ? 0.4 : 0;
        const beat = E.mode === 'climb' || E.mode === 'grab' ? Math.max(0, Math.sin(E.flap)) : Math.max(0, Math.sin(E.flap)) * 0.15;
        // Its shadow on the water (Wes, Sep 25: "make sure the eagle casts a shadow"): its own
        // silhouette, down-right. Height pushes it out, but only so far — at a true 105 u it
        // fell 60 u off and at 7% was never seen — and it stays dark enough to read: ~16% at
        // soaring height, ~24% as it comes down to the water.
        const z = E.z, zo = Math.min(z, 55);
        ctx.save(); ctx.translate(E.x + zo * 0.35, E.y + zo * 0.55); ctx.rotate(E.h); ctx.scale(k * 0.97, k * 0.97);
        ctx.fillStyle = `rgba(10,22,26,${0.16 + 0.08 * Math.max(0, 1 - z / 105)})`; eagleShape(ctx, fold, beat, false);
        ctx.restore();
        if (E.splash > 0) { drawFishSplash(ctx, E.sx, E.sy, E.splash, 2.4, E.i + 11); drawRing(ctx, E.sx, E.sy, E.splash, 6, 24, 0.55); }
        ctx.save(); ctx.translate(E.x, E.y); ctx.rotate(E.h); ctx.scale(k, k);
        if (E.fish > 0) {
            // the salmon hangs head-first under the body, gripped in its yellow feet
            ctx.save(); ctx.translate(0, 3.2); ctx.rotate(Math.sin(T * 5) * 0.12); ctx.globalAlpha *= Math.min(1, E.fish * 4);
            ctx.fillStyle = SOCKEYE.body; ctx.beginPath(); ctx.ellipse(0, 1.5, 0.75, 2.8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = SOCKEYE.head; ctx.beginPath(); ctx.ellipse(0, -0.8, 0.6, 0.9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e8b930'; for (const [fx, fy] of [[-0.55, 0.2], [0.55, 2.4]]) { ctx.beginPath(); ctx.ellipse(fx, fy, 0.55, 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore();
        }
        ctx.fillStyle = '#3a2718'; eagleShape(ctx, fold, beat, true);
        // the white head and neck, the heavy hooked yellow bill
        ctx.fillStyle = '#f5f3ec';
        ctx.beginPath(); ctx.moveTo(-1.2, -3.4); ctx.quadraticCurveTo(-1.3, -5.4, -0.6, -6.3); ctx.quadraticCurveTo(0, -6.7, 0.6, -6.3); ctx.quadraticCurveTo(1.3, -5.4, 1.2, -3.4); ctx.quadraticCurveTo(0, -2.7, -1.2, -3.4); ctx.fill();
        ctx.fillStyle = '#efbf2e'; ctx.beginPath(); ctx.moveTo(-0.5, -6.1); ctx.quadraticCurveTo(-0.45, -7.4, 0, -7.9); ctx.quadraticCurveTo(0.45, -7.4, 0.5, -6.1); ctx.closePath(); ctx.fill();
        // the white tail fan, feathers just marked
        ctx.fillStyle = '#f5f3ec'; ctx.beginPath(); ctx.moveTo(-1.05, 4.6); ctx.lineTo(-2.6, 8.2); ctx.quadraticCurveTo(0, 9.5, 2.6, 8.2); ctx.lineTo(1.05, 4.6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(150,140,120,0.5)'; ctx.lineWidth = 0.15;
        for (const t of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.moveTo(t * 1.2, 4.9); ctx.lineTo(t * 3.4, 8.6 + (1 - Math.abs(t)) * 0.4); ctx.stroke(); }
        ctx.restore();
    }

    // RIVER OTTER from above (references): long and low, dark brown and wet-sleek, a small flat
    // head with a paler muzzle, the thick tail tapering to a point. Swimming, only the head and
    // a line of back are out — the rest a dim shape under — with a bow wave off the chin and a
    // V behind; porpoising, it arcs under and comes up again. Lying up on the logjam, it is a
    // loose curl in the sun.
    function otterShape(ctx, bend, curl) {
        // the spine as a curve; curl bends it round (0 straight .. 1 a loose C)
        const pts = [];
        for (let i = 0; i <= 10; i++) {
            const s = i / 10, a = (s - 0.35) * (bend + curl * 1.2);
            pts.push({ x: Math.sin(a) * (s - 0.35) * 6 * (0.3 + curl), y: -7 + s * 16 });
        }
        // a thick neck straight into a long, heavy body; the tail thick at the root, tapering
        // (references, from above: head barely narrower than the body, the body an even tube, the
        // thick tail tapering over its last third)
        const wAt = (s) => s < 0.1 ? 2.1 + s * 4 : s < 0.64 ? 2.5 : Math.max(0.3, 2.1 * (1 - (s - 0.64) / 0.36) + 0.3);
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) ctx.lineTo(pts[i].x + wAt(i / 10), pts[i].y);
        for (let i = 10; i >= 0; i--) ctx.lineTo(pts[i].x - wAt(i / 10), pts[i].y);
        ctx.closePath();
        return pts;
    }
    function drawOtter(ctx, m, onJam) {
        const k = OTTER_SCALE * m.size;
        const bend = onJam ? 0 : Math.sin((m.trailT + m.i) * 3) * 0.25, curl = onJam ? m.curl : 0;
        const under = onJam ? 0 : Math.sin(Math.PI * (m.dip || 0));
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(onJam ? m.rh : m.h); ctx.scale(k, k);
        if (onJam) { ctx.fillStyle = 'rgba(10,20,15,0.25)'; ctx.save(); ctx.translate(0.8, 1.2); otterShape(ctx, 0, curl); ctx.fill(); ctx.restore(); }
        // under the water: the whole animal as one dim shape
        ctx.globalAlpha *= onJam ? 1 : 0.62 + 0.25 * (1 - under);
        ctx.fillStyle = onJam ? '#5a3d2a' : '#5b4331';
        const pts = otterShape(ctx, bend, curl); ctx.fill();
        if (!onJam) { ctx.save(); ctx.globalAlpha *= 0.3; ctx.fillStyle = `rgb(${waterTint()})`; otterShape(ctx, bend, curl); ctx.fill(); ctx.restore(); }
        ctx.globalAlpha = onJam ? ctx.globalAlpha : ctx.globalAlpha / (0.62 + 0.25 * (1 - under)) * (1 - under * 0.85);
        // out of the water (or on the jam): the head and the line of the back, crisp and wet
        if (onJam) {
            // lying up: the four short legs out at the sides
            ctx.fillStyle = '#3e2a1d';
            for (const [i, sd] of [[2, -1], [2, 1], [6, -1], [6, 1]]) { ctx.beginPath(); ctx.ellipse(pts[i].x + sd * 2.6, pts[i].y + 0.3, 0.75, 0.55, sd * 0.4, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.fillStyle = '#5e4330';
        ctx.beginPath(); ctx.ellipse(pts[0].x, -6.4, 2.15, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8c7862'; ctx.beginPath(); ctx.ellipse(pts[0].x, -7.9, 1.25, 0.9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1b1410'; ctx.beginPath(); ctx.ellipse(pts[0].x, -8.55, 0.45, 0.32, 0, 0, Math.PI * 2); ctx.fill();
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(pts[0].x + sd * 1.05, -6.9, 0.28, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#5a3f2c'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(pts[0].x + sd * 1.85, -5.5, 0.45, 0, Math.PI * 2); ctx.fill(); }
        // (references: plain wet brown fur — on the log dull and dry-looking, paler at the face;
        // swimming, a short glint where the back breaks the surface)
        if (!onJam) { ctx.strokeStyle = 'rgba(225,238,240,0.45)'; ctx.lineWidth = 0.5; ctx.lineCap = 'round';
            ctx.beginPath(); for (let i = 2; i <= 4; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); }
        else { ctx.fillStyle = 'rgba(40,26,16,0.28)'; ctx.beginPath(); for (let i = 1; i <= 7; i++) ctx.lineTo(pts[i].x - 0.8, pts[i].y); for (let i = 7; i >= 1; i--) ctx.lineTo(pts[i].x + 0.8, pts[i].y); ctx.fill(); }
        ctx.restore();
        if (!onJam && under < 0.6) {
            // the bow wave off its chin
            const [fx, fy] = fwd(m.h), hx = m.x + fx * 7 * k, hy = m.y + fy * 7 * k;
            ctx.save(); ctx.translate(hx, hy); ctx.rotate(m.h);
            // the crescent pushed up ahead of the chin, then the two arms of the V off it
            ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - under)})`; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(0, 3, 4.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${0.3 * (1 - under)})`; ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.arc(0, 3.4, 5.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
            ctx.restore();
        }
        if (m.ring > 0) drawRing(ctx, m.x, m.y, m.ring, 5, 16, 0.5);
    }

    // ── Bluewater Bonanza, drawn ─────────────────────────────────────────────────────────
    // HUMPBACK from above (references, Sep 25 2026 — drone shots of travelling pods, mothers and
    // calves, blows, breaches, lobtails and pec slaps): a long dark spindle, widest a third of
    // the way back, narrowing to a slim tail stock and wide notched flukes with a scalloped
    // trailing edge; a broad flat head with knobbly tubercles; and the famous FLIPPERS — a third
    // of the body long, white, scalloped, swept back — which glow through the water long after
    // the dark body has faded into it. The calf is small and paler and rides tight at her side.
    // THE SWIM (Wes, Sep 25: "the whale tail and fins don't move at all"). A humpback swims with
    // slow up-and-down strokes of its flukes: seen from above the flukes FORESHORTEN as they rise
    // and fall, the tail stock flexes, the rear third of the body follows a little; the long
    // flippers scull. _W holds the pose for the whale being drawn (set per frame in drawWhale):
    //   bend  lateral flex of the rear body, as a fraction of L at the tail
    //   fore  fluke foreshortening, 0.45 (edge-on, top/bottom of the stroke) .. 1 (flat)
    let _W = { bend: 0, fore: 1 };
    const WHALE_PROFILE = [[-0.5, 0], [-0.495, 0.03], [-0.48, 0.05], [-0.45, 0.07], [-0.4, 0.088], [-0.32, 0.105], [-0.22, 0.12], [-0.12, 0.13], [0, 0.125],
        [0.1, 0.105], [0.18, 0.08], [0.26, 0.055], [0.33, 0.035], [0.37, 0.026], [0.4, 0.022]];
    const _wx = (u) => _W.bend * Math.pow(Math.max(0, (u + 0.05) / 0.45), 2);          // centreline offset / L
    function whaleShape(ctx, L) {
        ctx.beginPath();
        for (const [u, w] of WHALE_PROFILE) ctx.lineTo((_wx(u) + w) * L, u * L);
        for (let k = WHALE_PROFILE.length - 1; k >= 0; k--) { const [u, w] = WHALE_PROFILE[k]; ctx.lineTo((_wx(u) - w) * L, u * L); }
        ctx.closePath();
    }
    function whaleFlukes(ctx, L, spread) {
        // hung on the end of the (flexed) tail stock, turned with it, foreshortened by the stroke
        const ang = Math.atan2(_wx(0.4) - _wx(0.36), 0.04), tx = _wx(0.4) * L;
        ctx.save(); ctx.translate(tx, L * 0.39); ctx.rotate(-ang * 1.1); ctx.scale(1, _W.fore); ctx.translate(0, -L * 0.39);
        const w = L * 0.2 * spread;
        ctx.beginPath(); ctx.moveTo(0, L * 0.39);
        ctx.quadraticCurveTo(w * 0.55, L * 0.385, w, L * 0.455);
        for (let k = 1; k <= 5; k++) ctx.lineTo(w * (1 - k / 5) + (k % 2 ? 1.5 : 0), L * 0.48 - (k % 2 ? 1 : 0));
        ctx.lineTo(0, L * 0.455);
        for (let k = 5; k >= 1; k--) ctx.lineTo(-w * (1 - k / 5) - (k % 2 ? 1.5 : 0), L * 0.48 - (k % 2 ? 1 : 0));
        ctx.lineTo(-w, L * 0.46); ctx.quadraticCurveTo(-w * 0.6, L * 0.4, 0, L * 0.39); ctx.closePath();
        ctx.restore();
    }
    function whaleFlipper(ctx, L, sd, out) {
        // swept back along the flank; `out` swings it out square (a pec slap)
        // (Wes's drone references: held well OUT from the body, 50-80° off its axis, a broad
        // paddle with a knobbly leading edge — not swept back along the flank)
        ctx.save(); ctx.translate(sd * L * 0.1 + _wx(-0.22) * L, -L * 0.22); ctx.rotate(-sd * (Math.PI / 2 - 0.35 - out * 0.35));
        const fl = L * 0.31, wd = L * 0.052;
        ctx.beginPath(); ctx.moveTo(-sd * wd * 0.7, 0);
        for (let k = 0; k <= 8; k++) { const u = k / 8; ctx.lineTo(-sd * (wd * (1 - u * 0.35) + (k % 2 ? 1.6 : 0)), u * fl); }   // the knobbly leading edge
        ctx.quadraticCurveTo(-sd * wd * 0.3, fl + 5, sd * wd * 0.2, fl * 0.95);   // the rounded tip
        ctx.quadraticCurveTo(sd * wd * 0.35, fl * 0.5, sd * wd * 0.45, 0); ctx.closePath();
        ctx.restore();
    }
    function drawWhale(ctx, m) {
        // (Wes, Sep 25: "the whales don't look like they are swimming and have too much of their
        // bodies exposed". References: a surfacing humpback is mostly a pale shape SEEN THROUGH the
        // water; only a strip of back rolls out — head and blowholes first, then the back and the
        // small dorsal, then gone — in a rim of white water; and the flukes keep beating.)
        const L = m.len, tint = waterTint();
        const lift = m.lift || 0, roll = m.roll || 0, fl = m.fluke || 0;
        const under = m.mode === 'under';
        const beat = Math.sin(m.ph * 2.2 + m.j);                          // the fluke stroke, ~3 s a cycle
        const turn = Math.max(-1, Math.min(1, (m.turn || 0) * 3));
        _W = { bend: 0.035 * Math.sin(m.ph * 2.2 + m.j - 0.9) + 0.05 * turn, fore: m.mode === 'dive' || m.ev ? 1 : 0.45 + 0.55 * Math.abs(Math.cos(m.ph * 2.2 + m.j)) };
        const scull = (sd) => 0.45 * Math.sin(m.ph * 1.1 + m.j + sd * 0.6) - 0.1;       // the flippers' slow sweep
        const out = lift > 0.02 || m.ev === 'feed' || (m.ev === 'breach' && roll > 0.05);   // a whole-body event (a pec slap lies at the surface)
        const depth = under ? m.depth : out ? 0 : 0.35;                     // at the surface it lies just under
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h);
        const sc = 1 + lift * 0.12; ctx.scale(sc, sc);
        if (lift > 0) { ctx.save(); ctx.translate(L * 0.1 * lift, L * 0.16 * lift); ctx.fillStyle = 'rgba(10,25,40,0.25)'; whaleShape(ctx, L); ctx.fill(); ctx.restore(); }
        // the whole animal under the water: flippers (turquoise), body (dark), flukes beating
        const body = (a) => {
            ctx.globalAlpha = a;
            for (const sd of [-1, 1]) { const raised = m.ev === 'pecslap' && sd === m.sd;
                ctx.fillStyle = raised && (m.fin || 0) > 0.2 ? '#f4f7f8' : (out ? '#e8eef0' : '#8fe0dc'); whaleFlipper(ctx, L, sd, raised ? roll * 0.9 : scull(sd)); ctx.fill(); }
            whaleShape(ctx, L); ctx.fillStyle = m.calf ? '#58646e' : '#2c343c'; ctx.fill();
            whaleFlukes(ctx, L, 1); ctx.fill();
            // the flukes' pale underside flashes at the top of each upstroke
            if (!out && beat > 0.6) { ctx.save(); ctx.globalAlpha *= (beat - 0.6) * 1.2; ctx.fillStyle = '#b7c6cc'; whaleFlukes(ctx, L, 0.9); ctx.fill(); ctx.restore(); }
        };
        if (!out) {
            body(1);
            // the water between us and it: deeper = bluer and fainter; the flippers glow through
            ctx.globalAlpha = 0.42 + depth * 0.45; ctx.fillStyle = `rgb(${tint})`; whaleShape(ctx, L); ctx.fill();
            whaleFlukes(ctx, L, 1); ctx.fill();
            ctx.globalAlpha = 0.22 * (1 - depth); ctx.fillStyle = '#b8f0ea'; for (const sd of [-1, 1]) { whaleFlipper(ctx, L, sd, scull(sd)); ctx.fill(); }
            // light playing on the back through the water: a soft paler spine, a knot of knobs at the head
            ctx.globalAlpha = 0.18 * (1 - depth); ctx.fillStyle = '#cfe9ee'; ctx.beginPath(); ctx.ellipse(0, -L * 0.1, L * 0.04, L * 0.3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            // THE ROLL: a window of back breaking the surface, sliding head -> tail over 3 s
            const p = (m.mode === 'surface' && m.rollT != null) ? m.rollT / 3 : m.mode === 'dive' ? 0.55 + (1 - m.t / 3.2) * 0.45 : 2;
            if (p >= 0 && p <= 1) {
                const c = -L * 0.42 + p * L * 0.74, half = L * 0.24 * Math.sin(Math.PI * Math.min(1, p * 1.15 + 0.08));
                // the part out of the water is a rounded crest of back: the body's own outline cut
                // by an ellipse along the spine — never square ends
                const wx = L * 0.1;
                const wash = ctx.createRadialGradient(0, c - half * 0.4, half * 0.2, 0, c, half * 1.4);
                wash.addColorStop(0, 'rgba(235,248,250,0.22)'); wash.addColorStop(1, 'rgba(235,248,250,0)');
                ctx.fillStyle = wash; ctx.beginPath(); ctx.ellipse(0, c, wx * 2.4, half * 1.4, 0, 0, Math.PI * 2); ctx.fill();
                // soft-edged: the crest drawn three times through widening windows at falling
                // strength, so it melts into the water instead of ending in a hard rim
                for (const [kx, ky, a] of [[1.35, 1.25, 0.35], [1, 1, 0.55], [0.65, 0.75, 1]]) {
                    ctx.save(); ctx.beginPath(); ctx.ellipse(0, c, wx * kx, half * ky, 0, 0, Math.PI * 2); ctx.clip();
                    ctx.globalAlpha = a; whaleShape(ctx, L); ctx.fillStyle = m.calf ? '#4c5862' : '#232a31'; ctx.fill(); ctx.restore();
                }
                ctx.globalAlpha = 1;
                ctx.save(); ctx.beginPath(); ctx.ellipse(0, c, wx * 0.9, half * 0.9, 0, 0, Math.PI * 2); ctx.clip();
                ctx.fillStyle = 'rgba(190,205,215,0.1)'; ctx.fillRect(-wx * 0.25, c - half, wx * 0.5, 2 * half);   // wet sheen along the spine
                // the knobs on the head, the blowholes and the dorsal when they're in the window
                ctx.fillStyle = 'rgba(90,100,108,0.9)';
                for (const [x, y] of [[0, -0.46], [0.03, -0.42], [-0.03, -0.42], [0.05, -0.37], [-0.05, -0.37]]) { ctx.beginPath(); ctx.arc(x * L, y * L, L * 0.008 + 0.4, 0, Math.PI * 2); ctx.fill(); }
                ctx.fillStyle = '#10151a'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * L * 0.008, -L * 0.23, 0.9, L * 0.012, 0, 0, Math.PI * 2); ctx.fill(); }
                ctx.fillStyle = m.calf ? '#3c464f' : '#161b20'; ctx.beginPath(); ctx.ellipse(0, L * 0.16, L * 0.018, L * 0.035, 0, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
                // the waterline round it: water sheeting off in a broken white fringe, heaviest at the
                // front where the back is rising through the surface, and a soft wash spreading out
                ctx.lineCap = 'round';
                // the bow of white where the back pushes up through the surface
                for (let a = 0; a < 7; a++) { const a0 = Math.PI * (1.12 + a * 0.11);
                    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2 - Math.abs(a - 3) * 0.3;
                    ctx.beginPath(); ctx.ellipse(0, c, wx * 1.15, half * 1.05, 0, a0, a0 + 0.08 + ((a * 37) % 3) * 0.02); ctx.stroke(); }
                // water streaming back off the flanks in threads
                for (const sd of [-1, 1]) for (let q = 0; q < 3; q++) {
                    const x0 = sd * wx * (0.95 + q * 0.12), y0 = c - half * (0.55 - q * 0.25);
                    ctx.strokeStyle = `rgba(255,255,255,${0.5 - q * 0.12})`; ctx.lineWidth = 1.1 - q * 0.2;
                    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + sd * 3, y0 + half * 0.6, x0 + sd * 1.5, y0 + half * 1.1); ctx.stroke(); }
            }
            // a PEC SLAP (references): rolled at the surface, one long white flipper raised into the
            // air — crisp and pale against the sea, with its shadow, and a strip of flank beside it
            if (m.ev === 'pecslap') {
                const fin = m.fin || 0;
                for (const [kx, a] of [[1.3, 0.35], [1, 0.55], [0.7, 1]]) {
                    ctx.save(); ctx.beginPath(); ctx.ellipse(-m.sd * L * 0.02, -L * 0.15, L * 0.1 * kx, L * 0.26 * kx, 0, 0, Math.PI * 2); ctx.clip();
                    ctx.globalAlpha = a; whaleShape(ctx, L); ctx.fillStyle = '#262d34'; ctx.fill(); ctx.restore(); }
                ctx.globalAlpha = 1;
                // the pale belly and throat pleats rolled up on the far side
                ctx.save(); whaleShape(ctx, L); ctx.clip(); ctx.fillStyle = `rgba(214,220,218,${0.55 * roll})`;
                ctx.beginPath(); ctx.ellipse(-m.sd * L * 0.09, -L * 0.18, L * 0.045, L * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                if (fin > 0.1) { ctx.save(); ctx.globalAlpha = 0.3 * fin; ctx.fillStyle = 'rgba(10,25,40,1)'; ctx.translate(L * 0.06 * fin, L * 0.1 * fin); whaleFlipper(ctx, L, m.sd, 0.9); ctx.fill(); ctx.restore(); }
                ctx.fillStyle = '#f4f7f8'; ctx.save(); ctx.translate(m.sd * L * 0.05 * fin, 0); whaleFlipper(ctx, L, m.sd, 0.3 + 0.6 * fin); ctx.fill(); ctx.restore();
                const wsh = ctx.createRadialGradient(0, -L * 0.15, L * 0.08, 0, -L * 0.15, L * 0.3);
                wsh.addColorStop(0, 'rgba(235,248,250,0.25)'); wsh.addColorStop(1, 'rgba(235,248,250,0)');
                ctx.fillStyle = wsh; ctx.beginPath(); ctx.ellipse(0, -L * 0.15, L * 0.2, L * 0.32, 0, 0, Math.PI * 2); ctx.fill();
            }
            // the flukes raised clear at the end of a dive or in a lobtail
            if (fl > 0.05) {
                _W.fore = 1;
                ctx.save(); ctx.globalAlpha = 0.3 * fl; ctx.fillStyle = 'rgba(10,25,40,1)'; ctx.translate(L * 0.06 * fl, L * 0.14 * fl); whaleFlukes(ctx, L, 1); ctx.fill(); ctx.restore();
                ctx.save(); ctx.translate(0, L * 0.4); ctx.scale(1, 1 - fl * 0.55); ctx.translate(0, -L * 0.4);
                ctx.globalAlpha = 1; ctx.fillStyle = '#2c343c'; whaleFlukes(ctx, L, 1); ctx.fill();
                ctx.globalAlpha = fl * 0.85; ctx.fillStyle = '#eef1f0'; ctx.save(); whaleFlukes(ctx, L, 1); ctx.clip(); ctx.fillRect(-L * 0.2, L * 0.43, L * 0.4, L * 0.1); ctx.restore();
                ctx.restore();
            }
        } else {
            // breach, pec slap, lunge: the body is out — crisp, and rolled to show a pale belly
            body(1);
            if (roll > 0.05) { ctx.save(); whaleShape(ctx, L); ctx.clip(); ctx.fillStyle = `rgba(226,230,228,${0.75 * roll})`;
                ctx.beginPath(); ctx.ellipse(-m.sd * L * 0.09, -L * 0.12, L * 0.09 * roll, L * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
            // the rear half still in the water
            ctx.save(); ctx.beginPath(); ctx.rect(-L, L * (0.05 + lift * 0.2), 2 * L, L); ctx.clip();
            ctx.globalAlpha = 0.45 * (1 - lift * 0.5); ctx.fillStyle = `rgb(${tint})`; whaleShape(ctx, L); ctx.fill(); whaleFlukes(ctx, L, 1); ctx.fill(); ctx.restore();
            ctx.globalAlpha = 1;
            if (m.ev === 'feed' && lift > 0.05) {
                ctx.save(); ctx.translate(0, -L * 0.36);
                ctx.fillStyle = '#2c343c'; ctx.beginPath(); ctx.moveTo(0, -L * 0.2 * lift); ctx.quadraticCurveTo(L * 0.1, -L * 0.05, L * 0.08, L * 0.1); ctx.lineTo(-L * 0.08, L * 0.1); ctx.quadraticCurveTo(-L * 0.1, -L * 0.05, 0, -L * 0.2 * lift); ctx.fill();
                ctx.fillStyle = `rgba(222,228,226,${0.9 * lift})`; ctx.beginPath(); ctx.moveTo(L * 0.01, -L * 0.14 * lift); ctx.quadraticCurveTo(L * 0.08, -L * 0.02, L * 0.07, L * 0.08); ctx.lineTo(L * 0.02, L * 0.08); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
        }
        ctx.restore();
    }
    function drawPrint(ctx, F) {
        const k = F.t / 14, a = 0.3 * (1 - k);
        const g = ctx.createRadialGradient(F.x, F.y, 0, F.x, F.y, F.r * (1 + k * 0.6));
        g.addColorStop(0, `rgba(185,225,235,${a})`); g.addColorStop(0.8, `rgba(185,225,235,${a * 0.6})`); g.addColorStop(1, 'rgba(185,225,235,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(F.x, F.y, F.r * (1 + k * 0.6), F.r * 0.75 * (1 + k * 0.6), F.h, 0, Math.PI * 2); ctx.fill();
    }
    // A blow from above: a bushy puff of white mist at the blowhole, growing and drifting down
    // the wind as it thins — a heart-shaped V close up, a soft plume from where we are.
    function drawBlow(ctx, B) {
        const k = B.t / 3.5, r = (16 + k * 52) * B.size, a = 0.85 * (1 - k) * (1 - k);
        const w = state.wind || { direction: 0 }, dx = -Math.sin(w.direction) * k * 40, dy = Math.cos(w.direction) * k * 40;
        ctx.save(); ctx.translate(B.x + dx, B.y + dy);
        for (const [ox, oy, rr] of [[0, 0, 1], [r * 0.35, -r * 0.2, 0.75], [-r * 0.3, -r * 0.25, 0.7], [0, r * 0.35, 0.6]]) {
            const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * rr);
            g.addColorStop(0, `rgba(245,248,250,${a})`); g.addColorStop(1, 'rgba(245,248,250,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, r * rr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
    // White water: a breach or a slap throws up a burst — a bright heart that swells into a ring of
    // torn foam, then lies on the sea as a fading lacy patch. Connected sheets, not dots.
    function drawSplash(ctx, S) {
        const k = S.t / S.life, burst = Math.max(0, 1 - S.t / 0.9);
        const rr = S.r * (0.5 + 0.5 * Math.min(1, S.t / 0.8)), seed = (S.x * 0.013 + S.y * 0.007);
        // an irregular closed outline: a blob of churned water, lobed, never a circle
        const blob = (rad, j) => { ctx.beginPath(); for (let a = 0; a <= 48; a++) { const aa = a / 48 * Math.PI * 2, n = 0.9 + 0.06 * Math.sin(aa * 2 + seed * 7 + j) + 0.05 * Math.sin(aa * 5 + seed * 3 + j * 2) + 0.03 * Math.sin(aa * 11 + seed + j);
            const x = Math.cos(aa) * rad * n, y = Math.sin(aa) * rad * n; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); };
        ctx.save(); ctx.translate(S.x, S.y);
        // the churned patch: pale aqua-white, fading as it spreads
        const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 1.1);
        gg.addColorStop(0, `rgba(255,255,255,${0.85 * burst + 0.35 * (1 - k)})`); gg.addColorStop(0.55, `rgba(230,245,248,${0.45 * (1 - k)})`); gg.addColorStop(1, `rgba(200,235,240,${0.15 * (1 - k)})`);
        ctx.fillStyle = gg; blob(rr * 1.1, 0); ctx.fill();
        // the lacy edge: a broken ring of foam following the blob, thick in places
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k)})`; ctx.lineWidth = S.big ? 3 : 1.8; ctx.lineJoin = 'round';
        ctx.setLineDash([rr * 0.35, rr * 0.12, rr * 0.18, rr * 0.2]); blob(rr * 1.05, 0); ctx.stroke(); ctx.setLineDash([]);
        if (S.bait) { ctx.fillStyle = `rgba(30,40,45,${0.5 * (1 - k)})`; for (let a = 0; a < 18; a++) { const aa = a * 2.1 + S.t * 3, d = rr * (0.4 + (a % 5) * 0.12); ctx.beginPath(); ctx.ellipse(Math.cos(aa) * d, Math.sin(aa) * d, 0.8, 2, aa, 0, Math.PI * 2); ctx.fill(); } }   // the fleeing bait
        ctx.restore();
    }
    function drawWhaleSlick(ctx, m) {
        // the "footprint": a round glassy slick where the flukes went down, smoother than the sea
        if (m.slick <= 0) return;
        const g = ctx.createRadialGradient(m.sx, m.sy, 0, m.sx, m.sy, m.len * 0.35);
        g.addColorStop(0, `rgba(190,220,232,${0.28 * m.slick})`); g.addColorStop(1, 'rgba(190,220,232,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(m.sx, m.sy, m.len * 0.35, m.len * 0.28, m.h, 0, Math.PI * 2); ctx.fill();
    }

    // SPINNER DOLPHIN from above (references): slimmer than the porpoise, with a LONG thin beak,
    // a three-tone flank (dark grey cape, paler grey band, white belly hidden below), riding in
    // the bow's pressure wave with white breaking off its back; a spinning leap is a moment clear
    // of the water, twisting, and a splash.
    function drawSpinner(ctx, m) {
        // SPINNER DOLPHIN from above (references): a slim grey torpedo with a long thin beak, a
        // darker cape along the back, small swept flippers and a crescent of flukes; riding it lies
        // just under the surface — seen through the water, its shadow under it — and breaks out in
        // a burst of white to breathe.
        if (!m.live) return;
        const L = SPINNER_LEN, tint = waterTint(), air = m.spin > 0 ? Math.sin(Math.PI * m.spin) : 0;
        const shape = () => {
            ctx.beginPath(); ctx.moveTo(0, -L * 0.5); ctx.lineTo(L * 0.025, -L * 0.38);
            ctx.bezierCurveTo(L * 0.12, -L * 0.33, L * 0.12, L * 0.1, L * 0.03, L * 0.36);
            ctx.lineTo(-L * 0.03, L * 0.36); ctx.bezierCurveTo(-L * 0.12, L * 0.1, -L * 0.12, -L * 0.33, -L * 0.025, -L * 0.38); ctx.closePath(); ctx.fill();
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * L * 0.08, -L * 0.18); ctx.quadraticCurveTo(sd * L * 0.2, -L * 0.1, sd * L * 0.17, -L * 0.03); ctx.lineTo(sd * L * 0.07, -L * 0.1); ctx.closePath(); ctx.fill(); }
            const w = Math.sin(T * 9 + m.i) * 0.15;
            ctx.beginPath(); ctx.moveTo(0, L * 0.34); ctx.quadraticCurveTo(L * 0.2, L * (0.38 + w * 0.2), L * 0.19, L * 0.47); ctx.quadraticCurveTo(L * 0.06, L * 0.42, 0, L * 0.45); ctx.quadraticCurveTo(-L * 0.06, L * 0.42, -L * 0.19, L * (0.47 - w * 0.2)); ctx.quadraticCurveTo(-L * 0.2, L * 0.38, 0, L * 0.34); ctx.fill();
        };
        // its shadow on the water below, offset down-right (further in the air)
        ctx.save(); ctx.translate(m.x + 3 + air * 8, m.y + 5 + air * 12); ctx.rotate(m.h); ctx.fillStyle = 'rgba(8,20,35,0.22)'; shape(); ctx.restore();
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h + (m.spin > 0 ? (1 - m.spin) * Math.PI * 4 : 0) * 0.08);
        if (air) ctx.scale(1 + air * 0.15, 1 + air * 0.15);
        ctx.fillStyle = '#9aa6ae'; shape();
        ctx.fillStyle = '#4e5a63'; ctx.beginPath(); ctx.ellipse(0, -L * 0.06, L * 0.045, L * 0.3, 0, 0, Math.PI * 2); ctx.fill();     // the dark cape
        ctx.fillStyle = '#39434b'; ctx.beginPath(); ctx.moveTo(-1.2, L * 0.02); ctx.lineTo(0, -L * 0.07); ctx.lineTo(1.2, L * 0.02); ctx.closePath(); ctx.fill();   // dorsal
        const under = air > 0 ? 0 : 1 - m.breath;
        if (under > 0) { ctx.globalAlpha = 0.32 * under; ctx.fillStyle = `rgb(${tint})`; shape(); }                                    // just under the surface
        ctx.restore();
        // breaking out to breathe: a burst of white off the head and back
        if (m.breath > 0) { const a = m.breath;
            ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h);
            const g = ctx.createRadialGradient(0, -L * 0.25, 0, 0, -L * 0.25, L * 0.35);
            g.addColorStop(0, `rgba(255,255,255,${0.75 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -L * 0.2, L * 0.25, L * 0.4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${0.6 * a})`; ctx.lineWidth = 1; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * L * 0.08, -L * 0.2); ctx.lineTo(sd * L * 0.2, L * 0.25); ctx.stroke(); }
            ctx.restore(); }
    }
    // NERVOUS WATER: a school of flying fish just under the surface ruffles it — a patch of small
    // broken ripples that flicker, and every so often a single fish flicks out and back. It is how
    // a sailor (and a fisherman) finds a school, so it is how the player finds a patch.
    function drawNervousWater(ctx, P) {
        const vx = state.camera ? state.camera.x : P.x, vy = state.camera ? state.camera.y : P.y;
        if (Math.hypot(P.x - vx, P.y - vy) > 2400) return;
        ctx.save(); ctx.lineCap = 'round';
        const g = ctx.createRadialGradient(P.x, P.y, P.r * 0.2, P.x, P.y, P.r);
        g.addColorStop(0, 'rgba(10,40,70,0.10)'); g.addColorStop(1, 'rgba(10,40,70,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, Math.PI * 2); ctx.fill();
        for (const q of P.ripples) {
            const k = ((T * 0.9 + q.ph) % 2) / 2;                               // each ripple spreads and fades on its own clock
            const x = P.x + Math.cos(q.a) * q.d * P.r * 0.85, y = P.y + Math.sin(q.a) * q.d * P.r * 0.85;
            ctx.strokeStyle = `rgba(230,245,250,${0.42 * (1 - k)})`; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x, y, 3 + k * 9, q.a, q.a + 2.2); ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, 3 + k * 9, q.a + 3.2, q.a + 4.6); ctx.stroke();
            // now and then one fish flicks out of the water: a bright sliver and a spot of white
            if (k < 0.12 && (Math.floor(T * 0.9 / 2 + q.ph) % 5) === 0) { ctx.fillStyle = 'rgba(210,230,245,0.85)'; ctx.save(); ctx.translate(x, y); ctx.rotate(q.a); ctx.fillRect(-1, -4, 2, 8); ctx.restore(); }
        }
        ctx.restore();
    }

        // MAHI-MAHI from above (references): a blunt, steep-browed head, a long dorsal fin running the
    // length of the back, tapering to a deeply forked tail; blue-green on the back, speckled, the
    // flanks gold. Under the water: a bright blue-green streak, veiled by depth — brighter and
    // crisper when it is shallow and chasing, with a thin V off it; in a leap, gold and green in the
    // air with its shadow, a burst of white where it left and re-entered.
    function drawMahi(ctx, m) {
        const L = MAHI_LEN * m.size, tint = waterTint(), air = m.leap > 0 ? Math.sin(Math.PI * m.leap) : 0;
        const chase = m.mode === 'chase', veil = air ? 0 : chase ? 0.3 : 0.62;
        if (chase && !air && m.trail && m.trail.length > 2) drawWakeTrail(ctx, m, 3, 1.4, 0.5);
        const body = () => { ctx.beginPath(); ctx.moveTo(-L * 0.08, -L * 0.5); ctx.quadraticCurveTo(0, -L * 0.53, L * 0.08, -L * 0.5);   // the blunt brow
            ctx.bezierCurveTo(L * 0.13, -L * 0.36, L * 0.12, L * 0.1, L * 0.03, L * 0.34); ctx.lineTo(-L * 0.03, L * 0.34); ctx.bezierCurveTo(-L * 0.12, L * 0.1, -L * 0.13, -L * 0.36, -L * 0.08, -L * 0.5); ctx.fill();
            const w = Math.sin(m.t * 14 + m.i) * (chase ? 0.3 : 0.15);
            ctx.beginPath(); ctx.moveTo(0, L * 0.32); ctx.lineTo(L * (0.17 + w * 0.1), L * 0.54); ctx.lineTo(0, L * 0.42); ctx.lineTo(-L * (0.17 - w * 0.1), L * 0.54); ctx.closePath(); ctx.fill(); };
        if (air) { ctx.save(); ctx.translate(m.x + air * 6, m.y + air * 10); ctx.rotate(m.h); ctx.fillStyle = 'rgba(8,20,35,0.25)'; body(); ctx.restore(); }
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h + (air ? Math.sin(m.leap * Math.PI * 2) * 0.3 : 0)); if (air) ctx.scale(1 + air * 0.15, 1 + air * 0.15);
        ctx.fillStyle = '#d8c42e'; body();                                               // the gold flanks
        ctx.fillStyle = '#1f9a8c'; ctx.beginPath(); ctx.ellipse(0, -L * 0.1, L * 0.065, L * 0.36, 0, 0, Math.PI * 2); ctx.fill();   // the blue-green back
        ctx.strokeStyle = '#2a7fb8'; ctx.lineWidth = L * 0.03; ctx.beginPath(); ctx.moveTo(0, -L * 0.44); ctx.lineTo(0, L * 0.3); ctx.stroke();   // the long dorsal fin
        ctx.fillStyle = 'rgba(80,170,230,0.7)'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc((k % 2 ? 1 : -1) * L * 0.05, -L * 0.3 + k * L * 0.12, L * 0.012 + 0.3, 0, Math.PI * 2); ctx.fill(); }   // speckles
        if (veil > 0) { ctx.globalAlpha = veil; ctx.fillStyle = `rgb(${tint})`; body(); }
        ctx.restore();
    }

        // FLYING FISH (references): a silver-blue sliver with the long pectoral "wings" spread like a
    // dragonfly's, pale and translucent; a streak of taxiing spray where it takes off, its shadow
    // under it, a little plop where it drops back in.
    function drawFlyfish(ctx, f) {
        // (references: from above, a dark blue back and a silver flank, the long pectoral "wings"
        // spread stiff and TRANSLUCENT — you see the sea through them — the tail's lower lobe
        // dragging a skipping line of V-ripples on take-off; a flick of spray where it drops in)
        if (f.t < 0) return;
        const p = Math.min(1, f.t / f.dur), x = f.x0 + Math.sin(f.h) * f.len * p, y = f.y0 - Math.cos(f.h) * f.len * p;
        if (f.t < f.dur) {
            const z = f.z * Math.sin(Math.PI * Math.min(1, p * 1.05)), s = f.size * FLYFISH_SPAN / 13;
            // taxiing: a line of little V-ripples where the tail skipped the water
            const taxi = Math.min(p, 0.12);
            if (p < 0.35) for (let q = 0.03; q < taxi; q += 0.045) { const tx = f.x0 + Math.sin(f.h) * f.len * q, ty = f.y0 - Math.cos(f.h) * f.len * q;
                ctx.save(); ctx.translate(tx, ty); ctx.rotate(f.h); ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p / 0.35)})`; ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.moveTo(-2.5, 2.5); ctx.quadraticCurveTo(0, -0.5, 2.5, 2.5); ctx.stroke(); ctx.restore(); }
            // shadow, then the fish
            ctx.save(); ctx.translate(x + z * 0.35, y + z * 0.55); ctx.rotate(f.h); ctx.scale(s, s); ctx.fillStyle = 'rgba(8,20,35,0.25)';
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -1.4); ctx.quadraticCurveTo(sd * 5.8, -0.6, sd * 5.4, 2.4); ctx.quadraticCurveTo(sd * 2.4, 1.6, 0, 1.2); ctx.fill(); }
            ctx.beginPath(); ctx.ellipse(0, 0, 0.9, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            ctx.save(); ctx.translate(x, y); ctx.rotate(f.h); ctx.scale(s, s);
            ctx.fillStyle = 'rgba(150,190,225,0.42)'; ctx.strokeStyle = 'rgba(40,70,110,0.6)'; ctx.lineWidth = 0.25;
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -1.4); ctx.quadraticCurveTo(sd * 5.8, -0.6, sd * 5.4, 2.4); ctx.quadraticCurveTo(sd * 2.4, 1.6, 0, 1.2); ctx.fill(); ctx.stroke();
                for (const r of [0.35, 0.65]) { ctx.beginPath(); ctx.moveTo(0, -0.6); ctx.lineTo(sd * 5.4 * r, 1.4 * r - 0.3); ctx.stroke(); } }   // fin rays
            ctx.fillStyle = '#23406b'; ctx.beginPath(); ctx.ellipse(0, 0, 0.95, 4.3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c8d8e4'; ctx.beginPath(); ctx.ellipse(0.35, 0.4, 0.4, 3, 0, 0, Math.PI * 2); ctx.fill();          // the silver flank
            ctx.fillStyle = '#23406b'; ctx.beginPath(); ctx.moveTo(-0.4, 3.9); ctx.lineTo(-1.6, 6); ctx.lineTo(0, 5); ctx.lineTo(1.4, 6.8); ctx.lineTo(0.4, 3.9); ctx.fill();   // forked tail, lower lobe longer
            ctx.restore();
        } else {
            const k = 1 - (f.t - f.dur) / 1.2;
            drawFishSplash(ctx, x, y, Math.max(0, k * 1.2 - 0.2), 0.6, 3);
            drawRing(ctx, x, y, k, 2, 9, 0.5);
        }
    }
    // LAYSAN ALBATROSS from above (references): long narrow wings, sooty dark-brown right across
    // the upper wing and back, a white head and white rump, a dark band at the tail tip, a pale
    // pinkish bill; banked, one wing dips and looks shorter; its shadow skims the swell below.
    function albatrossShape(ctx, bank) {
        for (const sd of [-1, 1]) {
            const span = 30 * (1 - Math.max(0, bank * sd) * 0.18);
            ctx.beginPath(); ctx.moveTo(sd * 2.2, -1.6);
            ctx.quadraticCurveTo(sd * span * 0.5, -3.4, sd * span, -1.2);
            ctx.quadraticCurveTo(sd * span * 0.55, 1.3, sd * 2.2, 2.4); ctx.closePath(); ctx.fill();
        }
        ctx.beginPath(); ctx.ellipse(0, 1, 2.6, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    function drawAlbatross(ctx, G) {
        const s = ALB_SPAN / 60;
        ctx.save(); ctx.translate(G.x + G.z * 0.35, G.y + G.z * 0.55); ctx.rotate(G.h); ctx.scale(s, s);
        ctx.fillStyle = 'rgba(10,25,40,0.2)'; albatrossShape(ctx, G.bank); ctx.restore();
        ctx.save(); ctx.translate(G.x, G.y); ctx.rotate(G.h); ctx.scale(s, s);
        ctx.fillStyle = '#3b3129'; albatrossShape(ctx, G.bank);
        ctx.fillStyle = '#f3f1ec'; ctx.beginPath(); ctx.ellipse(0, -5, 2.1, 2.6, 0, 0, Math.PI * 2); ctx.fill();   // white head
        ctx.beginPath(); ctx.ellipse(0, 5.5, 2.2, 2.4, 0, 0, Math.PI * 2); ctx.fill();                           // white rump
        ctx.fillStyle = '#2a231d'; ctx.beginPath(); ctx.ellipse(0, 8.2, 2, 0.9, 0, 0, Math.PI * 2); ctx.fill();    // the dark tail band
        ctx.fillStyle = '#d9b3a3'; ctx.beginPath(); ctx.moveTo(-0.6, -7.2); ctx.lineTo(0, -9.8); ctx.lineTo(0.6, -7.2); ctx.closePath(); ctx.fill();   // the pale bill
        ctx.fillStyle = 'rgba(40,34,30,0.7)'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 0.9, -5.4, 0.5, 0.35, 0, 0, Math.PI * 2); ctx.fill(); }   // the dark eye smudges
        ctx.restore();
    }

    // THE WHALES AS OBSTACLES (Wes, Sep 25 2026: "colliding with a whale stops you — hard contact!
    // ... only when at the surface"). The sim's contact check (checkWhaleContact, sim/collision.js)
    // asks for the bodies AT THE SURFACE right now — breathing, rolling out on a dive, or out of
    // the water in a display — never one cruising below. Each as a capsule, head to tail stock.
    // ── drawing Redrock's animals ─────────────────────────────────────────────────────────
    // STRIPED BASS from above: a dark olive-grey back, silver flanks showing at the edges, a
    // big head, a forked tail; rolling at the surface the flank turns up and the black
    // pinstripes show. Local frame: nose toward -y.
    function drawStriper(ctx, x, y, h, size, alpha, roll) {
        const L = STRIPER_LEN * size, W = L * 0.2;
        ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.globalAlpha *= alpha;
        ctx.fillStyle = '#b8c2c3';   // silver flank, widest when rolled
        ctx.beginPath(); ctx.ellipse(roll * W * 0.3, 0, W * (0.55 + 0.35 * roll), L * 0.42, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3c4845';   // the back
        ctx.beginPath(); ctx.moveTo(0, -L * 0.5); ctx.quadraticCurveTo(W * 0.62, -L * 0.3, W * 0.5 * (1 - roll * 0.5), L * 0.12);
        ctx.quadraticCurveTo(W * 0.3, L * 0.34, 0, L * 0.38); ctx.quadraticCurveTo(-W * 0.3, L * 0.34, -W * 0.5, L * 0.12);
        ctx.quadraticCurveTo(-W * 0.62, -L * 0.3, 0, -L * 0.5); ctx.fill();
        // the forked tail
        ctx.beginPath(); ctx.moveTo(0, L * 0.34); ctx.lineTo(-W * 0.62, L * 0.54); ctx.lineTo(0, L * 0.47); ctx.lineTo(W * 0.62, L * 0.54); ctx.closePath(); ctx.fill();
        if (roll > 0.2) {   // the pinstripes along the rolled flank
            ctx.strokeStyle = `rgba(20,26,28,${0.7 * roll})`; ctx.lineWidth = 0.45;
            for (const o of [0.35, 0.6, 0.85]) { ctx.beginPath(); ctx.moveTo(W * o, -L * 0.24); ctx.lineTo(W * o * 0.9, L * 0.26); ctx.stroke(); }
        }
        ctx.restore();
    }
    // A BOIL from above (Lake Powell footage, aerial frenzy references): a patch of torn white
    // water where the bait is pinned at the surface, the stripers' dark backs slashing through
    // it and leaving flat swirls, shad spraying clear of the leading edge in silver fans — and
    // behind, the pale flattened slick the moving boil leaves on the water.
    function drawStriperBoil(ctx, B) {
        const k = boilK(B); if (k <= 0) return;
        const R0 = B.r, rr = mulberry(B.seed);
        ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.h);   // local: the boil moves toward -y
        // 1. the slick: the flattened pale water the moving boil leaves behind, one soft sheet
        ctx.save(); ctx.translate(0, R0 * 0.8); ctx.scale(0.75, 1.4);
        let g = ctx.createRadialGradient(0, 0, 0, 0, 0, R0);
        g.addColorStop(0, `rgba(225,240,238,${0.13 * k})`); g.addColorStop(1, 'rgba(225,240,238,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        // 2. the bait pinned under it: a dark shifting mass, densest at the front
        for (let i = 0; i < 7; i++) {
            const a = i / 7 * Math.PI * 2 + T * 0.2, d = R0 * 0.35, x = Math.cos(a) * d, y = Math.sin(a) * d * 0.8 - R0 * 0.15, rad = R0 * (0.45 + 0.08 * Math.sin(T * 0.9 + i));
            g = ctx.createRadialGradient(x, y, 0, x, y, rad);
            g.addColorStop(0, `rgba(8,26,32,${0.14 * k})`); g.addColorStop(1, 'rgba(8,26,32,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
        }
        // 3. the stripers: under (a dim shape), rolling up with white thrown off them, down again
        //    leaving a flat swirl
        for (const f of B.fish) {
            const u = ((T + f.ph) % f.per) / f.per, a = f.a + T * 0.55 * f.dir, d = f.d * R0 * 0.85;
            const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.8 - R0 * 0.1, hd = a + f.dir * Math.PI / 2 + Math.PI / 2;
            if (u < 0.22) {
                const q = u / 0.22, up = Math.sin(q * Math.PI);
                drawStriper(ctx, x, y, hd, f.size, (0.45 + 0.55 * up) * k, up);
                // the white it throws: a torn sheet off its shoulders
                g = ctx.createRadialGradient(x, y, 0, x, y, 14 * f.size);
                g.addColorStop(0, `rgba(255,255,255,${0.75 * up * k})`); g.addColorStop(0.55, `rgba(245,252,252,${0.35 * up * k})`); g.addColorStop(1, 'rgba(245,252,252,0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 14 * f.size, 10 * f.size, hd, 0, Math.PI * 2); ctx.fill();
            } else if (u < 0.5) {
                const q = (u - 0.22) / 0.28;   // the swirl where it went down
                ctx.strokeStyle = `rgba(235,248,248,${0.5 * (1 - q) * k})`; ctx.lineWidth = 1.1;
                for (const [a0, a1] of [[0.3, 1.9], [2.4, 3.6], [4.1, 5.7]]) { ctx.beginPath(); ctx.ellipse(x, y, 5 + q * 9, 4 + q * 7, hd, a0 + q, a1 + q); ctx.stroke(); }
            } else drawStriper(ctx, x, y, hd, f.size, 0.22 * k, 0);
        }
        // 4. the white water: torn foam sheets — lobed, crisp-edged patches that swell as fish
        //    break under them and tear apart as they fade — over a soft glow of churned water
        for (let i = 0; i < 12; i++) {
            const a = rr() * Math.PI * 2 + T * 0.15, d = Math.sqrt(rr()) * R0 * 0.62, x = Math.cos(a) * d, y = Math.sin(a) * d * 0.8 - R0 * 0.2;
            const sp = 1.2 + rr(), ph = rr() * 10, pulse = Math.max(0, Math.sin(T * sp * 2 + ph)), rad = (10 + rr() * 12) * (0.6 + 0.6 * pulse), sd = rr() * 100;
            g = ctx.createRadialGradient(x, y, 0, x, y, rad * 1.5);
            g.addColorStop(0, `rgba(235,248,248,${0.28 * pulse * k})`); g.addColorStop(1, 'rgba(235,248,248,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad * 1.5, 0, Math.PI * 2); ctx.fill();
            if (pulse < 0.15) continue;
            // the sheet: a ragged lobed outline, holes torn in it as it thins
            ctx.fillStyle = `rgba(255,255,255,${(0.35 + 0.45 * pulse) * k})`;
            const pts = [];
            for (let v = 0; v < 18; v++) {
                const q = v / 18 * Math.PI * 2, rv = rad * (0.66 + 0.18 * Math.sin(q * 3 + sd) + 0.08 * Math.sin(q * 5 + sd * 2 + T * 2));
                pts.push([x + Math.cos(q) * rv, y + Math.sin(q) * rv * 0.85]);
            }
            ctx.beginPath(); ctx.moveTo((pts[17][0] + pts[0][0]) / 2, (pts[17][1] + pts[0][1]) / 2);
            for (let v = 0; v < 18; v++) { const n = pts[(v + 1) % 18]; ctx.quadraticCurveTo(pts[v][0], pts[v][1], (pts[v][0] + n[0]) / 2, (pts[v][1] + n[1]) / 2); }
            ctx.closePath(); ctx.fill();
            if (pulse < 0.7) {   // tearing: dark water showing through
                ctx.fillStyle = `rgba(40,110,120,${(0.7 - pulse) * 0.8 * k})`;
                for (let h = 0; h < 2; h++) { const hx = x + Math.cos(sd + h * 2.4) * rad * 0.3, hy = y + Math.sin(sd + h * 2.4) * rad * 0.25; ctx.beginPath(); ctx.ellipse(hx, hy, rad * 0.22, rad * 0.14, sd + h, 0, Math.PI * 2); ctx.fill(); }
            }
        }
        // 5. shad spraying clear of the leading edge: silver fans, a veil with glints in it
        for (let i = 0; i < 4; i++) {
            const per = 1.1 + rr() * 0.9, ph = rr() * per, u = ((T + ph) % per) / per; if (u > 0.5) { rr(); continue; }
            const q = u / 0.5, a = -Math.PI / 2 + (rr() - 0.5) * 2.2, x0 = Math.cos(a) * R0 * 0.55, y0 = Math.sin(a) * R0 * 0.55 - R0 * 0.1;
            const len = 10 + q * 22, spread = 0.5;
            ctx.save(); ctx.translate(x0, y0); ctx.rotate(a + Math.PI / 2);
            g = ctx.createLinearGradient(0, 0, 0, -len);
            g.addColorStop(0, `rgba(235,245,248,${0.45 * (1 - q) * k})`); g.addColorStop(1, 'rgba(235,245,248,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-len * spread, -len); ctx.quadraticCurveTo(0, -len * 1.12, len * spread, -len); ctx.lineTo(2, 0); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    // CALIFORNIA CONDOR from above (soaring references): very long, broad, PLANK wings held
    // flat, seven primaries splayed like fingers at each tip; coal black, with a pale silvery
    // bar along the upper wing's coverts and greyish secondaries; a short square tail; the small
    // bare orange-pink head poking out of a black ruff. It almost never flaps.
    function condorWing(ctx, reach) {
        const S = CONDOR_SPAN / 2 * reach, hx = S * 0.7;
        ctx.beginPath();
        ctx.moveTo(3, -8);
        ctx.quadraticCurveTo(S * 0.3, -9.6, S * 0.5, -9.6);                    // the arm, a touch forward to the wrist
        ctx.quadraticCurveTo(S * 0.62, -9.4, hx, -8.6);                          // the hand, swept very slightly back
        ctx.lineTo(hx + 0.6, 4.2);
        ctx.quadraticCurveTo(S * 0.42, 8.6, 3, 7.6);                            // the broad bulging secondaries
        ctx.closePath();
    }
    function condorFingers(ctx, reach) {
        const S = CONDOR_SPAN / 2 * reach, hx = S * 0.7;
        for (let i = 0; i < 7; i++) {
            const t = i / 6, y0 = -8 + t * 12, ang = -0.32 + t * 0.78, len = (S - hx) * (1.02 - Math.abs(t - 0.3) * 0.55), w = 1.05;
            ctx.save(); ctx.translate(hx - 0.5, y0); ctx.rotate(ang);
            ctx.beginPath(); ctx.moveTo(0, -w); ctx.quadraticCurveTo(len * 0.55, -w * 1.1, len, -0.1); ctx.quadraticCurveTo(len * 0.6, w * 0.9, 0, w); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    }
    function condorShape(ctx, bank, detail) {
        const fill = ctx.fillStyle;
        for (const sd of [-1, 1]) {
            const reach = 1 - 0.07 * bank * sd, S = CONDOR_SPAN / 2 * reach;
            ctx.save(); ctx.scale(sd, 1);
            ctx.fillStyle = fill; condorWing(ctx, reach); ctx.fill();
            ctx.fillStyle = detail ? '#121010' : fill; condorFingers(ctx, reach);
            if (detail) {
                // the broad pale panel over the rear half of the inner upper wing (the secondary
                // coverts and secondaries — the Grand Canyon birds, wings open on the rim), fading
                // out toward the hand, with the dark trailing fringe left showing
                for (const [a, w0] of [[0.35, 0], [0.75, 0.8]]) {
                    ctx.fillStyle = `rgba(198,194,184,${a})`;
                    ctx.beginPath(); ctx.moveTo(3.5, -1.2 + w0); ctx.quadraticCurveTo(S * 0.35, -1.8 + w0, S * 0.62, -2.4 + w0 * 1.2);
                    ctx.lineTo(S * 0.64, 2.6 - w0); ctx.quadraticCurveTo(S * 0.4, 6.4 - w0, 3.5, 6 - w0); ctx.closePath(); ctx.fill();
                }
                // a few feather lines across the hand
                ctx.strokeStyle = 'rgba(70,66,62,0.5)'; ctx.lineWidth = 0.3;
                for (let i = 1; i < 5; i++) { const x = S * (0.45 + i * 0.05); ctx.beginPath(); ctx.moveTo(x, -8.8); ctx.lineTo(x + 0.6, 4.4); ctx.stroke(); }
            }
            ctx.restore();
        }
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.ellipse(0, 0, 4.3, 10.5, 0, 0, Math.PI * 2); ctx.fill();          // body
        ctx.beginPath(); ctx.moveTo(-3.6, 8); ctx.lineTo(-5, 14.2); ctx.quadraticCurveTo(0, 15.6, 5, 14.2); ctx.lineTo(3.6, 8); ctx.closePath(); ctx.fill();   // short broad square tail
        ctx.beginPath(); ctx.ellipse(0, -10.2, 3.2, 3.2, 0, 0, Math.PI * 2); ctx.fill();       // the black ruff
    }
    function drawCondor(ctx, C) {
        const z = C.z, zo = Math.min(z, 55);
        ctx.save(); ctx.translate(C.x + zo * 0.35, C.y + zo * 0.55); ctx.rotate(C.h);
        ctx.fillStyle = 'rgba(10,22,26,0.17)'; condorShape(ctx, C.bank, false); ctx.restore();
        ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(C.h);
        ctx.fillStyle = '#1a1817'; condorShape(ctx, C.bank, true);
        // the bare head and bill, turned a little into the turn
        ctx.translate(0, -11); ctx.rotate(C.bank * 0.3);
        ctx.fillStyle = '#e07a4f'; ctx.beginPath(); ctx.ellipse(0, -3.2, 1.7, 2.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(160,60,40,0.6)'; ctx.beginPath(); ctx.ellipse(0, -2.2, 1.2, 1.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8dcc4'; ctx.beginPath(); ctx.moveTo(-0.65, -5.4); ctx.quadraticCurveTo(0, -7.4, 0.65, -5.4); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    // Four legs from above, swinging with the gait (0 stand, 1 walk/trot, 2 bound/lope).
    function drawLegs(ctx, step, moving, fx, fy, hy, w, len, col) {
        ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = w;
        const sw = Math.sin(step) * len * Math.min(1, moving) * (moving > 1.5 ? 1.5 : 1);
        for (const [x, y, ph] of [[-fx, fy, 1], [fx, fy, -1], [-fx, hy, -1], [fx, hy, 1]]) {
            const s = moving > 1.5 ? sw * (y === fy ? 1 : -1) : sw * ph;   // a bound: fore pair together, hind pair together
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x * 1.2, y + s + (y === fy ? -len * 0.25 : len * 0.25)); ctx.stroke();
        }
    }
    // A four-footed body from above, as a width profile down the spine: [y, half-width] pairs.
    function bodyPath(ctx, prof) {
        ctx.beginPath(); ctx.moveTo(0, prof[0][0] - 0.6);
        for (let i = 0; i < prof.length - 1; i++) { const [y0, w0] = prof[i], [y1, w1] = prof[i + 1]; ctx.quadraticCurveTo(w0, y0, (w0 + w1) / 2, (y0 + y1) / 2); }
        const [yl, wl] = prof[prof.length - 1]; ctx.quadraticCurveTo(wl, yl, 0, yl + 1.2);
        for (let i = prof.length - 1; i > 0; i--) { const [y0, w0] = prof[i], [y1, w1] = prof[i - 1]; ctx.quadraticCurveTo(-w0, y0, -(w0 + w1) / 2, (y0 + y1) / 2); }
        ctx.quadraticCurveTo(-prof[0][1], prof[0][0], 0, prof[0][0] - 0.6);
        ctx.closePath();
    }
    // DESERT BIGHORN from above (the Kananaskis drone shots, overlooks in Zion and the Grand
    // Canyon): a stocky sandy-brown barrel, deep at the shoulder, sunlit on one side and shaded on
    // the other; a thick neck and a big blocky head with a pale muzzle; the WHITE RUMP PATCH and
    // short dark tail that read from any height. A ram's massive horns curl back, out, down and
    // forward round each side of the head; a ewe's are short slim spikes; lambs are small.
    // Grazing, the head is down (foreshortened from above).
    const BIGHORN_BODY = [[-9, 2.8], [-6.5, 4.8], [-2, 5.9], [3, 6.2], [8, 5.6], [11.5, 4.4], [13.6, 2.2]];
    function drawBighorn(ctx, s) {
        const k = s.lamb ? 0.62 : s.ram ? 1 : 0.9, st = s.moving > 1.5 ? 1.08 : 1;
        ctx.save(); ctx.translate(s.x + 3.5, s.y + 5.5); ctx.rotate(s.h); ctx.scale(k, k * st);
        ctx.fillStyle = 'rgba(40,18,8,0.26)'; bodyPath(ctx, BIGHORN_BODY); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -12, 2.8, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.h); ctx.scale(k, k * st);
        drawLegs(ctx, s.step, s.moving, 4, -5, 9.5, 1.5, 3.4, '#6e5540');
        const g = ctx.createLinearGradient(-6, 0, 6, 0);
        g.addColorStop(0, '#c6a47f'); g.addColorStop(0.55, '#ab8964'); g.addColorStop(1, '#8a6c50');
        ctx.fillStyle = g; ctx.strokeStyle = SOFT; ctx.lineWidth = 0.5;
        bodyPath(ctx, BIGHORN_BODY); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#efe7d8';                                                                     // the white rump
        ctx.beginPath(); ctx.moveTo(-4.6, 9.4); ctx.quadraticCurveTo(0, 7.6, 4.6, 9.4); ctx.quadraticCurveTo(4.2, 13.4, 0, 13.8); ctx.quadraticCurveTo(-4.2, 13.4, -4.6, 9.4); ctx.fill();
        ctx.fillStyle = '#4a3a2c'; ctx.beginPath(); ctx.ellipse(0, 13.4, 1, 1.6, 0, 0, Math.PI * 2); ctx.fill();   // the tail
        // neck and head, turned to look, dipped to graze
        ctx.translate(0, -6.5); ctx.rotate(s.look);
        const hl = 1 - 0.3 * s.head;
        ctx.fillStyle = '#a8865f';
        ctx.beginPath(); ctx.moveTo(-3.4, 1); ctx.quadraticCurveTo(-3, -2.6 * hl, -2.3, -4.2 * hl); ctx.lineTo(2.3, -4.2 * hl); ctx.quadraticCurveTo(3, -2.6 * hl, 3.4, 1); ctx.closePath(); ctx.fill();
        ctx.translate(0, -4 * hl);
        ctx.fillStyle = s.head > 0.5 ? '#a4845f' : '#b3926e';
        ctx.beginPath(); ctx.moveTo(-2.5, 0.4); ctx.quadraticCurveTo(-2.7, -3.4 * hl, -1.5, -6.4 * hl); ctx.quadraticCurveTo(0, -7.3 * hl, 1.5, -6.4 * hl); ctx.quadraticCurveTo(2.7, -3.4 * hl, 2.5, 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e6dac4'; ctx.beginPath(); ctx.ellipse(0, -5.8 * hl, 1.3, 1.4 * hl, 0, 0, Math.PI * 2); ctx.fill();   // the pale muzzle
        ctx.fillStyle = '#9d7c58';
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 2.7, 0.2, 1.1, 0.6, sd * 0.5, 0, Math.PI * 2); ctx.fill(); }   // the ears
        if (s.ram) {
            // the horns: a massive ridged curl each side — back from the crown, out, then round
            // and forward past the cheek, thinning to the tip
            for (const sd of [-1, 1]) {
                const P = [[sd * 1.4, -1.6], [sd * 4.2, 1.2], [sd * 6.2, -1.2], [sd * 5.2, -4.2], [sd * 3.4, -4.6]];
                const seg = (i) => { ctx.beginPath(); ctx.moveTo(...P[i]); ctx.quadraticCurveTo((P[i][0] + P[i + 1][0]) / 2 + sd * (i < 2 ? 0.6 : 0.8), (P[i][1] + P[i + 1][1]) / 2 + (i < 2 ? 0.6 : -0.2), ...P[i + 1]); ctx.stroke(); };
                ctx.lineCap = 'round';
                for (let i = 0; i < 4; i++) { ctx.strokeStyle = 'rgba(60,42,24,0.85)'; ctx.lineWidth = 3.1 - i * 0.55 + 0.9; seg(i); }
                for (let i = 0; i < 4; i++) { ctx.strokeStyle = i < 2 ? '#d2b47e' : '#c4a36c'; ctx.lineWidth = 3.1 - i * 0.55; seg(i); }
                ctx.strokeStyle = 'rgba(90,64,36,0.7)'; ctx.lineWidth = 0.35;
                for (let i = 0; i < 3; i++) { const [x, y] = P[i + 1]; ctx.beginPath(); ctx.moveTo(x - 0.9, y - 0.6); ctx.lineTo(x + 0.9, y + 0.6); ctx.stroke(); }
            }
        } else if (!s.lamb) {
            ctx.strokeStyle = '#8f7250'; ctx.lineWidth = 1; ctx.lineCap = 'round';
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 1.1, -1.4); ctx.quadraticCurveTo(sd * 2.2, 0.4, sd * 2.4, 2.2); ctx.stroke(); }
        }
        ctx.restore();
    }
    // COYOTE from above (references): a lean grizzled grey-tan dog — deep narrow chest, a pinched
    // waist, the darker grizzled saddle soft-edged along the spine, slim reddish-tan legs, a
    // narrow pointed muzzle, BIG upright ears, and the bushy tail carried LOW and straight out
    // behind with a black tip. Sitting, it tucks up short and wraps the tail round its feet.
    const COYOTE_BODY = [[-8, 1.8], [-6.5, 2.8], [-4.5, 3.3], [-1, 3], [2, 2.6], [5, 3.1], [7, 2.6], [8.2, 1.4]];
    function drawCoyote(ctx, K) {
        const sit = K.sit, str = K.moving > 1.5 ? 1.1 : 1;
        const prof = COYOTE_BODY.map(([y, w]) => [y * (1 - 0.35 * sit) + (y > 0 ? 0 : sit * 1.2), w * (1 + 0.25 * sit * (y > 2 ? 1 : 0))]);
        ctx.save(); ctx.translate(K.x + 3, K.y + 4.8); ctx.rotate(K.h); ctx.scale(1, str);
        ctx.fillStyle = 'rgba(40,18,8,0.26)'; bodyPath(ctx, prof); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -10.5, 2.2, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(K.x, K.y); ctx.rotate(K.h); ctx.scale(1, str);
        if (sit < 0.5) drawLegs(ctx, K.step, K.moving, 2.5, -4.8, 5.4, 1.1, 3.2, '#b0845a');
        // the tail: low and straight out, swaying; wrapped round the haunches when it sits
        const sway = Math.sin(K.step * 0.5) * 0.25 * Math.min(1, K.moving), tb = 7.6 * (1 - 0.35 * sit);
        ctx.save(); ctx.translate(0, tb); ctx.rotate(sway + sit * 2.0);
        ctx.fillStyle = '#9c8468'; ctx.beginPath(); ctx.moveTo(-1.2, 0); ctx.quadraticCurveTo(-2.9, 4.5, -1.3, 9.4); ctx.quadraticCurveTo(0, 10.8, 1.3, 9.4); ctx.quadraticCurveTo(2.9, 4.5, 1.2, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#231c16'; ctx.beginPath(); ctx.moveTo(-1.6, 7.6); ctx.quadraticCurveTo(0, 7, 1.6, 7.6); ctx.quadraticCurveTo(1.2, 9.8, 0, 10.8); ctx.quadraticCurveTo(-1.2, 9.8, -1.6, 7.6); ctx.fill();
        ctx.restore();
        const g = ctx.createLinearGradient(-3.4, 0, 3.4, 0);
        g.addColorStop(0, '#c9ab86'); g.addColorStop(0.5, '#ae9373'); g.addColorStop(1, '#94795c');
        ctx.fillStyle = g; ctx.strokeStyle = SOFT; ctx.lineWidth = 0.45;
        bodyPath(ctx, prof); ctx.fill(); ctx.stroke();
        // the grizzled saddle: soft layers along the spine, and a few dark ticks
        for (const [w, a] of [[2.2, 0.25], [1.3, 0.3]]) {
            ctx.fillStyle = `rgba(78,66,54,${a})`;
            ctx.beginPath(); ctx.ellipse(0, -0.5 * (1 - sit), w, 6 * (1 - 0.35 * sit), 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(40,32,26,0.4)'; ctx.lineWidth = 0.3;
        for (let i = 0; i < 7; i++) { const y = -4.5 + i * 1.4, x = (i % 2 ? 0.6 : -0.6); ctx.beginPath(); ctx.moveTo(x - 0.5, y); ctx.lineTo(x + 0.5, y + 0.7); ctx.stroke(); }
        // neck, head (turned to stare, dipped to drink), the big ears
        ctx.translate(0, -7 * (1 - 0.3 * sit) + sit * 1.2); ctx.rotate(K.look);
        const hl = 1 - 0.3 * K.head;
        ctx.fillStyle = '#b39473';
        ctx.beginPath(); ctx.moveTo(-2.5, 1.2); ctx.quadraticCurveTo(-2.8, -2.2 * hl, -0.6, -7.2 * hl); ctx.quadraticCurveTo(0, -7.7 * hl, 0.6, -7.2 * hl); ctx.quadraticCurveTo(2.8, -2.2 * hl, 2.5, 1.2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e2d4bd'; ctx.beginPath(); ctx.ellipse(0, -5.6 * hl, 0.75, 1.5 * hl, 0, 0, Math.PI * 2); ctx.fill();   // pale muzzle
        ctx.fillStyle = '#2a211a'; ctx.beginPath(); ctx.arc(0, -7.3 * hl, 0.5, 0, Math.PI * 2); ctx.fill();                        // the nose
        for (const sd of [-1, 1]) {
            // an upright ear seen from above: a tall triangle standing off the back of the skull
            ctx.fillStyle = '#946c48'; ctx.beginPath(); ctx.moveTo(sd * 0.7, -1.2); ctx.lineTo(sd * 3.4, -0.2); ctx.lineTo(sd * 1.9, 1.8); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#dcc6a6'; ctx.beginPath(); ctx.moveTo(sd * 1.2, -0.7); ctx.lineTo(sd * 2.8, -0.1); ctx.lineTo(sd * 1.9, 1.1); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(30,22,16,0.75)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(sd * 0.7, -1.2); ctx.lineTo(sd * 3.4, -0.2); ctx.lineTo(sd * 1.9, 1.8); ctx.stroke();
        }
        ctx.restore();
    }

    function surfacedWhales() {
        const out = [];
        for (const W of whalePods) for (const m of W.members) {
            const up = m.mode === 'surface' || (m.mode === 'dive' && m.t > 1.2) || !!m.ev;
            if (!up) continue;
            const fx = Math.sin(m.h), fy = -Math.cos(m.h);
            out.push({ m, ax: m.x + fx * m.len * 0.45, ay: m.y + fy * m.len * 0.45, bx: m.x - fx * m.len * 0.33, by: m.y - fy * m.len * 0.33, r: m.len * 0.12 });
        }
        return out;
    }
    // A boat hit it: it throws white water and goes down.
    function startleWhale(m, x, y) {
        splashes.push({ x, y, t: 0, life: 3.5, r: m.len * 0.3 });
        if (m.mode === 'surface' && !m.ev) { m.mode = 'dive'; m.t = 1.3; m.fluke = 0; }
    }

    window.Wildlife = {
        surfacedWhales, startleWhale,
        WILDLIFE, init, update, drawWater, drawPerched, drawAir,
        // The Sailing School's ducklings (school.js owns their motion).
        drawDucklings,
        // For tests and the venue card.
        debug: () => ({ colonies, pods, resident, flight, boil, baskers, divers, waders, cruisers, lurkers, stalkers, perchers, leaps, shoals, poppers, fishers, runs, soarers, rompers, whalePods, blows, splashes, riders, flyfish, gliders, prints, flyPatches, stripers, condors, bands, coyotes, boilsHit, woken: [...lurkWoken], feats: [...feats] }),
        forceBoil: (x, y) => { boil = { x, y, t: 0, life: 45, seed: 1 }; if (flight) flight.mode = 'transit'; },
        // The drawing functions, for a look-bench (eval/_wildlife_bench.js) — not used by the game.
        art: { drawBoilAt: (ctx, x, y, t) => { const o = boil, oT = T; boil = { x, y, t: 10, life: 60, seed: 3 }; T = t; drawBoil(ctx); boil = o; T = oT; }, drawGullFlying, drawGullPerched, drawPelicanFlying, drawPelicanSitting, drawPorpoise,
               drawTurtle, drawTurtleUnder, drawGrebe, drawLoon, drawBeaver, drawMoose, drawSlap, drawWakeTrail, drawDuckling, drawDucklings,
               drawCruiser, seaTurtleShape, eagleRayShape, reefSharkShape, drawGator, drawEgret, drawAnhinga, drawFrog, drawLeap, drawShoal, drawSeal, drawSealHead, drawSealUnder, drawBear, drawSockeye, drawEagle, drawOtter, drawWhale, drawBlow, drawSplash, drawSpinner, drawFlyfish, drawAlbatross, drawPrint, drawMahi, setT: (t) => { T = t; }, drawStriperBoil, drawStriper, drawCondor, drawBighorn, drawCoyote },
    };
})();

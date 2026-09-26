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
        // Glacier Sound (designed Sep 25 2026; Wes chose an ANTARCTIC cast of animals). Painted
        // top-down sprites from the August art pass (assets/images/props/arctic) for the orcas,
        // penguins and leopard seal; the tern is drawn here. The course line (start → the south
        // lane → the narrows → the north pack → the rounding) places the floe animals and terns.
        arctic: {
            lane: [[2800, 1650], [1000, 2400], [-800, 2400], [-1800, 700], [-1500, -1500], [0, -3000]],
            // ORCAS: three travelling pods, each on its own loop (waypoints snapped to open
            // water at init) — the outer fjord, the west basin past the emperors, the north pack.
            // Pods: the outer fjord, the narrows and the north pack (both on the course), the rounding.
            orcas: { speed: 70, pods: [
                { id: 'A', kinds: ['orca', 'orca-b', 'orca-b', 'orca-calf'], at: [[1700, 1900], [400, 2700], [-900, 3000], [-300, 2350], [900, 2250]] },
                { id: 'B', kinds: ['orca', 'orca-b', 'orca'], at: [[-1900, 700], [-1650, -400], [-1350, -1500], [-2000, -1100], [-2250, 100], [-2100, 1500]] },
                { id: 'C', kinds: ['orca', 'orca-b', 'orca-b', 'orca', 'orca-calf'], at: [[-900, -2200], [250, -2000], [900, -2600], [-300, -3500], [-1400, -2600]] },
            ] },
            // PENGUINS, each species where it lives: an emperor huddle on the fast ice of isle-4,
            // gentoos on the two granite skerries by the rounding, a dense macaroni colony on the
            // rounding island's rock, and Adélies riding floes along the course. Groups go to sea
            // porpoising and come back; Adélies on a floe toboggan in when a boat comes close.
            // Grin's "Four Colonies" counts each species passed within visitR while racing.
            penguins: { visitR: 350, feat: 'arctic:colonies', reactR: 110,
                fixed: [{ species: 'emperor', shape: 'isle-4', n: 18, huddle: true }, { species: 'gentoo', shape: 'shape-1', n: 7 },
                        { species: 'gentoo', shape: 'shape-2', n: 6 }, { species: 'macaroni', shape: 'granite-isle', n: 18 }],
                adelieFloes: 7, adelieN: [3, 6] },
            // LEOPARD SEALS: hauled out singly on floes near the course; now and then (or when a
            // boat comes close) one slides in, cruises under the water, and hauls out elsewhere.
            seals: { n: 4, pack: [[-1650, 1100], [-1300, -1700]] },
            // ANTARCTIC TERNS: small flocks hovering and plunge-diving over krill in the lane, and
            // over the meltwater plume at the glacier face (Spike's explorer spot).
            terns: { at: [[1500, 2300, 260], [-1300, 1500, 240], [-1200, -1200, 260], [1750, -3200, 300], [-300, 2550, 220]], n: [5, 9] },
        },
        // Glowtide Strait (designed Sep 26 2026; Wes chose the five). A Palau-like karst strait by
        // moonlight. The GOLDEN JELLYFISH (Mastigias) bloom fills the north-west lagoon — Palau's
        // Jellyfish Lake species — and Bloom's explorer objective is to sail into it; MANTA RAYS feed
        // in the channels, looping through plankton that lights up round them; PALAU FLYING FOXES
        // cross the strait between the karst islands; HAWKSBILL TURTLES swim the reefs and haul up
        // the beaches to nest; DUGONGS graze the seagrass shallows and rise to breathe.
        glowtide: {
            bloom: { c: [-2350, -2550], r: 280, n: 520 },
            // each manta travels a circuit of feeding spots, stopping at each to feed (loops and flips)
            mantas: { routes: [[[650, 3150], [1300, 2600], [300, 2300], [-100, 3300]], [[250, 1350], [-600, 1100], [-200, 400], [600, 800]], [[-420, -700], [300, -1100], [-200, -2100], [-900, -1300]]] },
            // three colonies commuting back and forth between the islands all night, each on its own line
            foxes: { paths: [[[2900, 1400], [-3400, 1250]], [[2700, -350], [-3300, -650]], [[2600, 2900], [-3300, 3300]]], n: [5, 8], z: [55, 85] },
            // swimming spots on and beside the course (the sunken rocks and reef edges they forage)
            hawksbills: { swim: [[-547, -1400, 180], [227, 250, 160], [903, 2250, 170], [-686, 1730, 160], [-68, 664, 150], [337, 3457, 170], [-1513, 1257, 150]], nest: ['shape-56', 'shape-57'] },
            dugongs: [{ shape: 'shape-32', calf: false }, { shape: 'shape-26', calf: true }, { shape: 'shape-33', calf: false }],
        },
        // Otter Point (designed Sep 26 2026; Wes chose the four — see the OTTER POINT section below).
        // Places from eval/_otter_* probes against Wes's recorded races: rafts in the beds the lane
        // passes (the head, the north coast, the gate and the islet), sea lions on the stacks along
        // the north lane, both bird rocks and the cove beach, sharks along the kelp edge and the
        // stacks, blue whales 700-1100 u outside the lane (the Wildlife rung sails out to them).
        otter: {
            seaOtters: { lookR: 300, reactR: 110, rafts: [['kelp-head-mid', 6, true], ['kelp-head-in', 5], ['kelp-islet-inner', 6, true], ['kelp-c5', 4], ['kelp-gate', 5],
                ['kelp-c4', 4, true], ['kelp-c1', 3], ['kelp-c3', 3], ['kelp-c2', 3], ['shape-6', 4]] },
            seaLions: { lookR: 420, reactR: 170, raftAt: 520,
                rocks: [['prop-474', 9], ['prop-475', 10], ['prop-463', 12], ['prop-447', 12], ['prop-462', 9], ['prop-160', 22], ['prop-458', 30], ['prop-296', 8]],   /* packed (Wes's haul-out video) */
                beaches: [['sand-4', 12]], commute: [['prop-160', 10], ['prop-463', 6], ['prop-458', 16], ['prop-474', 4], ['prop-447', 5]] },   /* drone refs: rafts are tight packs of a dozen or more */
            // Each patrols the water where a haul-out's sea lions raft — which is where the lane runs
            // (eval/_otter_race_wild.js: the fleet's line passes 30-40 u from the north stacks' rafts).
            whites: [
                { pingpong: true, path: [[-3950, -1700], [-4700, -1950], [-5250, -2050], [-5350, -2800], [-5000, -3350], [-4400, -3550], [-3700, -3500]] },   // round bird rock and across the beat (there and back: the head is all rocks)
                { path: [[-700, -5950], [0, -6300], [1500, -6550], [2300, -6400], [1400, -6350], [200, -6100]] },            // the west stacks
                { path: [[2800, -6600], [3200, -6900], [4900, -6600], [5600, -6700], [5000, -6300], [3600, -6400]] },        // the east stacks
                { path: [[7550, -3950], [8200, -4250], [8900, -4200], [8300, -3950]] },                       // the islet and the big bird rock
            ],
            // 550-700 u outside the fleet's line: a blow at the edge of the screen now and then, and a
            // real detour to get alongside (nearR is from the whale's middle; it is ~120 u to its head).
            hunt: { feat: 'otter:hunt' },   // a successful hunt with any of it on the player's screen
            blues: { nearR: 250, krill: [[1000, -7400], [4000, -7800], [-5150, 1700], [10000, -5300]], pods: [
                { n: 2, speed: 40, path: [[-2200, -6750], [1000, -7250], [4000, -7700], [6500, -7450], [4000, -7550], [1000, -7100]] },   // offshore of the north lane
                { n: 3, speed: 34, path: [[-4700, 1100], [-5500, 1300], [-5300, 2300], [-4750, 2000]] },   // a group of three just outside the fleet's furthest tacks on the beat (~(-4000, 1950); Wes, Sep 26) — 700 u off at the closest                            // outside the beat
                { n: 1, speed: 38, path: [[9400, -6700], [10000, -5700], [10200, -4700], [9750, -4250], [9550, -5300]] },                                // off the far corner
            ] },
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
    // WINGBEAT TIME (Wes, Sep 26 2026): every wing and flipper beat — birds, bats, the rays'
    // wings, turtles' flippers — runs at HALF the real bird's rate. The sim clock is ~3x, and at
    // the real rates the beats read far too fast. Fish tail beats, jelly pulses and gaits are not wings.
    const WING_TIME = 0.5;

    let cfg = null, rnd = null, T = 0;
    let colonies = [], followers = [], pods = [], resident = null, flight = null, boil = null, baskers = [], divers = [], waders = [], cruisers = [], lurkers = [], stalkers = [], perchers = [], leaps = [], shoals = [], poppers = [];
    let fishers = [], runs = [], soarers = [], rompers = [];
    let stripers = [], nextStriper = 0, boilsHit = 0, condors = [], bands = [], coyotes = [];
    let jellyBloom = null, mantas = [], foxFlocks = [], nextFox = 0, hawksbills = [], dugongs = [];
    let orcaPods = [], colonies2 = [], floeGroups = [], swimmers = [], treks = [], lseals = [], ternFlocks = [], visited = new Set();
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
        orcaPods = []; colonies2 = []; floeGroups = []; swimmers = []; treks = []; jellyBloom = null; mantas = []; foxFlocks = []; nextFox = 0; hawksbills = []; dugongs = []; lseals = []; ternFlocks = []; visited = new Set();
        whalePods = []; blows = []; splashes = []; riders = []; flyfish = []; gliders = []; nextFly = 0; prints = []; flyPatches = [];
        foams = []; blood = []; seaOtterRafts = []; slHauls = []; slGroups = []; whites = []; bluePods = []; blueBlows = []; krill = []; huntCool = 8;
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
        if (cfg.orcas) orcaPods = cfg.orcas.pods.map((P, i) => makeOrcaPod(P, i));
        if (cfg.penguins) { colonies2 = makeColonies(cfg.penguins); floeGroups = makeFloeGroups(cfg.penguins); }
        if (cfg.seals) lseals = makeSeals(cfg.seals);
        if (cfg.terns) ternFlocks = makeTerns(cfg.terns);
        if (cfg.bloom) jellyBloom = makeBloom(cfg.bloom);
        if (cfg.mantas) mantas = makeMantas(cfg.mantas);
        if (cfg.foxes) foxFlocks = cfg.foxes.paths.map((P, k) => makeFoxFlock(cfg.foxes, P, k));
        if (cfg.hawksbills) hawksbills = makeHawksbills(cfg.hawksbills);
        if (cfg.dugongs) dugongs = makeDugongs(cfg.dugongs);
        if (cfg.seaOtters) seaOtterRafts = makeSeaOtters(cfg.seaOtters);
        if (cfg.seaLions) { slHauls = makeSeaLions(cfg.seaLions);
            for (const [id, n] of cfg.seaLions.commute || []) { const H = slHauls.find(q => q.id === id); if (H) { const G = makeSLGroup(H, n, H.sea.x, H.sea.y, 'raft'); G.t = R(5, 40); slGroups.push(G); } } }
        if (cfg.whites) whites = makeWhites(cfg.whites);
        if (cfg.blues) bluePods = makeBluePods(cfg.blues);
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
        if (sig !== lastRaceSig) { lastRaceSig = sig; feats = new Set(); lurkWoken = new Set(); boilsHit = 0; for (const B of stripers) B.hit = false; visited = new Set(); }
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
        if (orcaPods.length) updateOrcas(dt);
        if (cfg.penguins) updatePenguins(dt, me);
        if (lseals.length) updateSeals(dt);
        if (ternFlocks.length) updateTerns(dt);
        if (jellyBloom) updateBloom(dt);
        if (mantas.length) updateMantas(dt);
        if (cfg.foxes) updateFoxes(dt);
        if (hawksbills.length) updateHawksbills(dt);
        if (dugongs.length) updateDugongs(dt);
        if (seaOtterRafts.length) updateSeaOtters(dt);
        if (slHauls.length || slGroups.length) updateSeaLions(dt);
        if (whites.length) updateWhites(dt);
        if (bluePods.length) updateBlues(dt, me);
        if (cfg.seaLions || cfg.blues) { for (const S of splashes) S.t += dt; if (!whalePods.length) splashes = splashes.filter(S => S.t < S.life); }
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
                e.flap += dt * 16 * WING_TIME;   // ~2.6 Hz real
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
            a.t += dt; a.flap += dt * WING_TIME; a.splash = Math.max(0, a.splash - dt * 1.2);
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
            E.t -= dt; E.flap += dt * WING_TIME * (E.mode === 'climb' || E.mode === 'grab' ? 15 : 0); E.splash = Math.max(0, E.splash - dt * 1.2);
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
            f.ph += dt * (spd / base) * (c.kind === 'eagleray' ? 1.6 * WING_TIME : c.kind === 'reefshark' ? 5.5 : 2.2 * WING_TIME);
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
            g.flap += dt * WING_TIME * (g.mode === 'perched' ? 0 : 20);   // ~3.2 Hz real, the herring gull's beat
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
        for (const b of f.birds) { b.a += b.w * dt; b.flap += dt * 20 * WING_TIME; b.gl = (b.gl || 0) + dt; }
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
            b.flap += dt * WING_TIME * (b.mode === 'fly' ? 14 : 0);   // ~2.2 Hz real, slow and deep
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

    // ── GLACIER SOUND: orcas, penguins, leopard seals, terns (Sep 25 2026) ───────────────
    // The painted top-down sprites, and the INK length (px) of each frame's animal, so every one
    // draws at a target length in world units. Nose up in the frame. Sizes (guidelines/scale.md,
    // re-checked Sep 25 after Wes asked): orcas at TRUE size like the humpbacks — male 7.6 m -> 76,
    // female 6 m -> 60, a young calf 3.2 m -> 32; penguins at the floor-and-rank rule (3x true,
    // floor 20, ~15% steps to keep the order) — emperor 1.15 m -> 30, gentoo 0.8 m -> 24, macaroni
    // 0.7 m -> 21, Adélie 0.7 m -> 20; the leopard seal 3.2 m -> 60 (a broad animal, ~2x); the tern
    // 0.4 m -> 20 bill to tail streamers, spanning 32.
    const ARCTIC_SPR = {
        orca: { ink: 307, len: 76, parts: true, hinge: 0.7998 }, 'orca-b': { ink: 287, len: 60, parts: true, hinge: 0.7988 },
        'orca-calf': { ink: 168, len: 32, parts: true, hinge: 0.7715 },
        emperor: { file: 'penguin-emperor', ink: 94, len: 30 }, adelie: { file: 'penguin-adelie', ink: 76, len: 20 },
        gentoo: { file: 'penguin-gentoo', ink: 79, len: 24 }, macaroni: { file: 'penguin-macaroni', ink: 98, len: 21 },
        porpoise: { file: 'penguin-porpoising', ink: 76, len: 20 }, seal: { file: 'seal', ink: 154, len: 60 },
    };
    const _arcticImg = {};
    function arcticImg(name) {
        if (!_arcticImg[name] && typeof Image !== 'undefined') { const im = new Image(); im.src = 'assets/images/props/arctic/' + name + '.png'; _arcticImg[name] = im; }
        return _arcticImg[name];
    }
    const imgReady = (im) => im && im.complete && im.naturalWidth > 0;
    // A sprite by key, centred, nose along h, scaled so its ink is `len` long.
    // THE LEOPARD SEAL'S BACK (review against references, Sep 25 2026): from above a leopard
    // seal is a long, slim, dark slate-grey animal — the leopard spotting is on the PALE THROAT and
    // flanks, barely on the back — with a huge flat reptilian head. The August sprite is a stout
    // pale seal with white blotches over the back (a harbour seal from above), so it is drawn
    // slimmer (0.82 across) and its back darkened toward slate, the spots subdued to a faint mottle.
    let _sealBack = null;
    function sealBackImg(im) {
        if (!_sealBack && typeof document !== 'undefined') {
            const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d');
            g.drawImage(im, 0, 0);
            g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(118,128,140)'; g.fillRect(0, 0, c.width, c.height);   // slate, the pale blotches knocked back
            g.globalCompositeOperation = 'destination-in'; g.drawImage(im, 0, 0);                                           // keep the silhouette
            _sealBack = c;
        }
        return _sealBack || im;
    }
    function drawArcticSprite(ctx, key, x, y, h, alpha, lenMul) {
        const S = ARCTIC_SPR[key]; let im = arcticImg(S.file || key); if (!imgReady(im)) return;
        const k = S.len * (lenMul || 1) / S.ink, w = im.naturalWidth * k, hh = im.naturalHeight * k;
        const slim = key === 'seal' ? 0.82 : 1; if (key === 'seal') im = sealBackImg(im);
        ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(slim, 1); ctx.globalAlpha *= alpha; ctx.drawImage(im, -w / 2, -hh / 2, w, hh); ctx.restore();
    }
    const ORCA_KNOTS = 70;   // ~5 kn cruising
    // Land that isn't ice drifting: authored shapes only (floes move; swimmers pass under them).
    function fixedLand(x, y) {
        for (const s of (state.course && state.course.islands) || []) {
            if (s.isFloe || s.awash || !s.vertices || (s.id || '').endsWith('.hit')) continue;
            if (Math.hypot(x - s.x, y - s.y) > (s.radius || 1e9)) continue;
            if (pointInPoly(x, y, s.vertices)) return true;
        }
        return false;
    }
    function openWater(x, y, m) {
        if (fixedLand(x, y)) return false;
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; if (fixedLand(x + Math.cos(a) * m, y + Math.sin(a) * m)) return false; }
        return true;
    }
    // SOLID: any hard shape — rock, the ice coast and islands, AND the drifting floes (they are
    // ice, and nothing swims under them). `ignore` lets a swimmer come alongside the floe it is
    // making for. Awash shapes are water.
    // A floe is also solid where it WILL be in the next ~0.9 s — drifting AND spinning (a big
    // floe's rim sweeps at up to ~70 u/s) — a swimmer sees the ice coming; a check against only
    // where it is now let floes slide over the animals.
    const FLOE_LOOK = 0.9;
    function solidAt(x, y, ignore, noFloes) {
        for (const s of (state.course && state.course.islands) || []) {
            if (s === ignore || (noFloes && s.isFloe) || s.awash || !s.vertices || s.vertices.length < 3) continue;
            const r = (s.radius || 1e9) + (s.isFloe ? 20 : 0), dx = x - s.x, dy = y - s.y; if (dx * dx + dy * dy > r * r) continue;
            if (pointInPoly(x, y, s.vertices)) return s;
            if (s.isFloe) for (const k of [0.35, 1]) {
                // where this point sits on the floe as it will be: undo its drift and its spin
                const tt = FLOE_LOOK * k, w = -(s.spinRate || 0) * tt, px = x - (s.driftVx || 0) * tt - s.x, py = y - (s.driftVy || 0) * tt - s.y;
                if (pointInPoly(s.x + px * Math.cos(w) - py * Math.sin(w), s.y + px * Math.sin(w) + py * Math.cos(w), s.vertices)) return s;
            }
        }
        return null;
    }
    // Move a swimmer toward (tx, ty) at speed v without ever putting its body on or under
    // anything solid: of the headings near the wanted one, take the closest whose way ahead is
    // open across the body's width; never step so that the nose, middle or tail lands on solid;
    // and if a drifting floe has come over it, get out from under — straight away from its centre.
    const SWIM_TRIES = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2, -2, 2.6, -2.6, Math.PI];
    // The body's footprint at a pose: nose, middle, tail, and the half-way points. Any on solid?
    function bodyHit(x, y, h, halfLen, ignore, noFloes) {
        const fx = Math.sin(h), fy = -Math.cos(h);
        // sampled no more than ~5 u apart, so a thin spit of rock can't slip between the samples
        const n = Math.max(4, Math.ceil(halfLen / 5));
        for (let i = n; i >= -n; i--) { const k = i / n, s = solidAt(x + fx * halfLen * k, y + fy * halfLen * k, ignore, noFloes); if (s) return s; }
        return null;
    }
    // noFloes: a whale — it dives under the pack, so only rock and the fixed ice stop it.
    // The nearest spot of open water the whole body fits in (rings outward from o), or null.
    // ...reachable in a straight line that never crosses rock or fixed ice (floes it may slip past).
    function nearestClear(o, halfLen, ignore, noFloes, maxR) {
        for (let r = 12; r <= (maxR || 360); r += 12) for (let i = 0; i < 16; i++) {
            const a = i / 16 * Math.PI * 2, x = o.x + Math.sin(a) * r, y = o.y - Math.cos(a) * r;
            if (bodyHit(x, y, a, halfLen, ignore, noFloes)) continue;
            let ok = true; for (let k = 1; k < 6 && ok; k++) if (solidAt(o.x + (x - o.x) * k / 6, o.y + (y - o.y) * k / 6, ignore, true)) ok = false;
            if (ok) return { x, y, a };
        }
        return null;
    }
    // Still under the ice after 0.2 s — a squeeze between floes, or against the shore, that the
    // slide-out can't solve: it comes up in the nearest open water it can reach (a dive and a
    // resurface; the caller shows the ring). Returns true when it did.
    function unstick(o, dt, halfLen, ignore) {
        if (!bodyHit(o.x, o.y, o.h, halfLen * 0.6, ignore)) { o.stuck = 0; return false; }
        o.stuck = (o.stuck || 0) + dt; if (o.stuck < 0.2) return false;
        const q = nearestClear(o, halfLen, ignore, false, 900); o.stuck = 0;
        if (q) { o.x = q.x; o.y = q.y; o.h = q.a; return true; }
        return false;
    }
    function swimTo(o, tx, ty, v, turn, dt, halfLen, halfW, ignore, noFloes) {
        // a drifting floe (or the start) has put ice on the body: slide straight out from it
        const cover = bodyHit(o.x, o.y, o.h, halfLen, ignore, noFloes);
        if (cover) {
            const q = nearestClear(o, halfLen, ignore, noFloes), sp = Math.max(v, 40) * 2 * dt;
            if (q) { const d = Math.hypot(q.x - o.x, q.y - o.y), k = Math.min(1, sp / (d || 1)), nx = o.x + (q.x - o.x) * k, ny = o.y + (q.y - o.y) * k;
                // squeezed: it turns and slips out along the escape line; its body may not touch rock
                // or fixed ice on the way (only the drifting ice it is escaping)
                const ea = Math.atan2(q.x - o.x, -(q.y - o.y));
                for (const h of [ea, o.h, q.a]) if (!bodyHit(nx, ny, h, halfLen, ignore, true)) { o.x = nx; o.y = ny; o.h = h; break; }
            }
            return;
        }
        const want = Math.atan2(tx - o.x, -(ty - o.y)); let go = null;
        for (const da of SWIM_TRIES) {
            const a = want + da, sa = Math.sin(a), ca = Math.cos(a); let clear = true;
            for (const r of [halfLen + 10, halfLen + 45, halfLen + 90]) { for (const w of [-halfW, 0, halfW]) if (solidAt(o.x + sa * r + ca * w, o.y - ca * r + sa * w, ignore, noFloes)) { clear = false; break; } if (!clear) break; }
            if (clear) { go = a; break; }
        }
        if (go === null) go = o.h + Math.PI;
        // turn toward it — but only into a pose whose whole body is clear; then step, the same rule
        const h1 = o.h + Math.max(-turn * dt, Math.min(turn * dt, angDiff(go, o.h)));
        for (const h of [h1, o.h, o.h + (h1 - o.h) * 0.5]) {
            const nx = o.x + Math.sin(h) * v * dt, ny = o.y - Math.cos(h) * v * dt;
            if (!bodyHit(nx, ny, h, halfLen, ignore, noFloes)) { o.h = h; o.x = nx; o.y = ny; return; }
        }
        if (!bodyHit(o.x, o.y, h1, halfLen, ignore, noFloes)) o.h = h1;   // can't go on: turn on the spot if the turn is clear
    }
    function snapWater(x, y, m) {
        if (openWater(x, y, m)) return { x, y };
        for (let r = 40; r < 1200; r += 40) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (openWater(px, py, m)) return { x: px, y: py }; }
        return { x, y };
    }
    const floeList = () => ((state.course && state.course.islands) || []).filter(s => s.isFloe);
    const floeToWorld = (F, lx, ly) => { const c = Math.cos(F.spin || 0), s = Math.sin(F.spin || 0); return { x: F.x + lx * c - ly * s, y: F.y + lx * s + ly * c }; };
    function laneDist(x, y) {
        const L = cfg.lane || []; let best = 1e9;
        for (let i = 0; i < L.length - 1; i++) { const [ax, ay] = L[i], [bx, by] = L[i + 1], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); }
        return best;
    }
    // A spot on a floe's surface, well inside its snow (localVeg is the snow cap, 0.7 of the art).
    function floeSpot(F, inset) {
        const V = F.localVeg || F.localArt || []; if (V.length < 3) return { x: 0, y: 0 };
        for (let k = 0; k < 30; k++) { const a = R(0, 7), d = Math.sqrt(rnd()) * F.radius * (inset || 0.45), x = Math.cos(a) * d, y = Math.sin(a) * d; if (pointInPoly(x, y, V)) return { x, y }; }
        return { x: 0, y: 0 };
    }

    // ORCAS. A pod steers round its loop; members hold a loose side-by-side formation. Each
    // surfaces on a shared rhythm (a little out of step): rise, a short blow, the back rolling
    // through, down again; between, they travel a few metres under, seen as dim shapes.
    function makeOrcaPod(P, i) {
        const pts = P.at.map(([x, y]) => snapWater(x, y, 90));
        const members = P.kinds.map((kind, j) => ({ j, kind, x: pts[0].x, y: pts[0].y, h: 0, sd: (j % 2 ? 1 : -1) * Math.ceil(j / 2), back: (j >> 1) * 34 + R(-8, 8) + (kind === 'orca-calf' ? 16 : 0),
            ph: R(0, 0.25), beat: R(0, 7), blow: 0, trail: [], trailT: 0 }));
        return { i, cfg: P, pts, wi: 1, x: pts[0].x, y: pts[0].y, h: 0, members, cycle: R(0, 8), period: R(7, 11), breaths: Math.round(R(1, 4)) };
    }
    function updateOrcas(dt) {
        for (const W of orcaPods) {
            const [tx, ty] = [W.pts[W.wi].x, W.pts[W.wi].y];
            // look ahead: of the headings near the one to the waypoint, the closest whose next
            // 220 u (and the pod's width either side) is open water
            swimTo(W, tx, ty, ORCA_KNOTS, 0.7, dt, 60, 70, null, true);
            W.leg = (W.leg || 0) + dt;
            if (Math.hypot(tx - W.x, ty - W.y) < 120 || W.leg > 60) { W.wi = (W.wi + 1) % W.pts.length; W.leg = 0; }
            // Travelling killer whales take ONE breath per surfacing, in bouts: a few short
            // surfacings close together, then a longer dive (research on BC residents: ~1.6
            // breaths a minute travelling). Game time runs ~3x: bouts of 3-5 breaths 7-11 s
            // apart, then 35-60 s down.
            W.cycle += dt; if (W.cycle > W.period) { W.cycle -= W.period; W.breaths--; if (W.breaths <= 0) { W.breaths = Math.round(R(4, 6)) + 1; W.period = R(20, 32); } else W.period = R(6, 9); }
            W.diving = W.breaths === 1 && W.period > 18;   // (the long dive: no surfacing this cycle)
            const fx = Math.sin(W.h), fy = -Math.cos(W.h), rx = -fy, ry = fx;
            for (const m of W.members) {
                let tx2 = W.x + rx * m.sd * 46 - fx * m.back, ty2 = W.y + ry * m.sd * 46 - fy * m.back;
                if (solidAt(tx2, ty2, null, true)) { tx2 = W.x - fx * (50 + m.j * 45); ty2 = W.y - fy * (50 + m.j * 45); }   // its slot is on the ice: in line astern
                const d = Math.hypot(tx2 - m.x, ty2 - m.y), L2 = ARCTIC_SPR[m.kind].len * 0.5;
                const v = Math.min(ORCA_KNOTS * 1.3, d * 1.5 + ORCA_KNOTS * 0.6);
                // steer for a point ahead of its slot, so it swims along with the pod, not at the slot
                swimTo(m, tx2 + fx * 60, ty2 + fy * 60, v, 1.2, dt, L2, 9, null, !(m.up >= 0));   // at the surface it goes round the floes; under, it passes beneath
                // the surfacing: u in [0,1] over the 4 s after the pod's cycle starts, per member offset
                const t = W.cycle - m.ph * 4;
                const was = m.up || 0, L3 = ARCTIC_SPR[m.kind].len * 0.5;
                if (was < 0 && t >= 0 && t < 0.2 && bodyHit(m.x, m.y, m.h, L3)) m.hold = true;          // ice overhead: it can't come up here
                if (m.hold && !bodyHit(m.x, m.y, m.h, L3)) m.hold = false;
                if (was >= 0 && bodyHit(m.x, m.y, m.h, L3)) { m.hold = true; }                            // a floe drifting over it at the surface: it goes down
                m.up = !W.diving && !m.hold && t >= 0 && t < 4 ? t / 4 : -1;
                // the blow goes as the blowhole breaks the surface (a third of the way into the roll),
                // and hangs where it was blown while the whale travels on
                if (m.up >= 0.28 && was < 0.28) { m.blow = 1; const L = ARCTIC_SPR[m.kind].len; m.bx = m.x + Math.sin(m.h) * L * 0.22; m.by = m.y - Math.cos(m.h) * L * 0.22; m.bh = m.kind === 'orca' ? 1 : m.kind === 'orca-b' ? 0.85 : 0.55; }
                m.blow = Math.max(0, m.blow - dt / 2.2);
                m.beat += dt * (m.up >= 0 ? 2.2 : 3.2);
                m.trailT += dt; if (m.trailT > 0.12) { m.trailT = 0; if (m.up >= 0) { m.trail.unshift({ x: m.x, y: m.y }); if (m.trail.length > 12) m.trail.pop(); } else if (m.trail.length) m.trail.pop(); }
            }
        }
    }

    // PENGUINS, species by species (references + field notes, Sep 25 2026):
    //  - ON THE ICE they walk to the water in SINGLE FILE along their own track (the drone shots
    //    of gentoo and emperor lines), or TOBOGGAN on their bellies pushing with their feet —
    //    Adélies and emperors on snow and ice; gentoos and macaronis on rock only walk.
    //  - They go in ONE AFTER ANOTHER off the edge (Adélies hesitate at a floe edge, then all
    //    go in a rush), and come out with a leap onto the ice (an Adélie clears 2-3 m).
    //  - IN THE WATER gentoos, Adélies and macaronis PORPOISE — short arcs clear of the water
    //    every second or two at 2-3 m/s (7-10 km/h), breathing without slowing; gentoos are the
    //    fastest. Emperors do NOT porpoise: they swim low and deep, a back or a head breaking
    //    the surface now and then, and ROCKET out onto the ice.
    // Gaits in drawn body lengths a second (scale.md rule 8, the game's ~3x clock): emperors walk
    // slowly and stately (0.6 BL/s) on a slow rock (~1.5 steps a second); Adélies bustle (1 BL/s,
    // ~3 steps a second); gentoos stride; macaronis HOP on rock, feet together. Tobogganing is
    // about twice walking. Swimming: porpoisers ~3 BL/s, gentoos fastest and leaping highest;
    // emperors cruise ~1.7 BL/s. `rock` is the waddle's angular rate, `amp` its roll.
    const PENG = {
        emperor: { walk: 18, slide: 45, swim: 50, porp: null, toboggan: true, rock: 4.8, amp: 0.08 },
        adelie: { walk: 22, slide: 40, swim: 60, porp: [1.2, 1.7], hop: 7, toboggan: true, rock: 9.4, amp: 0.16 },
        gentoo: { walk: 24, slide: 0, swim: 72, porp: [1.0, 1.4], hop: 9, toboggan: false, rock: 8, amp: 0.13 },
        macaroni: { walk: 21, slide: 0, swim: 60, porp: [1.2, 1.6], hop: 7, toboggan: false, rock: 7, amp: 0.05, hops: true },
    };
    function colonySpot(isl, m) {
        // on the shape, near its water edge on the side the course sees
        const V = isl.vertices; let best = null, bd = 1e9;
        for (let k = 0; k < 400; k++) {
            const v = V[Math.floor(rnd() * V.length)], u = R(0.05, 0.4), x = v.x + (isl.x - v.x) * u, y = v.y + (isl.y - v.y) * u;
            if (!pointInPoly(x, y, V) || !pointInPoly(x + m, y, V) || !pointInPoly(x - m, y, V) || !pointInPoly(x, y + m, V) || !pointInPoly(x, y - m, V)) continue;
            const d = laneDist(x, y); if (d < bd) { bd = d; best = { x, y }; }
        }
        return best || { x: isl.x, y: isl.y };
    }
    // The colony's way to the sea: from its centre toward the nearest open water, the last point
    // on the shape (the edge) and a point out in the water.
    function colonyShore(C) {
        let best = null;
        for (let i = 0; i < 24; i++) {
            const a = i / 24 * Math.PI * 2, fx = Math.sin(a), fy = -Math.cos(a);
            let e = null;
            for (let d = 4; d < 400; d += 4) { const x = C.home.x + fx * d, y = C.home.y + fy * d; if (!pointInPoly(x, y, C.isl.vertices)) { e = { x: C.home.x + fx * (d - 5), y: C.home.y + fy * (d - 5), d }; break; } }
            if (!e || fixedLand(e.x + fx * 30, e.y + fy * 30)) continue;
            if (!best || e.d < best.e.d) best = { e, w: { x: e.x + fx * 30, y: e.y + fy * 30 }, h: a };
        }
        return best;
    }
    function makeColonies(c) {
        const out = [];
        for (const F of c.fixed) {
            const isl = (state.course.islands || []).find(s => s.id === F.shape); if (!isl) continue;
            const home = colonySpot(isl, F.huddle ? 30 : 16), birds = [];
            const sp = F.huddle ? 7.5 : F.species === 'macaroni' ? 11 : 15;
            for (let i = 0; i < F.n; i++) {
                for (let k = 0; k < 40; k++) {
                    const a = R(0, 7), d = Math.sqrt(rnd()) * sp * Math.sqrt(F.n) * 0.62, x = home.x + Math.cos(a) * d, y = home.y + Math.sin(a) * d;
                    if (!pointInPoly(x, y, isl.vertices) || birds.some(b => Math.hypot(b.x - x, b.y - y) < sp * 0.72)) continue;
                    birds.push({ x, y, hx: x, hy: y, h: F.huddle ? Math.atan2(x - home.x, -(y - home.y)) + Math.PI : R(0, 7), t: R(1, 6), bob: R(0, 7) }); break;
                }
            }
            const C = { species: F.species, isl, home, birds, huddle: !!F.huddle, nextSea: R(10, 40), ice: isl.style === 'ice' };
            C.shore = colonyShore(C);
            out.push(C);
        }
        return out;
    }
    function makeFloeGroups(c) {
        const floes = floeList().filter(F => F.radius >= 60 && F.radius <= 260).sort((a, b) => laneDist(a.x, a.y) - laneDist(b.x, b.y));
        const out = [];
        for (const F of floes) {
            if (out.length >= c.adelieFloes) break;
            if (laneDist(F.x, F.y) > 700 || out.some(G => Math.hypot(G.floe.x - F.x, G.floe.y - F.y) < 700)) continue;
            const n = Math.round(R(c.adelieN[0], c.adelieN[1]));
            out.push({ floe: F, birds: Array.from({ length: n }, () => { const p = floeSpot(F, 0.4); return { lx: p.x, ly: p.y, lh: R(0, 7), t: R(1, 5), bob: R(0, 7), slideT: R(20, 60) }; }) });
        }
        return out;
    }
    function swimGroupFrom(species, x, y, awayH, n) {
        const P = PENG[species];
        const birds = Array.from({ length: n }, (_, i) => ({ ox: R(-16, 16), oy: -i * 13 + R(-5, 5), ph: R(0, 1.6), per: P.porp ? R(P.porp[0], P.porp[1]) : R(3, 5) }));
        return { species, x, y, h: awayH, t: 0, out: R(10, 18), back: null, birds };
    }
    // A TREK: birds moving over the ice or rock one after another along one path — out to the
    // water (walking in single file, or tobogganing), or in from it (a leap out, then walking).
    // pts are world points, or floe-local ones when `floe` is set (the floe drifts and spins).
    function trekPos(T, s) {
        const P = T.pts; let x = P[0].x, y = P[0].y, h = 0;
        for (let i = 0; i < P.length - 1; i++) {
            const a = P[i], b = P[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
            h = Math.atan2(b.x - a.x, -(b.y - a.y));
            if (s <= L || i === P.length - 2) { const u = Math.min(1, s / L); x = a.x + (b.x - a.x) * u; y = a.y + (b.y - a.y) * u; break; }
            s -= L;
        }
        if (T.floe) { const w = floeToWorld(T.floe, x, y); return { x: w.x, y: w.y, h: h + (T.floe.spin || 0) }; }
        return { x, y, h };
    }
    const trekLen = (T) => T.pts.reduce((a, p, i) => i ? a + Math.hypot(p.x - T.pts[i - 1].x, p.y - T.pts[i - 1].y) : 0, 0);
    function updateTreks(dt) {
        for (const T of treks) {
            const L = trekLen(T); let all = true;
            for (const b of T.birds) {
                b.delay -= dt; if (b.delay > 0) { all = false; continue; }
                b.splash = Math.max(0, (b.splash || 0) - dt / 0.9);
                if (b.done) continue;
                if (T.dir === 'in' && !b.leapt) { b.leapt = true; b.splash = 1; const p = trekPos(T, 0); b.sx = p.x; b.sy = p.y; }
                b.step = (b.step || 0) + dt;
                const G = PENG[T.species];
                // the waddle surges twice a rock; a macaroni hops — a bound, then a pause
                const v = T.slide ? T.speed : G.hops ? T.speed * 2.2 * Math.max(0, Math.sin(b.step * G.rock)) : T.speed * (0.75 + 0.5 * Math.max(0, Math.sin(b.step * G.rock)));
                b.s += v * dt;
                if (b.s >= L) { b.done = true; b.s = L; if (T.dir === 'out') { b.splash = 1; const p = trekPos(T, L); b.sx = p.x; b.sy = p.y; } }
                if (!b.done) all = false;
            }
            T.t = (T.t || 0) + dt;
            if (all && T.birds.every(b => !(b.splash > 0))) { T.done = true; T.onEnd && T.onEnd(T); }
        }
        treks = treks.filter(T => !T.done);
    }
    function updatePenguins(dt, me) {
        const c = cfg.penguins;
        // Four Colonies: each species passed within visitR, while racing
        if (me) {
            const seen = (sp, x, y) => { if (!visited.has(sp) && Math.hypot(me.x - x, me.y - y) < c.visitR) { visited.add(sp); if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: c.feat, value: visited.size }); } };
            for (const C of colonies2) seen(C.species, C.home.x, C.home.y);
            for (const G of floeGroups) if (G.birds.length) seen('adelie', G.floe.x, G.floe.y);
        }
        for (const C of colonies2) {
            for (const b of C.birds) { b.t -= dt; b.bob += dt; if (b.t <= 0) { b.t = R(2, 7); if (!C.huddle) b.h += R(-1.2, 1.2); } }
            // An emperor huddle ROLLS: birds on the windward edge shuffle round the outside to the
            // lee and push in, so the mass creeps and turns (a few cm a second — here a slow drift).
            if (C.huddle) for (const b of C.birds) {
                const dx = b.hx - C.home.x, dy = b.hy - C.home.y, r = Math.hypot(dx, dy) || 1, w = 0.03 * (r / 20);
                const nx = C.home.x + dx * Math.cos(w * dt) - dy * Math.sin(w * dt), ny = C.home.y + dx * Math.sin(w * dt) + dy * Math.cos(w * dt);
                if (pointInPoly(nx, ny, C.isl.vertices)) { b.hx = nx; b.hy = ny; b.x = nx; b.y = ny; }
            }
            C.nextSea -= dt;
            if (C.nextSea <= 0 && C.shore && C.birds.length > 4) {
                // a party goes to sea: the birds nearest the way down, in single file
                C.nextSea = C.huddle ? R(60, 120) : R(30, 70);
                const P = PENG[C.species], n = Math.min(C.birds.length - 3, Math.round(R(3, 5)));
                const party = C.birds.slice().sort((a, b) => Math.hypot(a.x - C.shore.e.x, a.y - C.shore.e.y) - Math.hypot(b.x - C.shore.e.x, b.y - C.shore.e.y)).slice(0, n);
                C.birds = C.birds.filter(b => !party.includes(b));
                const start = party[0], slide = C.ice && P.toboggan;
                treks.push({ species: C.species, dir: 'out', slide, speed: slide ? P.slide : P.walk, pts: [{ x: start.x, y: start.y }, C.shore.e],
                    birds: party.map((b, i) => ({ delay: i * R(0.6, 1.1), s: 0, home: b })),
                    onEnd: (T) => { const S = swimGroupFrom(C.species, C.shore.w.x, C.shore.w.y, C.shore.h, T.birds.length); S.home = C; S.party = T.birds.map(q => q.home); swimmers.push(S); } });
            }
        }
        for (const G of floeGroups) {
            if (!G.birds.length || G.leaving) continue;
            for (const b of G.birds) {
                b.t -= dt; b.bob += dt; if (b.t <= 0) { b.t = R(2, 6); b.lh += R(-1, 1); }
                // now and then one toboggans across its floe to a new spot
                b.slideT -= dt; if (b.slideT <= 0 && !b.sliding) { const p = floeSpot(G.floe, 0.4); b.sliding = { x0: b.lx, y0: b.ly, x1: p.x, y1: p.y, u: 0 }; b.slideT = R(25, 70); }
                if (b.sliding) { const S = b.sliding, L = Math.hypot(S.x1 - S.x0, S.y1 - S.y0) || 1; S.u += dt * 26 / L; b.lh = Math.atan2(S.x1 - S.x0, -(S.y1 - S.y0));
                    b.lx = S.x0 + (S.x1 - S.x0) * Math.min(1, S.u); b.ly = S.y0 + (S.y1 - S.y0) * Math.min(1, S.u); if (S.u >= 1) b.sliding = null; }
            }
            const bt = boatNear(G.floe.x, G.floe.y, G.floe.radius + c.reactR);
            if (bt) {
                // they rush to the far edge on their bellies and go in one after another
                const away = Math.atan2(G.floe.x - bt.x, -(G.floe.y - bt.y)), la = away - (G.floe.spin || 0);
                let e = { x: Math.sin(la) * G.floe.radius * 0.5, y: -Math.cos(la) * G.floe.radius * 0.5 };
                for (let r = 0.5; r < 1.3; r += 0.05) { const x = Math.sin(la) * G.floe.radius * r, y = -Math.cos(la) * G.floe.radius * r; if (!pointInPoly(x, y, G.floe.localArt || G.floe.localVeg)) break; e = { x, y }; }
                const order = G.birds.slice().sort((a, b) => Math.hypot(a.lx - e.x, a.ly - e.y) - Math.hypot(b.lx - e.x, b.ly - e.y));
                const n = order.length, floe = G.floe;
                for (let i = 0; i < n; i++) {
                    const b = order[i];
                    treks.push({ species: 'adelie', dir: 'out', slide: true, speed: PENG.adelie.slide * 1.3, floe, pts: [{ x: b.lx, y: b.ly }, e], birds: [{ delay: i * R(0.2, 0.4), s: 0 }],
                        onEnd: i === n - 1 ? () => { const w = floeToWorld(floe, e.x * 1.25, e.y * 1.25); swimmers.push(Object.assign(swimGroupFrom('adelie', w.x, w.y, away, n), { toFloe: true })); } : null });
                }
                G.birds = [];
            }
        }
        updateTreks(dt);
        for (const S of swimmers) {
            const P = PENG[S.species];
            // a group that has just gone in starts in open water, never under a floe
            if (!S.placed) { S.placed = true; if (bodyHit(S.x, S.y, S.h, 22, S.home ? S.home.isl : null)) { const q = nearestClear(S, 22, S.home ? S.home.isl : null); if (q) { S.x = q.x; S.y = q.y; } } }
            S.t += dt;
            // out, then home (a colony) or onto another floe
            if (S.t > S.out && !S.back) {
                if (S.home) S.back = { x: S.home.shore.w.x, y: S.home.shore.w.y };
                else { const F = floeList().filter(f => f.radius >= 60 && f.radius <= 260 && !floeGroups.some(G => G.floe === f && G.birds.length) && !sealFloes().has(f) && Math.hypot(f.x - S.x, f.y - S.y) < 900).sort((a, b) => Math.hypot(a.x - S.x, a.y - S.y) - Math.hypot(b.x - S.x, b.y - S.y))[0]; S.back = F ? { floe: F } : { x: S.x, y: S.y, gone: true }; }
            }
            let tx, ty;
            if (S.back) { tx = S.back.floe ? S.back.floe.x : S.back.x; ty = S.back.floe ? S.back.floe.y : S.back.y; }
            else { S.wa = (S.wa || S.h) + Math.sin(S.t * 0.4) * 0.2 * dt; tx = S.x + Math.sin(S.wa) * 300; ty = S.y - Math.cos(S.wa) * 300; }
            // the group is ~2 birds wide and ~4 long; home water is by the shore, so let it in to its colony's shape
            swimTo(S, tx, ty, P.swim, 1.6, dt, 22, 18, S.back && S.back.floe ? S.back.floe : S.home ? S.home.isl : null);
            unstick(S, dt, 22, S.back && S.back.floe ? S.back.floe : S.home ? S.home.isl : null);
            // home: its landing water, or anywhere against its own shore; and if the pack has walled
            // the landing off for a minute, they come ashore anyway (they would find a way in)
            const arrive = S.back && (S.back.floe ? Math.hypot(tx - S.x, ty - S.y) < S.back.floe.radius + 15 : (Math.hypot(tx - S.x, ty - S.y) < 45 || S.t > S.out + 60));
            if (arrive) {
                if (S.back.floe) {
                    // out onto the floe with a leap, one after another, and up onto the snow
                    const F = S.back.floe, la = Math.atan2(S.x - F.x, -(S.y - F.y)) - (F.spin || 0);
                    let G = floeGroups.find(q => q.floe === F); if (!G) { G = { floe: F, birds: [] }; floeGroups.push(G); }
                    let e = { x: 0, y: 0 }; for (let r = 0.2; r < 1.3; r += 0.05) { const x = Math.sin(la) * F.radius * r, y = -Math.cos(la) * F.radius * r; if (!pointInPoly(x, y, F.localArt || F.localVeg)) break; e = { x, y }; }
                    G.leaving = true;
                    S.birds.forEach((q, i) => { const p = floeSpot(F, 0.4);
                        treks.push({ species: 'adelie', dir: 'in', slide: false, speed: PENG.adelie.walk, floe: F, pts: [e, p], birds: [{ delay: i * R(0.3, 0.6), s: 0 }],
                            onEnd: () => { G.birds.push({ lx: p.x, ly: p.y, lh: R(0, 7), t: R(1, 5), bob: R(0, 7), slideT: R(20, 60) }); if (i === S.birds.length - 1) G.leaving = false; } }); });
                } else if (S.home) {
                    // back up the shore in single file (an emperor rockets out first), to their places
                    const C = S.home, Pp = PENG[C.species];
                    (S.party || []).forEach((b, i) => treks.push({ species: C.species, dir: 'in', slide: false, speed: Pp.walk, pts: [C.shore.e, { x: b.hx, y: b.hy }], birds: [{ delay: i * R(0.5, 0.9), s: 0 }],
                        onEnd: () => { C.birds.push(b); } }));
                }
                S.done = true;
            }
            if (S.t > 120 && !S.home) S.done = true;
        }
        swimmers = swimmers.filter(S => !S.done);
    }

    // LEOPARD SEALS (references + field notes): solitary; they rest hauled out alone on a floe
    // (a quarter of the time) and otherwise PATROL the water just off a penguin colony or along
    // an ice edge, lying almost awash, waiting for birds going in or out. So each seal keeps a
    // station off one colony: hauled out on the nearest floe, or cruising a slow loop off the
    // colony's way down to the sea, its big head and back just breaking the surface.
    function makeSeals(c) {
        // stations: off the rounding colonies (the macaronis and the gentoos), and two on the
        // pack-ice edge the course threads (the narrows, the north pack)
        const col = colonies2.filter(C => C.shore);
        const stations = [col.find(C => C.species === 'macaroni'), col.find(C => C.species === 'gentoo')].filter(Boolean).map(C => ({ x: C.shore.w.x, y: C.shore.w.y, C }))
            .concat((c.pack || []).map(([x, y]) => ({ x, y, C: null })));
        const out = [];
        for (let i = 0; i < c.n && stations.length; i++) {
            const st = stations[i % stations.length];
            out.push({ st, floe: null, lx: 0, ly: 0, lh: R(0, 7), mode: 'swim', t: R(2, 8), x: st.x + R(-80, 80), y: st.y + R(-80, 80), h: R(0, 7), sw: R(0, 7), ring: 0, plop: 0, up: 0, a: R(0, 7) });
        }
        return out;
    }
    function sealFloe(S, maxD) {
        const taken = penguinFloes(); for (const o of lseals) if (o !== S && o.floe && (o.mode === 'haul' || o.mode === 'launch' || o.mode === 'toFloe')) taken.add(o.floe);
        return floeList().filter(f => f.radius >= 70 && !taken.has(f) && Math.hypot(f.x - S.st.x, f.y - S.st.y) < maxD).sort((a, b) => (Math.hypot(a.x - S.x, a.y - S.y) + laneDist(a.x, a.y)) - (Math.hypot(b.x - S.x, b.y - S.y) + laneDist(b.x, b.y)))[0];
    }
    // No penguin shares a floe with a leopard seal (that floe would be empty in a moment).
    function sealFloes() { return new Set(lseals.filter(o => o.floe && (o.mode === 'haul' || o.mode === 'launch' || o.mode === 'toFloe')).map(o => o.floe)); }
    function penguinFloes() {
        const f = new Set(floeGroups.filter(G => G.birds.length || G.leaving).map(G => G.floe));
        for (const S of swimmers) if (S.back && S.back.floe) f.add(S.back.floe);
        for (const T of treks) if (T.floe) f.add(T.floe);
        return f;
    }
    function updateSeals(dt) {
        for (const S of lseals) {
            S.t -= dt; S.ring = Math.max(0, S.ring - dt / (S.mode === 'dive' ? 2 : 1.4)); S.plop = Math.max(0, S.plop - dt / 1.2);
            if (S.mode === 'haul') {
                if (S.hauling) {   // humping in from the edge, heave by heave
                    const Hh = S.hauling, dx = Hh.x - S.lx, dy = Hh.y - S.ly, d = Math.hypot(dx, dy); Hh.s += dt;
                    const v = 26 * Math.max(0.15, Math.sin(Hh.s * 7.5)) ** 0.7;
                    if (d < 2) { S.hauling = null; S.heave = 0; } else { S.lx += dx / d * Math.min(d, v * dt); S.ly += dy / d * Math.min(d, v * dt); S.heave = Math.sin(Hh.s * 7.5); }
                }
                const w = floeToWorld(S.floe, S.lx, S.ly); S.x = w.x; S.y = w.y; S.h = S.lh + (S.floe.spin || 0);
                // back to the station when the rest is over, a boat comes close, or the floe drifts off
                if (!S.hauling && (S.t <= 0 || boatNear(S.x, S.y, 90)) || Math.hypot(S.floe.x - S.st.x, S.floe.y - S.st.y) > 1100 && !S.hauling) {
                    // OFF THE ICE (references: a leopard seal humps to the edge in a few heaves, then
                    // arcs off head first — half a leap, half a slide — into a splash, and goes
                    // straight down and away, a dark shape fading into the depth)
                    const q = nearestClear(S, 55) || nearestClear(S, 30);
                    const F = S.floe, a0 = q ? Math.atan2(q.x - S.x, -(q.y - S.y)) : S.h;
                    // the way off: toward open water, and only where the whole leap lands clear (never onto
                    // rock or another floe) — the nearest such heading to the open water
                    let la = a0 - (F.spin || 0), e = { x: S.lx, y: S.ly };
                    for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.7, -1.7, 2.3, -2.3, Math.PI]) {
                        const l = a0 + da - (F.spin || 0); let ee = { x: S.lx, y: S.ly };
                        for (let d = 0; d < F.radius * 2; d += 3) { const x = S.lx + Math.sin(l) * d, y = S.ly - Math.cos(l) * d; if (!pointInPoly(x, y, F.localArt || F.localVeg)) break; ee = { x, y }; }
                        const w = floeToWorld(F, ee.x, ee.y), wa = l + (F.spin || 0);
                        let ok = !bodyHit(w.x + Math.sin(wa) * 72, w.y - Math.cos(wa) * 72, wa, 30, F);
                        for (let k = 1; k < 6 && ok; k++) if (solidAt(w.x + Math.sin(wa) * 12 * k, w.y - Math.cos(wa) * 12 * k, F, true)) ok = false;   // nor over rock on the way
                        if (ok) { la = l; e = ee; break; }
                        if (da === 0) { la = l; e = ee; }
                    }
                    S.mode = 'launch'; S.lt = 0; S.faced = false; S.l0 = { x: S.lx, y: S.ly }; S.le = e; S.la = la;
                    S.lh0 = S.lh; S.hump = Math.max(0.4, Math.hypot(e.x - S.lx, e.y - S.ly) / 45);   // time to hump to the edge
                }
            } else if (S.mode === 'launch') {
                // 1. humping to the edge (in the floe's frame, so it rides the drifting, turning floe)
                const F = S.floe, H = S.hump, LEAP = 0.8;
                // 0. it swings round to face the water first — a heavy animal pivots slowly on the ice
                if (!S.faced) {
                    const d = angDiff(S.la, S.lh); S.lh += Math.max(-1.6 * dt, Math.min(1.6 * dt, d));
                    const w = floeToWorld(F, S.lx, S.ly); S.x = w.x; S.y = w.y; S.h = S.lh + (F.spin || 0); S.heave = Math.sin(S.lh * 8) * 0.5;
                    if (Math.abs(d) < 0.08) S.faced = true;
                    continue;
                }
                S.lt += dt; S.lh = S.la;
                if (S.lt < H) {
                    const u = S.lt / H, surge = u + Math.sin(u * Math.PI * 2 * Math.max(1, Math.round(H * 2.2))) * 0.04;   // heave by heave
                    S.lx = S.l0.x + (S.le.x - S.l0.x) * surge; S.ly = S.l0.y + (S.le.y - S.l0.y) * surge;
                    const w = floeToWorld(F, S.lx, S.ly); S.x = w.x; S.y = w.y; S.h = S.lh + (F.spin || 0); S.z = 0;
                    S.heave = Math.sin(u * Math.PI * 2 * Math.max(1, Math.round(H * 2.2)));
                } else {
                    // 2. the arc off the edge, head first, out over the water
                    const u = Math.min(1, (S.lt - H) / LEAP), w = floeToWorld(F, S.le.x, S.le.y), a = S.la + (F.spin || 0);
                    S.h = a; S.x = w.x + Math.sin(a) * 58 * u; S.y = w.y - Math.cos(a) * 58 * u; S.z = Math.sin(Math.PI * u) * 15; S.heave = 0; S.pitch = Math.cos(Math.PI * u);   // nose up, then down into the water
                    if (u >= 1) {
                        // 3. the entry: a splash, and down and away
                        S.mode = 'dive'; S.depth = 0; S.v = 95; S.t = R(6, 11); S.plop = 1; S.ring = 1; S.z = 0;
                        S.sx = S.x + Math.sin(a) * 14; S.sy = S.y - Math.cos(a) * 14; S.splashA = a; S.floe = null;
                    }
                }
            } else if (S.mode === 'dive') {
                // a burst away, slowing to a cruise, sinking: a dark shape that fades out. Under the
                // water it may pass below the floes, like the whales.
                S.v += (38 - S.v) * Math.min(1, dt * 1.2); S.sw += dt * 2.6;
                S.depth = Math.min(1, S.depth + dt / 3.6); S.h += Math.sin(S.sw * 0.5) * 0.25 * dt;
                swimTo(S, S.x + Math.sin(S.h) * 200, S.y - Math.cos(S.h) * 200, S.v, 0.6, dt, 30, 10, null, S.depth > 0.25);
                if (S.depth >= 1) { S.mode = 'deep'; S.t = R(10, 18); }
            } else if (S.mode === 'deep') {
                // gone: it swims back toward its station below, and comes up there
                S.sw += dt * 2.2; S.a += dt * 0.09;
                const r = 190 + 70 * Math.sin(S.a * 1.7), tx = S.st.x + Math.cos(S.a) * r, ty = S.st.y + Math.sin(S.a) * r;
                swimTo(S, tx, ty, 45, 1.2, dt, 30, 10, null, true);
                if (S.t <= 0 && !bodyHit(S.x, S.y, S.h, 36)) { S.mode = 'swim'; S.t = R(20, 40); S.ring = 1; S.depth = 0; }
            } else if (S.mode === 'toFloe') {
                const F = S.floe; swimTo(S, F.x, F.y, 40, 2, dt, 30, 10, F); if (unstick(S, dt, 30, F)) S.ring = 1; S.sw += dt * 2.2; S.up = 0.4;
                if (Math.hypot(F.x - S.x, F.y - S.y) < F.radius * 0.95) {
                    // hauling out: it heaves itself up over the edge where it touched, then humps in
                    const c = Math.cos(-(F.spin || 0)), sn = Math.sin(-(F.spin || 0)), dx = S.x - F.x, dy = S.y - F.y, lx = dx * c - dy * sn, ly = dx * sn + dy * c;
                    const L = Math.hypot(lx, ly) || 1; let e = { x: 0, y: 0 };
                    for (let d = 0; d < L + 40; d += 3) { const x = lx / L * d, y = ly / L * d; if (!pointInPoly(x, y, F.localArt || F.localVeg)) break; e = { x, y }; }
                    const ein = R(28, 48), ee = Math.hypot(e.x, e.y) || 1, p = { x: e.x - e.x / ee * Math.min(ein, ee), y: e.y - e.y / ee * Math.min(ein, ee) };   // a body length or so in from the edge
                    S.lx = e.x; S.ly = e.y; S.lh = Math.atan2(p.x - e.x, -(p.y - e.y)); S.hauling = { x: p.x, y: p.y, s: 0 };
                    S.mode = 'haul'; S.t = R(60, 120); S.plop = 1;
                }
                if (S.t < -40) S.mode = 'swim';
            } else {
                // the patrol: a slow sinuous loop 120-260 u off the colony's way to the sea
                S.sw += dt * 2.2; S.a += dt * 0.09;
                const r = 190 + 70 * Math.sin(S.a * 1.7), tx = S.st.x + Math.cos(S.a) * r, ty = S.st.y + Math.sin(S.a) * r;
                swimTo(S, tx, ty, 30, 1.2, dt, 30, 10);
                if (unstick(S, dt, 30)) S.ring = 1;
                S.up = 0.35 + 0.5 * Math.max(0, Math.sin(S.sw * 0.37)) ** 4;   // awash, the head lifting now and then
                if (S.up > 0.8 && S.ring <= 0) S.ring = 1;
                if (S.t <= 0) { const F = sealFloe(S, 700); if (F) { S.floe = F; S.mode = 'toFloe'; S.t = 0; } else S.t = R(10, 20); }
            }
        }
    }

    // TERNS. A flock over each spot: they beat into the wind hovering, head down, drift, and one
    // at a time plunge — folded, straight down — splash, and climb back up.
    function makeTerns(c) {
        return c.at.map(([x, y, r], i) => ({ cx: x, cy: y, r, birds: Array.from({ length: Math.round(R(c.n[0], c.n[1])) }, () => ({ a: R(0, 7), d: Math.sqrt(rnd()) * r, x, y, h: R(0, 7), z: R(30, 48), zh: R(30, 48), mode: 'hover', t: R(1, 6), flap: R(0, 7), splash: 0, sx: 0, sy: 0, drift: R(-0.15, 0.15) })) }));
    }
    function updateTerns(dt) {
        const wd = state.wind ? state.wind.direction : 0;
        // ROOSTING (research: Antarctic terns rest on ice floes between bouts of fishing): now and
        // then a bird drops onto the nearest floe free of seals, stands facing the wind, and later
        // lifts off back to the flock.
        for (const F of ternFlocks) for (const b of F.birds) {
            if (b.mode === 'roost') {
                b.t -= dt; const w = floeToWorld(b.floe, b.lx, b.ly); b.x = w.x; b.y = w.y; b.z = 0;
                b.h += angDiff(wd, b.h) * Math.min(1, dt * 1.5);
                if (b.t <= 0 || boatNear(b.x, b.y, 120) || sealFloes().has(b.floe) || Math.hypot(b.floe.x - F.cx, b.floe.y - F.cy) > F.r + 500) { b.mode = 'climb'; b.t = 1.2; b.floe = null; }
                continue;
            }
            if (b.mode === 'land') {
                const w = floeToWorld(b.floe, b.lx, b.ly); steer(b, w.x, w.y, 55, 4, dt); b.flap += dt * 25 * WING_TIME; b.z = Math.max(0, b.z - dt * 25);
                if (Math.hypot(w.x - b.x, w.y - b.y) < 4 && b.z < 2) { b.mode = 'roost'; b.t = R(15, 40); }
                continue;
            }
            b.rt = (b.rt === undefined ? R(20, 90) : b.rt) - dt;
            if (b.mode === 'hover' && b.rt <= 0) {
                b.rt = R(40, 120);
                const sealed = sealFloes(), Fl = floeList().filter(f => f.radius >= 40 && !sealed.has(f) && Math.hypot(f.x - F.cx, f.y - F.cy) < F.r + 250).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
                if (Fl) { const q = floeSpot(Fl, 0.45); b.floe = Fl; b.lx = q.x; b.ly = q.y; b.mode = 'land'; continue; }
            }
        }
        for (const F of ternFlocks) for (const b of F.birds) {
            if (b.mode === 'roost' || b.mode === 'land') continue;
            b.t -= dt; b.splash = Math.max(0, b.splash - dt / 0.9);
            b.a += b.drift * dt; const tx = F.cx + Math.cos(b.a) * b.d, ty = F.cy + Math.sin(b.a) * b.d;
            if (b.mode === 'hover') {
                b.flap += dt * 30 * WING_TIME;   // hovering ~4.8 Hz real (terns commute at ~3.5 Hz and beat faster to hang in one place)
                b.x += (tx - b.x) * Math.min(1, dt * 0.6); b.y += (ty - b.y) * Math.min(1, dt * 0.6);
                b.h += angDiff(wd, b.h) * Math.min(1, dt * 2);   // hovering, bill into the wind
                b.z += (b.zh - b.z) * Math.min(1, dt);
                if (b.t <= 0) { if (rnd() < 0.45) { b.mode = 'dive'; b.t = 0.35; } else { b.mode = 'shift'; b.t = R(1.5, 3); b.a += R(-0.8, 0.8); b.d = Math.sqrt(rnd()) * F.r; } }
            } else if (b.mode === 'shift') {
                b.flap += dt * 22 * WING_TIME; steer(b, tx, ty, 60, 3, dt); b.z += (b.zh - b.z) * Math.min(1, dt);
                if (b.t <= 0) { b.mode = 'hover'; b.t = R(2, 6); }
            } else if (b.mode === 'dive') {
                b.z = Math.max(0, b.z - dt * 140);
                if (b.z <= 0) { b.mode = 'sit'; b.t = R(0.5, 1); b.splash = 1; b.sx = b.x; b.sy = b.y; }
            } else if (b.mode === 'sit') { if (b.t <= 0) { b.mode = 'climb'; b.t = 1.2; } }
            else if (b.mode === 'climb') { b.flap += dt * 26 * WING_TIME; b.z = Math.min(b.zh, b.z + dt * 40); b.x += Math.sin(b.h) * 12 * dt; b.y -= Math.cos(b.h) * 12 * dt; if (b.t <= 0) { b.mode = 'hover'; b.t = R(2, 6); } }
        }
    }

    // ── GLOWTIDE: golden jellies, mantas, flying foxes, hawksbills, dugongs (Sep 26 2026) ──
    // Sizes (guidelines/scale.md): a Mastigias bell 5-20 cm is drawn 5-9 u — a BLOOM, read as a
    // mass (rule 7); manta 4.5 m span -> 70 (broad, ~1.5x, bigger than the Lagoon's eagle ray);
    // flying fox 1 m span -> 30 (x3); hawksbill 0.8 m -> 24 (broad, ~3x, under the green turtle's
    // 26); dugong 2.7 m -> 52 (broad, ~2x).
    const MANTA_SPAN = 70, FOX_SPAN = 36, HAWK_LEN = 24, DUGONG_LEN = 52;
    // GOLDEN JELLIES. References (Jellyfish Lake, Palau; spotted lagoon jelly): a domed bell,
    // golden-amber, dotted with cream spots; beneath it eight frilly oral arms bunched into a pale
    // cauliflower cluster with club ends — from above it shows through the bell as a pale lobed
    // rosette. They pulse about twice a second, swim slowly and bump along together in a dense
    // swarm, bigger and smaller mixed, some near the surface (bright, sharp) and some deeper
    // (smaller, fainter, bluer).
    function makeBloom(c) {
        const [cx, cy] = c.c, out = [];
        for (let i = 0; i < c.n; i++) {
            let x, y; for (let k = 0; k < 20; k++) { const a = R(0, 7), d = c.r * Math.sqrt(-2 * Math.log(Math.max(1e-3, rnd()))) * 0.42; x = cx + Math.cos(a) * d; y = cy + Math.sin(a) * d; if (Math.hypot(x - cx, y - cy) < c.r * 1.25 && !onLand(x, y)) break; }
            out.push({ x, y, h: R(0, 7), v: R(1, 3), size: R(0.6, 1.25), depth: rnd() ** 1.5, ph: R(0, 7), rate: R(9, 12.5), spots: Math.floor(R(0, 1e6)) });
        }
        return { cx, cy, r: c.r, jel: out };
    }
    function updateBloom(dt) {
        const B = jellyBloom;
        for (const j of B.jel) {
            j.ph += dt * j.rate;
            const push = 0.6 + 0.8 * Math.max(0, Math.sin(j.ph));   // each contraction a small shove
            j.h += Math.sin(T * 0.13 + j.spots) * 0.25 * dt;
            // they keep together: past the edge of the swarm they turn back in
            const dc = Math.hypot(j.x - B.cx, j.y - B.cy); if (dc > B.r) j.h += angDiff(Math.atan2(B.cx - j.x, -(B.cy - j.y)), j.h) * Math.min(1, dt * 0.8);
            const nx = j.x + Math.sin(j.h) * j.v * push * dt, ny = j.y - Math.cos(j.h) * j.v * push * dt;
            if (!onLand(nx, ny)) { j.x = nx; j.y = ny; } else j.h += 1.5;
            j.depth = Math.min(1, Math.max(0, j.depth + Math.sin(T * 0.07 + j.spots * 1.7) * 0.01 * dt));
        }
    }
    // MANTA RAYS. At night they feed on plankton near the surface: slow loops, and bouts of
    // BACKFLIPS in place — a barrel-roll forward over and over, so from above the ray shortens,
    // shows its white belly with dark spots, and comes back over. The flapping wings stir the
    // plankton into light (drawGlow).
    function makeMantas(c) { return c.routes.map((pts, i) => { const P = pts.map(([x, y]) => snapWater(x, y, 50)); return { i, P, wi: 1, cx: P[0].x, cy: P[0].y, r: R(90, 140), x: P[0].x, y: P[0].y, h: 0, a: R(0, 7), dir: -1, beat: R(0, 7), mode: 'feed',   // feeding circles run anticlockwise from above, as cyclone feeding does
                 t: R(20, 40), loopT: R(4, 10), pitch: 0, sparks: [], sparkT: 0 }; }); }
    function updateMantas(dt) {
        for (const M of mantas) {
            M.t -= dt;
            // ~0.3 Hz (Fish et al. 2018): one slow deep stroke every three seconds, and when
            // cruising a glide now and then, wings flat; faster through the somersaults
            M.glide = (M.glide || 0) - dt; if (M.mode === 'travel' && M.glide <= -R(8, 16) && Math.cos(M.beat) > 0.95) M.glide = R(2, 4);
            if (!(M.glide > 0)) M.beat += dt * WING_TIME * (M.mode === 'loop' ? 2.6 : 1.9);
            // feeding at the surface, the wingtips break it at the top of each stroke
            M.surfTip = Math.max(0, (M.surfTip || 0) - dt / 0.8);
            if (M.mode === 'feed' && Math.sin(M.beat) > 0.97 && !(M.surfTip > 0.5) && (Math.sin(T * 0.05 + M.i * 3) > 0.2)) M.surfTip = 1;
            if (M.mode === 'travel') {
                // on to the next feeding spot at ~2 kn, steady, the wings in long slow strokes
                const T2 = M.P[M.wi]; swimTo(M, T2.x, T2.y, 34, 0.8, dt, 18, 36);
                M.pitch += (0 - M.pitch) * Math.min(1, dt * 2);
                if (Math.hypot(T2.x - M.x, T2.y - M.y) < 60) { M.mode = 'feed'; M.cx = T2.x; M.cy = T2.y; M.a = Math.atan2(M.y - M.cy, M.x - M.cx); M.t = R(25, 45); M.loopT = R(3, 8); }
            } else if (M.mode === 'feed') {
                // feeding: slow circles over the plankton, and bouts of backflips in place
                M.a += M.dir * 18 / M.r * dt;   // mouth open is slow going
                swimTo(M, M.cx + Math.cos(M.a) * M.r, M.cy + Math.sin(M.a) * M.r, 18, 0.9, dt, 18, 36);
                M.pitch += (0 - M.pitch) * Math.min(1, dt * 2);
                M.loopT -= dt; if (M.loopT <= 0) { M.mode = 'loop'; M.lt = R(6, 12); }
                if (M.t <= 0) { M.mode = 'travel'; M.wi = (M.wi + 1) % M.P.length; }
            } else {
                // somersaulting in place, ~3.5 s a loop, drifting forward a little
                M.pitch += dt * (Math.PI * 2 / 3.5); M.lt -= dt;
                const nx = M.x + Math.sin(M.h) * 6 * dt, ny = M.y - Math.cos(M.h) * 6 * dt; if (!onLand(nx, ny)) { M.x = nx; M.y = ny; }
                if (M.lt <= 0 && Math.cos(M.pitch) > 0.95) { M.mode = 'feed'; M.pitch = 0; M.loopT = R(6, 14); }
            }
            // sparks: where the wingtips and the rolling body churn the plankton
            M.sparkT += dt;
            if (M.sparkT > 0.09) { M.sparkT = 0; const fx = Math.sin(M.h), fy = -Math.cos(M.h), span = MANTA_SPAN * 0.5;
                // plankton flashes wherever the wings and body stir the water: scattered over the
                // ray's footprint and just behind it, each a brief flicker
                for (let k = 0; k < (M.mode === 'loop' ? 4 : 2); k++) { const u = R(-1, 1), v = R(-0.3, 0.7);
                    M.sparks.push({ x: M.x - fy * u * span + fx * -v * 20, y: M.y + fx * u * span + fy * -v * 20, age: 0, s: R(0.5, 1.2), life: R(0.6, 1.4) }); } }
            for (const s of M.sparks) s.age += dt; M.sparks = M.sparks.filter(s => s.age < s.life);
        }
    }
    // PALAU FLYING FOXES. At dusk and through the night they commute between the karst islands
    // in loose straggling streams, slow and steady on long rowing wingbeats (~2.2 Hz), well above
    // the water. A flock crosses on one of the paths, and another follows a while later.
    // Each of the three colonies commutes on its own line between two islands: across, a few
    // slow circles over the far island's trees, and back — so all night there is a stream on
    // each line, going one way or the other.
    function makeFoxFlock(c, P, k) {
        const n = Math.round(R(c.n[0], c.n[1])), A = { x: P[0][0], y: P[0][1] }, Bp = { x: P[1][0], y: P[1][1] };
        const F = { A, B: Bp, to: k % 2 ? A : Bp, mode: 'cross', t: 0, bats: [] };
        const from = F.to === A ? Bp : A, h = Math.atan2(F.to.x - from.x, -(F.to.y - from.y)), u = R(0.1, 0.8);
        for (let i = 0; i < n; i++) F.bats.push({ x: from.x + (F.to.x - from.x) * u - Math.sin(h) * i * R(30, 60) + Math.cos(h) * R(-50, 50), y: from.y + (F.to.y - from.y) * u + Math.cos(h) * i * R(30, 60) + Math.sin(h) * R(-50, 50),
            h, z: R(c.z[0], c.z[1]), flap: R(0, 7), rate: R(15.5, 18), v: R(42, 52), wob: R(0, 7), ca: R(0, 7), cr: R(50, 110) });   // ~2.5-2.9 Hz
        return F;
    }
    function updateFoxes(dt) {
        for (const F of foxFlocks) {
            F.t -= dt;
            const arrived = F.bats.filter(b => Math.hypot(F.to.x - b.x, F.to.y - b.y) < 180).length;
            if (F.mode === 'cross' && arrived >= F.bats.length * 0.7) { F.mode = 'circle'; F.t = R(8, 16); }
            if (F.mode === 'circle' && F.t <= 0) { F.mode = 'cross'; F.to = F.to === F.A ? F.B : F.A; }
            for (const b of F.bats) {
                // steady rowing flight with a short glide now and then (wings held spread)
                b.glideT = (b.glideT || 0) - dt; b.nextGlide = (b.nextGlide === undefined ? R(3, 12) : b.nextGlide) - dt;
                if (b.nextGlide <= 0 && Math.sin(b.flap) > 0.9) { b.glideT = R(0.6, 1.4); b.nextGlide = R(5, 14); }
                if (!(b.glideT > 0)) b.flap += dt * b.rate * WING_TIME; b.wob += dt;
                let tx = F.to.x, ty = F.to.y;
                if (F.mode === 'circle') { b.ca += dt * b.v / b.cr; tx += Math.cos(b.ca) * b.cr; ty += Math.sin(b.ca) * b.cr; }
                const want = Math.atan2(tx - b.x, -(ty - b.y)) + (F.mode === 'cross' ? Math.sin(b.wob * 0.7) * 0.15 : 0);
                b.h += angDiff(want, b.h) * Math.min(1, dt * (F.mode === 'circle' ? 2 : 0.8));
                b.x += Math.sin(b.h) * b.v * dt; b.y -= Math.cos(b.h) * b.v * dt;
            }
        }
    }

    // HAWKSBILLS. Swimming: they fly with the front flippers, a slow stroke (~0.5 Hz) and a
    // glide, poking round the reef rocks, up to breathe now and then. Nesting: a female hauls up
    // the beach leaving a track — the hawksbill's ALTERNATING gait, the flipper marks staggered
    // either side of the drag of the shell — digs a body pit, flinging sand behind her, lays, covers,
    // and goes back down to the sea. Old tracks stay on the sand.
    function beachLine(isl) {
        // an edge of this beach whose one side is open water and the other side sand, and the
        // direction inland from it
        const V = isl.vertices, ok = [];
        for (let k = 0; k < V.length; k++) {
            const a = V[k], b = V[(k + 1) % V.length], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            for (const sd of [-1, 1]) {
                const nx = -(b.y - a.y) / L * sd, ny = (b.x - a.x) / L * sd;   // candidate outward normal
                const water = { x: mx + nx * 30, y: my + ny * 30 }, nest = { x: mx - nx * 55, y: my - ny * 55 };
                if (!onLand(water.x, water.y) && !onLand(mx + nx * 60, my + ny * 60) && pointInPoly(nest.x, nest.y, V) && pointInPoly(mx - nx * 20, my - ny * 20, V))
                    ok.push({ water, edge: { x: mx, y: my }, nest, inland: Math.atan2(-nx, ny) });
            }
        }
        return ok.length ? ok[Math.floor(rnd() * ok.length)] : null;
    }
    function makeHawksbills(c) {
        const out = [];
        c.swim.forEach(([x0, y0, r], i) => { const q = snapWater(x0, y0, 40), x = q.x, y = q.y; out.push({ i, mode: 'swim', cx: x, cy: y, r, x, y, h: R(0, 7), beat: R(0, 7), tx: x, ty: y, t: R(3, 8), up: 0, ring: 0 }); });
        for (const id of c.nest) { const isl = (state.course.islands || []).find(s => s.id === id); if (!isl) continue; const B = beachLine(isl); if (!B) continue;
            out.push({ i: out.length, mode: 'nestwait', isl, B, x: B.water.x, y: B.water.y, h: B.inland, beat: R(0, 7), t: R(5, 40), tracks: [], dig: 0, sandT: 0, sand: [] }); }
        return out;
    }
    function updateHawksbills(dt) {
        for (const H of hawksbills) {
            H.t -= dt; H.ring = Math.max(0, (H.ring || 0) - dt / 1.5);
            if (H.mode === 'swim') {
                H.beat += dt * 3.2 * WING_TIME;   // ~0.5 Hz real
                if (Math.hypot(H.tx - H.x, H.ty - H.y) < 20 || H.t <= 0) { for (let k = 0; k < 12; k++) { const a = R(0, 7), d = Math.sqrt(rnd()) * H.r, x = H.cx + Math.cos(a) * d, y = H.cy + Math.sin(a) * d; if (!onLand(x, y)) { H.tx = x; H.ty = y; break; } } H.t = R(8, 16); }
                swimTo(H, H.tx, H.ty, 16 * (0.6 + 0.4 * Math.max(0, Math.sin(H.beat))), 1.2, dt, 12, 8);
                H.up = Math.max(0, Math.sin(T * 0.18 + H.i * 2)) ** 6;   // up to breathe now and then (every ~35 s)
                if (H.up > 0.9 && H.ring <= 0) H.ring = 1;
                continue;
            }
            const B = H.B;
            if (H.mode === 'nestwait') { if (H.t <= 0) { H.mode = 'crawlup'; H.x = B.water.x; H.y = B.water.y; H.h = B.inland; H.tracks.push([]); } continue; }
            if (H.mode === 'crawlup' || H.mode === 'crawldown') {
                // heaving: both front flippers pull together, the body lurches, rests — ~3 u/s
                H.beat += dt * 2.4; const lurch = Math.max(0, Math.sin(H.beat)), v = 7 * lurch;
                const T2 = H.mode === 'crawlup' ? B.nest : B.water, want = Math.atan2(T2.x - H.x, -(T2.y - H.y));
                H.h += angDiff(want, H.h) * Math.min(1, dt * 1.5); H.x += Math.sin(H.h) * v * dt; H.y -= Math.cos(H.h) * v * dt;
                const tr = H.tracks[H.tracks.length - 1]; if (onLand(H.x, H.y) && (!tr.length || Math.hypot(tr[tr.length - 1].x - H.x, tr[tr.length - 1].y - H.y) > 2.2)) tr.push({ x: H.x, y: H.y, h: H.h, side: tr.length % 2 ? 1 : -1 });
                if (Math.hypot(T2.x - H.x, T2.y - H.y) < 3) {
                    if (H.mode === 'crawlup') { H.mode = 'nest'; H.t = R(50, 80); }
                    else { H.mode = 'nestwait'; H.t = R(90, 180); H.x = B.water.x; H.y = B.water.y; if (H.tracks.length > 3) H.tracks.shift(); }
                }
                continue;
            }
            if (H.mode === 'nest') {
                // digging, laying, covering: sand flung back in bursts by the flippers
                H.dig += dt; H.sandT -= dt;
                if (H.sandT <= 0) { H.sandT = R(0.6, 1.4); const bx = H.x - Math.sin(H.h) * 10, by = H.y + Math.cos(H.h) * 10; for (let k = 0; k < 5; k++) { const a = H.h + Math.PI + R(-0.9, 0.9); H.sand.push({ x: bx, y: by, vx: Math.sin(a) * R(15, 30), vy: -Math.cos(a) * R(15, 30), age: 0 }); } }
                if (H.t <= 0) { H.mode = 'crawldown'; H.tracks.push([]); }
            }
            for (const s of H.sand) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.9; s.vy *= 0.9; } H.sand = H.sand.filter(s => s.age < 1);
        }
    }
    // DUGONGS. They graze the seagrass beds in the shallows, head down, moving slowly forward
    // and leaving a feeding trail — a pale furrow where the grass is pulled up — with a cloud of
    // silt at the muzzle; every minute or so they rise, the nostrils break the surface for a
    // breath (a ring, a puff), and they sink back to feed. A calf keeps to its mother's side,
    // just behind her flipper, and breathes when she does.
    function makeDugongs(list) {
        const out = [];
        for (const D of list) { const isl = (state.course.islands || []).find(s => s.id === D.shape); if (!isl) continue;
            const spot = () => { for (let k = 0; k < 60; k++) { const v = isl.vertices[Math.floor(rnd() * isl.vertices.length)], u = R(0.2, 0.8), x = isl.x + (v.x - isl.x) * u, y = isl.y + (v.y - isl.y) * u; if (pointInPoly(x, y, isl.vertices) && !onLand(x, y) && !bodyHit(x, y, 0, DUGONG_LEN * 0.5)) return { x, y }; } return { x: isl.x, y: isl.y }; };
            const p = spot();
            const G = { isl, spot, x: p.x, y: p.y, h: R(0, 7), tx: p.x, ty: p.y, beat: R(0, 7), mode: 'graze', t: R(10, 40), up: 0, ring: 0, puff: 0, trail: [], trailT: 0, silt: 0, calf: null, len: DUGONG_LEN };
            if (D.calf) G.calf = { x: p.x + 20, y: p.y + 10, h: G.h, beat: R(0, 7), len: DUGONG_LEN * 0.55, up: 0 };
            out.push(G); }
        return out;
    }
    function updateDugongs(dt) {
        for (const G of dugongs) {
            G.t -= dt; G.ring = Math.max(0, G.ring - dt / 1.6); G.puff = Math.max(0, G.puff - dt / 1.2);
            if (G.mode === 'graze') {
                G.beat += dt * 1.6;   // a lazy fluke stroke
                if (Math.hypot(G.tx - G.x, G.ty - G.y) < 15) { const q = G.spot(); G.tx = q.x; G.ty = q.y; }
                swimTo(G, G.tx, G.ty, 9, 0.5, dt, G.len * 0.5, 10);
                G.up += (0 - G.up) * Math.min(1, dt); G.silt = 1;
                G.trailT += dt; if (G.trailT > 0.5) { G.trailT = 0; G.trail.push({ x: G.x + Math.sin(G.h) * G.len * 0.45, y: G.y - Math.cos(G.h) * G.len * 0.45, h: G.h, age: 0 }); }
                if (G.t <= 0) { G.mode = 'rise'; G.t = 5; }
            } else {
                // rising to breathe: a few seconds up, the nostrils break once, then down again
                G.beat += dt * 2.6; G.silt = 0; swimTo(G, G.tx, G.ty, 12, 0.5, dt, G.len * 0.5, 10);
                const u = 1 - G.t / 5; G.up = Math.sin(Math.PI * Math.min(1, u));
                if (u > 0.45 && !G.breathed) { G.breathed = true; G.ring = 1; G.puff = 1; }
                if (G.t <= 0) { G.mode = 'graze'; G.t = R(45, 75); G.breathed = false; }
            }
            for (const q of G.trail) q.age += dt; G.trail = G.trail.filter(q => q.age < 80);
            if (G.calf) { const C = G.calf, fx = Math.sin(G.h), fy = -Math.cos(G.h), tx = G.x - fy * 16 - fx * 8, ty = G.y + fx * 16 - fy * 8;
                C.h += angDiff(G.h, C.h) * Math.min(1, dt * 2); C.x += (tx - C.x) * Math.min(1, dt * 1.5); C.y += (ty - C.y) * Math.min(1, dt * 1.5); C.beat += dt * 2.4; C.up = G.up; }
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
    // A WINGBEAT SEEN FROM ABOVE (all the flapping birds; the tern has its own version). ph is the
    // stroke phase (0 top of the stroke, 0 → pi the downstroke), amp the stroke's half-angle in
    // radians. From straight above a wing raised or lowered FORESHORTENS: pf is the span factor,
    // full only as the wing passes level. On the upstroke the wrist flexes and the hand sweeps back
    // (flex 0..1). Rates are the real birds' (Pennycuick's cruising wingbeats): herring gull
    // ~3.2 Hz, brown pelican ~2.2 Hz, great egret ~2.6 Hz, bald eagle ~2.4 Hz.
    function wingStroke(ph, amp) {
        const elev = amp * Math.cos(ph), up = Math.sin(ph) < 0 ? -Math.sin(ph) : 0;
        return { pf: 0.35 + 0.65 * Math.cos(elev), flex: Math.min(1, up * 0.9 + (1 - Math.cos(elev)) * 0.3), down: Math.max(0, Math.sin(ph)) };
    }
    const GLIDE = { pf: 1, flex: 0, down: 0 };
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
    function drawGullFlying(ctx, x, y, h, z, flap, glide) {
        // a gull flaps, and glides in between (a follower mostly glides behind the ship)
        const W = glide ? GLIDE : wingStroke(flap, 0.85), beat = W.flex;
        const s = (1 + z * 0.004) * 1.2;
        // shadow on the water: the same silhouette, dark, offset by height
        ctx.save(); ctx.translate(x + z * 0.35, y + z * 0.55); ctx.rotate(h); ctx.scale(s * 0.95, s * 0.95);
        ctx.fillStyle = `rgba(10,25,40,${0.2 * Math.max(0.3, 1 - z / 120)})`;
        ctx.save(); ctx.scale(W.pf, 1); for (const sd of [-1, 1]) { gullWingPath(ctx, sd, beat); ctx.fill(); } ctx.restore();
        ctx.beginPath(); ctx.ellipse(0, 0.5, 2.4, 7.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(s, s);
        ctx.lineJoin = 'round'; ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(40,46,56,0.6)';
        // tail fan
        ctx.beginPath(); ctx.moveTo(-1.6, 4.5); ctx.lineTo(-2.6, 9.4); ctx.quadraticCurveTo(0, 10.4, 2.6, 9.4); ctx.lineTo(1.6, 4.5); ctx.closePath();
        ctx.fillStyle = '#f7f8f9'; ctx.fill(); ctx.stroke();
        ctx.save(); ctx.scale(W.pf, 1);
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
        ctx.restore();
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
        const s = (1 + z * 0.004) * 1.25;
        // pelicans flap in bouts and glide between (a formation's leader starts and the rest follow)
        const Wp = fold || Math.sin(flap * 0.12) < -0.2 ? GLIDE : wingStroke(flap, 0.85);
        const sweep = fold ? 1 : Wp.flex * 0.28;   // the hand flexes back a little on the upstroke
        const half = PELICAN_SPAN / 2 / 1.25 * (fold ? 1 : Wp.pf);
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
        for (const W of orcaPods) for (const m of W.members) drawOrca(ctx, m);
        if (jellyBloom) { const cam = state.camera, hw = (ctx.canvas ? ctx.canvas.width : 2000) * 0.6 + 60, hh = (ctx.canvas ? ctx.canvas.height : 2000) * 0.6 + 60; for (const j of jellyBloom.jel) if (!cam || (Math.abs(j.x - cam.x) < hw && Math.abs(j.y - cam.y) < hh)) drawGoldJelly(ctx, j); }
        for (const G of dugongs) drawDugong(ctx, G);
        for (const H of hawksbills) if (H.mode === 'swim') drawHawksbill(ctx, H);
        for (const M of mantas) drawManta(ctx, M);
        for (const K of krill) drawKrill(ctx, K);
        for (const W of bluePods) for (const m of W.members) drawWhaleSlick(ctx, m);
        for (const W of bluePods) for (const m of W.members) drawBlueWhale(ctx, m);
        for (const G of seaOtterRafts) for (const m of G.members) drawSeaOtterUnder(ctx, m);
        for (const G of slGroups) drawSLGroupWater(ctx, G);
        for (const B of blood) { if (!onCam(B.x, B.y, 100)) continue; const k = B.t / B.life, r = B.r0 * (1 + 2.6 * Math.sqrt(k)), g = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, r);
            const c = B.dark ? '98,40,34' : '126,58,46';
            g.addColorStop(0, `rgba(${c},${0.26 * (1 - k)})`); g.addColorStop(0.55, `rgba(${c},${0.15 * (1 - k)})`); g.addColorStop(1, `rgba(${c},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(B.x, B.y, r, r * 0.75, B.a, 0, Math.PI * 2); ctx.fill(); }
        for (const W of whites) drawWhiteShark(ctx, W, 'water');
        for (const F of foams) drawFoam(ctx, F);
        for (const W of whites) if (W.mode === 'feed' && W.bite > 0 && onCam(W.x, W.y, 100)) { const k = W.bite / 2.2, hx = W.x + Math.sin(W.h) * 28, hy = W.y - Math.cos(W.h) * 28;
            ctx.fillStyle = `rgba(214,120,120,${0.8 * Math.sin(Math.PI * k)})`; ctx.beginPath(); ctx.ellipse(hx, hy, 7, 5, W.h + 0.6, 0, Math.PI * 2); ctx.fill(); }
        if (cfg.seaLions || cfg.blues) for (const S of splashes) drawSplash(ctx, S);
        for (const S of swimmers) drawSwimmers(ctx, S);
        for (const S of lseals) if (S.mode !== 'haul' && S.mode !== 'launch') drawLeopardSeal(ctx, S);   // (on the ice and in the air it draws above the floes)
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
        for (const C of colonies2) drawColony(ctx, C);
        for (const G of floeGroups) drawFloeGroup(ctx, G);
        drawTreks(ctx);
        for (const H of hawksbills) if (H.mode !== 'swim') { drawTurtleTracks(ctx, H); drawHawksbill(ctx, H); }
        for (const S of lseals) if (S.mode === 'haul' || S.mode === 'launch') drawLeopardSeal(ctx, S);
        for (const F of ternFlocks) for (const b of F.birds) if (b.mode === 'roost') drawTern(ctx, b);
        // Otter Point: otters float ON the kelp canopy (the float stratum draws before this layer),
        // sea lions lie on their rocks; a leaping sea lion and a breaching shark are over it all
        for (const G of seaOtterRafts) if (onCam(G.cx, G.cy, 300)) for (const m of G.members) drawSeaOtter(ctx, m);
        for (const H of slHauls) if (onCam(H.C.x, H.C.y, 400)) for (const m of H.members) { if (m.mode === 'climb' && m.inWater) drawSeaLion(ctx, m, { swim: true }); else if (m.mode !== 'gone') drawSeaLion(ctx, m); if (m.splash > 0) drawFishSplash(ctx, m.spx, m.spy, m.splash, 1.8, m.spx); }
        for (const G of slGroups) drawSLGroupAir(ctx, G);
        for (const W of whites) drawWhiteShark(ctx, W, 'air');
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
                drawGullFlying(ctx, x, y, b.a + (b.w > 0 ? Math.PI : 0), b.z, b.flap, Math.sin(b.gl * 0.35 + b.r) > -0.3);   // mostly gliding, a few beats now and then
            }
        }
        if (flight) for (const b of flight.birds) if (b.mode === 'fly' || b.mode === 'dive') drawPelicanFlying(ctx, b.x, b.y, b.h, b.z, b.flap, b.mode === 'dive');
        for (const E of soarers) drawEagle(ctx, E);
        for (const f of flyfish) if (!f.caught) drawFlyfish(ctx, f);
        for (const P of flyPatches) if (P.pack) for (const m of P.pack) if (m.leap > 0) drawMahi(ctx, m);
        for (const B of blows) drawBlow(ctx, B);
        for (const G of gliders) if (G.i === 0 || G.here) drawAlbatross(ctx, G);
        for (const C of condors) drawCondor(ctx, C);
        for (const F of ternFlocks) for (const b of F.birds) if (b.mode !== 'roost') drawTern(ctx, b);
        for (const F of foxFlocks) for (const b of F.bats) drawFlyingFox(ctx, b);
        for (const B of blueBlows) drawBlueBlow(ctx, B);
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
            // slow, deep, bowed beats (herons and egrets: ~2.6 Hz, the downstroke deep)
            const We = wingStroke(e.flap, 0.9), beat = -Math.cos(e.flap) * 0.6 + We.flex * 0.8, z = e.z;
            const wing = (fill) => {
                ctx.save(); ctx.scale(We.pf, 1);
                for (const sd of [-1, 1]) {
                    ctx.beginPath(); ctx.moveTo(sd * 1.6, -2.2);
                    ctx.quadraticCurveTo(sd * 8, -4.2 - beat * 1.5, sd * 14.5, -1 + beat * 1.2);
                    ctx.quadraticCurveTo(sd * 12, 2.4, sd * 7, 2.8);
                    ctx.quadraticCurveTo(sd * 3.5, 3.2, sd * 1.6, 2.6); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
                }
                ctx.restore();
            };
            const shade = () => { ctx.beginPath(); ctx.ellipse(0, 1, 1.9, 5.2, 0, 0, Math.PI * 2); ctx.fill(); };
            ctx.save(); ctx.translate(e.x + z * 0.35, e.y + z * 0.55); ctx.rotate(e.h); ctx.scale(k * 0.95, k * 0.95);
            ctx.fillStyle = `rgba(10,25,40,${0.2 * Math.max(0.3, 1 - z / 120)})`; wing(ctx.fillStyle); shade(); ctx.restore();
            ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.h); ctx.scale(k, k);
            ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 0.55; ctx.lineCap = 'round';
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 0.5, 5); ctx.lineTo(sd * 0.6, 11); ctx.stroke(); }   // legs trailing
            wing('#f5f5f0');
            ctx.strokeStyle = 'rgba(150,150,140,0.5)'; ctx.lineWidth = 0.4;
            ctx.save(); ctx.scale(We.pf, 1); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 1.6, -2.2); ctx.quadraticCurveTo(sd * 8, -4.2 - beat * 1.5, sd * 14.5, -1 + beat * 1.2); ctx.stroke(); } ctx.restore();
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
    let _eaglePF = 1;   // the span factor of the current stroke (set by drawEagle)
    function eagleWing(ctx, sd, fold, beat) {
        const S = 17.5 * (1 - fold * 0.45) * _eaglePF, sw = fold * 5 + beat * 2.4;
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
        // soaring it does NOT flap — wings held flat, fingers spread; climbing away with a fish it
        // labours, deep beats at ~2.4 Hz
        const Wg = E.mode === 'climb' || E.mode === 'grab' ? wingStroke(E.flap, 1.0) : GLIDE, beat = Wg.flex;
        _eaglePF = Wg.pf;
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

    // ── drawing Glacier Sound's animals ──────────────────────────────────────────────────
    // An ORCA: dim under the water; surfacing, the back and dorsal roll through as a band that
    // travels nose to tail (the head, then the fin, then the tail stock), with a short bushy blow
    // and a V off the fin. The flukes beat on their own part, foreshortened about the hinge.
    function drawOrca(ctx, m) {
        const S = ARCTIC_SPR[m.kind], body = arcticImg(m.kind + '-body'), fl = arcticImg(m.kind + '-flukes');
        if (!imgReady(body) || !imgReady(fl)) return;
        const k = S.len / S.ink, W = body.naturalWidth * k, H = body.naturalHeight * k, hy = -H / 2 + S.hinge * H;
        const up = m.up >= 0 ? Math.sin(Math.PI * m.up) : 0;
        const one = (alpha, clipY0, clipY1) => {
            ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h); ctx.globalAlpha *= alpha;
            if (clipY0 !== undefined) { ctx.beginPath(); ctx.rect(-W, clipY0, W * 2, clipY1 - clipY0); ctx.clip(); }
            const tilt = Math.sin(m.beat) * 0.9;
            ctx.save(); ctx.translate(0, hy); ctx.scale(1, Math.max(0.35, Math.cos(tilt))); ctx.translate(0, -hy); ctx.drawImage(fl, -W / 2, -H / 2, W, H); ctx.restore();
            ctx.drawImage(body, -W / 2, -H / 2, W, H);
            ctx.restore();
        };
        one(0.3);   // the whole animal, under the water
        if (up > 0) {
            // the band of back that is out: centred from the head (u=0) back to the tail stock (u=1)
            const c = -H * 0.4 + m.up * H * 0.62, half = S.len * 0.34 * up;
            one(0.75, c - half, c + half); one(1, c - half * 0.7, c + half * 0.7);
            // where the head breaks: a crescent of white pushed ahead of the band; behind the
            // band, the smooth flattened slick the back leaves as it rolls down
            ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h);
            const fw = S.len * 0.13;
            if (m.up < 0.75) {
                // the bow wave: white water peeling back off each side of the head, broken, not an arc
                ctx.lineCap = 'round';
                for (const sd of [-1, 1]) for (const [a0, w, al] of [[0, 1.5, 0.65], [0.35, 1, 0.4]]) {
                    ctx.strokeStyle = `rgba(255,255,255,${al * up})`; ctx.lineWidth = w;
                    ctx.beginPath(); ctx.moveTo(sd * fw * (0.35 + a0), c - half + fw * (0.1 + a0));
                    ctx.quadraticCurveTo(sd * fw * (1.05 + a0), c - half + fw * (0.4 + a0), sd * fw * (1.3 + a0), c - half + fw * (1.6 + a0 * 2)); ctx.stroke();
                }
            }
            const g = ctx.createLinearGradient(0, c + half, 0, c + half + S.len * 0.45);
            g.addColorStop(0, `rgba(210,228,240,${0.1 * up})`); g.addColorStop(1, 'rgba(210,228,240,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, c + half + S.len * 0.14, fw * 0.8, S.len * 0.16, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        // THE DORSAL FIN — the orca's signature from any angle: a tall black blade standing at
        // ~40% of the length (an adult male's is 1.8 m, straight and triangular; a female's and a
        // calf's shorter and curved back). From above it is a thin dark sliver along the back,
        // and out of the water it throws a long shadow down-right.
        const finPos = -H * 0.5 + H * 0.37, finT = Math.max(0, Math.min(1, (m.up - 0.15) / 0.2)) * Math.max(0, Math.min(1, (0.95 - m.up) / 0.25));
        const finH = (m.kind === 'orca' ? 18 : m.kind === 'orca-b' ? 9 : 5) * finT;
        if (up > 0 && finH > 0.5) {
            ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h);
            const chord = S.len * 0.1;
            // the shadow (in the animal's frame, pointing to the world's down-right)
            const wx = 0.54, wy = 0.84, c0 = Math.cos(-m.h), s0 = Math.sin(-m.h), lx = wx * c0 - wy * s0, ly = wx * s0 + wy * c0;   // world down-right, in the whale's frame
            ctx.fillStyle = 'rgba(8,16,28,0.35)'; ctx.beginPath();
            ctx.moveTo(0, finPos - chord * 0.5); ctx.lineTo(lx * finH, finPos + ly * finH + (m.kind === 'orca' ? 0 : chord * 0.3)); ctx.lineTo(0, finPos + chord * 0.5); ctx.closePath(); ctx.fill();
            const fwid = 1.2 + finH * 0.09;   // a tall fin leans a little and shows more of its side
            ctx.fillStyle = '#0b0d10'; ctx.beginPath(); ctx.moveTo(0, finPos - chord * 0.55); ctx.quadraticCurveTo(fwid, finPos, 0, finPos + chord * 0.55); ctx.quadraticCurveTo(-fwid, finPos, 0, finPos - chord * 0.55); ctx.fill();
            // its sunlit leading edge (light from the upper left) — how a fin reads from above
            ctx.strokeStyle = `rgba(200,215,230,${0.75 * finT})`; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, finPos - chord * 0.55); ctx.quadraticCurveTo(-fwid, finPos - chord * 0.1, -fwid * 0.3, finPos + chord * 0.4); ctx.stroke();
            ctx.restore();
        }
        if (m.blow > 0 && m.bx !== undefined) drawOrcaBlow(ctx, m);
    }
    // AN ORCA'S BLOW (references: a low bushy column, ~3.5 m, briefly visible, dispersing fast in
    // wind). From above: a dense white core over the blowhole that bursts out into a ragged cloud
    // of a few lobes, carried downwind and thinning; the spray's faint shadow on the water, down-right
    // as for anything that stands up.
    function drawOrcaBlow(ctx, m) {
        const q = 1 - m.blow, k = m.bh || 1, wd = state.wind ? state.wind.direction : 0;
        const dx = Math.sin(wd + Math.PI) * q * 26, dy = -Math.cos(wd + Math.PI) * q * 26;   // downwind drift
        const a = Math.min(1, m.blow * 1.6) * (q < 0.08 ? q / 0.08 : 1);                     // bursts, then fades
        const R0 = (7 + 16 * Math.sqrt(q)) * k, rr = mulberry(Math.floor((m.bx + m.by) * 10) >>> 0);
        const lobes = Array.from({ length: 6 }, () => ({ a: rr() * Math.PI * 2, d: 0.2 + rr() * 0.55, r: 0.45 + rr() * 0.35 }));
        // the shadow of the column, on the water
        ctx.fillStyle = `rgba(8,18,30,${0.16 * a})`;
        ctx.beginPath(); ctx.ellipse(m.bx + dx * 0.6 + 10 * k, m.by + dy * 0.6 + 16 * k, R0 * 0.8, R0 * 0.55, 0.6, 0, Math.PI * 2); ctx.fill();
        for (const L of lobes) {
            const x = m.bx + dx + Math.cos(L.a) * R0 * L.d * (0.6 + q), y = m.by + dy + Math.sin(L.a) * R0 * L.d * (0.6 + q), r = R0 * L.r;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(248,251,255,${0.55 * a})`); g.addColorStop(0.6, `rgba(240,246,252,${0.25 * a})`); g.addColorStop(1, 'rgba(240,246,252,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        // the dense core over the blowhole, brief
        if (q < 0.45) { const c = 1 - q / 0.45, g = ctx.createRadialGradient(m.bx + dx * 0.3, m.by + dy * 0.3, 0, m.bx + dx * 0.3, m.by + dy * 0.3, 6 * k);
            g.addColorStop(0, `rgba(255,255,255,${0.9 * c})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.bx + dx * 0.3, m.by + dy * 0.3, 6 * k, 0, Math.PI * 2); ctx.fill(); }
    }
    function drawPenguinOn(ctx, species, x, y, h, bob) {
        drawArcticSprite(ctx, species, x, y, h + Math.sin(bob * 3) * 0.05, 1);
    }
    function drawColony(ctx, C) { for (const b of C.birds) drawPenguinOn(ctx, C.species, b.x, b.y, b.h, b.bob); }
    function drawFloeGroup(ctx, G) {
        for (const b of G.birds) { const w = floeToWorld(G.floe, b.lx, b.ly), h = b.lh + (G.floe.spin || 0);
            if (b.sliding) drawToboggan(ctx, 'adelie', w.x, w.y, h, 1); else drawPenguinOn(ctx, 'adelie', w.x, w.y, h, b.bob); }
    }
    // Tobogganing: flat on the belly, stretched out, flippers back — the sprite lengthened and
    // narrowed — pushing a faint scuffed track behind it on the snow.
    function drawToboggan(ctx, species, x, y, h, k) {
        const L = ARCTIC_SPR[species].len;
        ctx.save(); ctx.translate(x, y); ctx.rotate(h);
        ctx.strokeStyle = 'rgba(150,170,190,0.35)'; ctx.lineWidth = L * 0.25; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, L * 0.4); ctx.lineTo(0, L * 1.6); ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(0.85, 1.22); drawArcticSprite(ctx, species, 0, 0, 0, k); ctx.restore();
    }
    function drawTreks(ctx, list) {
        for (const T of list || treks) {
            const L = trekLen(T);
            for (const b of T.birds) {
                if (b.delay > 0) { if (T.dir === 'out') { const p = trekPos(T, 0); drawPenguinOn(ctx, T.species, p.x, p.y, p.h, 0); } continue; }
                if (b.splash > 0) { whiteSheet(ctx, b.sx, b.sy, 9 * (1.4 - b.splash * 0.4), 6 * (1.4 - b.splash * 0.4), 0, b.sx, 0.6 * b.splash); drawFishSplash(ctx, b.sx, b.sy, b.splash, 0.8, b.sy); }
                if (b.done) continue;
                const p = trekPos(T, Math.min(L, b.s));
                if (T.slide) drawToboggan(ctx, T.species, p.x, p.y, p.h, 1);
                else { const G = PENG[T.species], st = b.step || 0;
                    if (G.hops) { const up = Math.max(0, Math.sin(st * G.rock)); ctx.save(); ctx.globalAlpha *= 0.3; drawArcticSprite(ctx, T.species, p.x + up * 2, p.y + up * 3, p.h, 1); ctx.restore(); ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1 + up * 0.08, 1 + up * 0.08); drawPenguinOn(ctx, T.species, 0, 0, p.h, 0); ctx.restore(); }
                    else drawPenguinOn(ctx, T.species, p.x, p.y, p.h + Math.sin(st * G.rock * 0.5) * G.amp, 0); }   // the waddle: a side-to-side roll, one per two steps
            }
        }
    }
    // Swimming penguins, by species. Porpoisers (gentoo, Adélie, macaroni) are mostly a dim
    // streamlined shape under the water, and every beat an arc clear — their own markings, a
    // shadow, a small crown of white going out and coming in. Emperors swim low: a dim shape,
    // now and then the back and head breaking the surface with a V behind.
    function drawSwimmers(ctx, S) {
        const P = PENG[S.species], fx = Math.sin(S.h), fy = -Math.cos(S.h), sp = S.species;
        const under = (x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(S.h); ctx.scale(0.8, 1.2); drawArcticSprite(ctx, sp, 0, 0, 0, a); ctx.restore(); };
        for (const b of S.birds) {
            const ox = b.ox + Math.sin(S.t * 0.8 + b.ph * 3) * 5, oy = b.oy + Math.sin(S.t * 0.6 + b.ph * 5) * 3;
            const x = S.x + fx * oy + -fy * ox, y = S.y + fy * oy + fx * ox, u = ((S.t + b.ph) % b.per) / b.per;
            if (P.porp && u < 0.3) {
                const q = u / 0.3, z = Math.sin(Math.PI * q) * P.hop, px = x + fx * (q - 0.5) * 10, py = y + fy * (q - 0.5) * 10;
                ctx.fillStyle = 'rgba(8,16,28,0.25)'; ctx.beginPath(); ctx.ellipse(px + z * 0.35, py + z * 0.55, 3, 7, S.h, 0, Math.PI * 2); ctx.fill();
                under(px, py, 1);
                if (q < 0.25) drawFishSplash(ctx, x - fx * 5, y - fy * 5, 1 - q / 0.25, 0.7, b.ph * 7);
                if (q > 0.75) drawFishSplash(ctx, x + fx * 5, y + fy * 5, (q - 0.75) / 0.25, 0.7, b.ph * 9);
            } else if (!P.porp && u < 0.18) {
                const q = Math.sin(Math.PI * u / 0.18);
                under(x, y, 0.35 + 0.55 * q);
                ctx.strokeStyle = `rgba(255,255,255,${0.45 * q})`; ctx.lineWidth = 0.9;
                for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + fx * 9, y + fy * 9); ctx.lineTo(x - fx * 10 + -fy * sd * 7, y - fy * 10 + fx * sd * 7); ctx.stroke(); }
            } else under(x, y, 0.28);
        }
    }
    // The seal as a dark shape under the water: its own silhouette, tinted to the deep (cached).
    let _sealShade = null;
    function sealShade() {
        const im = arcticImg('seal'); if (!imgReady(im)) return null;
        if (!_sealShade && typeof document !== 'undefined') {
            const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d');
            g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgb(10,24,38)'; g.fillRect(0, 0, c.width, c.height); _sealShade = c;
        }
        return _sealShade;
    }
    function drawSealShade(ctx, x, y, h, alpha, scale) {
        const c = sealShade(); if (!c || alpha <= 0) return;
        const k = ARCTIC_SPR.seal.len * scale / ARCTIC_SPR.seal.ink, w = c.width * k, hh = c.height * k;
        ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.globalAlpha *= alpha; ctx.drawImage(c, -w / 2, -hh / 2, w, hh); ctx.restore();
    }
    // The entry: where it went in head first — a crown of white round the hole that tears and
    // fades, spray thrown forward, then broken rings spreading; drawn UNDER the body going in.
    function drawSealEntry(ctx, S) {
        if (S.sx === undefined) return;
        const k = S.plop, a = S.splashA;
        if (k > 0) {
            whiteSheet(ctx, S.sx, S.sy, 9 + 12 * (1 - k), 14 + 10 * (1 - k), a, S.sx, 0.6 * k);
            drawFishSplash(ctx, S.sx + Math.sin(a) * 10, S.sy - Math.cos(a) * 10, k, 2.2, S.sy);
            drawFishSplash(ctx, S.sx - Math.sin(a) * 6 + Math.cos(a) * 7, S.sy + Math.cos(a) * 6 + Math.sin(a) * 7, k * 0.8, 1.4, S.sx);
        }
        for (let r = 0; r < 3; r++) { const q = S.ring - r * 0.25; if (q > 0 && q < 1) { ctx.strokeStyle = `rgba(255,255,255,${0.4 * q})`; ctx.lineWidth = 1.1;
            for (const [a0, a1] of [[0.2, 1.4], [1.9, 3.1], [3.6, 4.6], [5.0, 6.0]]) { ctx.beginPath(); ctx.ellipse(S.sx, S.sy, 10 + (1 - q) * 28, 12 + (1 - q) * 30, a, a0 + r, a1 + r); ctx.stroke(); } } }
    }
    function drawLeopardSeal(ctx, S) {
        if (S.mode === 'deep') return;
        if (S.mode === 'haul') { const hv = S.hauling ? S.heave || 0 : 0; ctx.save(); ctx.translate(S.x, S.y); ctx.rotate(S.h); ctx.scale(1 + 0.04 * hv, 1 - 0.07 * hv); drawArcticSprite(ctx, 'seal', 0, 0, 0, 1); ctx.restore(); }
        else if (S.mode === 'launch') {
            const z = S.z || 0;
            if (z > 0.5) drawSealShade(ctx, S.x + z * 0.35, S.y + z * 0.55, S.h, 0.3, 1);   // its shadow as it leaves the ice
            // humping: the body bunches and stretches heave by heave; leaping, it stretches out long
            const hv = S.heave || 0, sy = z > 0.5 ? 1.06 - 0.1 * (1 - Math.abs(S.pitch || 0)) : 1 - 0.07 * hv, sx = z > 0.5 ? 0.94 : 1 + 0.04 * hv;
            ctx.save(); ctx.translate(S.x, S.y); ctx.rotate(S.h); ctx.scale(sx * (1 + z / 70), sy * (1 + z / 70)); drawArcticSprite(ctx, 'seal', 0, 0, 0, 1); ctx.restore();
        } else if (S.mode === 'dive') {
            drawSealEntry(ctx, S);
            const d = S.depth, fx = Math.sin(S.h), fy = -Math.cos(S.h), hd = S.h + Math.sin(S.sw) * 0.2 * (1 - d);
            // the body going under: the sprite fades in the first moments while the dark shape
            // takes over, then that shrinks a little and thins into the depth
            drawSealShade(ctx, S.x, S.y, hd, 0.55 * (1 - d) * Math.min(1, d * 6 + 0.3), 1 - 0.12 * d);
            if (d < 0.25) drawArcticSprite(ctx, 'seal', S.x, S.y, hd, 1 - d / 0.25);
            // the V it pushes while it is still near the top
            if (d < 0.5) { ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - d / 0.5)})`; ctx.lineWidth = 1;
                for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(S.x + fx * 20, S.y + fy * 20); ctx.quadraticCurveTo(S.x - fx * 4 - fy * sd * 8, S.y - fy * 4 + fx * sd * 8, S.x - fx * 18 - fy * sd * 14, S.y - fy * 18 + fx * sd * 14); ctx.stroke(); } }
        }
        else {
            const hd = S.h + Math.sin(S.sw) * 0.25;
            drawArcticSprite(ctx, 'seal', S.x, S.y, hd, 0.6 + 0.4 * S.up);
            // awash: a low V off the head as it cruises
            const fx = Math.sin(S.h), fy = -Math.cos(S.h); ctx.strokeStyle = `rgba(255,255,255,${0.3 * S.up})`; ctx.lineWidth = 0.9;
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(S.x + fx * 18, S.y + fy * 18); ctx.lineTo(S.x - fx * 8 - fy * sd * 10, S.y - fy * 8 + fx * sd * 10); ctx.stroke(); }
            if (S.ring > 0) for (let r = 0; r < 2; r++) { const q = S.ring - r * 0.3; if (q > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.4 * q})`; ctx.lineWidth = 1; for (const [a0, a1] of [[0.3, 1.6], [2.1, 3.3], [3.8, 5.6]]) { ctx.beginPath(); ctx.ellipse(S.x + Math.sin(S.h) * 16, S.y - Math.cos(S.h) * 16, 6 + (1 - q) * 16, 5 + (1 - q) * 13, S.h, a0, a1); ctx.stroke(); } } }
        }
        if (S.mode !== 'dive' && S.plop > 0) whiteSheet(ctx, S.x, S.y, 22 * (1.3 - S.plop * 0.3), 12 * (1.3 - S.plop * 0.3), S.h, S.lx + S.ly, 0.6 * S.plop);
    }
    // ANTARCTIC TERN from above (references): long narrow pointed wings, crooked at the wrist,
    // pale pearl grey with darker outer primaries; white rump and a deeply forked white tail with
    // long streamers; a black cap and a thin blood-red bill. Hovering, the wings beat fast in a
    // blur; plunging, they fold back into a dart. Span 24 u.
    // A TERN'S WINGSTROKE seen from above (references: hovering and cruising terns; common/Arctic
    // terns beat ~3.5 Hz commuting, faster hovering). The wing is never just scaled — through the
    // stroke it swings up and down, and from straight above that FORESHORTENS the span: full
    // width only as it passes level, short at the top and bottom. On the UPSTROKE the wrist
    // flexes and the long hand sweeps back (the tip trails near the tail); on the DOWNSTROKE the
    // wing is fully spread and, hovering, sweeps forward. ph = stroke phase: 0 top, pi bottom.
    // fold = 1 for the plunge (folded back into a dart). Returns the wing points for the markings.
    function ternWing(ph, fold, hover) {
        const elev = (hover ? 1.05 : 0.8) * Math.cos(ph), down = Math.sin(ph) > 0 ? Math.sin(ph) : 0, up = Math.sin(ph) < 0 ? -Math.sin(ph) : 0;   // 0 → pi is the downstroke
        const pf = (0.35 + 0.65 * Math.cos(elev)) * (1 - 0.62 * fold), flex = Math.min(1, up * 0.9 + (1 - Math.cos(elev)) * 0.3) * (1 - fold);
        const fwd = hover ? down * 2.2 : down * 0.8, span = 14 * pf;   // long narrow wings: ~2x the body, as a tern's are
        return { span, wx: span * (0.4 + 0.06 * flex), wy: -1.6 - fwd * 0.4 + flex * 0.9 + fold * 1.5,
                 tx: span * (1 - 0.25 * flex), ty: 2.4 - fwd + flex * 4.4 + fold * 6, back: 0.9 + flex * 0.6 };
    }
    function ternShape(ctx, W) {
        for (const sd of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(sd * 1, -1.2);
            ctx.quadraticCurveTo(sd * W.wx * 0.6, W.wy - 0.6, sd * W.wx, W.wy);                        // leading edge of the arm
            ctx.quadraticCurveTo(sd * (W.wx + (W.tx - W.wx) * 0.6), W.wy + (W.ty - W.wy) * 0.35 - 0.4, sd * W.tx, W.ty);   // the long pointed hand
            ctx.quadraticCurveTo(sd * (W.wx + (W.tx - W.wx) * 0.25), W.wy + 1.6 + (W.ty - W.wy) * 0.3, sd * 1.2, W.back);   // trailing edge: a narrow wing
            ctx.closePath(); ctx.fill();
        }
    }
    const TERN_SCALE = 1.35;
    function drawTern(ctx, b) {
        if (b.mode === 'roost') {
            // standing on the ice, from above: a slim grey body, the long wings folded and crossed
            // past the white tail, the black cap and the red bill; its shadow down-right
            ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.h); ctx.scale(TERN_SCALE * 1.6, TERN_SCALE * 1.6);   // ~19 u bill to wingtips: the floor, like the flying bird
            ctx.fillStyle = 'rgba(40,60,80,0.25)'; ctx.beginPath(); ctx.ellipse(0.8, 1.6, 1.3, 3.8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#b9c0c7'; ctx.beginPath(); ctx.ellipse(0, 0.6, 1.3, 3.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8f98a2'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 1.1, -0.5); ctx.quadraticCurveTo(sd * 1.3, 3, -sd * 0.4, 6.4); ctx.lineTo(sd * 0.2, 3); ctx.closePath(); ctx.fill(); }
            ctx.fillStyle = '#f4f6f7'; ctx.beginPath(); ctx.moveTo(-0.6, 3.4); ctx.lineTo(-0.9, 6); ctx.lineTo(0, 4.6); ctx.lineTo(0.9, 6); ctx.lineTo(0.6, 3.4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#16181b'; ctx.beginPath(); ctx.ellipse(0, -2.6, 0.9, 1.1, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#d8342a'; ctx.beginPath(); ctx.moveTo(-0.3, -3.5); ctx.lineTo(0, -5.4); ctx.lineTo(0.3, -3.5); ctx.closePath(); ctx.fill();
            ctx.restore(); return;
        }
        const flying = b.mode === 'hover' || b.mode === 'climb' || b.mode === 'shift' || b.mode === 'land', fold = b.mode === 'dive' ? 1 : 0;
        const W = ternWing(flying ? b.flap : 1.9, fold, b.mode === 'hover');
        const zo = Math.min(b.z, 45);
        ctx.save(); ctx.translate(b.x + zo * 0.35, b.y + zo * 0.55); ctx.rotate(b.h); ctx.scale(TERN_SCALE * 0.95, TERN_SCALE * 0.95); ctx.fillStyle = `rgba(4,10,20,${0.34 * Math.max(0.45, 1 - b.z / 120)})`; ternShape(ctx, W);
        ctx.beginPath(); ctx.ellipse(0, 1, 1.1, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.h); ctx.scale(TERN_SCALE, TERN_SCALE);
        ctx.fillStyle = '#c9ced4'; ternShape(ctx, W);
        ctx.fillStyle = 'rgba(90,98,108,0.55)';   // the darker outer primaries
        for (const sd of [-1, 1]) { const mx = W.wx + (W.tx - W.wx) * 0.45, my = W.wy + (W.ty - W.wy) * 0.45; ctx.beginPath(); ctx.moveTo(sd * mx, my); ctx.lineTo(sd * W.tx, W.ty); ctx.lineTo(sd * (mx + (W.tx - mx) * 0.15), my + 1.2 + (W.ty - my) * 0.3); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = '#b9c0c7'; ctx.beginPath(); ctx.ellipse(0, 0.6, 1.2, 3.4, 0, 0, Math.PI * 2); ctx.fill();   // body: pale grey mantle from above
        ctx.fillStyle = '#f4f6f7'; ctx.beginPath(); ctx.ellipse(0, 3.2, 0.9, 1.3, 0, 0, Math.PI * 2); ctx.fill();   // white rump
        { const fan = b.mode === 'hover' ? 1.5 : 1; ctx.beginPath(); ctx.moveTo(-0.9, 3.8); ctx.lineTo(-2.2 * fan, 8.6 - (fan - 1) * 1.5); ctx.lineTo(0, 5.4); ctx.lineTo(2.2 * fan, 8.6 - (fan - 1) * 1.5); ctx.lineTo(0.9, 3.8); ctx.closePath(); ctx.fill(); }   // the forked tail — fanned wide as it hovers
        ctx.fillStyle = '#16181b'; ctx.beginPath(); ctx.ellipse(0, -3.1, 0.95, 1.1, 0, 0, Math.PI * 2); ctx.fill();   // the black cap
        ctx.fillStyle = '#d8342a'; ctx.beginPath(); ctx.moveTo(-0.35, -4); ctx.lineTo(0, -6.2); ctx.lineTo(0.35, -4); ctx.closePath(); ctx.fill();   // the red bill
        ctx.restore();
        if (b.splash > 0) { drawFishSplash(ctx, b.sx, b.sy, b.splash, 0.6, b.a * 5); }
    }

    // ── drawing Glowtide's animals ─────────────────────────────────────────────────────────
    // A GOLDEN JELLY from above: the bell a warm amber dome, its rim scalloped and a shade lighter,
    // cream spots in rings, the pale lobed rosette of the oral arms showing through at the centre;
    // squeezing narrower on each pulse. Deeper ones smaller, fainter and bluer.
    function drawGoldJelly(ctx, j) {
        const sq = Math.max(0, Math.sin(j.ph)), d = j.depth, r = 4.6 * j.size * (1 - 0.14 * sq) * (1 - 0.25 * d), a = 0.95 - 0.5 * d;
        const rr = mulberry(j.spots);
        ctx.save(); ctx.translate(j.x, j.y); ctx.rotate(j.h); ctx.globalAlpha *= a;
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
        g.addColorStop(0, d > 0.5 ? 'rgba(201,176,122,0.85)' : 'rgba(246,206,120,0.9)'); g.addColorStop(0.75, d > 0.5 ? 'rgba(154,138,102,0.7)' : 'rgba(214,150,60,0.75)'); g.addColorStop(1, 'rgba(235,200,130,0.35)');
        ctx.fillStyle = g; ctx.beginPath();
        for (let k = 0; k <= 16; k++) { const q = k / 16 * Math.PI * 2, rk = r * (1 + 0.05 * Math.sin(q * 8 + j.ph)); k ? ctx.lineTo(Math.cos(q) * rk, Math.sin(q) * rk) : ctx.moveTo(Math.cos(q) * rk, Math.sin(q) * rk); }
        ctx.closePath(); ctx.fill();
        // the oral arms' rosette showing through, eight pale lobes
        ctx.fillStyle = 'rgba(250,236,200,0.75)';
        for (let k = 0; k < 8; k++) { const q = k / 8 * Math.PI * 2 + 0.2; ctx.beginPath(); ctx.arc(Math.cos(q) * r * 0.28, Math.sin(q) * r * 0.28, r * 0.2, 0, Math.PI * 2); ctx.fill(); }
        // cream spots
        ctx.fillStyle = 'rgba(255,248,225,0.85)';
        ctx.globalAlpha *= 0.7; for (let k = 0; k < 7; k++) { const q = rr() * Math.PI * 2, dd = r * (0.55 + rr() * 0.35); ctx.beginPath(); ctx.arc(Math.cos(q) * dd, Math.sin(q) * dd, Math.max(0.3, r * 0.06), 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }
    // MANTA RAY from above (references: drone shots over reefs, night-feeding reef mantas, the
    // Manta Trust's feeding notes; kinematics: Fish et al. 2018, JEB "Kinematics of swimming of the
    // manta ray"). A broad dark diamond: the wings' leading edges bow forward and sweep back to
    // HOOKED, curling tips, the trailing edge deeply concave, the head squared off. Reef mantas
    // (Palau's) carry pale Y-shaped shoulder patches. The wing stroke is SLOW — ~0.3 Hz — and
    // deep (0.74 body lengths peak to peak), and the flexible wing makes it a travelling wave:
    // the tip lags the root, so the tips curl down after the root and flick up after it again.
    // Cruising, the cephalic fins are ROLLED into two horns; feeding, they UNFURL into paddles
    // either side of the gaping white-rimmed mouth, funnelling plankton in. Rolled belly-up in a
    // somersault, the white belly shows its gill slits and dark spots.
    function mantaWing(ctx, sd, span, len, stroke, tipLag, fold) {
        // stroke: the root's elevation (-1..1); tipLag: the tip's (behind it in phase)
        const w = span * 0.5 * (0.74 + 0.26 * Math.cos(stroke * 1.2)) * (1 - 0.35 * fold);
        const tipY = len * (0.1 + 0.18 * Math.max(0, -tipLag) + 0.12 * fold), curl = 0.12 + 0.12 * Math.max(0, tipLag);
        ctx.beginPath();
        ctx.moveTo(sd * len * 0.14, -len * 0.46);
        ctx.bezierCurveTo(sd * w * 0.4, -len * 0.5, sd * w * 0.82, -len * 0.18, sd * w, tipY);          // leading edge, bowed forward
        ctx.quadraticCurveTo(sd * w * (1 - curl), tipY + len * 0.12, sd * w * (0.86 - curl), tipY + len * 0.1);   // the hooked tip
        ctx.bezierCurveTo(sd * w * 0.55, len * 0.12, sd * len * 0.3, len * 0.22, sd * len * 0.16, len * 0.4);     // concave trailing edge
        ctx.lineTo(0, len * 0.44);
        ctx.closePath();
    }
    function drawManta(ctx, M) {
        const span = MANTA_SPAN, len = span * 0.46, cp = Math.cos(M.pitch), belly = cp < 0, feeding = M.mode !== 'travel';
        const stroke = Math.sin(M.beat), tipLag = Math.sin(M.beat - 0.9);
        M.ceph = (M.ceph === undefined ? 0 : M.ceph) + ((feeding ? 1 : 0) - (M.ceph || 0)) * 0.05;   // fins unfurl as it starts to feed
        const u = M.ceph;
        ctx.save(); ctx.translate(M.x, M.y); ctx.rotate(M.h); ctx.scale(1, Math.max(0.2, Math.abs(cp)));
        if (belly) ctx.scale(1, -1);   // on its back the head leads the other way round the loop
        ctx.globalAlpha *= 0.85;
        const body = belly ? '#e6eaec' : '#1a1f25';
        ctx.fillStyle = body;
        for (const sd of [-1, 1]) { mantaWing(ctx, sd, span, len, stroke, tipLag, 0); ctx.fill(); }
        ctx.beginPath(); ctx.ellipse(0, 0, len * 0.2, len * 0.46, 0, 0, Math.PI * 2); ctx.fill();   // the body disc
        if (!belly) {
            // the pale Y shoulder patches of a reef manta, and a paler rim to the trailing edge
            ctx.fillStyle = 'rgba(228,232,234,0.8)';
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * len * 0.1, -len * 0.3); ctx.quadraticCurveTo(sd * span * 0.18, -len * 0.3, sd * span * 0.3, -len * 0.08);
                ctx.quadraticCurveTo(sd * span * 0.18, -len * 0.14, sd * len * 0.2, -len * 0.08); ctx.quadraticCurveTo(sd * len * 0.14, -len * 0.16, sd * len * 0.1, -len * 0.3); ctx.fill(); }
        } else {
            ctx.strokeStyle = 'rgba(40,50,60,0.6)'; ctx.lineWidth = 0.6;   // gill slits
            for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * len * 0.1, -len * 0.18 + k * 2.2); ctx.lineTo(sd * len * 0.24, -len * 0.2 + k * 2.2); ctx.stroke(); }
            ctx.fillStyle = 'rgba(30,40,50,0.6)'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(Math.sin(k * 2.3) * len * 0.15, len * 0.08 + Math.cos(k * 1.7) * len * 0.1, 0.9, 0, Math.PI * 2); ctx.fill(); }
        }
        // the mouth, gaping when it feeds: a wide white-rimmed opening at the squared front
        if (u > 0.2) { ctx.fillStyle = `rgba(235,240,242,${0.85 * u})`; ctx.beginPath(); ctx.ellipse(0, -len * 0.47, len * 0.13, len * 0.05 * u, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(20,24,28,${0.9 * u})`; ctx.beginPath(); ctx.ellipse(0, -len * 0.47, len * 0.1, len * 0.03 * u, 0, 0, Math.PI * 2); ctx.fill(); }
        // the cephalic fins: rolled horns (u=0) → unfurled paddles angled forward and in (u=1)
        ctx.fillStyle = belly ? '#d8dde0' : '#15191e';
        for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * len * 0.16, -len * 0.48); ctx.rotate(sd * (0.3 - 0.55 * u));
            // rolled: a thin horn; unfurled: a long flat paddle reaching forward past the mouth
            const rl = len * (0.075 + 0.07 * u), rw = len * (0.022 + 0.018 * u);
            ctx.beginPath(); ctx.moveTo(-rw, 0); ctx.quadraticCurveTo(-rw * 1.2, -rl * 0.7, 0, -rl); ctx.quadraticCurveTo(rw * 1.2, -rl * 0.7, rw, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
        // the tail: short on a reef manta, a thin whip swinging with the stroke
        ctx.strokeStyle = belly ? '#b8bfc4' : '#15191e'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, len * 0.42); ctx.quadraticCurveTo(stroke * 1.2, len * 0.54, 0, len * 0.66); ctx.stroke();
        ctx.restore();
        // surface feeding: at the top of the stroke the wingtips break the surface in two small splashes
        if (M.surfTip > 0) for (const sd of [-1, 1]) { const w = span * 0.5, x = M.x + Math.cos(M.h) * sd * w, y = M.y + Math.sin(M.h) * sd * w; drawFishSplash(ctx, x, y, M.surfTip, 1.1, sd + M.i); drawRing(ctx, x, y, M.surfTip, 3, 12, 0.4); }
    }
    // The plankton it lights: soft blue-green blooms of light that flare and fade (additive).
    function drawMantaGlow(ctx, M, n) {
        for (const s of M.sparks) { const u = s.age / s.life, k = Math.sin(Math.PI * Math.min(1, u)), r = 2 + 4 * s.s;
            const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r); g.addColorStop(0, `rgba(140,240,255,${0.5 * k * n})`); g.addColorStop(1, 'rgba(60,200,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill(); }
    }
    // PALAU FLYING FOX from above (references: flying foxes overhead, in flight at dusk): long
    // membranous wings, dark brown and a little translucent, the four long finger bones fanning
    // to a scalloped trailing edge between them, the thumb claw at the wrist; a dark furry body
    // with a GOLDEN-ORANGE MANTLE over the shoulders and neck, a fox's face with small ears; no tail.
    function drawFlyingFox(ctx, b) {
        // THE STROKE (references: flying foxes overhead and in flight sequences; bat-flight
        // kinematics — Riskin et al. 2012, "Upstroke wing flexion and the inertial cost of bat
        // flight"): the DOWNSTROKE is the fully spread wing sweeping forward — wrist well ahead
        // of the shoulder, the long hand swept back to a point; on the UPSTROKE the wrist flexes
        // and the whole hand-wing folds back alongside the arm, so from above the wing collapses
        // to a short crescent, then flings open again. From straight above the span also
        // foreshortens as the wing rises and falls. Gliding, the wing is held spread and level.
        const glide = b.glideT > 0;
        const ph = glide ? Math.PI * 0.5 : b.flap, elev = 0.9 * Math.cos(ph);
        const up = glide ? 0 : Math.max(0, -Math.sin(ph));                              // 0..1 through the upstroke
        const fold = Math.min(1, up * 1.15), fwd = glide ? 0.3 : Math.max(0, Math.sin(ph));   // folded / swept forward
        const H = FOX_SPAN * 0.5 * (0.45 + 0.55 * Math.cos(elev));
        const L = (a, c) => a + (c - a) * fold;
        // key poses in (fraction of half-span, y): spread → folded
        const P = {
            sh: [1.4 / H, -2.6],
            wr: [L(0.44, 0.34), L(-4.0 - fwd * 1.2, -2.2)],
            tip: [L(1.0, 0.52), L(1.4 - fwd * 1.0, 6.4)],
            d4: [L(0.74, 0.44), L(4.0, 6.8)],
            d5: [L(0.44, 0.3), L(6.4, 7.2)],
            ank: [1.3 / H, 5.8],
        };
        const X = (q, sd) => sd * q[0] * H, Y = (q) => q[1];
        const wing = (sd, fill) => {
            ctx.beginPath(); ctx.moveTo(X(P.sh, sd), Y(P.sh));
            ctx.quadraticCurveTo(X(P.sh, sd) * 0.4 + X(P.wr, sd) * 0.6, Y(P.wr) - 0.6, X(P.wr, sd), Y(P.wr));                     // arm, leading edge
            ctx.quadraticCurveTo((X(P.wr, sd) + X(P.tip, sd)) / 2, (Y(P.wr) + Y(P.tip)) / 2 - 0.5, X(P.tip, sd), Y(P.tip));      // hand, leading edge
            // the trailing edge, scalloped between the finger tips, back to the ankle
            const sc = (a, c, dip) => ctx.quadraticCurveTo((X(a, sd) + X(c, sd)) / 2, (Y(a) + Y(c)) / 2 - dip, X(c, sd), Y(c));
            sc(P.tip, P.d4, 2.2 * (1 - fold * 0.6)); sc(P.d4, P.d5, 2.4 * (1 - fold * 0.6)); sc(P.d5, P.ank, 1.4);
            ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
        };
        const zo = Math.min(b.z, 50);
        ctx.save(); ctx.translate(b.x + zo * 0.35, b.y + zo * 0.55); ctx.rotate(b.h); ctx.globalAlpha *= 0.3;
        for (const sd of [-1, 1]) wing(sd, 'rgb(4,10,20)'); ctx.beginPath(); ctx.ellipse(0, 0.5, 1.9, 4.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.h);
        for (const sd of [-1, 1]) {
            wing(sd, 'rgba(74,48,36,0.9)');
            // the bones through the membrane: forearm to the wrist, then the fingers fanning out
            ctx.strokeStyle = 'rgba(30,19,14,0.55)'; ctx.lineWidth = 0.35; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(X(P.sh, sd), Y(P.sh)); ctx.lineTo(X(P.wr, sd), Y(P.wr)); ctx.stroke();
            for (const q of [P.tip, P.d4, P.d5]) { ctx.beginPath(); ctx.moveTo(X(P.wr, sd), Y(P.wr)); ctx.lineTo(X(q, sd), Y(q)); ctx.stroke(); }
            // the little thumb claw at the wrist
            ctx.fillStyle = '#1d140f'; ctx.beginPath(); ctx.arc(X(P.wr, sd) - sd * 0.2, Y(P.wr) - 0.5, 0.45, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#2c1f18'; ctx.beginPath(); ctx.ellipse(0, 1, 2, 4.4, 0, 0, Math.PI * 2); ctx.fill();          // body
        for (const sd of [-1, 1]) { ctx.strokeStyle = '#2c1f18'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(sd * 0.9, 4.6); ctx.lineTo(sd * 1.3, 6.2); ctx.stroke(); }   // legs trailing to the membrane
        ctx.fillStyle = '#c9893a'; ctx.beginPath(); ctx.ellipse(0, -2.4, 2.2, 2, 0, 0, Math.PI * 2); ctx.fill();       // golden mantle
        ctx.fillStyle = '#3a2618'; ctx.beginPath(); ctx.moveTo(-1.4, -3.4); ctx.quadraticCurveTo(-1.2, -6.2, 0, -7.6); ctx.quadraticCurveTo(1.2, -6.2, 1.4, -3.4); ctx.closePath(); ctx.fill();   // the long fox muzzle
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 0.6, -4.4); ctx.lineTo(sd * 1.8, -5.4); ctx.lineTo(sd * 1.4, -3.8); ctx.fill(); }   // pointed ears
        ctx.restore();
    }
    // HAWKSBILL from above (references): a narrow head with a hooked hawk's beak; the carapace an
    // elongated heart, its scutes OVERLAPPING like roof tiles and the back margin SERRATED; amber
    // tortoiseshell — gold with dark brown streaks radiating in each scute; flippers scaled and
    // clawed. Swimming, the long fore-flippers sweep like wings.
    function hawksbillShape(ctx, H, onSand) {
        const L = HAWK_LEN, stroke = onSand ? Math.max(0, Math.sin(H.beat)) * 0.9 : Math.sin(H.beat) * 0.8;
        // flippers first, under the shell
        ctx.fillStyle = onSand ? '#5b4430' : '#4f3c2c';
        for (const sd of [-1, 1]) {
            ctx.save(); ctx.translate(sd * L * 0.2, -L * 0.18); ctx.rotate(sd * (0.9 - stroke * 0.7));
            ctx.beginPath(); ctx.ellipse(sd * L * 0.2, 0, L * 0.24, L * 0.07, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            ctx.save(); ctx.translate(sd * L * 0.14, L * 0.26); ctx.rotate(sd * (2.4 + stroke * 0.3));
            ctx.beginPath(); ctx.ellipse(sd * L * 0.08, 0, L * 0.1, L * 0.05, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        // head and beak
        ctx.fillStyle = '#6a4d33'; ctx.beginPath(); ctx.ellipse(0, -L * 0.42, L * 0.08, L * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3b2a1c'; ctx.beginPath(); ctx.moveTo(-L * 0.03, -L * 0.52); ctx.lineTo(0, -L * 0.58); ctx.lineTo(L * 0.03, -L * 0.52); ctx.closePath(); ctx.fill();
        // the shell: an elongated heart with a serrated rear margin
        ctx.fillStyle = '#9a6a2c'; ctx.beginPath(); ctx.moveTo(0, -L * 0.33);
        ctx.quadraticCurveTo(L * 0.24, -L * 0.34, L * 0.22, -L * 0.02);
        for (let k = 0; k <= 5; k++) { const u = k / 5, x = L * 0.22 * (1 - u), y = -L * 0.02 + L * 0.38 * Math.sin(u * Math.PI / 2); ctx.lineTo(x + L * 0.02, y); ctx.lineTo(x, y + L * 0.035); }
        for (let k = 5; k >= 0; k--) { const u = k / 5, x = -L * 0.22 * (1 - u), y = -L * 0.02 + L * 0.38 * Math.sin(u * Math.PI / 2); ctx.lineTo(x, y + L * 0.035); ctx.lineTo(x - L * 0.02, y); }
        ctx.quadraticCurveTo(-L * 0.24, -L * 0.34, 0, -L * 0.33); ctx.closePath(); ctx.fill();
        // tortoiseshell: amber scutes with dark radiating streaks
        ctx.fillStyle = 'rgba(230,170,70,0.55)';
        const sc = [[0, -0.2], [0, -0.02], [0, 0.16], [-0.12, -0.16], [0.12, -0.16], [-0.14, 0.04], [0.14, 0.04], [-0.1, 0.2], [0.1, 0.2]];
        for (const [x, y] of sc) { ctx.beginPath(); ctx.ellipse(x * L, y * L, L * 0.065, L * 0.075, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = 'rgba(60,30,12,0.6)'; ctx.lineWidth = 0.35;
        for (const [x, y] of sc) for (let k = 0; k < 3; k++) { const a = -0.8 + k * 0.8; ctx.beginPath(); ctx.moveTo(x * L, y * L - 0.8); ctx.lineTo(x * L + Math.sin(a) * 2.2, y * L + Math.cos(a) * 2); ctx.stroke(); }
    }
    function drawHawksbill(ctx, H) {
        if (H.mode === 'nestwait') return;
        const onSand = H.mode !== 'swim';
        if (!onSand) {
            const a = 0.72 + 0.28 * (H.up || 0);
            ctx.save(); ctx.translate(H.x, H.y); ctx.rotate(H.h); ctx.globalAlpha *= a; hawksbillShape(ctx, H, false); ctx.restore();
            if (H.ring > 0) drawRing(ctx, H.x + Math.sin(H.h) * 11, H.y - Math.cos(H.h) * 11, H.ring, 4, 16, 0.45);
            return;
        }
        ctx.save(); ctx.translate(H.x + 1.5, H.y + 2.4); ctx.rotate(H.h); ctx.fillStyle = 'rgba(30,20,10,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, HAWK_LEN * 0.26, HAWK_LEN * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if (H.mode === 'nest') { ctx.fillStyle = 'rgba(150,120,80,0.35)'; ctx.beginPath(); ctx.ellipse(H.x, H.y, HAWK_LEN * 0.55, HAWK_LEN * 0.62, H.h, 0, Math.PI * 2); ctx.fill(); }   // the body pit
        ctx.save(); ctx.translate(H.x, H.y); ctx.rotate(H.h); hawksbillShape(ctx, H, true); ctx.restore();
        ctx.fillStyle = 'rgba(225,205,160,0.8)'; for (const s of H.sand) { ctx.beginPath(); ctx.arc(s.x, s.y, 1.1 * (1 - s.age), 0, Math.PI * 2); ctx.fill(); }   // flung sand
    }
    // The track up the beach: a central drag of the shell and the flipper marks either side,
    // STAGGERED — the hawksbill's alternating gait (a green turtle's marks pair up).
    function drawTurtleTracks(ctx, H) {
        for (const tr of H.tracks || []) for (const q of tr) {
            ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.h);
            ctx.fillStyle = 'rgba(95,75,50,0.22)'; ctx.fillRect(-1.6, -1.2, 3.2, 2.6);
            ctx.strokeStyle = 'rgba(80,60,40,0.4)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(q.side * 4.5, -0.5); ctx.lineTo(q.side * 7.5, 1.2); ctx.stroke();
            ctx.restore();
        }
    }
    // DUGONG from above (references: drone shots over seagrass; Red Sea and Australian dugongs): a
    // long spindle of a body, grey-brown and paler on top where the light falls, a big rounded
    // head with the broad downturned muzzle disc, small paddle flippers near the front, and a
    // WHALE-LIKE CRESCENT FLUKE (a manatee's is a round paddle). Under the water it is a soft
    // shape; rising, it sharpens and the top of the head breaks the surface.
    function dugongShape(ctx, len, beat) {
        const w = len * 0.17, flk = Math.cos(beat);
        ctx.beginPath(); ctx.moveTo(0, -len * 0.5);
        ctx.bezierCurveTo(w * 1.1, -len * 0.48, w * 1.25, -len * 0.1, w * 0.9, len * 0.15);
        ctx.quadraticCurveTo(w * 0.35, len * 0.36, w * 0.2, len * 0.38);
        ctx.lineTo(-w * 0.2, len * 0.38); ctx.quadraticCurveTo(-w * 0.35, len * 0.36, -w * 0.9, len * 0.15);
        ctx.bezierCurveTo(-w * 1.25, -len * 0.1, -w * 1.1, -len * 0.48, 0, -len * 0.5); ctx.closePath(); ctx.fill();
        // the fluke: a crescent, foreshortening as it beats up and down
        const fs = 0.55 + 0.45 * Math.abs(flk);
        ctx.beginPath(); ctx.moveTo(0, len * 0.36); ctx.quadraticCurveTo(w * 1.8 * fs, len * 0.4, w * 2.1 * fs, len * 0.5); ctx.quadraticCurveTo(w * 0.8 * fs, len * 0.44, 0, len * 0.47);
        ctx.quadraticCurveTo(-w * 0.8 * fs, len * 0.44, -w * 2.1 * fs, len * 0.5); ctx.quadraticCurveTo(-w * 1.8 * fs, len * 0.4, 0, len * 0.36); ctx.fill();
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * w * 1.15, -len * 0.2, w * 0.45, w * 0.18, sd * 0.6, 0, Math.PI * 2); ctx.fill(); }   // flippers
    }
    function drawDugong(ctx, G) {
        for (const q of G.trail) { const k = 1 - q.age / 80, j = Math.sin(q.x * 3.7 + q.y) * 2; ctx.fillStyle = `rgba(190,200,175,${0.12 * k})`; ctx.beginPath(); ctx.ellipse(q.x + j, q.y - j * 0.5, 3.4, 2.4, q.h + j, 0, Math.PI * 2); ctx.fill(); }   // the feeding trail: grass pulled up in soft patches
        for (const A of G.calf ? [G, G.calf] : [G]) {
            const up = A.up || 0, a = 0.6 + 0.4 * up;
            ctx.save(); ctx.translate(A.x, A.y); ctx.rotate(A.h); ctx.globalAlpha *= a;
            ctx.fillStyle = '#8e857a'; dugongShape(ctx, A.len, A.beat);
            ctx.fillStyle = 'rgba(190,180,168,0.5)'; ctx.beginPath(); ctx.ellipse(0, -A.len * 0.1, A.len * 0.08, A.len * 0.28, 0, 0, Math.PI * 2); ctx.fill();   // light on the back
            ctx.fillStyle = '#6a6259'; ctx.beginPath(); ctx.ellipse(0, -A.len * 0.46, A.len * 0.1, A.len * 0.06, 0, 0, Math.PI * 2); ctx.fill();   // the muzzle disc
            ctx.restore();
        }
        if (G.silt) { const mx = G.x + Math.sin(G.h) * G.len * 0.5, my = G.y - Math.cos(G.h) * G.len * 0.5, g = ctx.createRadialGradient(mx, my, 0, mx, my, 10);
            g.addColorStop(0, 'rgba(200,190,150,0.25)'); g.addColorStop(1, 'rgba(200,190,150,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.fill(); }   // silt at the muzzle
        if (G.ring > 0) { const hx = G.x + Math.sin(G.h) * G.len * 0.42, hy = G.y - Math.cos(G.h) * G.len * 0.42; drawRing(ctx, hx, hy, G.ring, 5, 20, 0.5); if (G.puff > 0) drawFishSplash(ctx, hx, hy, G.puff, 1.1, G.x); }
    }

    // ══ OTTER POINT (designed Sep 26 2026; Wes chose the four) ═══════════════════════════════
    // Monterey's kelp coast. SEA OTTERS raft in the kelp beds on their backs — wrapped in the
    // fronds so they don't drift, grooming, cracking urchins on their chests, a mother with her
    // pup riding on her belly — and dive for food. CALIFORNIA SEA LIONS haul out on the stacks,
    // the big bird rock and the beach in the cove, heads up and barking; a boat close sends them
    // galumphing into the sea; groups porpoise out to raft offshore with their flippers up, and
    // back. GREAT WHITE SHARKS patrol the kelp edge and the rocky coast — a slate-grey torpedo
    // under the water, the dorsal fin and the tail tip cutting the surface now and then; one will
    // come up and shadow a boat, and one will hit a sea lion from below in a full breach. BLUE
    // WHALES travel offshore: the tall column of a blow, a back that goes on and on with the tiny
    // dorsal at the very end, and now and then a lunge sideways through a red krill swarm.
    //
    // SIZES (guidelines/scale.md): sea otter 1.3 m -> ~30 (about 2x, a broad floater); sea lion
    // 2 m -> ~44, a bull ~56; great white 5 m -> ~76 (bigger than a hull on purpose: this is the
    // animal people should remember); blue whale 25 m -> 360 (Wes, Sep 26: at true size, 240, it read too
    // small beside the others, which are all drawn 1.5-2.3x; now ~1.45x, six and a half hulls).
    const SEA_OTTER_LEN = 30, SEA_LION_LEN = 38, WHITE_LEN = 76, BLUE_LEN = 360;   // (sea lion ~half the shark, Wes's refs)
    const WHITE_CRUISE = 36, SL_SWIM = 55;
    // Sea otter fur (references): a dark chocolate body, the head and chest paling to cream
    // with age; a pup is a ball of pale tan fluff. Kelp fronds amber-olive with round bulbs.
    const SEA_OTTER = { body: '#33251d', belly: '#3d2d24', paw: '#2a1e17', flipper: '#2c2019', kelp: '#9a7a2c', bulb: '#b08d3a', pup: '#cbb189' };
    // California sea lion: dry females golden to tan-brown, bulls dark chocolate with a pale crest;
    // wet, all of them go dark and shine.
    const SEA_LION = { cow: '#a27a4d', cowBack: '#8a6541', bull: '#4c3829', bullCrest: '#b09372', wet: '#4e3b2e', swim: '#6e5c4b', flipper: '#35271e' };
    // Great white from above: a slate-grey back with a warm bronze cast; the white belly shows only
    // at the very edge of the flank and under the pectorals when it banks.
    const WHITE = { back: '#4c5358', warm: '#5a574f', edge: '#c7ccce', fin: '#474d53', mouth: '#b4485a', teeth: '#f3efe4' };
    // Blue whale: mottled pale blue-grey — through the water it glows a light aqua (drone refs).
    // (Wes's aerial references, Sep 26: from above a blue whale is PALE — a silvery lavender-grey, finely
    // dappled, the ridge of the back catching the light as a pale line; underwater it glows pale grey-blue
    // against the deep blue, the flippers turquoise-white; never the dark grey of a humpback.)
    const BLUE = { body: '#b7bfcc', mottle: '#dde3ea', dark: '#8f99aa', wet: '#b3bac8', under: '#c2ccd8', fin: '#c4ece8', fluke: '#c5d1dd', guard: '#d9dfe7', pleat: '#d9ccc4' };
    let foams = [], blood = [], kelpBeds = [], seaOtterRafts = [], slHauls = [], slGroups = [], whites = [], bluePods = [], blueBlows = [], krill = [], huntCool = 8;
    const onCam = (x, y, pad) => { const c = state.camera; if (!c) return true; return Math.abs(x - c.x) < 760 + (pad || 0) && Math.abs(y - c.y) < 520 + (pad || 0); };
    const islandById = (id) => ((state.course && state.course.islands) || []).find(s => s.id === id);
    function polyCentre(V) { let x = 0, y = 0; for (const p of V) { x += p.x; y += p.y; } return { x: x / V.length, y: y / V.length }; }
    function polyEdgeDist(x, y, V) {
        let best = 1e9;
        for (let i = 0; i < V.length; i++) { const a = V[i], b = V[(i + 1) % V.length], dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
            best = Math.min(best, Math.hypot(x - a.x - t * dx, y - a.y - t * dy)); }
        return best;
    }

    // ── SEA OTTERS ───────────────────────────────────────────────────────────────────────
    function makeSeaOtters(c) {
        const out = [];
        for (const [id, n, pup] of c.rafts) {
            const isl = islandById(id); if (!isl) continue;
            const V = isl.vertices, C = polyCentre(V);
            // the raft sits in the thick of the bed
            let cx = C.x, cy = C.y;
            for (let k = 0; k < 30; k++) { const x = C.x + R(-80, 80), y = C.y + R(-80, 80); if (pointInPoly(x, y, V) && polyEdgeDist(x, y, V) > 60) { cx = x; cy = y; break; } }
            const base = R(0, Math.PI * 2), members = [];
            for (let tries = 0; members.length < n && tries < 400; tries++) {
                const a = R(0, Math.PI * 2), d = Math.sqrt(rnd()) * (26 + n * 9), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
                if (!pointInPoly(x, y, V) || members.some(m => Math.hypot(m.hx - x, m.hy - y) < 22)) continue;
                const i = members.length;
                members.push({ i, hx: x, hy: y, x, y, h: base + R(-2.2, 2.2), mode: 'float', t: R(3, 18), bob: R(0, 7), roll: 0, paws: 'rest', food: null, tap: 0,
                    ring: 0, ring2: 0, look: 0, kelp: rnd() < 0.45, size: R(0.86, 1.06), head: R(0.55, 1), trail: [], trailT: 0, tx: x, ty: y, dive: 0, vis: 1,
                    pup: pup && i === 0, px: x, py: y, ph: 0, forager: !(pup && i === 0) && rnd() < 0.4 });
            }
            out.push({ id, isl, V, cx, cy, members, travT: R(20, 60) });
        }
        kelpBeds = ((state.course && state.course.islands) || []).filter(s2 => s2.vertices && s2.vertices.length > 2 && VenueDoc.traits(s2).veg === 'kelp');
        return out;
    }
    // somewhere else in the same bed, for a dive to come up at
    function kelpSpot(G, x, y, r) {
        for (let k = 0; k < 20; k++) { const a = R(0, Math.PI * 2), d = R(r * 0.4, r), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (pointInPoly(px, py, G.V) && !onLand(px, py)) return { x: px, y: py }; }
        return { x, y };
    }
    const inKelp = (x, y) => kelpBeds.some(K => Math.hypot(x - K.x, y - K.y) < (K.radius || 1e9) && pointInPoly(x, y, K.vertices));
    function nearestKelp(x, y) { let best = null, bd = 1e9; for (const K of kelpBeds) for (const v of K.vertices) { const d = Math.hypot(v.x - x, v.y - y); if (d < bd) { bd = d; best = { x: v.x + (K.x - v.x) * 0.25, y: v.y + (K.y - v.y) * 0.25 }; } } return best; }
    // swimming on its belly across open water: forward along its heading, round any rock
    // A boat bearing down on (x, y): the boat whose track over the next `horizon` seconds (at its real
    // velocity — boat.speed is units per 60 Hz frame) passes within R of the point. Returns the boat,
    // the time to its closest approach, and which side of its track the point lies on (+1 starboard).
    // Wes, Sep 26: animals in the water should get out of the way — at 130 u/s a 110 u radius left them
    // under a second, so they react to where the boat is GOING.
    function boatThreat(x, y, horizon, R) {
        let best = null;
        for (const b of state.boats || []) {
            if (b.opacity !== undefined && b.opacity < 0.2) continue;
            const vx = b.velocity ? b.velocity.x * 60 : Math.sin(b.heading || 0) * (b.speed || 0) * 60, vy = b.velocity ? b.velocity.y * 60 : -Math.cos(b.heading || 0) * (b.speed || 0) * 60;
            const dx = x - b.x, dy = y - b.y, v2 = vx * vx + vy * vy;
            if (dx * dx + dy * dy > (R + Math.sqrt(v2) * horizon) ** 2) continue;
            const tc = v2 > 1 ? Math.max(0, Math.min(horizon, (dx * vx + dy * vy) / v2)) : 0;
            const d = Math.hypot(dx - vx * tc, dy - vy * tc);
            if (d < R && (!best || tc < best.t)) best = { b, t: tc, d, side: Math.sign(vx * dy - vy * dx) || 1, vx, vy, spd: Math.sqrt(v2) };
        }
        return best;
    }
    // the way out of a boat's path: square off its track, on the side the animal is already on
    function dodgeDir(th) { const L = th.spd || 1; return th.spd > 5 ? { x: -th.vy / L * th.side, y: th.vx / L * th.side } : null; }
    function otterSwim(m, tx, ty, v, dt) {
        const want = Math.atan2(tx - m.x, -(ty - m.y));
        for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) { const h = want + da, nh = m.h + Math.max(-3 * dt, Math.min(3 * dt, angDiff(h, m.h)));
            const nx = m.x + Math.sin(nh) * v * dt, ny = m.y - Math.cos(nh) * v * dt;
            if (!solidAt(nx + Math.sin(nh) * 14, ny - Math.cos(nh) * 14, null, true) && !solidAt(nx, ny, null, true)) { m.h = nh; m.x = nx; m.y = ny; return; } }
        m.h += 2 * dt;
    }
    function updateSeaOtters(dt) {
        const c = cfg.seaOtters;
        // TRAVELLERS: now and then one sets off on its belly across open water to another bed, stays a
        // while, and swims home — the otters a shark finds out of the kelp
        for (const G of seaOtterRafts) { G.travT -= dt; if (G.travT > 0) continue; G.travT = R(35, 80);
            const m = G.members.find(q => !q.pup && q.mode === 'float' && !q.away); if (!m) continue;
            const to = seaOtterRafts.filter(H => H !== G && Math.hypot(H.cx - G.cx, H.cy - G.cy) < 2600).sort((a, b) => Math.hypot(a.cx - G.cx, a.cy - G.cy) - Math.hypot(b.cx - G.cx, b.cy - G.cy))[0];
            if (!to) continue; const q = kelpSpot(to, to.cx, to.cy, 60); m.mode = 'travel'; m.tx = q.x; m.ty = q.y; m.away = true; m.homeG = G; m.ring2 = 1; }
        for (const G of seaOtterRafts) for (const m of G.members) {
            m.t -= dt; m.bob += dt; m.ph += dt;
            m.ring = Math.max(0, m.ring - dt / 1.6); m.ring2 = Math.max(0, m.ring2 - dt / 1.2);
            const b = boatNear(m.x, m.y, c.lookR);
            const bd = b ? Math.hypot(b.x - m.x, b.y - m.y) : 1e9;
            // PERISCOPING: a boat coming — it sits up in the water and watches it
            const wantLook = b && bd < c.lookR && (m.mode === 'float' || m.mode === 'eat');
            m.look += ((wantLook ? 1 : 0) - m.look) * Math.min(1, dt * 3);
            if (wantLook) m.h += angDiff(Math.atan2(b.x - m.x, -(b.y - m.y)), m.h) * Math.min(1, dt * 1.5);
            // IN ITS PATH (the boat's track over the next 2.5 s passes within 70 u), or simply too close:
            // resting ones go down or swim off square to the boat's line; moving ones veer out of it
            const th = m.mode !== 'under' && m.mode !== 'dive' && m.mode !== 'roll' ? boatThreat(m.x, m.y, 2.5, 70) : null;
            if (th && (m.mode === 'travel' || m.mode === 'bolt' || m.mode === 'swim' || (m.mode === 'back' && m.t <= 0))) {
                const dd = dodgeDir(th); if (dd && !(m.shoveT > 0)) { m.shoveT = 1.2; m.svx = dd.x * 55; m.svy = dd.y * 55; m.ring2 = 1; }
            }
            if ((th || (b && bd < c.reactR)) && (m.mode === 'float' || m.mode === 'eat' || m.mode === 'back')) {
                const dd = th && dodgeDir(th), away = dd ? Math.atan2(dd.x, -dd.y) : Math.atan2(m.x - b.x, -(m.y - b.y));
                if (m.pup) { m.mode = 'back'; m.t = 0; m.fleeTo = { x: m.x + Math.sin(away) * 130, y: m.y - Math.cos(away) * 130 }; if (m.pupAlone) m.fleeTo = null; }
                else if ((m.i + Math.floor(T / 30)) % 2) { m.mode = 'dive'; m.t = 0.7; m.quick = true; const q = kelpSpot(G, m.x + Math.sin(away) * 140, m.y - Math.cos(away) * 140, 60); m.tx = q.x; m.ty = q.y; }
                else { m.mode = 'swim'; m.t = R(3, 5); m.tx = m.x + Math.sin(away) * 170; m.ty = m.y - Math.cos(away) * 170; m.ring2 = 1; m.fast = !!th; }
                m.paws = 'rest'; m.food = null;
            }
            if (m.mode === 'float' || m.mode === 'eat') {
                // lying on its back in the kelp, drifting a little, turning slowly
                m.x += (m.hx - m.x) * Math.min(1, dt * 0.05) + Math.sin(m.bob * 0.23 + m.i) * 0.6 * dt;
                m.y += (m.hy - m.y) * Math.min(1, dt * 0.05) + Math.cos(m.bob * 0.19 + m.i) * 0.6 * dt;
                m.h += Math.sin(m.bob * 0.11 + m.i * 2) * 0.03 * dt;
                if (m.mode === 'eat') {
                    // cracking a shell on the chest: a pounding every ~0.8 s, then a pause to eat
                    m.tap = (m.ph % 0.8) < 0.14 && (m.ph % 6) < 3.2 ? 1 : 0;
                    if (m.t <= 0) { m.mode = 'float'; m.food = null; m.paws = 'rest'; m.t = R(4, 10); }
                } else if (m.t <= 0 && m.leg === 'visit') {
                    const H = m.homeG, q = kelpSpot(H, H.cx, H.cy, 60); m.mode = 'travel'; m.leg = 'home'; m.tx = q.x; m.ty = q.y; m.ring2 = 1;
                } else if (m.t <= 0) {
                    const r = rnd();
                    if (r < 0.3 && !m.pupAlone) { m.mode = 'roll'; m.t = 0.9; m.ring2 = 1; }
                    else if (r < 0.55) { m.paws = 'groom'; m.t = R(3, 6); }
                    else if (r < 0.82 && m.forager) { m.mode = 'dive'; m.t = 0.9; m.quick = false; const q = kelpSpot(G, m.x, m.y, 70); m.tx = q.x; m.ty = q.y; }
                    else { m.paws = 'rest'; m.t = R(5, 14); }
                }
            } else if (m.mode === 'roll') {
                // a grooming roll: over and back up in one quick turn, water flying
                m.roll = 1 - m.t / 0.9;
                if (m.t <= 0) { m.mode = 'float'; m.roll = 0; m.t = R(2, 6); m.paws = 'groom'; }
            } else if (m.mode === 'dive') {
                // the forward roll down: head first, the back arching, the hind flippers flicked up last
                m.dive = 1 - m.t / (m.quick ? 0.7 : 0.9);
                if (m.pup && !m.pupAlone) { m.pupAlone = true; m.px = m.x; m.py = m.y; }   // a pup can't dive: she leaves it floating
                if (m.t <= 0) { m.mode = 'under'; m.ut = 0; m.dive = 0; m.ring = 1; m.t = m.quick ? R(7, 12) : R(10, 18); m.food = null; }
            } else if (m.mode === 'under') {
                m.ut += dt;
                const d = Math.hypot(m.tx - m.x, m.ty - m.y);
                if (d > 2) { const v = Math.min(d, (m.quick ? 22 : 8) * dt); m.x += (m.tx - m.x) / d * v; m.y += (m.ty - m.y) / d * v; m.h += angDiff(Math.atan2(m.tx - m.x, -(m.ty - m.y)), m.h) * Math.min(1, dt * 2); }
                if (m.t <= 0 && !boatNear(m.x, m.y, 50)) {
                    m.mode = m.quick ? 'back' : 'eat'; m.ring = 1; m.ring2 = 1; m.t = R(10, 20);
                    if (!m.quick) { const f = rnd(); m.food = f < 0.5 ? 'urchin' : f < 0.8 ? 'crab' : 'clam'; m.paws = 'hold'; }
                    // a mother comes straight back to her pup
                    if (m.pup) { m.mode = 'back'; m.tx = m.px; m.ty = m.py; }
                }
            } else if (m.mode === 'travel' || m.mode === 'bolt') {
                // across open water; BOLTING from a shark it makes flat out for the nearest kelp
                otterSwim(m, m.tx, m.ty, m.mode === 'bolt' ? 62 : 30, dt);
                if (m.mode === 'bolt') { m.boltT = (m.boltT || 0) + dt; if ((m.boltT % 0.5) < dt) { m.ring = 0.8; } }
                if (Math.hypot(m.tx - m.x, m.ty - m.y) < 14 || (m.mode === 'bolt' && inKelp(m.x, m.y) && m.boltT > 1)) {
                    m.boltT = 0;
                    if (m.away && m.mode === 'travel' && m.leg !== 'home') { m.mode = 'float'; m.hx = m.x; m.hy = m.y; m.t = R(20, 45); m.leg = 'visit'; }
                    else if (m.mode === 'bolt') { m.mode = 'float'; m.hx = m.x; m.hy = m.y; m.t = R(15, 30); m.leg = 'visit'; }
                    else { m.mode = 'float'; m.away = false; m.leg = null; m.hx = m.tx; m.hy = m.ty; m.t = R(5, 12); }
                }
            } else if (m.mode === 'swim') {
                // on its belly, head up, swimming off with a wake — then it rolls back over
                const d = Math.hypot(m.tx - m.x, m.ty - m.y), w = Math.atan2(m.tx - m.x, -(m.ty - m.y));
                m.h += angDiff(w, m.h) * Math.min(1, dt * 3);
                const v = m.fast ? 50 : 34, nx = m.x + Math.sin(m.h) * v * dt, ny = m.y - Math.cos(m.h) * v * dt;
                if (!onLand(nx, ny)) { m.x = nx; m.y = ny; }
                if (d < 15 || m.t <= 0) { m.mode = 'back'; m.fast = false; m.t = R(6, 12); m.ring2 = 1; m.tx = m.hx; m.ty = m.hy; }
            } else if (m.mode === 'back') {
                // BACKSTROKE home: on its back, feet first, kicking with the hind flippers
                if (m.t > 0 && !m.pup) { /* a rest before it heads home */ }
                else {
                    const P = m.pupAlone ? { x: m.px, y: m.py } : m.fleeTo || { x: m.hx, y: m.hy }, tx = P.x, ty = P.y, d = Math.hypot(tx - m.x, ty - m.y);
                    if (d < 6) { m.mode = 'float'; m.t = R(4, 12); m.pupAlone = false; m.fleeTo = null; }
                    else { const w = Math.atan2(m.x - tx, -(m.y - ty)); m.h += angDiff(w, m.h) * Math.min(1, dt * 1.5);   // head AWAY from where it's going
                        const v = Math.min(d, 14 * dt); m.x += (tx - m.x) / d * v; m.y += (ty - m.y) / d * v; }
                }
            }
            // the sideways dash out of a boat's path, on top of whatever it was doing
            if (m.shoveT > 0) { m.shoveT -= dt; const nx = m.x + m.svx * dt, ny = m.y + m.svy * dt; if (!solidAt(nx, ny, null, true)) { m.x = nx; m.y = ny; m.h += angDiff(Math.atan2(m.svx, -m.svy), m.h) * Math.min(1, dt * 4); } }
            recordTrail(m, dt, m.mode === 'swim' || m.mode === 'travel' || m.mode === 'bolt' || (m.mode === 'back' && m.t <= 0));
            if (m.mode !== 'roll') m.roll = 0;
        }
        // mothers drift back to the raft with the pup once reunited: the raft spot follows her
        for (const G of seaOtterRafts) for (const m of G.members) if (m.pup && !m.pupAlone && m.mode === 'float') { m.hx += (G.cx - m.hx) * Math.min(1, dt * 0.02); m.hy += (G.cy - m.hy) * Math.min(1, dt * 0.02); }
    }

    // SEA OTTER, second drawing (Wes's references, Sep 26 2026 — drone rafts at Morro Bay and in kelp,
    // singles on their backs from above, a mother with her pup, close portraits). On its back it is LONG:
    // a round pale head, a short thick neck, a broad chest with the forepaws folded on it, the belly
    // narrowing to the hips, then the big dark webbed hind feet splayed out and a long flat tail trailing
    // well past them. The face looks straight up: eyes toward the crown, the big black nose below them
    // toward the chest, puffy pale whisker pads either side, the mouth under the nose. Native units: the
    // crown at y = -14.4, the tail tip at y = +18; heading up is the head.
    const OTTER_BODY = [[-8.6, 2.9], [-6.4, 4.2], [-3.5, 4.8], [0, 4.8], [3, 4.4], [5.6, 3.7], [7.6, 2.8], [9.2, 1.8]];
    function seaOtterBody(ctx, w) {
        ctx.beginPath();
        OTTER_BODY.forEach(([y, hw], i) => i ? ctx.lineTo(hw * w, y) : ctx.moveTo(hw * w, y));
        for (let i = OTTER_BODY.length - 1; i >= 0; i--) { const [y, hw] = OTTER_BODY[i]; ctx.lineTo(-hw * w, y); }
        ctx.closePath();
    }
    function seaOtterTail(ctx, w, sway) {
        // long, flat, paddle-like, as long as a third of the body, trailing past the feet
        ctx.beginPath(); ctx.moveTo(1.7 * w, 8.6);
        ctx.quadraticCurveTo(1.7 * w + sway * 0.3, 14, 1.0 * w + sway, 18.4); ctx.quadraticCurveTo(sway, 19.8, -1.0 * w + sway, 18.4);
        ctx.quadraticCurveTo(-1.7 * w + sway * 0.3, 14, -1.7 * w, 8.6); ctx.closePath();
    }
    function seaOtterFoot(ctx, sd, spread, scale) {
        // a hind foot: a broad webbed paddle out and back from the hip, the toes fanned at the end
        ctx.save(); ctx.translate(sd * 2.7, 7.0); ctx.rotate(-sd * spread); ctx.scale(scale, scale);
        ctx.beginPath(); ctx.moveTo(-1.1, 0); ctx.quadraticCurveTo(-2.4, 3.2, -2.3, 6.2); ctx.quadraticCurveTo(-1.2, 7.4, 0, 6.9); ctx.quadraticCurveTo(1.2, 7.5, 2.3, 6.2); ctx.quadraticCurveTo(2.4, 3.2, 1.1, 0); ctx.closePath();
        ctx.fillStyle = SEA_OTTER.flipper; ctx.fill();
        ctx.strokeStyle = 'rgba(110,88,70,0.55)'; ctx.lineWidth = 0.3; for (const t of [-1.3, -0.45, 0.45, 1.3]) { ctx.beginPath(); ctx.moveTo(t * 0.4, 1.5); ctx.lineTo(t * 1.35, 6.6); ctx.stroke(); }
        ctx.restore();
    }
    // The face, looking up at us, centred at (0, hy) with radius hr — eyes toward the crown (-y), the nose
    // below them toward the chest.
    function seaOtterFace(ctx, hy, hr, headCol, whisk) {
        // puffy pale whisker pads either side of the nose
        ctx.fillStyle = 'rgba(245,236,214,0.55)'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * hr * 0.33, hy + hr * 0.42, hr * 0.36, hr * 0.28, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#15100d';
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * hr * 0.4, hy - hr * 0.3, hr * 0.11, hr * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }   // the eyes, small and dark, up toward the crown
        // the big black nose: a rounded triangle pointing down toward the chin
        ctx.beginPath(); ctx.moveTo(-hr * 0.33, hy + hr * 0.12); ctx.quadraticCurveTo(0, hy + hr * 0.02, hr * 0.33, hy + hr * 0.12); ctx.quadraticCurveTo(hr * 0.3, hy + hr * 0.35, 0, hy + hr * 0.45); ctx.quadraticCurveTo(-hr * 0.3, hy + hr * 0.35, -hr * 0.33, hy + hr * 0.12); ctx.fill();
        ctx.strokeStyle = 'rgba(40,28,22,0.7)'; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.moveTo(0, hy + hr * 0.45); ctx.lineTo(0, hy + hr * 0.62); ctx.stroke();   // the mouth line under it
        if (whisk) { ctx.strokeStyle = 'rgba(250,246,236,0.7)'; ctx.lineWidth = 0.18;
            for (const sd of [-1, 1]) for (const q of [-0.2, 0.25, 0.7]) { ctx.beginPath(); ctx.moveTo(sd * hr * 0.45, hy + hr * 0.45); ctx.quadraticCurveTo(sd * hr * 1.1, hy + hr * (0.45 + q * 0.5), sd * hr * 1.6, hy + hr * (0.6 + q)); ctx.stroke(); } }
    }
    function drawSeaOtterUnder(ctx, m) {
        // a dim shape gliding under the kelp just after it goes down and just before it comes up
        if (m.mode !== 'under') return;
        const k = SEA_OTTER_LEN / 32 * m.size, fade = Math.max(0, 1 - m.ut / 1.5, 1 - m.t / 1.6);
        if (fade <= 0.02) return;
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h); ctx.scale(k, k); ctx.globalAlpha *= 0.3 * Math.min(1, fade);
        ctx.fillStyle = 'rgb(20,30,32)'; seaOtterBody(ctx, 0.85); ctx.fill(); seaOtterTail(ctx, 1, 0); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -11, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    function drawSeaOtter(ctx, m) {
        const k = SEA_OTTER_LEN / 32 * m.size, tint = waterTint();
        const bobA = Math.sin(m.bob * 1.3 + m.i) * 0.04;
        if (m.pup && m.pupAlone) drawSeaOtterPup(ctx, m.px, m.py, m.h + 0.4, k, m.bob, true);
        if (m.ring > 0) { drawRing(ctx, m.x, m.y, m.ring, 6 * k, 18 * k, 0.55); drawRing(ctx, m.x, m.y, Math.max(0, m.ring - 0.35), 4 * k, 12 * k, 0.4); }
        if (m.ring2 > 0) drawRing(ctx, m.x, m.y, m.ring2, 9 * k, 10 * k, 0.35);
        if (m.mode === 'under') return;
        const prone = m.mode === 'swim' || m.mode === 'travel' || m.mode === 'bolt';
        if (prone) drawWakeTrail(ctx, m, 4 * k, 1.1, m.mode === 'bolt' ? 0.9 : 0.6);
        if (m.mode === 'back' && m.t <= 0) drawWakeTrail(ctx, m, 3.5 * k, 0.8, 0.35);
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h + bobA); ctx.scale(k, k);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const headC = m.head, headCol = `rgb(${Math.round(150 + 80 * headC)},${Math.round(128 + 78 * headC)},${Math.round(98 + 70 * headC)})`;
        const tailSway = Math.sin(m.bob * (prone ? 5 : 0.9) + m.i) * (prone ? 1.4 : 0.5);
        if (prone) {
            // ON ITS BELLY: low and dark, the back awash, the pale crown of the head pushing a bow wave,
            // the feet and the long tail trailing
            ctx.fillStyle = 'rgba(8,24,30,0.25)'; ctx.beginPath(); ctx.ellipse(1, 3, 5, 15, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = SEA_OTTER.body; for (const sd of [-1, 1]) seaOtterFoot(ctx, sd, 0.12, 0.85); seaOtterTail(ctx, 0.9, tailSway); ctx.fill();
            ctx.fillStyle = SEA_OTTER.body; seaOtterBody(ctx, 0.8); ctx.fill();
            ctx.save(); ctx.globalAlpha *= 0.4; ctx.fillStyle = `rgb(${tint})`; seaOtterBody(ctx, 0.8); ctx.fill(); seaOtterTail(ctx, 0.9, tailSway); ctx.fill(); ctx.restore();
            ctx.strokeStyle = 'rgba(225,238,240,0.45)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 2); ctx.stroke();   // the wet line of the back
            ctx.fillStyle = headCol; ctx.beginPath(); ctx.ellipse(0, -11, 3.2, 3.4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = SEA_OTTER.body; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 2.6, -9.6, 0.6, 0, Math.PI * 2); ctx.fill(); }   // the little ears at the back of the head
            ctx.fillStyle = '#15100d'; ctx.beginPath(); ctx.ellipse(0, -14.1, 0.9, 0.55, 0, 0, Math.PI * 2); ctx.fill();   // the nose, leading
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -12.2, 3.6, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
            for (const sd of [-1, 1]) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(sd * 3.2, -13.2); ctx.quadraticCurveTo(sd * 4.6, -10, sd * 5.8, -7); ctx.stroke(); }
            ctx.restore(); return;
        }
        const roll = m.roll || 0, rc = Math.cos(roll * Math.PI * 2), back = rc < 0;    // mid-roll we see its back
        const dive = m.dive || 0, lk = m.look || 0;
        // the contact shade in the water round it
        ctx.fillStyle = 'rgba(8,24,30,0.24)'; ctx.beginPath(); ctx.ellipse(1.2, 2.5, 6, 16, 0, 0, Math.PI * 2); ctx.fill();
        if (dive > 0) { ctx.save(); ctx.beginPath(); ctx.rect(-14, -16 + dive * 26, 28, 40); ctx.clip(); }
        const wid = Math.max(0.55, Math.abs(rc)) * (1 - lk * 0.15);
        // the long flat tail and the big hind feet, held up out of the water, splayed (bigger as it dives: they come up last)
        const fl = 1 + (dive > 0.5 ? (dive - 0.5) * 1.4 : 0);
        ctx.fillStyle = SEA_OTTER.flipper; seaOtterTail(ctx, wid, tailSway); ctx.fill();
        for (const sd of [-1, 1]) seaOtterFoot(ctx, sd, 0.62 + 0.12 * Math.sin(m.bob * 1.7 + sd), fl);   // (splayed well out, clear of the tail)
        // the body, belly up: the dense dark fur, wet and spiky; the chest paling toward the head with age
        ctx.fillStyle = back ? SEA_OTTER.body : SEA_OTTER.belly; seaOtterBody(ctx, wid); ctx.fill();
        if (!back) {
            const g = ctx.createLinearGradient(0, -9, 0, -2); g.addColorStop(0, headCol); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.save(); ctx.globalAlpha *= 0.5 * headC; ctx.fillStyle = g; seaOtterBody(ctx, wid); ctx.fill(); ctx.restore();
            // the wet fur: short pale spiky streaks catching the light
            ctx.strokeStyle = 'rgba(185,165,145,0.35)'; ctx.lineWidth = 0.25;
            for (let q = 0; q < 9; q++) { const y = -5 + q * 1.4, x = ((q * 37) % 7 - 3) * 0.9 * wid; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.5, y + 1.1); ctx.stroke(); }
        }
        // lying awash: the water over the hips
        ctx.save(); seaOtterBody(ctx, wid); ctx.clip(); ctx.globalAlpha *= 0.18; ctx.fillStyle = `rgb(${tint})`; ctx.beginPath(); ctx.ellipse(0, 7, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.strokeStyle = SOFT; ctx.lineWidth = 0.35; seaOtterBody(ctx, wid); ctx.stroke();
        // a strand of kelp across the belly, anchoring it: out beyond the body both sides, a bulb at the end
        if (m.kelp && !back && dive === 0) {
            ctx.strokeStyle = SEA_OTTER.kelp; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.bezierCurveTo(-5, -2.6, 4, 4.2, 13, 2.2); ctx.stroke();
            ctx.strokeStyle = 'rgba(214,180,90,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-12, -0.2); ctx.bezierCurveTo(-5, -2.6, 4, 4, 12, 2); ctx.stroke();
            ctx.fillStyle = SEA_OTTER.bulb; ctx.beginPath(); ctx.arc(13.6, 2.4, 1.3, 0, Math.PI * 2); ctx.fill();
        }
        // the pup riding on her chest and belly, its head up under her chin
        if (m.pup && !m.pupAlone && dive === 0 && !back) drawSeaOtterPup(ctx, 0, -1.2, 0, 1, m.bob, false);
        // the head: round, pale; sitting up (periscoping) it is bigger and nearer, its shadow thrown down-right
        const hy = -11 - lk * 1.2, hr = 3.5 * (1 + lk * 0.18);
        if (lk > 0.05) { ctx.fillStyle = `rgba(8,24,30,${0.2 * lk})`; ctx.beginPath(); ctx.ellipse(2.2 * lk, hy + 3 * lk, hr, hr, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = back ? SEA_OTTER.body : headCol; ctx.beginPath(); ctx.ellipse(0, hy, hr * Math.max(wid, 0.8) * 1.05, hr, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = SOFT; ctx.lineWidth = 0.3; ctx.stroke();
        if (!back) seaOtterFace(ctx, hy, hr, headCol, true);
        else { ctx.fillStyle = headCol; ctx.beginPath(); ctx.ellipse(0, hy - hr * 0.2, hr * 0.7, hr * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }   // rolled: the pale crown from behind
        // the forearms and paws: folded on the chest; up at the face grooming; holding the food
        if (!back && dive === 0) {
            let pw = [[-1.5, -6.9], [1.5, -6.9]];
            if (m.paws === 'groom') { const s = Math.sin(m.ph * 4) * 0.9; pw = [[-1.6 + s * 0.4, hy + 0.3 + s], [1.6 - s * 0.4, hy + 0.6 - s]]; }
            const eating = m.paws === 'hold' || m.mode === 'eat';
            if (eating) { const up = m.tap ? -0.9 : 0; pw = [[-2.1, -6.3 + up], [2.1, -6.3 + up]]; }
            if (m.food) {
                const fy = -5.9 + (m.tap ? -0.9 : 0);
                if (m.food === 'urchin') { ctx.fillStyle = '#4d2a5a'; ctx.beginPath(); ctx.arc(0, fy, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#6d3f7c'; ctx.lineWidth = 0.35; for (let a = 0; a < 12; a++) { const aa = a / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(aa) * 1.6, fy + Math.sin(aa) * 1.6); ctx.lineTo(Math.cos(aa) * 2.5, fy + Math.sin(aa) * 2.5); ctx.stroke(); } }
                else if (m.food === 'crab') { ctx.fillStyle = '#c4552c'; ctx.beginPath(); ctx.ellipse(0, fy, 2.3, 1.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#a0401f'; ctx.lineWidth = 0.4; for (const sd of [-1, 1]) for (const q of [-0.8, 0, 0.8]) { ctx.beginPath(); ctx.moveTo(sd * 2, fy + q); ctx.lineTo(sd * 3.2, fy + q * 1.5); ctx.stroke(); } }
                else { ctx.fillStyle = '#d9d0bd'; ctx.beginPath(); ctx.ellipse(0, fy, 2, 1.5, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(120,110,90,0.7)'; ctx.lineWidth = 0.3; ctx.stroke(); }
            }
            ctx.strokeStyle = SEA_OTTER.paw; ctx.lineWidth = 1.7;
            for (const [x, y] of pw) { const sd = Math.sign(x); ctx.beginPath(); ctx.moveTo(sd * 4 * wid, -5.8); ctx.quadraticCurveTo(sd * 3.2 * wid, y + 0.5, x, y); ctx.stroke(); }   // the short forearms from the shoulders
            ctx.fillStyle = SEA_OTTER.paw; for (const [x, y] of pw) { ctx.beginPath(); ctx.ellipse(x, y, 1.1, 0.9, 0, 0, Math.PI * 2); ctx.fill(); }
        }
        if (dive > 0) ctx.restore();
        // the roll throws water off its fur; the dive leaves a swirl where the head went under
        if (roll > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.7 * Math.sin(Math.PI * roll)})`; ctx.lineWidth = 0.9; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(0, -1, 8, sd > 0 ? -0.6 : Math.PI - 0.6, sd > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke(); } }
        if (dive > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - dive * 0.5)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -11 + dive * 22, 5 + dive * 3, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
    }
    // A PUP (references): a ball of pale tan fluff, on its mother's chest with its head up under her chin,
    // or floating alone like a cork while she dives — the same face as hers, looking up.
    function drawSeaOtterPup(ctx, x, y, h, k, bob, alone) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(h + (alone ? Math.sin(bob * 0.7) * 0.2 : 0)); if (alone) ctx.scale(k, k);
        if (alone) { ctx.fillStyle = 'rgba(8,24,30,0.22)'; ctx.beginPath(); ctx.ellipse(0.8, 1.2, 4.4, 7, 0, 0, Math.PI * 2); ctx.fill(); }
        // fluffy body: a lobed outline, never a smooth ellipse
        ctx.fillStyle = SEA_OTTER.pup; ctx.beginPath();
        for (let a = 0; a <= 24; a++) { const aa = a / 24 * Math.PI * 2, r = 1 + 0.07 * Math.sin(aa * 9); ctx.lineTo(Math.cos(aa) * 3.4 * r, 1.4 + Math.sin(aa) * 5 * r); }
        ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(120,95,65,0.55)'; ctx.lineWidth = 0.3; ctx.stroke();
        if (alone) { ctx.fillStyle = '#6a5140'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 1.4, 6.6, 0.9, 1.4, sd * 0.3, 0, Math.PI * 2); ctx.fill(); } }   // its little dark feet
        ctx.fillStyle = '#dac7a2'; ctx.beginPath(); ctx.arc(0, -4.4, 2.5, 0, Math.PI * 2); ctx.fill();
        seaOtterFace(ctx, -4.4, 2.5, '#dac7a2', false);
        ctx.restore();
    }

    // ── CALIFORNIA SEA LIONS ─────────────────────────────────────────────────────────────
    // A haul-out: a rock (a prop's collider) or a beach (a sand shape). Each animal has its own
    // spot; the water's edge off that spot is where it goes in and comes out.
    function makeSeaLions(c) {
        const hauls = [];
        const add = (id, V, n, beach) => {
            const C = polyCentre(V), spots = [];
            const x0 = Math.min(...V.map(p => p.x)), x1 = Math.max(...V.map(p => p.x)), y0 = Math.min(...V.map(p => p.y)), y1 = Math.max(...V.map(p => p.y));
            const okAt = (x, y) => { if (!pointInPoly(x, y, V)) return false; const e = polyEdgeDist(x, y, V); return e >= 12 && !(beach && e > 110); };
            // HUDDLED (drone refs): they lie in clumps, touching, all ways round — never evenly spread
            const clumps = [];
            for (let tries = 0; clumps.length < Math.max(1, Math.ceil(n / 9)) && tries < 300; tries++) { const x = R(x0, x1), y = R(y0, y1); if (okAt(x, y) && clumps.every(c2 => Math.hypot(c2.x - x, c2.y - y) > 70)) clumps.push({ x, y }); }
            for (let tries = 0; spots.length < n && tries < 4000; tries++) {
                const c2 = clumps[tries % clumps.length], a = R(0, Math.PI * 2), d = R(0, 18 + spots.length * 2.2);
                const x = c2.x + Math.cos(a) * d, y = c2.y + Math.sin(a) * d;
                if (!okAt(x, y) || spots.some(s2 => Math.hypot(s2.x - x, s2.y - y) < 15)) continue;
                spots.push({ x, y });
            }
            // the water's edge off each spot: out from the rock's middle until the water is open
            const members = spots.map((s, i) => {
                // the water nearest this spot, in any direction (a beach backs onto land; a rock is not convex)
                let a = Math.atan2(s.x - C.x, -(s.y - C.y)), ex = s.x, ey = s.y, bestD = 1e9;
                for (let k = 0; k < 24; k++) { const aa = k / 24 * Math.PI * 2;
                    for (let d = 8; d < Math.min(bestD, 600); d += 8) { const px = s.x + Math.sin(aa) * d, py = s.y - Math.cos(aa) * d;
                        if (!pointInPoly(px, py, V) && !onLand(px, py)) { if (openAround(px + Math.sin(aa) * 14, py - Math.cos(aa) * 14, 12)) { bestD = d; a = aa; ex = px; ey = py; } break; } } }
                const bull = rnd() < 0.2;
                return { i, sx: s.x, sy: s.y, x: s.x, y: s.y, h: beach ? a + Math.PI + R(-1.1, 1.1) : R(0, Math.PI * 2), ex: ex + Math.sin(a) * 12, ey: ey - Math.cos(a) * 12, out: a,   // (the collider is traced off the painted rock)
                         bull, size: bull ? R(1.18, 1.3) : R(0.85, 1.02), mode: 'lie', t: R(2, 12), up: 0, bark: 0, wet: polyEdgeDist(s.x, s.y, V) < 45 ? 1 : rnd() < 0.15 ? 1 : 0, /* refs: dark wet ones by the waterline, golden dry ones up top */ lowWet: beach ? 0 : polyEdgeDist(s.x, s.y, V) < 45 ? 0.7 : 0, curl: R(-0.6, 0.6), bob: R(0, 7), home: true };
            });
            hauls.push({ id, V, C, beach: !!beach, members, alert: 0 });
        };
        for (const [id, n] of c.rocks) { const s = islandById(id + '.hit'); if (s) add(id, s.vertices, n, false); }
        for (const [id, n] of c.beaches || []) { const s = islandById(id); if (s) add(id, s.vertices, n, true); }
        // each haul-out's raft spot: the open sea off it, along the longest clear line of water
        for (const H of hauls) {
            let best = 0, ba = 0;
            for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; let d = 0; while (d < 900 && !onLand(H.C.x + Math.sin(a) * d, H.C.y - Math.cos(a) * d) || d < 150) { d += 30; if (d > 900) break; }
                let clear = 0; for (let q = 200; q <= 700; q += 50) if (!onLand(H.C.x + Math.sin(a) * q, H.C.y - Math.cos(a) * q)) clear++; if (clear > best) { best = clear; ba = a; } }
            const p = snapOpen(H.C.x + Math.sin(ba) * (c.raftAt || 520), H.C.y - Math.cos(ba) * (c.raftAt || 520), 110); H.sea = p; H.depT = R(5, 30);
        }
        return hauls;
    }
    // A group in the water: members in a loose school round a leader, travelling or rafting.
    function makeSLGroup(H, n, x, y, mode) {
        // a tight pack all facing one way (drone refs): a jittered grid, ~a body width across, ~half a length along
        const cols = Math.max(1, Math.round(Math.sqrt(n * 0.8)));
        const members = Array.from({ length: n }, (_, j) => ({ j, x: x + R(-30, 30), y: y + R(-30, 30), h: R(0, 7), ox: ((j % cols) - (cols - 1) / 2) * 17 + R(-4, 4), oy: -Math.floor(j / cols) * 27 + R(-5, 5) + (j % 2) * 8, leap: 0, leapT: R(0.5, 4), z: 0, splash: 0, sx: 0, sy: 0, splash2: 0, flip: rnd() < 0.6 ? (rnd() < 0.5 ? -1 : 1) : 0,
            bull: rnd() < 0.15, size: R(0.85, 1.05), trail: [], trailT: 0, flung: 0, fz: 0, fx: 0, fy: 0, gone: false, bob: R(0, 7) }));
        return { H, x, y, h: 0, mode, t: R(30, 60), tx: x, ty: y, members, speed: SL_SWIM };
    }
    function slBlocked(x, y, h) {
        const fx = Math.sin(h), fy = -Math.cos(h);
        return solidAt(x, y, null, true) || solidAt(x + fx * 22, y + fy * 22, null, true) || solidAt(x - fx * 16, y - fy * 16, null, true)
            || solidAt(x - fy * 12, y + fx * 12, null, true) || solidAt(x + fy * 12, y - fx * 12, null, true);
    }
    function updateSeaLions(dt) {
        const c = cfg.seaLions;
        for (const H of slHauls) {
            H.alert = Math.max(0, H.alert - dt); H.flushCool = (H.flushCool || 0) - dt;
            const b = boatNear(H.C.x, H.C.y, 900);
            let flushed = [];
            for (const m of H.members) {
                m.t -= dt; m.bob += dt; m.bark = Math.max(0, m.bark - dt); m.wet = Math.max(m.lowWet || 0, m.wet - dt / 60);
                if (m.mode === 'lie' || m.mode === 'upright') {
                    const bd = b ? Math.hypot(b.x - m.x, b.y - m.y) : 1e9;
                    // heads up and watching when a boat comes past; barking at it
                    const want = bd < c.lookR || H.alert > 0 ? 1 : m.mode === 'upright' ? 1 : 0;
                    m.up += (want - m.up) * Math.min(1, dt * 2.5);
                    if (want && b) m.look = Math.atan2(b.x - m.x, -(b.y - m.y));
                    if (m.t <= 0) { const r = rnd(); m.mode = r < 0.25 ? 'upright' : 'lie'; m.t = R(3, 12); if (r < 0.35) m.bark = R(1.5, 3.5); if (r > 0.9) m.h += R(-0.8, 0.8); }
                    if (bd < c.reactR && !(H.flushCool > 0)) flushed.push(m);
                } else if (m.mode === 'shuffle') {
                    // galumphing to the water's edge: the heaving gait, a body length a second
                    const d = Math.hypot(m.ex - m.x, m.ey - m.y), a = Math.atan2(m.ex - m.x, -(m.ey - m.y));
                    m.h += angDiff(a, m.h) * Math.min(1, dt * 6);
                    const v = Math.min(d, (45 + 25 * Math.max(0, Math.sin(m.bob * 9))) * dt); if (d > 1) { m.x += (m.ex - m.x) / d * v; m.y += (m.ey - m.y) / d * v; }
                    m.gait = m.bob * 9;
                    // in the water the moment it leaves the rock (or the sand): the splash is right there
                    if (d < 3 || (!pointInPoly(m.x, m.y, H.V) && !onLand(m.x, m.y))) { m.mode = 'gone'; m.splash = 1; m.spx = m.x; m.spy = m.y; }
                } else if (m.mode === 'climb') {
                    // hauling out: up out of the wash onto its spot, streaming water
                    // swim in to the edge (under the water, drawn with its group's look), then haul up onto its spot
                    m.t = Math.max(0, m.t); const tw = (m.ct || 2.2) - 2.2, el = (m.ct || 2.2) - m.t;
                    if (el < tw) { const k3 = el / Math.max(tw, 1e-3); m.x = m.cx0 + (m.ex - m.cx0) * k3; m.y = m.cy0 + (m.ey - m.cy0) * k3; m.h = Math.atan2(m.ex - m.cx0, -(m.ey - m.cy0)); m.inWater = true; }
                    else { m.inWater = false; const k2 = (el - tw) / 2.2;
                        if (!m.outSplash) { m.outSplash = true; m.splash = 0.8; m.spx = m.ex; m.spy = m.ey; }
                        m.x = m.ex + (m.sx - m.ex) * k2; m.y = m.ey + (m.sy - m.ey) * k2; m.h = m.out + Math.PI; m.gait = m.bob * 9; }
                    if (m.t <= 0) { m.mode = 'lie'; m.t = R(6, 16); m.wet = 1; m.h = m.out + Math.PI + R(-1.2, 1.2); m.outSplash = false; }
                }
                if (m.splash > 0) m.splash = Math.max(0, m.splash - dt / 1.4);
            }
            // COMMUTING: every so often two to four of the ones by the water slip in and head out to sea
            // together; they raft out there and come back to the same spots (no more than two groups out)
            H.depT -= dt;
            if (H.depT <= 0 && !flushed.length) {
                H.depT = R(25, 55);
                const out = slGroups.filter(G => G.H === H && G.from).length;
                const free = H.members.filter(m => (m.mode === 'lie' || m.mode === 'upright') && (Math.hypot(m.ex - m.x, m.ey - m.y) < 200 || H.beach));
                if (out < 2 && free.length >= 2) {
                    const n = Math.min(free.length, 2 + Math.floor(rnd() * 3)), start = Math.floor(rnd() * free.length), goers = [];
                    for (let k = 0; k < n; k++) goers.push(free[(start + k) % free.length]);
                    for (const m of goers) { m.mode = 'shuffle'; m.home = false; }
                    const G = makeSLGroup(H, 0, goers[0].ex, goers[0].ey, 'travel'); G.from = goers; G.members = []; G.pending = goers.slice(); G.t = R(25, 50); slGroups.push(G);
                }
            }
            if (flushed.length && b) {
                // the ones nearest the water go in together, in a rush; the rest sit up and bark
                H.alert = 12; H.flushCool = 25;
                for (const m of H.members) if (m.mode === 'lie' || m.mode === 'upright') { m.bark = R(1, 3); m.up = Math.max(m.up, 0.5); }
                const goers = flushed.filter(m => Math.hypot(m.ex - m.x, m.ey - m.y) < 240 || H.beach).slice(0, 7);
                if (goers.length) {
                    for (const m of goers) { m.mode = 'shuffle'; m.home = false; }
                    // a new group, forming in the water off the rock and heading out to sea, away from the boat
                    const G = makeSLGroup(H, 0, goers[0].ex, goers[0].ey, 'flee'); G.from = goers; G.members = [];
                    G.pending = goers.slice(); G.t = R(40, 70); slGroups.push(G);
                }
            }
        }
        for (const G of slGroups) {
            G.t -= dt;
            // hauled-out animals that have hit the water join their group, porpoising off
            if (G.pending) for (const m of G.pending.slice()) if (m.mode === 'gone') {
                G.pending.splice(G.pending.indexOf(m), 1);
                G.members.push({ j: G.members.length, x: m.x, y: m.y, h: m.h, ox: R(-40, 40), oy: R(-40, 20), leap: 0, leapT: R(0.2, 1.5), z: 0, splash: 1, sx: m.x, sy: m.y, splash2: 0, flip: 0,
                    bull: m.bull, size: m.size, trail: [], trailT: 0, flung: 0, fz: 0, fx: 0, fy: 0, gone: false, bob: m.bob, src: m });
            }
            if (!G.members.length) continue;
            // RIDING THE SHARK'S TAIL (two of Wes's videos): sea lions that find a patrolling white shark
            // near them go to it and keep just behind its tail — the one place it can't strike — for a while
            if (G.mode === 'inspect') {
                const S = G.shark; if (!S || (S.mode !== 'patrol' && S.mode !== 'fin') || G.t <= 0) { G.mode = 'travel'; G.shark = null; G.t = R(30, 50); }
                else { G.tx = S.x - Math.sin(S.h) * 70; G.ty = S.y + Math.cos(S.h) * 70; }
            } else if ((G.mode === 'raft' || G.mode === 'travel' || G.mode === 'loiter') && !G.pending?.length) {
                G.inspT = (G.inspT || R(1, 3)) - dt;
                if (G.inspT <= 0) { G.inspT = 2;
                    const S = whites.find(W2 => (W2.mode === 'patrol' || W2.mode === 'fin') && Math.hypot(W2.x - G.x, W2.y - G.y) < 360);
                    if (S && rnd() < 0.07) { G.mode = 'inspect'; G.shark = S; G.t = R(10, 18); } } }
            // a boat sailing into a raft: they go, porpoising off to one side, and settle again beyond
            if ((G.mode === 'raft' || G.mode === 'loiter' || G.mode === 'travel')) { const th = boatThreat(G.x, G.y, 3, 150), b = th ? th.b : boatNear(G.x, G.y, 130);
                // a shark's fin close by puts them to flight too
                const sk = whites.find(W => W.depth < 0.3 && W.mode !== 'shadow' && Math.hypot(W.x - G.x, W.y - G.y) < 230);
                if (sk && !b) { const a = Math.atan2(G.x - sk.x, -(G.y - sk.y)); G.mode = 'flee'; G.aim = snapOpen(G.x + Math.sin(a) * 450, G.y - Math.cos(a) * 450, 80); G.t = R(30, 50); }
                if (b && G.mode !== 'travel') { const dd = th && dodgeDir(th); if (dd) { G.mode = 'flee'; G.aim = snapOpen(G.x + dd.x * 320, G.y + dd.y * 320, 50); G.t = R(20, 35); } else { const a = Math.atan2(G.x - b.x, -(G.y - b.y)); G.mode = 'flee'; G.aim = snapWater(G.x + Math.sin(a) * 280, G.y - Math.cos(a) * 280, 50); G.t = R(20, 35); } } }
            const L = G.members[0];
            if (G.mode === 'flee' || G.mode === 'travel') {
                // porpoising to the raft spot
                if (G.mode === 'flee' && !G.aim) G.aim = snapWater(G.H.sea.x + R(-120, 120), G.H.sea.y + R(-120, 120), 50);
                // escaping a strike: JINKING — the line snaps left and right every second or so
                if (G.mode === 'flee' && G.jink) { G.jinkT = (G.jinkT || 0) - dt; if (G.jinkT <= 0) { G.jinkT = R(0.6, 1.2); const d = Math.hypot(G.aim.x - G.x, G.aim.y - G.y) || 1, sgn = (G.js = -(G.js || 1)); G.aim = snapWater(G.x + (G.aim.x - G.x) / d * 300 + (-(G.aim.y - G.y) / d) * sgn * 160, G.y + (G.aim.y - G.y) / d * 300 + ((G.aim.x - G.x) / d) * sgn * 160, 60); } }
                const tgt = G.mode === 'flee' ? G.aim : G.H.sea;
                G.tx = tgt.x; G.ty = tgt.y;
                // (overdue — the way is awkward — it rafts where it is)
                if (G.t < 25) G.jink = false;
                if (Math.hypot(G.tx - G.x, G.ty - G.y) < 60 || G.t < -20) { G.mode = 'raft'; G.t = R(25, 55); }
            } else if (G.mode === 'raft') {
                // RAFTING: lying at the surface in a loose cluster, flippers held up in the air
                G.tx = G.H.sea.x; G.ty = G.H.sea.y;
                if (G.t <= 0) { G.mode = 'return'; }
            } else if (G.mode === 'return') {
                // back in to the rock: to the water's edge off a free spot, then up out of the water
                const spot = G.H.members.find(m => !m.home && m.mode === 'gone') || null;
                if (G.from && G.from.length) { const f = G.from[0], q = G.inAt || (G.inAt = snapOpen(f.ex + Math.sin(f.out) * 60, f.ey - Math.cos(f.out) * 60, 25)); G.tx = q.x; G.ty = q.y; }
                else { const E = G.H.edge || (G.H.edge = (() => { const sa = Math.atan2(G.H.sea.x - G.H.C.x, -(G.H.sea.y - G.H.C.y)); let b = G.H.members[0]; for (const m of G.H.members) if (Math.abs(angDiff(m.out, sa)) < Math.abs(angDiff(b.out, sa))) b = m;
                        return snapOpen(b.ex + Math.sin(b.out) * 90, b.ey - Math.cos(b.out) * 90, 30); })()); G.tx = E.x; G.ty = E.y; }
                if (Math.hypot(G.tx - G.x, G.ty - G.y) < 60 || G.t < -30) {
                    if (G.from && G.from.length) {
                        for (const q of G.members) { const m = q.src; if (m && !q.gone) { m.mode = 'climb'; m.home = true; m.cx0 = q.x; m.cy0 = q.y; m.cw = Math.hypot(m.ex - q.x, m.ey - q.y); m.t = m.ct = 2.2 + m.cw / 45; } }
                        G.done = true;
                    } else { G.mode = 'loiter'; G.t = R(15, 30); }   // a commuting group idles off the rock, then heads back out
                }
                void spot;
            } else if (G.mode === 'loiter') {
                G.tx = G.x; G.ty = G.y;
                if (G.t <= 0) G.mode = 'travel';
            }
            // the leader steers round the rocks; the rest keep station about it
            const spd = G.mode === 'raft' || G.mode === 'loiter' ? 6 : G.mode === 'flee' ? SL_SWIM * 1.5 : G.mode === 'inspect' ? Math.min(90, 20 + Math.hypot(G.tx - G.x, G.ty - G.y) * 0.8) : SL_SWIM;
            if (Math.hypot(G.tx - G.x, G.ty - G.y) > 8) steerTo(G, G.tx, G.ty, spd, 2.2, dt, 20, 16, G.mode === 'flee');
            const fx = Math.sin(G.h), fy = -Math.cos(G.h), moving = G.mode !== 'raft' && G.mode !== 'loiter';
            for (const q of G.members) {
                q.bob += dt; q.splash = Math.max(0, q.splash - dt / 1.2); q.splash2 = Math.max(0, q.splash2 - dt / 1.2);
                if (q.gone) continue;
                if (q.flung > 0) {
                    // thrown by a shark: tumbling through the air, then down with a splash
                    q.flung -= dt; q.fz = Math.max(0, Math.sin(Math.PI * Math.min(1, 1 - q.flung / 1.1)));
                    q.x += q.fx * dt; q.y += q.fy * dt; q.h += 7 * dt;
                    if (q.flung <= 0) { q.fz = 0; q.splash = 1; q.sx = q.x; q.sy = q.y; }
                    continue;
                }
                const ox = G.mode === 'raft' ? q.ox * 0.8 : q.ox, oy = G.mode === 'raft' ? q.oy * 0.8 : q.oy;
                const tx = G.x + -fy * ox + fx * oy, ty = G.y + fx * ox + fy * oy;
                const d = Math.hypot(tx - q.x, ty - q.y), a = Math.atan2(tx - q.x, -(ty - q.y));
                const v = Math.min(d * 1.5, spd * 1.3);
                if (d > 1.5) {
                    // never under a rock: the body (nose, middle, flanks) must stay in open water — if the
                    // way is blocked it swings off either side, and failing that it waits for the group
                    const nh0 = q.h + angDiff(moving ? a : G.h + q.ox * 0.02, q.h) * Math.min(1, dt * 3);
                    for (const dh of [0, 0.5, -0.5, 1.1, -1.1]) { const nh = nh0 + dh, nx = q.x + Math.sin(nh) * v * dt, ny = q.y - Math.cos(nh) * v * dt;
                        if (!slBlocked(nx, ny, nh)) { q.x = nx; q.y = ny; q.h = nh; break; } } }
                else if (!moving) q.h += angDiff(G.h + q.ox * 0.02, q.h) * Math.min(1, dt * 0.5);
                // OUT OF THE WAY: one in a boat's path (its track over 1.6 s within 45 u) leaps clear sideways,
                // square to the boat's line, and drops back into its place in the group after
                if (!(q.dodgeT > 0) && q.leap === 0) { const th = boatThreat(q.x, q.y, 1.6, 45), dd = th && dodgeDir(th);
                    if (dd) { q.dodgeT = 0.9; q.dvx = dd.x * 110; q.dvy = dd.y * 110; q.leap = 0.001; q.splash = 1; q.sx = q.x; q.sy = q.y; q.h = Math.atan2(dd.x, -dd.y); } }
                if (q.dodgeT > 0) { q.dodgeT -= dt; const nx = q.x + q.dvx * dt, ny = q.y + q.dvy * dt; if (!slBlocked(nx, ny, q.h)) { q.x = nx; q.y = ny; } }
                // PORPOISING: travelling, each one leaps clear every few seconds — an arc out and back
                if (moving) {
                    q.leapT -= dt;
                    if (q.leap > 0) { q.leap += dt / 0.7; if (q.leap >= 1) { q.leap = 0; q.splash2 = 1; q.sx = q.x; q.sy = q.y; } }
                    else if (q.leapT <= 0) { q.leap = 0.001; q.leapT = R(G.mode === 'flee' ? 1.2 : 2.2, G.mode === 'flee' ? 2.6 : 5); q.splash = 1; q.sx = q.x; q.sy = q.y; }
                } else q.leap = 0;
                q.z = q.leap > 0 ? Math.sin(Math.PI * q.leap) : 0;
                recordTrail(q, dt, moving && q.leap === 0);
            }
        }
        slGroups = slGroups.filter(G => !G.done);
    }
    // SEA LION from above (references, Sep 26 2026 — drone shots of haul-outs on stacks and
    // beaches, porpoising groups, rafting): a long tapering body with a small head on a thick neck,
    // the long fore flippers out from the chest, the hind flippers fanned at the tail; dry the cows
    // are golden-brown and the bulls dark with a pale crest; wet they all go dark and glossy.
    function seaLionPath(ctx, bend) {
        // native: nose at y=-21, tail/hips at y=+10 (the hind flippers beyond)
        const S = [[-21, 0.5], [-20, 1.3], [-18.5, 1.9], [-16, 2.2], [-13.5, 3], [-10, 4.4], [-6, 5.1], [-2, 5.1], [2, 4.5], [6, 3.4], [9.5, 2.3], [11.5, 1.6]];   // slim: a quarter as wide as long (drone refs)
        const off = (y) => bend * Math.pow(Math.max(0, (y + 5) / 15), 2) * 5 - bend * Math.pow(Math.max(0, (-y - 5) / 16), 2) * 4;
        ctx.beginPath();
        S.forEach(([y, w], i) => { const x = off(y) + w; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        for (let i = S.length - 1; i >= 0; i--) { const [y, w] = S[i]; ctx.lineTo(off(y) - w, y); }
        ctx.closePath();
        return off;
    }
    function drawSeaLion(ctx, m, opt) {
        // opt: { swim, under, leap, raft, flip, wet }
        const o = opt || {}, k = SEA_LION_LEN / 40 * m.size;
        const up = m.up || 0, bark = m.bark > 0 ? Math.max(0, Math.sin(m.bob * 11)) : 0;
        const wet = o.swim ? 1 : m.wet || 0;
        const col = o.swim ? SEA_LION.swim : m.bull ? SEA_LION.bull : SEA_LION.cow;
        const bend = o.swim ? Math.sin(m.bob * 5) * 0.25 : (m.curl || 0);
        const gait = m.gait != null && (m.mode === 'shuffle' || m.mode === 'climb') ? Math.sin(m.gait) : null;
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h); ctx.scale(k, k);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (o.leap) { const z = o.leap; ctx.save(); ctx.translate(z * 9, z * 14); ctx.fillStyle = 'rgba(10,25,40,0.22)'; seaLionPath(ctx, 0); ctx.fill(); ctx.restore(); ctx.scale(1 + z * 0.14, 1 + z * 0.14); }
        else if (!o.swim) { ctx.fillStyle = 'rgba(20,16,10,0.3)'; ctx.save(); ctx.translate(1.4, 2); seaLionPath(ctx, bend); ctx.fill(); ctx.restore(); }
        const off = (y) => bend * Math.pow(Math.max(0, (y + 5) / 15), 2) * 5 - bend * Math.pow(Math.max(0, (-y - 5) / 16), 2) * 4;
        // the hind flippers: ashore they fan out behind; swimming they trail together
        ctx.fillStyle = SEA_LION.flipper;
        for (const sd of [-1, 1]) {
            ctx.save(); ctx.translate(off(11) + sd * 1.3, 10.8); ctx.rotate(sd * (o.swim ? 0.12 : 0.55 + (gait != null ? 0.25 * gait * sd : 0)));
            ctx.beginPath(); ctx.moveTo(-1.2, 0); ctx.lineTo(-2.8, 8.2); ctx.lineTo(-1, 7.6); ctx.lineTo(0.3, 8.8); ctx.lineTo(2.6, 7.8); ctx.lineTo(1.4, 0); ctx.closePath(); ctx.fill(); ctx.restore();
        }
        // the fore flippers: long, from the chest; ashore planted out to the sides, swimming swept back like wings
        const stroke = o.swim ? Math.sin(m.bob * 3.2 * WING_TIME * 2) : 0;
        for (const sd of [-1, 1]) {
            const raised = o.raft && m.flip === sd;
            ctx.save(); ctx.translate(off(-8) + sd * 4.4, -8.5);
            // (canvas: +x is the animal's right; turning by -sd*a sweeps each flipper back from abeam)
            ctx.scale(sd, 1); ctx.rotate(o.swim ? 0.5 - 0.4 * stroke : gait != null ? 0.15 + 0.45 * gait * sd : 0.55);   // (refs: swimming, the fore flippers held well out like wings, sweeping back on the stroke)
            if (raised) ctx.scale(1.2, 1.2);
            ctx.beginPath(); ctx.moveTo(0, -1.9); ctx.quadraticCurveTo(8, -2.4, 14.5, 0.6); ctx.quadraticCurveTo(14.4, 1.7, 12.6, 1.9); ctx.quadraticCurveTo(7, 2.6, 0, 2.1); ctx.closePath();   // long blades, a quarter of the body
            ctx.fillStyle = raised ? '#2a1f18' : SEA_LION.flipper; ctx.fill(); ctx.restore();
        }
        // the body
        ctx.fillStyle = col; seaLionPath(ctx, bend); ctx.fill();
        if (!o.swim) {
            // a darker back and the paler flanks where the sun catches them
            ctx.save(); seaLionPath(ctx, bend); ctx.clip();
            ctx.fillStyle = m.bull ? 'rgba(30,20,14,0.35)' : 'rgba(110,80,50,0.35)'; ctx.beginPath(); ctx.ellipse(off(-3), -3, 2, 11, 0, 0, Math.PI * 2); ctx.fill();
            if (wet > 0) { ctx.fillStyle = `rgba(40,30,24,${0.55 * wet})`; seaLionPath(ctx, bend); ctx.fill(); ctx.fillStyle = `rgba(235,240,240,${0.35 * wet})`; ctx.beginPath(); ctx.ellipse(off(-4) - 1.6, -4, 0.7, 7, 0.05, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore();
        } else {
            ctx.fillStyle = 'rgba(225,238,240,0.35)'; ctx.beginPath(); ctx.ellipse(off(-5) - 1.2, -5, 0.6, 6, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = SOFT; ctx.lineWidth = 0.35; seaLionPath(ctx, bend); ctx.stroke();
        // the head: small, a pointed muzzle; heads-up it rises toward us (bigger, its shadow longer)
        ctx.save(); ctx.translate(off(-17), -17);
        if (up > 0.05) { ctx.rotate(angDiff((m.look != null ? m.look : m.h), m.h) * up * 0.6); ctx.fillStyle = `rgba(20,16,10,${0.25 * up})`; ctx.beginPath(); ctx.ellipse(2.6 * up, 3.5 * up, 2.8, 4, 0, 0, Math.PI * 2); ctx.fill(); }
        const hs = 1 + up * 0.28;
        ctx.scale(hs, hs); ctx.translate(0, -up * 1.2);
        ctx.fillStyle = m.bull && !o.swim ? SEA_LION.bull : o.swim ? '#8a7866' : col;
        ctx.beginPath(); ctx.moveTo(0, -5.4); ctx.quadraticCurveTo(1.2, -5.1, 1.8, -2.8); ctx.quadraticCurveTo(2.6, 0.2, 2.2, 2.4); ctx.quadraticCurveTo(0, 3.4, -2.2, 2.4); ctx.quadraticCurveTo(-2.6, 0.2, -1.8, -2.8); ctx.quadraticCurveTo(-1.2, -5.1, 0, -5.4); ctx.fill();   // a narrow, dog-like head
        ctx.strokeStyle = SOFT; ctx.lineWidth = 0.3; ctx.stroke();
        if (m.bull && !o.swim) { ctx.fillStyle = SEA_LION.bullCrest; ctx.beginPath(); ctx.ellipse(0, 0.2, 1.3, 1.8, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#1b1411'; ctx.beginPath(); ctx.ellipse(0, -5, 0.7, 0.45, 0, 0, Math.PI * 2); ctx.fill();
        if (bark > 0.2 && !o.swim) { ctx.fillStyle = '#7a3a38'; ctx.beginPath(); ctx.ellipse(0, -4.3, 0.9, 0.5 + bark * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
        for (const sd of [-1, 1]) { ctx.fillStyle = '#1b1411'; ctx.beginPath(); ctx.arc(sd * 1.25, -2.2, 0.4, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = m.bull && !o.swim ? '#3a2a1f' : 'rgba(60,44,32,0.9)'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 2.1, 0.2, 0.3, 0.75, sd * 0.3, 0, Math.PI * 2); ctx.fill(); }   // the little ear flaps
        ctx.restore();
        ctx.restore();
    }
    function drawSLGroupWater(ctx, G) {
        const tint = waterTint();
        for (const q of G.members) {
            if (q.splash > 0) drawFishSplash(ctx, q.sx, q.sy, q.splash, 1.6, q.sx);
            if (q.splash2 > 0) drawFishSplash(ctx, q.sx, q.sy, q.splash2, 1.4, q.sy);
            if (q.gone || q.flung > 0 || q.z > 0.15) continue;
            if (!onCam(q.x, q.y, 100)) continue;
            if (G.mode === 'raft' || G.mode === 'loiter') {
                // lying at the surface, awash, a flipper or two raised into the air
                drawSeaLion(ctx, q, { swim: true, raft: true });
                ctx.save(); ctx.globalAlpha *= 0.35; ctx.translate(q.x, q.y); ctx.rotate(q.h); const k = SEA_LION_LEN / 40 * q.size; ctx.scale(k, k); ctx.fillStyle = `rgb(${tint})`; ctx.beginPath(); ctx.rect(-9, -12, 18, 26); ctx.fill(); ctx.restore();
                // (no ring round each one: a ring reads as UI) — a faint lap of water at the shoulders instead
                { const k0 = SEA_LION_LEN / 40 * q.size; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.h); ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.12 * Math.sin(q.bob * 0.8 + q.j)})`; ctx.lineWidth = 0.9; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(0, -6 * k0, 8.5 * k0, sd > 0 ? -0.9 : Math.PI + 0.3, sd > 0 ? -0.3 : Math.PI + 0.9); ctx.stroke(); } ctx.restore(); }
                // the raised flipper stands clear: crisp, with its shadow on the water
                if (q.flip) { const k = SEA_LION_LEN / 40 * q.size; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.h); ctx.scale(k, k); ctx.translate(q.flip * 5.2, -8.5); ctx.scale(q.flip, 1); ctx.rotate(-0.3);
                    ctx.fillStyle = 'rgba(10,25,40,0.25)'; ctx.save(); ctx.translate(2, 3); ctx.beginPath(); ctx.moveTo(0, -1.3); ctx.quadraticCurveTo(6, -1.8, 11, 0.2); ctx.quadraticCurveTo(6, 1.8, 0, 1.4); ctx.fill(); ctx.restore();
                    ctx.fillStyle = '#261c16'; ctx.beginPath(); ctx.moveTo(0, -1.3); ctx.quadraticCurveTo(6, -1.8, 11, 0.2); ctx.quadraticCurveTo(6, 1.8, 0, 1.4); ctx.fill(); ctx.restore(); }
            } else {
                // swimming just under: a dim glossy torpedo, flippers sweeping, a wake
                // (refs, the Galapagos hunt: at speed each one tows a long white streak at the surface)
                if (G.mode === 'flee' || G.mode === 'inspect') { const tr = q.trail; if (tr.length > 2) { ctx.save(); ctx.lineCap = 'round';
                    for (let i = 1; i < tr.length; i++) { const k = 1 - i / tr.length; ctx.strokeStyle = `rgba(255,255,255,${0.55 * k})`; ctx.lineWidth = 5 * k + 1; ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke(); }
                    ctx.restore(); } }
                drawWakeTrail(ctx, q, 4.5, 1.3, 0.45);
                ctx.save(); ctx.globalAlpha *= 0.8; drawSeaLion(ctx, q, { swim: true }); ctx.restore();
                ctx.save(); ctx.globalAlpha *= 0.3; ctx.translate(q.x, q.y); ctx.rotate(q.h); const k = SEA_LION_LEN / 40 * q.size; ctx.scale(k, k); ctx.fillStyle = `rgb(${tint})`; seaLionPath(ctx, 0); ctx.fill(); ctx.restore();
            }
        }
    }
    function drawSLGroupAir(ctx, G) {
        for (const q of G.members) {
            if (q.gone) continue;
            if (q.flung > 0) { drawSeaLion(ctx, q, { swim: true, leap: 0.4 + q.fz * 1.4 }); continue; }
            if (q.z > 0.15 && onCam(q.x, q.y, 100)) drawSeaLion(ctx, q, { swim: true, leap: q.z });
        }
    }

    // ── GREAT WHITE SHARKS ───────────────────────────────────────────────────────────────
    // A patrol point in open water: clear of the land AND the rock colliders (snapWater only knows
    // the authored shapes), with room round it.
    function snapOpen(x, y, m) {
        const ok = (px, py) => !solidAt(px, py, null, true) && [0, 1, 2, 3, 4, 5, 6, 7].every(i => !solidAt(px + Math.cos(i * 0.785) * m, py + Math.sin(i * 0.785) * m, null, true));
        if (ok(x, y)) return { x, y };
        for (let r = 40; r < 1200; r += 40) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (ok(px, py)) return { x: px, y: py }; }
        return { x, y };
    }
    // swimTo's look-ahead, done every 0.3 s instead of every frame (it tests a few hundred points
    // against the coast; four sharks at 30 fps made it a third of the frame); between, the shark
    // holds the heading it chose, checking only the water just ahead of its nose.
    function steerTo(o, tx, ty, v, turn, dt, halfLen, halfW, fresh) {
        o.steerT = (o.steerT || 0) - dt;
        const nose = (h, r) => solidAt(o.x + Math.sin(h) * r, o.y - Math.cos(h) * r, null, true);
        if (bodyHit(o.x, o.y, o.h, halfLen * 0.5, null, true)) { o.steerT = 0; swimTo(o, tx, ty, v, turn, dt, halfLen, halfW, null, true); return; }
        if (fresh || o.steerT <= 0 || o.go == null) {
            o.steerT = 0.3;
            const want = Math.atan2(tx - o.x, -(ty - o.y)); o.go = o.h + Math.PI;
            for (const da of SWIM_TRIES) { const a = want + da, sa = Math.sin(a), ca = Math.cos(a); let clear = true;
                for (const r of [halfLen + 25, halfLen + 60, halfLen + 110]) { for (const w of [-halfW - 12, 0, halfW + 12]) if (solidAt(o.x + sa * r + ca * w, o.y - ca * r + sa * w, null, true)) { clear = false; break; } if (!clear) break; }
                if (clear) { o.go = a; break; } }
        }
        const h1 = o.h + Math.max(-turn * dt, Math.min(turn * dt, angDiff(o.go, o.h)));
        // the nose, and a little either side of it, must stay clear of the rock (and its painted overhang)
        const side = (h, r, w) => solidAt(o.x + Math.sin(h) * r + Math.cos(h) * w, o.y - Math.cos(h) * r + Math.sin(h) * w, null, true);
        const ahead = halfLen + v * dt + 14;
        if (!nose(h1, ahead) && !side(h1, ahead - 6, halfW * 0.7) && !side(h1, ahead - 6, -halfW * 0.7) && !nose(h1, halfLen * 0.4)) { o.h = h1; o.x += Math.sin(h1) * v * dt; o.y -= Math.cos(h1) * v * dt; }
        else { o.h = h1; o.steerT = 0; }
    }
    function makeWhites(list) {
        return list.map((P, i) => {
            const pts = P.path.map(([x, y]) => snapOpen(x, y, 70));
            return { i, pts, wi: 1, dir: 1, pingpong: !!P.pingpong, x: pts[0].x, y: pts[0].y, h: 0, depth: 0.55, want: 0.55, mode: 'patrol', t: R(8, 25), ph: R(0, 7), cool: R(0, 6), trail: [], trailT: 0, scanT: R(0, 0.5),
                     z: 0, roll: 0, jaw: 0, target: null, splash: 0, sx: 0, sy: 0, slick: 0, lx: 0, ly: 0, spd: WHITE_CRUISE, caught: false, bd: 0 };
        });
    }
    // Open water all round (x, y) out to r — no rock, no land (a hunt never ends on a rock).
    function openAround(x, y, r) { if (solidAt(x, y, null, true)) return false; for (let i = 0; i < 8; i++) { const a = i * 0.785; if (solidAt(x + Math.cos(a) * r, y + Math.sin(a) * r, null, true)) return false; } return true; }
    // The strike: out of the water at the sea lion (bz 1: a full breach; less: a surface lunge at the
    // end of a chase), which is thrown clear or — p of the time — taken.
    function startBreach(W, q, bt, bz, p) {
        W.mode = 'breach'; W.t = bt; W.bt = bt; W.bz = bz; W.z = 0; W.caught = rnd() < p; if (!W.caught) W.sawSprint = false; W.sx = q.x; W.sy = q.y; W.splash = 1; W.bx = q.x; W.by = q.y;
        if (!W.caught) { const a = W.h + (rnd() < 0.5 ? -1 : 1) * R(0.6, 1.4); q.flung = 1.1; q.fx = Math.sin(a) * 50; q.fy = -Math.cos(a) * 50; }
        else { q.gone = true; W.killX = q.x; W.killY = q.y; W.killT = 45; }
        splashes.push({ x: q.x, y: q.y, t: 0, life: 9, r: 42 });   // (refs: the strike's swirl of foam opens into a lacy ring that lingers)
        const G = W.target.G, a = Math.atan2(G.x - W.x, -(G.y - W.y)); G.mode = 'flee'; G.aim = snapOpen(G.x + Math.sin(a) * 500, G.y - Math.cos(a) * 500, 80); G.t = R(40, 70);
    }
    // THE STRIKE (Wes's drone references — the Mossel Bay kill, the Bryce Milford short, NatGeo): from
    // overhead a white shark's kill is not a breach. It sprints in from behind and below, and the water
    // ERUPTS — a burst of white foam 1.5-2 shark lengths across that spins into a swirl; the shark rolls,
    // pale belly flashing; for a few seconds it thrashes, shaking its head, inside the churn; the foam
    // opens into a lacy ring that drifts and lingers; and a red-brown cloud blooms where it happened. About
    // half the time the sea lion gets away, porpoising off hard and jinking. One strike in eight (never
    // at the end of a surface chase) goes up as a full breach instead.
    function strike(W, q, p, fromChase) {
        if (!fromChase && rnd() < 1 / 8) { startBreach(W, q, 1.9, 1, p); return; }
        W.caught = rnd() < p; if (!W.caught) W.sawSprint = false; W.mode = 'strike'; W.t = 0.55; W.roll = 1; W.depth = 0; W.sx = q.x; W.sy = q.y;
        foams.push({ x: q.x, y: q.y, t: 0, life: R(16, 22), R: R(52, 64), seed: R(0, 7), churn: W.caught ? 4 : 1.2, blood: W.caught, spin: rnd() < 0.5 ? -1 : 1 });
        const G = W.target.G, a = Math.atan2(G.x - W.x, -(G.y - W.y));
        if (W.caught) { q.gone = true; W.killX = q.x; W.killY = q.y; W.killT = 45; }
        else { q.flung = 0.7; q.fx = Math.sin(a + R(-0.8, 0.8)) * 70; q.fy = -Math.cos(a + R(-0.8, 0.8)) * 70; }
        G.mode = 'flee'; G.jink = true; G.aim = snapOpen(G.x + Math.sin(a) * 500, G.y - Math.cos(a) * 500, 80); G.t = R(40, 70);
    }
    // The strike's white water, drawn over the shark: a BURST (0.5 s) of foam swelling to R; the CHURN
    // (while it thrashes) — a lobed white sheet with thick spiral streaks turning in it, pink inside once
    // blood is in it; then the RING — the foam opening out into a lacy ring that drifts wider and fades.
    // Connected sheets and strokes, never dots.
    function drawFoam(ctx, F) {
        if (!onCam(F.x, F.y, 150)) return;
        const t = F.t, R0 = F.R, sd = F.seed, burst = Math.min(1, t / 0.5), churnEnd = F.churn + 0.5;
        const fade = t < churnEnd ? 1 : Math.max(0, 1 - (t - churnEnd) / (F.life - churnEnd));
        const lobe = (r, j, rot) => { ctx.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2 + rot, n = 0.86 + 0.08 * Math.sin(a * 3 + sd + j) + 0.06 * Math.sin(a * 7 + sd * 2 + j); ctx.lineTo(Math.cos(a) * r * n, Math.sin(a) * r * n); } ctx.closePath(); };
        ctx.save(); ctx.translate(F.x, F.y);
        if (t < churnEnd) {
            // the sheet: bright at first, churning
            const r = R0 * (0.35 + 0.65 * burst), rot = F.spin * t * 0.9;
            const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
            g.addColorStop(0, `rgba(255,255,255,${0.95})`); g.addColorStop(0.7, 'rgba(240,250,252,0.8)'); g.addColorStop(1, 'rgba(225,245,248,0.15)');
            ctx.fillStyle = g; lobe(r, 0, rot); ctx.fill();
            if (F.blood && t > 0.7) { const pk = Math.min(1, (t - 0.7) / 1.2), pg = ctx.createRadialGradient(r * 0.1, 0, 0, r * 0.1, 0, r * 0.6);
                pg.addColorStop(0, `rgba(214,110,112,${0.6 * pk})`); pg.addColorStop(1, 'rgba(214,110,112,0)'); ctx.fillStyle = pg; lobe(r * 0.6, 3, -rot); ctx.fill(); }
            // the swirl: thick white spiral streaks turning in it
            // (irregular: broken streaks of different lengths and weights, wobbling — a regular spiral reads as a logo)
            ctx.lineCap = 'round';
            for (let k = 0; k < 6; k++) { const j = Math.abs(Math.sin(k * 7.3 + sd)), a0 = rot * (1.2 + 0.5 * j) + k * 1.1 + sd, len = 0.6 + 1.4 * j, r0 = r * (0.2 + 0.45 * Math.abs(Math.cos(k * 3.1 + sd)));
                const pts = []; for (let i = 0; i <= 10; i++) { const f = i / 10, a = a0 + F.spin * f * len, rr = r0 + r * 0.35 * f + Math.sin(f * 9 + k) * r * 0.05; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
                for (let i = 1; i < pts.length; i++) { const f = i / pts.length; ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - f * 0.6)})`; ctx.lineWidth = (1 + 2.6 * j) * Math.sin(Math.PI * f) + 0.4; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); } }
            // spray thrown out in the first instant
            if (t < 0.6) { const b = 1 - t / 0.6; ctx.fillStyle = `rgba(255,255,255,${0.8 * b})`;
                for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + sd, L = r * (1.05 + 0.35 * Math.abs(Math.sin(i * 3.1 + sd))), w = r * 0.07;
                    ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.1) * r * 0.8, Math.sin(a - 0.1) * r * 0.8); ctx.quadraticCurveTo(Math.cos(a) * L * 0.9 - Math.sin(a) * w, Math.sin(a) * L * 0.9 + Math.cos(a) * w, Math.cos(a) * L, Math.sin(a) * L);
                    ctx.quadraticCurveTo(Math.cos(a) * L * 0.9 + Math.sin(a) * w, Math.sin(a) * L * 0.9 - Math.cos(a) * w, Math.cos(a + 0.1) * r * 0.8, Math.sin(a + 0.1) * r * 0.8); ctx.fill(); } }
        } else {
            // the lacy ring, drifting wider, a faint pale wash inside it
            const k = (t - churnEnd) / (F.life - churnEnd), r = R0 * (1 + 0.9 * Math.sqrt(k)), rot = F.spin * t * 0.15;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `rgba(230,246,248,${0.12 * fade})`); g.addColorStop(1, `rgba(230,246,248,${0.05 * fade})`);
            ctx.fillStyle = g; lobe(r, 0, rot); ctx.fill();
            // the lace: a band of foam strands, each its own weight, gaps where the ring has torn
            ctx.lineCap = 'round';
            for (let b = 0; b < 3; b++) { const rr = r * (0.82 + b * 0.11), n = 40;
                for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rot + b, w = Math.sin(a * 3 + sd + b * 2) + 0.6 * Math.sin(a * 11 + sd * 3);
                    if (w < -0.2) continue;
                    const nn = (q) => rr * (0.9 + 0.06 * Math.sin(q * 3 + sd + b) + 0.05 * Math.sin(q * 7 + sd * 2));
                    ctx.strokeStyle = `rgba(255,255,255,${(0.35 + 0.35 * Math.min(1, w)) * fade * (b === 1 ? 1 : 0.6)})`; ctx.lineWidth = (0.6 + 1.8 * Math.min(1, w + 0.2)) * (1 - 0.5 * k);
                    const a2 = a + Math.PI * 2 / n; ctx.beginPath(); ctx.moveTo(Math.cos(a) * nn(a), Math.sin(a) * nn(a)); ctx.lineTo(Math.cos(a2) * nn(a2), Math.sin(a2) * nn(a2)); ctx.stroke(); } }
        }
        ctx.restore();
    }
    // Is (x, y) inside the player's actual view? The draw maps 1 world unit to 1 canvas pixel about the
    // camera centre, rotated by the camera; a margin m (u) can be asked for inside the edge.
    function onPlayerScreen(x, y, m) {
        const c = state.camera, cv = (typeof canvas !== 'undefined' && canvas) || { width: 1280, height: 720 };
        if (!c) return false;
        const dx = x - c.x, dy = y - c.y, r = -(c.rotation || 0), ca = Math.cos(r), sa = Math.sin(r);
        const sx = dx * ca - dy * sa, sy = dx * sa + dy * ca;
        return Math.abs(sx) < cv.width / 2 - (m || 0) && Math.abs(sy) < cv.height / 2 - (m || 0);
    }
    function updateFoams(dt) { for (const F of foams) F.t += dt; foams = foams.filter(F => F.t < F.life); }
    // Blood in the water: soft red-brown puffs let go from the shark's mouth, spreading and fading, so a
    // moving shark draws a long wavy plume behind it (the drone hunt).
    function bleed(W, dt, rate) {
        W.bleedT = (W.bleedT || 0) - dt; if (W.bleedT > 0) return; W.bleedT = 0.35 / rate;
        blood.push({ x: W.x + Math.sin(W.h) * 22 + R(-18, 18), y: W.y - Math.cos(W.h) * 22 + R(-18, 18), t: 0, life: R(28, 40), r0: R(8, 15), a: R(0, 7), dark: rnd() < 0.4 });
    }
    // The kill's cloud: a burst of big red-brown puffs where it happened, spreading 2-3 shark lengths.
    // (patchy and smoky, not one round blob: many smaller puffs scattered along a lopsided spread)
    function bloom(x, y) { const dir = R(0, 7); for (let i = 0; i < 14; i++) { const a = dir + R(-1.4, 1.4), d = R(0, 70) * (i % 3 ? 1 : 0.4); blood.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, t: 0, life: R(40, 60), r0: R(10, 24), a: R(0, 7), dark: rnd() < 0.5 }); } }
    function updateWhites(dt) {
        for (const B of blood) B.t += dt; blood = blood.filter(B => B.t < B.life);
        updateFoams(dt);
        // AZURE'S "WITNESS THE HUNT" (Wes: the blood on screen IS the hunt): the racing player within
        // sight (900 u) of a kill while its blood is still in the water — 45 s from the strike
        // (Wes, Sep 26: seeing a SUCCESSFUL hunt is seeing any of it ON SCREEN — the sprint before the
        // strike, the strike, or the blood after it, for 45 s)
        const me0 = cfg.hunt && playerCanEarn();
        for (const W of whites) {
            if (W.mode === 'sprint' || W.mode === 'stalk') { if (W.mode === 'stalk') W.sawSprint = false; else if (me0 && onPlayerScreen(W.x, W.y, 20)) W.sawSprint = true; }
            if (W.killT > 0) { W.killT -= dt;
                if (me0 && (W.sawSprint || onPlayerScreen(W.killX, W.killY, 20))) feat(cfg.hunt.feat);
                if (W.killT <= 0) W.sawSprint = false; }
        }
        huntCool -= dt;
        const me = state.boats && state.boats.find(b => b.isPlayer);
        for (const W of whites) {
            W.t -= dt; W.cool -= dt;
            W.splash = Math.max(0, W.splash - dt / 3); W.slick = Math.max(0, W.slick - dt / 20);
            let tx = W.pts[W.wi].x, ty = W.pts[W.wi].y, spd = WHITE_CRUISE;
            if (W.mode === 'patrol' || W.mode === 'fin') {
                if (Math.hypot(tx - W.x, ty - W.y) < 120) {
                    if (!W.pingpong) W.wi = (W.wi + 1) % W.pts.length;
                    else { if (W.wi + W.dir < 0 || W.wi + W.dir >= W.pts.length) W.dir = -W.dir; W.wi += W.dir; } }
                // mostly cruising a few metres down; now and then it comes up and the fin cuts the surface
                if (W.t <= 0) { if (W.mode === 'patrol') { W.mode = 'fin'; W.t = R(8, 14); } else { W.mode = 'patrol'; W.t = R(12, 28); } }
                W.want = W.mode === 'fin' ? 0.03 : 0.5 + 0.12 * Math.sin(T * 0.07 + W.i);
                W.scanT -= dt;
                if (W.scanT <= 0 && W.cool <= 0) {
                    W.scanT = 0.5;
                    // CURIOUS: a boat that comes within five boat lengths of it (Wes) — it comes up and shadows
                    // it, fin up, off the quarter; that comes before any hunt
                    let fb = null, fd = 1e9;
                    for (const bt of state.boats || []) { if ((bt.opacity !== undefined && bt.opacity < 0.2) || (bt.raceState && bt.raceState.finished)) continue;
                        const d = Math.hypot(bt.x - W.x, bt.y - W.y);
                        if (d < 5 * 55 && (bt === me || onCam(bt.x, bt.y, 0)) && (bt === me ? d - 400 : d) < fd) { fd = bt === me ? d - 400 : d; fb = bt; } }
                    if (fb) { W.mode = 'shadow'; W.follow = fb; W.t = R(12, 18); W.side = Math.sign(((W.x - fb.x) * Math.cos(fb.heading) + (W.y - fb.y) * Math.sin(fb.heading))) || 1; }
                    else {
                    // HUNTING: a sea lion swimming in open water near it, where a sailor can see it — an
                    // ambush from below (the breach) or, half the time when it's close, a chase at the surface
                    let best = null, bd = 700;
                    if (huntCool <= 0) for (const G of slGroups) for (const q of G.members) {
                        if (q.gone || q.flung > 0 || q.leap > 0 || G.mode === 'inspect') continue; const d = Math.hypot(q.x - W.x, q.y - W.y);
                        if (d < bd && onCam(q.x, q.y, 0) && openAround(q.x, q.y, 110)) { bd = d; best = { G, q }; } }
                    if (best) { W.target = best; if (bd < 380 && rnd() < 0.5) { W.mode = 'chase'; W.t = R(7, 11); } else { W.mode = 'stalk'; W.t = 7; } huntCool = R(25, 45); }
                    // a SEA OTTER out of the kelp: it comes up behind it, fin out, and the otter bolts for the bed
                    else if (huntCool <= 0 && (best = (() => { let o = null, od = 650; for (const G of seaOtterRafts) for (const m of G.members) if ((m.mode === 'travel' || m.mode === 'swim') && !inKelp(m.x, m.y) && onCam(m.x, m.y, 0)) { const d = Math.hypot(m.x - W.x, m.y - W.y); if (d < od) { od = d; o = m; } } return o; })())) {
                        W.mode = 'chaseOtter'; W.otter = best; W.t = R(8, 12); huntCool = R(20, 40);
                    }
                    }
                }
            } else if (W.mode === 'shadow') {
                // alongside the boat's quarter, keeping up with it — then it loses interest and goes down
                const b = W.follow; const bx = Math.sin(b.heading), by = -Math.cos(b.heading);
                tx = b.x - bx * 30 - by * W.side * 55; ty = b.y - by * 30 + bx * W.side * 55;
                spd = Math.min(280, Math.hypot(tx - W.x, ty - W.y) * 2.2 + 25);
                W.want = 0.04;
                if (W.t <= 0 || Math.hypot(b.x - W.x, b.y - W.y) > 950) { W.mode = 'patrol'; W.t = R(10, 20); W.cool = R(25, 45); W.follow = null; }
            } else if (W.mode === 'chase') {
                // AT THE SURFACE after it: fin up and closing, the sea lions porpoising flat out and jinking
                const q = W.target.q; if (q.gone || q.flung > 0) { W.mode = 'patrol'; W.cool = 20; continue; }
                const lead = Math.min(1, Math.hypot(q.x - W.x, q.y - W.y) / 150) * 0.4;
                tx = q.x + Math.sin(q.h) * SL_SWIM * lead; ty = q.y - Math.cos(q.h) * SL_SWIM * lead; spd = 150; W.want = 0.04;
                const G = W.target.G; if (G.mode !== 'flee') { const a = Math.atan2(G.x - W.x, -(G.y - W.y)); G.mode = 'flee'; G.aim = snapOpen(G.x + Math.sin(a) * 600, G.y - Math.cos(a) * 600, 80); G.t = R(40, 70); G.from = G.from || null; }
                if (Math.hypot(q.x - W.x, q.y - W.y) < 34) { strike(W, q, 0.3, true); }
                else if (W.t <= 0 || !openAround(q.x, q.y, 80)) { W.mode = 'patrol'; W.t = R(10, 20); W.cool = R(20, 35); }   // it gives up — or the sea lions made the rocks
            } else if (W.mode === 'chaseOtter') {
                const m = W.otter, d = Math.hypot(m.x - W.x, m.y - W.y); tx = m.x; ty = m.y; spd = 88; W.want = 0.04;
                if (d < 170 && m.mode !== 'bolt' && m.mode !== 'under') { const K = nearestKelp(m.x, m.y); if (K) { m.mode = 'bolt'; m.tx = K.x; m.ty = K.y; m.boltT = 0; m.ring2 = 1; } }
                // it will not follow into the kelp, and it gives up soon
                if (inKelp(W.x + Math.sin(W.h) * 40, W.y - Math.cos(W.h) * 40) || inKelp(m.x, m.y) || m.mode === 'under' || W.t <= 0) { W.mode = 'patrol'; W.t = R(10, 20); W.cool = R(20, 35); W.otter = null; }
                else if (d < 26) {
                    // the lunge at the surface — and the otter is gone under, to come up in the kelp
                    W.mode = 'breach'; W.t = 1.1; W.bt = 1.1; W.bz = 0.35; W.caught = false; W.bx = m.x; W.by = m.y; W.splash = 1;
                    splashes.push({ x: m.x, y: m.y, t: 0, life: 3, r: 22 });
                    const K = nearestKelp(m.x, m.y) || { x: m.x, y: m.y }; m.mode = 'dive'; m.t = 0.5; m.quick = true; m.tx = K.x; m.ty = K.y; m.leg = 'visit'; W.otter = null;
                }
            } else if (W.mode === 'stalk') {
                // down deep and in under it, unseen
                const q = W.target.q; if (q.gone || q.flung > 0) { W.mode = 'patrol'; W.cool = 20; continue; }
                tx = q.x - Math.sin(q.h) * 40; ty = q.y + Math.cos(q.h) * 40; spd = 90; W.want = 1;
                if (Math.hypot(q.x - W.x, q.y - W.y) < 170 || W.t <= 0) { W.mode = openAround(q.x, q.y, 90) ? 'sprint' : 'patrol'; W.t = 1.6; if (W.mode === 'patrol') W.cool = 15; }
            } else if (W.mode === 'sprint') {
                // THE SPRINT: the last second and a half, in from behind and below — the shape firming up
                // fast as it rises, three times its cruising speed, no fin
                const q = W.target.q; if (q.gone || q.flung > 0) { W.mode = 'patrol'; W.cool = 15; continue; }
                tx = q.x; ty = q.y; spd = 150; W.want = 0.12; W.depth = Math.max(0.12, W.depth - dt * 0.6);
                if (Math.hypot(q.x - W.x, q.y - W.y) < 26 || W.t <= 0) strike(W, q, 0.47, false);
            } else if (W.mode === 'strike') {
                // the hit: rolled, at the surface, carried on a length by its own speed
                spd = 60; W.want = 0; W.roll = Math.max(0, W.t / 0.55);
                if (W.t <= 0) { W.roll = 0; if (W.caught) { W.mode = 'thrash'; W.t = R(3, 4); W.lx = W.x; W.ly = W.y; W.slick = 1; bloom(W.x, W.y); } else { W.mode = 'patrol'; W.t = R(10, 20); W.cool = R(25, 40); W.want = 0.7; } }
            } else if (W.mode === 'breach') {
                // clear of the water, rising nearly vertical, jaws open; over at the top; the crash
                const k2 = 1 - W.t / W.bt; W.z = W.bz * Math.sin(Math.PI * Math.min(1, k2 / 0.8)); W.roll = Math.min(1, k2 * 1.6) * W.bz; W.jaw = k2 < 0.55 ? 1 : Math.max(0, 1 - (k2 - 0.55) * 4);
                if (k2 > 0.8 && !W.crashed) { W.crashed = true; splashes.push({ x: W.x + Math.sin(W.h) * 20, y: W.y - Math.cos(W.h) * 20, t: 0, life: 6, r: 30 + 28 * W.bz, big: true }); }
                if (W.t <= 0) { W.z = 0; W.crashed = false; W.roll = 0; W.jaw = 0; W.mode = W.caught ? 'thrash' : 'patrol'; W.t = W.caught ? 2.5 : R(10, 20); if (W.caught) { bloom(W.x, W.y); foams.push({ x: W.x, y: W.y, t: 0.6, life: 18, R: 56, seed: R(0, 7), churn: 3, blood: true, spin: 1 }); } W.want = W.caught ? 0.02 : 0.9; W.cool = R(30, 50); if (W.caught) { W.slick = 1; W.lx = W.x; W.ly = W.y; } }
                spd = 20;
            } else if (W.mode === 'thrash') {
                // at the surface, shaking its head, the water churned
                // THE THRASH: shaking its head side to side in the churn, barely moving
                tx = W.lx + Math.sin(W.h + Math.sin(T * 9) * 0.9) * 30; ty = W.ly - Math.cos(W.h + Math.sin(T * 9) * 0.9) * 30; spd = 14; W.want = 0.02;
                W.shake = Math.sin(T * 13) * 0.45;
                bleed(W, dt, 0.9);
                if (W.t <= 0) { W.shake = 0; W.mode = 'feed'; W.t = R(35, 50); W.fa = Math.atan2(W.x - W.lx, -(W.y - W.ly)); W.biteT = R(8, 14); }
            } else if (W.mode === 'feed') {
                // FEEDING (the drone hunt): it swims slowly off with the kill, a red-brown plume streaming
                // behind it, circles back through the cloud, and every so often surfaces on the carcass
                // (a pink patch in white water) for another bite
                W.fa += dt * 0.35; tx = W.lx + Math.sin(W.fa) * 110; ty = W.ly - Math.cos(W.fa) * 110; spd = 32; W.want = 0.05;
                bleed(W, dt, 1.1);   // (puffs overlapping into one plume, not beads)
                W.biteT -= dt; if (W.biteT <= 0) { W.biteT = R(9, 15); W.bite = 2.2; splashes.push({ x: W.x + Math.sin(W.h) * 26, y: W.y - Math.cos(W.h) * 26, t: 0, life: 4, r: 24 }); }
                W.bite = Math.max(0, (W.bite || 0) - dt);
                if (W.t <= 0) { W.mode = 'patrol'; W.t = R(12, 25); }
            }
            if (W.mode !== 'rush' && W.mode !== 'sprint') W.depth += (W.want - W.depth) * Math.min(1, dt * (W.mode === 'stalk' ? 1.2 : 0.5));
            const o = W, ox0 = W.x, oy0 = W.y, oh0 = W.h;
            if (W.mode !== 'breach') steerTo(W, tx, ty, spd, W.mode === 'sprint' ? 4 : W.mode === 'shadow' || W.mode === 'chase' || W.mode === 'chaseOtter' ? 2.6 : 1.1, dt, 30, 20, W.mode === 'sprint' || W.mode === 'shadow' || W.mode === 'chase' || W.mode === 'chaseOtter');
            const moved = Math.hypot(o.x - ox0, o.y - oy0);
            W.turn = (W.turn || 0) * 0.9 + angDiff(o.h, oh0) / Math.max(dt, 1e-3) * 0.1;
            W.spd = moved / Math.max(dt, 1e-3);
            // the tail: a slow sweep cruising, quicker when it speeds up (the body stiff, the tail stock working)
            W.ph += dt * (4.2 + W.spd * 0.03);
            recordTrail(W, dt, W.depth < 0.15 && W.mode !== 'breach');
        }
    }
    // The body's half-width along it, s = 0 at the snout .. 1 at the tail's root (references:
    // a heavy spindle, deepest a third back, a conical snout, a slim keeled tail stock).
    const WHITE_W = [[0, 0], [0.03, 2.4], [0.08, 4.6], [0.15, 6.4], [0.24, 7.6], [0.33, 8], [0.45, 7.4], [0.57, 6.1], [0.68, 4.4], [0.78, 2.9], [0.86, 2], [0.9, 2.3], [0.93, 1.5]];
    function whitePath(ctx, sway) {
        const L = 58;
        ctx.beginPath();
        for (const [s, w] of WHITE_W) ctx.lineTo(sway(s) + w, -L * 0.45 + s * L);
        for (let i = WHITE_W.length - 1; i >= 0; i--) { const [s, w] = WHITE_W[i]; ctx.lineTo(sway(s) - w, -L * 0.45 + s * L); }
        ctx.closePath();
    }
    function drawWhiteShark(ctx, W, layer) {
        // layer: 'water' draws it under the surface (or finning at it); 'air' draws the breach
        if (!onCam(W.x, W.y, 200)) return;
        const breach = W.mode === 'breach';
        if ((layer === 'air') !== breach) return;
        const Ls = 58, k = WHITE_LEN / 64, tint = waterTint();
        const turn = Math.max(-1, Math.min(1, (W.turn || 0) * 2));
        const amp = breach ? 2 : 3.4;
        // most of the bending in the rear third; the head yaws a touch against it (lamnid swimming)
        const sway = (s) => amp * Math.pow(Math.max(0, s - 0.4) / 0.6, 2) * Math.sin(W.ph - s * 2.6) - 0.5 * Math.sin(W.ph + 0.8) * Math.max(0, 0.25 - s) * 2 + turn * 6 * Math.pow(Math.max(0, s - 0.3), 2);
        const Y = (s) => -Ls * 0.45 + s * Ls;
        const P = (s) => { let w = 0; for (let i = 1; i < WHITE_W.length; i++) if (s <= WHITE_W[i][0]) { const a = WHITE_W[i - 1], b = WHITE_W[i], u = (s - a[0]) / (b[0] - a[0]); w = a[1] + (b[1] - a[1]) * u; break; } return { x: sway(s), y: Y(s), w }; };
        const shape = (mode) => {
            // pectorals: long, broad, swept back like a plane's wings
            const A = P(0.25), B = P(0.35);
            for (const sd of [-1, 1]) {
                ctx.beginPath(); ctx.moveTo(A.x + sd * A.w * 0.9, A.y);
                ctx.quadraticCurveTo(A.x + sd * 15, A.y + 3, A.x + sd * 23, A.y + 14);
                ctx.quadraticCurveTo(A.x + sd * 16, A.y + 13, B.x + sd * B.w * 0.9, B.y + 2); ctx.closePath();
                if (mode === 'body') { ctx.fillStyle = WHITE.back; ctx.fill(); ctx.strokeStyle = 'rgba(40,44,48,0.5)'; ctx.lineWidth = 0.4; ctx.stroke();
                    // the pale underside flashes along the trailing edge when it banks
                    ctx.strokeStyle = `rgba(230,234,236,${0.25 + 0.4 * Math.max(0, sd * turn)})`; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(A.x + sd * 22, A.y + 13.5); ctx.quadraticCurveTo(A.x + sd * 16, A.y + 12.6, B.x + sd * B.w, B.y + 2); ctx.stroke(); }
                else ctx.fill();
            }
            // pelvic fins, small
            const V = P(0.68); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(V.x + sd * V.w * 0.8, V.y - 1); ctx.lineTo(V.x + sd * 7, V.y + 3.6); ctx.lineTo(V.x + sd * V.w * 0.6, V.y + 2.4); ctx.closePath(); if (mode === 'body') ctx.fillStyle = WHITE.back; ctx.fill(); }
            // the caudal fin: tall and crescent, seen from above nearly edge-on — a blade that swings
            const T0 = P(0.92), ang = Math.atan2(sway(0.93) - sway(0.86), Ls * 0.07) * 2.2;
            ctx.save(); ctx.translate(T0.x, T0.y); ctx.rotate(-ang);
            ctx.beginPath(); ctx.moveTo(-1.6, -1); ctx.quadraticCurveTo(-2.6, 5, -0.3, 11); ctx.lineTo(0.5, 11); ctx.quadraticCurveTo(2.4, 5, 1.6, -1); ctx.closePath();
            if (mode === 'body') { ctx.fillStyle = WHITE.fin; ctx.fill(); } else ctx.fill();
            ctx.restore();
            whitePath(ctx, sway);
            if (mode !== 'body') { ctx.fill(); return; }
            const g = ctx.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, WHITE.warm); g.addColorStop(0.5, WHITE.back); g.addColorStop(1, WHITE.warm);
            ctx.fillStyle = g; ctx.fill();
            // the white belly, just showing at the widest part of each flank: a broken, uneven line
            ctx.save(); whitePath(ctx, sway); ctx.clip();
            ctx.strokeStyle = 'rgba(214,220,222,0.3)'; ctx.lineWidth = 0.8;
            for (const sd of [-1, 1]) { ctx.beginPath(); for (let s = 0.14; s <= 0.7; s += 0.04) { const q = P(s); const x = q.x + sd * (q.w - 0.4 - 0.35 * Math.sin(s * 40 + sd)); s === 0.14 ? ctx.moveTo(x, q.y) : ctx.lineTo(x, q.y); } ctx.stroke(); }
            // a paler snout, the darker spine
            ctx.fillStyle = 'rgba(140,146,150,0.35)'; ctx.beginPath(); ctx.ellipse(sway(0.04), Y(0.04), 2.2, 3.6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(40,44,48,0.3)'; ctx.lineWidth = 3.2; ctx.beginPath(); for (let s = 0.1; s <= 0.88; s += 0.06) { const q = P(s); s === 0.1 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); } ctx.stroke();
            ctx.restore();
            ctx.strokeStyle = 'rgba(40,44,48,0.55)'; ctx.lineWidth = 0.45; whitePath(ctx, sway); ctx.stroke();
            // the gill slits, five on each side, and the black eyes near the snout
            ctx.strokeStyle = 'rgba(35,38,42,0.7)'; ctx.lineWidth = 0.45;
            for (const sd of [-1, 1]) for (let g2 = 0; g2 < 5; g2++) { const q = P(0.19 + g2 * 0.018); ctx.beginPath(); ctx.moveTo(q.x + sd * (q.w - 1.6), q.y - 0.6); ctx.quadraticCurveTo(q.x + sd * (q.w - 0.4), q.y, q.x + sd * (q.w - 1.2), q.y + 0.9); ctx.stroke(); }
            ctx.fillStyle = '#0b0c0e'; for (const sd of [-1, 1]) { const q = P(0.085); ctx.beginPath(); ctx.arc(q.x + sd * (q.w - 0.9), q.y, 0.6, 0, Math.PI * 2); ctx.fill(); }
            // the lateral keels on the tail stock
            ctx.fillStyle = WHITE.fin; for (const sd of [-1, 1]) { const q = P(0.89); ctx.beginPath(); ctx.moveTo(q.x + sd * q.w, q.y - 1.6); ctx.lineTo(q.x + sd * (q.w + 1.1), q.y); ctx.lineTo(q.x + sd * q.w, q.y + 1.6); ctx.fill(); }
            // the first dorsal, from above a thick dark blade along the spine (it stands up out of the page)
            const D0 = P(0.36), D1 = P(0.5);
            ctx.fillStyle = WHITE.fin; ctx.beginPath(); ctx.moveTo(D0.x, D0.y); ctx.quadraticCurveTo(D0.x + 1.6, (D0.y + D1.y) / 2, D1.x + 0.2, D1.y + 1.5); ctx.quadraticCurveTo(D0.x - 1.2, (D0.y + D1.y) / 2 + 2, D0.x, D0.y); ctx.fill();
        };
        if (breach) {
            // THE BREACH (Wes's references, Sep 26 2026 — Seal Island breaches, a head at the surface, jaws
            // from above). It comes out head first, nearly vertical, so from overhead we look INTO its face:
            // the pointed snout nearest us, grey only round the edges, a ragged line to the white throat and
            // belly, and the huge gape across the head — pink-red gums, rows of white triangular teeth top
            // and bottom, dark inside; the pectorals thrown out either side (grey above, white beneath, dark
            // tips); the rest of it dropping away into a crown of torn white water. On the way up and back
            // down it is still the top view, rolled so the belly shows. Its shadow is thrown far out.
            const z = W.z, roll = W.roll, bxw = W.bx != null ? W.bx : W.x, byw = W.by != null ? W.by : W.y;
            const up = Math.max(0, Math.min(1, (z - 0.25) / 0.45));     // 0: seen from above .. 1: seen head-on
            whiteWater(ctx, bxw, byw, 30 + z * 34, 0.55 + 0.45 * z, W.i || 0);
            ctx.save(); ctx.translate(W.x + z * 45, W.y + z * 70); ctx.rotate(W.h); ctx.scale(k * (1 + z * 0.3), k * (1 - z * 0.3)); ctx.fillStyle = `rgba(10,25,40,${0.28 * (1 - z * 0.3)})`; shape('flat'); ctx.restore();
            if (up < 1) {
                ctx.save(); ctx.globalAlpha *= 1 - up; ctx.translate(W.x, W.y - z * 12); ctx.rotate(W.h + roll * 0.5); ctx.scale(k * (1 + z * 0.95), k * (1 + z * 0.95) * (1 - z * 0.3));
                shape('body');
                ctx.save(); whitePath(ctx, sway); ctx.clip(); ctx.fillStyle = `rgba(238,240,238,${0.85 * roll})`; ctx.beginPath(); ctx.ellipse(-8 + roll * 3, -2, 6 * roll + 0.1, 26, 0.05, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                ctx.restore();
            }
            if (up > 0) {
                const sc = k * (1.25 + z * 0.9), jaw = W.jaw || 0;
                ctx.save(); ctx.globalAlpha *= up; ctx.translate(W.x, W.y - z * 10); ctx.rotate(W.h); ctx.scale(sc, sc);
                // the body dropping away behind the head, into the water
                ctx.fillStyle = WHITE.back; ctx.beginPath(); ctx.moveTo(-8.4, 3); ctx.quadraticCurveTo(-7.5, 12, -4.5, 20); ctx.lineTo(4.5, 20); ctx.quadraticCurveTo(7.5, 12, 8.4, 3); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#e9ebe8'; ctx.beginPath(); ctx.moveTo(-6, 3); ctx.quadraticCurveTo(-5, 12, -2.8, 20); ctx.lineTo(2.8, 20); ctx.quadraticCurveTo(5, 12, 6, 3); ctx.closePath(); ctx.fill();
                // the pectorals flung out either side: long, grey above, white beneath, dark at the tips
                for (const sd of [-1, 1]) {
                    ctx.save(); ctx.translate(sd * 6.5, 5); ctx.scale(sd, 1);
                    ctx.beginPath(); ctx.moveTo(0, -1.5); ctx.quadraticCurveTo(9, 0, 17, 9); ctx.quadraticCurveTo(10, 6, 0, 4); ctx.closePath(); ctx.fillStyle = '#f0f1ee'; ctx.fill();
                    ctx.beginPath(); ctx.moveTo(0, -1.5); ctx.quadraticCurveTo(9, 0, 17, 9); ctx.quadraticCurveTo(9, 2.4, 0, 0.8); ctx.closePath(); ctx.fillStyle = WHITE.back; ctx.fill();
                    ctx.beginPath(); ctx.moveTo(13.6, 5.4); ctx.lineTo(17, 9); ctx.lineTo(13, 6.8); ctx.closePath(); ctx.fillStyle = '#1d2226'; ctx.fill();
                    ctx.restore();
                }
                // the head: a blunt cone, the snout at the top
                const head = () => { ctx.beginPath(); ctx.moveTo(0, -17); ctx.bezierCurveTo(5.5, -16.5, 9.2, -8, 9, 0); ctx.bezierCurveTo(8.9, 4, 7, 7, 0, 7.5); ctx.bezierCurveTo(-7, 7, -8.9, 4, -9, 0); ctx.bezierCurveTo(-9.2, -8, -5.5, -16.5, 0, -17); ctx.closePath(); };
                ctx.fillStyle = '#eceeeb'; head(); ctx.fill();
                // the grey upper side: the whole snout down to about the eyes, and a band down each flank;
                // the line where it meets the white is ragged (every reference shows it torn, never smooth)
                ctx.save(); head(); ctx.clip(); ctx.fillStyle = WHITE.back; ctx.beginPath();
                ctx.moveTo(-12, -20); ctx.lineTo(12, -20); ctx.lineTo(12, 10); ctx.lineTo(7.6, 10);
                for (let q = 0; q <= 10; q++) { const f = q / 10; ctx.lineTo(7.2 - 0.9 * Math.abs(Math.sin(f * 11)), 8 - f * 12); }            // down the right flank
                for (let q = 0; q <= 14; q++) { const f = q / 14, x = 6.8 - f * 13.6; ctx.lineTo(x, -4.6 + 1.1 * Math.sin(f * 17 + 1) + 1.6 * Math.pow(Math.abs(x) / 7, 2)); }   // across, under the eyes
                for (let q = 10; q >= 0; q--) { const f = q / 10; ctx.lineTo(-7.2 + 0.9 * Math.abs(Math.cos(f * 10)), 8 - f * 12); }           // down the left flank
                ctx.lineTo(-7.6, 10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(40,44,48,0.35)'; ctx.beginPath(); ctx.ellipse(0, -15.2, 2.2, 1.6, 0, 0, Math.PI * 2); ctx.fill();   // the darker tip of the snout
                ctx.restore();
                ctx.strokeStyle = 'rgba(40,44,48,0.5)'; ctx.lineWidth = 0.35; head(); ctx.stroke();
                // the black eyes at the edge of the grey, the nostrils near the tip
                ctx.fillStyle = '#0b0c0e'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 6.9, -6.5, 0.75, 0.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(sd * 2.2, -12.4, 0.5, 0.25, sd * 0.4, 0, Math.PI * 2); ctx.fill(); }
                // THE GAPE: the jaws wide, pink-red gums round a dark throat; triangular teeth along both jaws
                const mo = 0.3 + 0.7 * jaw, mw = 7.3, mh = 5.4 * mo, my = 0.4;   // (wider than tall: a rounded trapezoid of a gape)
                ctx.fillStyle = '#d7727c'; ctx.beginPath(); ctx.ellipse(0, my, mw, mh, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#4a0f18'; ctx.beginPath(); ctx.ellipse(0, my + 0.4, mw * 0.72, mh * 0.66, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(160,40,52,0.6)'; ctx.beginPath(); ctx.ellipse(0, my + 0.6, mw * 0.5, mh * 0.42, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = WHITE.teeth;
                for (let t = 0; t < 11; t++) { const a = Math.PI * (1.09 + t * 0.082), cx = Math.cos(a) * mw * 0.86, cy = my + Math.sin(a) * mh * 0.86, sz = 1.75 - Math.abs(t - 5) * 0.12;
                    ctx.beginPath(); ctx.moveTo(cx - sz * 0.55, cy); ctx.lineTo(cx * 0.93, cy + sz * 1.5); ctx.lineTo(cx + sz * 0.55, cy); ctx.fill(); }
                for (let t = 0; t < 10; t++) { const a = Math.PI * (0.1 + t * 0.089), cx = Math.cos(a) * mw * 0.84, cy = my + Math.sin(a) * mh * 0.84, sz = 1.45 - Math.abs(t - 4.5) * 0.1;
                    ctx.beginPath(); ctx.moveTo(cx - sz * 0.5, cy); ctx.lineTo(cx * 0.93, cy - sz * 1.4); ctx.lineTo(cx + sz * 0.5, cy); ctx.fill(); }
                // water streaming off the head and down the flanks
                ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineCap = 'round';
                for (const sd of [-1, 1]) for (let q = 0; q < 2; q++) { ctx.lineWidth = 1 - q * 0.3; ctx.beginPath(); ctx.moveTo(sd * (8.8 - q), -5 + q * 4); ctx.quadraticCurveTo(sd * (10.2 - q), -1 + q * 4, sd * (9.4 - q), 4 + q * 4); ctx.stroke(); }
                ctx.restore();
                // the white water round its waist, in FRONT of the body where it leaves the sea
                ctx.save(); ctx.globalAlpha *= up; whiteWater(ctx, bxw + Math.sin(W.h) * -6, byw - Math.cos(W.h) * -6, 18 + 10 * z, 0.7, (W.i || 0) + 5); ctx.restore();
            }
            return;
        }
        const d = Math.max(0, Math.min(1, W.depth));
        // its shadow on the bottom (the kelp edge is shallow enough to see it) — faint, well offset
        const hgt = 10 + (1 - d) * 26;
        ctx.save(); ctx.translate(W.x + hgt * 0.35, W.y + hgt * 0.55); ctx.rotate(W.h); ctx.scale(k, k); ctx.globalAlpha *= 0.04 + 0.04 * (1 - d); ctx.fillStyle = 'rgb(10,25,40)'; shape('flat'); ctx.restore();
        // the slick where it fed
        if (W.slick > 0) { const g = ctx.createRadialGradient(W.lx, W.ly, 0, W.lx, W.ly, 70); g.addColorStop(0, `rgba(96,62,58,${0.28 * W.slick})`); g.addColorStop(0.6, `rgba(170,190,190,${0.2 * W.slick})`); g.addColorStop(1, 'rgba(170,190,190,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(W.lx, W.ly, 70, 52, W.h, 0, Math.PI * 2); ctx.fill(); }
        if (W.depth < 0.15 && W.trail.length > 2) drawWakeTrail(ctx, W, 2.2, 1.4, 0.5 * (1 - W.depth / 0.15));
        ctx.save(); ctx.translate(W.x, W.y); ctx.rotate(W.h + (W.shake || 0)); ctx.scale(k, k);
        const a0 = ctx.globalAlpha;
        // deeper = fainter and bluer, but still a DARK shape — the shadow under the water that says shark
        // (even finning, the body is half a metre down: veiled, so the fin standing out of it reads)
        ctx.globalAlpha = a0 * (0.9 - 0.45 * d); shape('body');
        ctx.globalAlpha = a0 * (0.24 + 0.36 * d); ctx.fillStyle = `rgb(${tint.split(',').map(v => Math.round(v * 0.62)).join(',')})`; shape('flat');
        ctx.globalAlpha = a0;
        // rolled in the strike (and in the thrash): the pale belly flashes along one flank
        const rl = W.mode === 'thrash' ? 0.5 + 0.4 * Math.sin(T * 13) : (W.roll || 0);
        if (rl > 0.02 && W.mode !== 'breach') { ctx.save(); whitePath(ctx, sway); ctx.clip(); ctx.fillStyle = `rgba(236,238,236,${0.8 * rl})`; ctx.beginPath(); ctx.ellipse(-7 + rl * 3, 0, 5 * rl + 0.1, 24, 0.05, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        const surf = W.mode === 'strike' || W.mode === 'thrash' ? 0 : Math.max(0, 1 - W.depth / 0.12);
        if (surf > 0) {
            // FINNING: the dorsal stands out of the water — dark, a tall curved triangle leaning back,
            // throwing its shadow on the sea — with water curling off its leading edge; behind it the
            // tip of the tail swings through the surface, cutting a little wake of its own
            // ORTHOGRAPHIC, straight down: a vertical fin is only its top edge — a narrow dark blade along
            // the spine, raked back — and its HEIGHT shows in the shadow it throws on the water (light
            // from the upper left, so down and to the right; the offset turned into the shark's frame)
            const D0 = P(0.34), D1 = P(0.47), DT = P(0.53), hf = 30 * surf;   // (its height drawn long, so the shadow reaches past the back onto open water)
            const wsx = 0.35 * hf, wsy = 0.55 * hf, ch = Math.cos(W.h), sh = Math.sin(W.h);
            const lx = wsx * ch + wsy * sh, ly = -wsx * sh + wsy * ch;          // the shadow's reach, in the fin's frame
            ctx.fillStyle = `rgba(8,20,32,${0.4 * surf})`; ctx.beginPath(); ctx.moveTo(D0.x, D0.y); ctx.lineTo(DT.x + lx, DT.y + ly); ctx.lineTo(D1.x, D1.y); ctx.closePath(); ctx.fill();
            // white water heaped at the leading edge, peeling back either side of the fin
            { const wg = ctx.createRadialGradient(D0.x, D0.y - 1, 0, D0.x, D0.y - 1, 5); wg.addColorStop(0, `rgba(255,255,255,${0.85 * surf})`); wg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(D0.x, D0.y - 1, 5, 0, Math.PI * 2); ctx.fill(); }
            ctx.strokeStyle = `rgba(255,255,255,${0.35 * surf})`; ctx.lineWidth = 0.6;
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(D0.x + sd * 1.3, D0.y); ctx.quadraticCurveTo(D0.x + sd * 2.6, D0.y + 3, D0.x + sd * 3.8, D1.y - 1); ctx.stroke(); }
            // the blade: thick at the base, tapering to the raked-back tip; lit along its upper-left edge
            ctx.fillStyle = '#2b3136'; ctx.beginPath(); ctx.moveTo(D0.x, D0.y - 0.6); ctx.quadraticCurveTo(D0.x - 1.5, (D0.y + D1.y) / 2, DT.x - 0.2, DT.y); ctx.quadraticCurveTo(D1.x + 1.3, (D0.y + D1.y) / 2 + 2, D0.x + 1, D0.y); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(205,212,218,0.6)'; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(D0.x - 0.3, D0.y - 0.4); ctx.quadraticCurveTo(D0.x - 1.5, (D0.y + D1.y) / 2, DT.x - 0.2, DT.y); ctx.stroke();
            // the upper lobe of the tail slicing the surface behind: the same kind of blade, swinging, with its shadow
            const T0 = P(0.92), ang = Math.atan2(sway(0.93) - sway(0.86), Ls * 0.07) * 2.2, tt = { x: T0.x - Math.sin(ang) * 9, y: T0.y + Math.cos(ang) * 9 }, ht = 16 * surf;
            const tx2 = 0.35 * ht * ch + 0.55 * ht * sh, ty2 = -0.35 * ht * sh + 0.55 * ht * ch;
            ctx.fillStyle = `rgba(10,25,40,${0.28 * surf})`; ctx.beginPath(); ctx.moveTo(T0.x, T0.y); ctx.lineTo(tt.x + tx2, tt.y + ty2); ctx.lineTo(tt.x, tt.y); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#2b3136'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(T0.x, T0.y); ctx.lineTo(tt.x, tt.y); ctx.stroke();
            { const wg = ctx.createRadialGradient(T0.x, T0.y, 0, T0.x, T0.y, 3.5); wg.addColorStop(0, `rgba(255,255,255,${0.55 * surf})`); wg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(T0.x, T0.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
    }

    // Torn white water round something bursting through the surface: a lobed sheet of foam, bright at
    // the heart, and thick tapered tongues of spray thrown out at uneven angles — sheets, never dots.
    function whiteWater(ctx, x, y, r, a, seed) {
        ctx.save(); ctx.translate(x, y);
        const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`); g.addColorStop(0.6, `rgba(235,248,250,${0.6 * a})`); g.addColorStop(1, 'rgba(220,240,245,0)');
        ctx.fillStyle = g; ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2, n = 0.82 + 0.12 * Math.sin(t * 3 + seed) + 0.08 * Math.sin(t * 7 + seed * 2.3); ctx.lineTo(Math.cos(t) * r * n, Math.sin(t) * r * n); }
        ctx.fill();
        for (let i = 0; i < 9; i++) {
            const j = Math.abs(Math.sin(i * 12.99 + seed * 3.1)), t = (i + 0.7 * j) / 9 * Math.PI * 2, L = r * (0.9 + 0.7 * j), w = r * (0.08 + 0.06 * j);
            ctx.fillStyle = `rgba(255,255,255,${0.75 * a * (0.6 + 0.4 * j)})`; ctx.beginPath();
            ctx.moveTo(Math.cos(t - 0.12) * r * 0.5, Math.sin(t - 0.12) * r * 0.5);
            ctx.quadraticCurveTo(Math.cos(t) * L * 0.8 - Math.sin(t) * w, Math.sin(t) * L * 0.8 + Math.cos(t) * w, Math.cos(t) * L, Math.sin(t) * L);
            ctx.quadraticCurveTo(Math.cos(t) * L * 0.8 + Math.sin(t) * w, Math.sin(t) * L * 0.8 - Math.cos(t) * w, Math.cos(t + 0.12) * r * 0.5, Math.sin(t + 0.12) * r * 0.5);
            ctx.fill();
        }
        ctx.restore();
    }
    // ── BLUE WHALES ──────────────────────────────────────────────────────────────────────
    function makeBluePods(c) {
        krill = (c.krill || []).map(([x, y], i) => ({ i, x, y, r: R(120, 160), ph: R(0, 7), eat: 0, fade: 1, busy: null, open: openAround(x, y, 300) }));   // (a swarm by the rocks is scenery: no whale steers for it)
        return c.pods.map((P, i) => {
            const segs = [], pts = P.path; let L = 0;
            for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, d, s0: L }); L += d; }
            const members = Array.from({ length: P.n }, (_, j) => ({ j, len: BLUE_LEN * R(0.9, 1.04), ox: j * R(110, 150) * (j % 2 ? 1 : -1), oy: -j * R(80, 140), x: 0, y: 0, h: 0, v: P.speed,
                mode: 'under', t: R(2, 20) + j * 6, depth: 1, breaths: 0, blowT: 0, ev: null, evT: 0, ph: R(0, 7), fluke: 0, rollT: 99, slick: 0, sx: 0, sy: 0, sd: 1, lunge: 0, turn: 0,
                // the dapple: many small pale and dark flecks, finer toward the tail (u along, v across, size, light?)
                mott: Array.from({ length: 150 }, () => { const u = R(-0.46, 0.36); return [u, R(-0.9, 0.9), R(0.0015, 0.0042) * (u > 0.15 ? 0.7 : 1), rnd() < 0.55]; }) }));
            return { cfg: P, i, segs, L, s: R(0, L), members, cx: 0, cy: 0 };
        });
    }
    function updateBlues(dt, me) {
        const c = cfg.blues;
        for (const K of krill) { K.ph += dt; K.fade = Math.min(1, K.fade + dt / 4); }
        for (const W of bluePods) {
            W.s += W.cfg.speed * dt;
            const here = _podAt(W, W.s), ahead = _podAt(W, W.s + 400);
            W.cx = here.x; W.cy = here.y;
            const hh = Math.atan2(ahead.x - here.x, -(ahead.y - here.y)), fx = Math.sin(hh), fy = -Math.cos(hh);
            for (const m of W.members) {
                m.t -= dt; m.ph += dt;
                const tx = here.x + fx * -m.oy + -fy * m.ox, ty = here.y + fy * -m.oy + fx * m.ox;
                if (m.x === 0 && m.y === 0) { m.x = tx; m.y = ty; m.h = hh; }
                // SWIMMING, NOT SLIDING (Wes, Sep 26: "it should not rotate in place"): it always moves
                // forward along its own heading and turns only as it goes — a turn no tighter than about
                // a body length and a half — chasing a point well ahead of its place in the pod, a little
                // faster when behind its place and slower when ahead
                const mh = Math.sin(m.h), mc = -Math.cos(m.h);
                const along = (tx - m.x) * mh + (ty - m.y) * mc;
                m.v += (W.cfg.speed * (m.ev === 'lunge' && m.evT > 1.2 ? 0.4 : Math.max(0.65, Math.min(1.5, 1 + along / 300))) - m.v) * Math.min(1, dt * (m.ev === 'lunge' ? 1.2 : 0.5));   // engulfing a mouthful stops it nearly dead
                const ax = tx + fx * 380, ay = ty + fy * 380; let want = Math.atan2(ax - m.x, -(ay - m.y));
                // a krill swarm ahead: it makes for it (and lunges when its head reaches the edge)
                const hx0 = m.x + mh * m.len * 0.45, hy0 = m.y + mc * m.len * 0.45;
                if (!m.ev) for (const K of krill) { if (K.busy || K.fade < 1) continue; const d = Math.hypot(K.x - hx0, K.y - hy0), ang = Math.abs(angDiff(Math.atan2(K.x - hx0, -(K.y - hy0)), m.h));
                    if (d < 800 && ang < 0.9 && K.open !== false) want = Math.atan2(K.x - m.x, -(K.y - m.y));
                    if (d < 150 && ang < 0.7 && !m.lungeCool) {   /* its head at the swarm's heart as the jaws open ~1 s later */ m.ev = 'lunge'; m.evT = 0; m.sd = rnd() < 0.5 ? -1 : 1; m.kr = K; K.busy = m; if (m.mode !== 'surface') { m.mode = 'surface'; m.breaths = 3; m.blowT = 6; m.depth = 0; } break; } }
                m.lungeCool = Math.max(0, (m.lungeCool || 0) - dt);
                // ...and it keeps its whole length off the rocks: look along the way it wants to go
                const clearH = (h) => { for (const r of [m.len * 0.55 + 60, m.len * 0.55 + 220]) for (const w of [-m.len * 0.12, 0, m.len * 0.12]) if (solidAt(m.x + Math.sin(h) * r + Math.cos(h) * w, m.y - Math.cos(h) * r + Math.sin(h) * w, null, true)) return false; return true; };
                if (!clearH(want)) for (const da of [0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6]) if (clearH(want + da)) { want += da; break; }
                const maxTurn = m.v / (1.5 * m.len), dh = Math.max(-maxTurn * dt, Math.min(maxTurn * dt, angDiff(want, m.h)));
                m.h += dh; m.x += Math.sin(m.h) * m.v * dt; m.y -= Math.cos(m.h) * m.v * dt;
                m.turn = m.turn * 0.9 + dh / Math.max(dt, 1e-3) * 0.1;
                // fluke prints: the smooth round slicks each stroke leaves at the surface behind a shallow whale
                m.printT = (m.printT || R(0, 5)) - dt;
                if (m.printT <= 0 && (m.mode !== 'under' || m.depth < 0.6)) { m.printT = R(4.5, 6.5); prints.push({ x: m.x - Math.sin(m.h) * m.len * 0.44, y: m.y + Math.cos(m.h) * m.len * 0.44, h: m.h, r: m.len * 0.13, t: 0 }); }
                m.slick = Math.max(0, m.slick - dt / 12); m.rollT += dt;
                if (m.mode === 'under') {
                    m.depth = Math.min(1, m.depth + dt / 5);
                    if (m.t < 6) m.depth = Math.max(0.3, m.depth - dt / 4);
                    if (m.t <= 0 && boatNear(m.x, m.y, m.len * 0.7)) m.t = 1.5;
                    if (m.t <= 0) { m.mode = 'surface'; m.breaths = Math.round(R(4, 6)); m.blowT = 0; m.depth = 0;
                    }
                } else if (m.mode === 'surface') {
                    if (m.ev === 'lunge') {
                        // THE LUNGE (references: side-lunging blues off California): it ROLLS over onto its side as
                        // it drives into the swarm — a gradual turn, not a switch — the jaws gape, the pleated
                        // throat balloons out with the water it engulfs, the mouth closes on it; it all but
                        // stops; the pouch drains and it rolls back upright
                        m.evT += dt; const e = m.evT, ss = (a, b) => { const q = Math.max(0, Math.min(1, (e - a) / (b - a))); return q * q * (3 - 2 * q); };
                        m.roll = ss(0, 1.5) * (1 - ss(4.0, 5.8));
                        m.gape = ss(0.5, 1.2) * (1 - ss(2.1, 2.8));
                        m.pouch = ss(0.9, 2.2) * (1 - 0.85 * ss(3.2, 5.0)) * (1 - ss(5.0, 5.8));
                        m.lunge = m.roll;
                        // the swarm goes into it: thinned while the open mouth is in it
                        const K = m.kr, hx = m.x + Math.sin(m.h) * m.len * 0.45, hy = m.y - Math.cos(m.h) * m.len * 0.45;
                        if (K && m.gape > 0.2 && Math.hypot(K.x - hx, K.y - hy) < K.r * 1.2) K.eat = Math.min(1, K.eat + dt * 0.8);
                        if (e > 5.8) { m.ev = null; m.lunge = 0; m.roll = 0; m.gape = 0; m.pouch = 0; m.blowT = 1.2; m.lungeCool = 25;
                            // what is left drifts apart; a new swarm is somewhere further along the pod's way
                            if (K) { K.busy = null; const q = _podAt(W, W.s + R(1500, 2600)), q2 = snapOpen(q.x + R(-120, 120), q.y + R(-120, 120), 300); K.x = q2.x; K.y = q2.y; K.eat = 0; K.fade = 0; K.open = openAround(K.x, K.y, 300); } }
                        continue;
                    }
                    { const b = boatNear(m.x + Math.sin(m.h) * m.len * 0.5, m.y - Math.cos(m.h) * m.len * 0.5, m.len * 0.6); if (b) { m.mode = 'dive'; m.t = 5; m.flukeUp = false; continue; } }
                    m.blowT -= dt;
                    if (m.blowT <= 0) {
                        if (m.breaths-- <= 0) { m.mode = 'dive'; m.t = 6; m.flukeUp = rnd() < 0.3; continue; }
                        m.rollT = 0;
                        const bx = m.x + Math.sin(m.h) * m.len * 0.31, by = m.y - Math.cos(m.h) * m.len * 0.31;
                        blueBlows.push({ x: bx, y: by, t: 0, s: m.len / 360, seed: R(0, 7), vx: Math.sin(m.h) * m.v, vy: -Math.cos(m.h) * m.v });
                        m.blowT = R(6, 9);
                    }
                } else if (m.mode === 'dive') {
                    // the terminal dive: a long high arch of back and, now and then, the flukes lifted
                    m.fluke = m.flukeUp ? Math.max(0, Math.sin(Math.PI * Math.max(0, (1 - m.t / 6) * 1.6 - 0.6))) : 0;
                    if (m.t <= 0) { m.mode = 'under'; m.fluke = 0; m.depth = 0.3; m.t = R(25, 45); m.slick = 1; m.sx = m.x - Math.sin(m.h) * m.len * 0.4; m.sy = m.y + Math.cos(m.h) * m.len * 0.4; }
                }
                // BLUE WATER: the player alongside a blue whale while racing
                if (me && c.feat && Math.hypot(me.x - m.x, me.y - m.y) < c.nearR) feat(c.feat);
            }
        }
        for (const B of blueBlows) B.t += dt; blueBlows = blueBlows.filter(B => B.t < 6);
        if (!whalePods.length) { for (const F of prints) F.t += dt; prints = prints.filter(F => F.t < 14); }
    }
    // BLUE WHALE from above (references, Sep 26 2026 — drone shots in the Sea of Cortez and off
    // Monterey, blows, lunges): immensely long and slender; a broad flat U of a head; small pointed
    // flippers a quarter of the way back; a tiny dorsal three-quarters back; a thick tail stock and
    // straight-edged flukes. Mottled blue-grey; through the water it glows pale aqua.
    // (Wes's aerial references: slim — widest about a tenth of its length, just behind the flippers; the
    // head a broad, flat, rounded U nearly as wide as the body; the tail stock long and thin.)
    // (second look beside the references: a SPINDLE, not a tube — the rounded snout about half the width
    // of the body, widening to the flippers, then one long steady taper to the thin tail stock)
    const BLUE_PROFILE = [[-0.5, 0], [-0.497, 0.012], [-0.49, 0.02], [-0.475, 0.027], [-0.45, 0.033], [-0.4, 0.04], [-0.33, 0.047], [-0.26, 0.052], [-0.2, 0.054], [-0.12, 0.052], [-0.04, 0.047], [0.05, 0.04], [0.13, 0.032], [0.2, 0.024], [0.26, 0.017], [0.31, 0.012], [0.36, 0.009], [0.405, 0.008]];
    let _BW = { bend: 0, fore: 1 };
    const _bwx = (u) => _BW.bend * Math.pow(Math.max(0, (u + 0.1) / 0.5), 2);
    function blueShape(ctx, L) { ctx.beginPath(); for (const [u, w] of BLUE_PROFILE) ctx.lineTo((_bwx(u) + w) * L, u * L); for (let k = BLUE_PROFILE.length - 1; k >= 0; k--) { const [u, w] = BLUE_PROFILE[k]; ctx.lineTo((_bwx(u) - w) * L, u * L); } ctx.closePath(); }
    function blueFlukes(ctx, L) {
        const ang = Math.atan2(_bwx(0.405) - _bwx(0.36), 0.045), tx = _bwx(0.405) * L;
        ctx.save(); ctx.translate(tx, L * 0.4); ctx.rotate(-ang * 1.1); const zs = 1 + 0.06 * (_BW.up || 0); ctx.scale(zs, _BW.fore * zs);
        // a delta, span ~a fifth of the length, the tips swept back to points, a small notch
        const w = L * 0.105; ctx.beginPath(); ctx.moveTo(0, -L * 0.008); ctx.quadraticCurveTo(w * 0.45, -L * 0.002, w, L * 0.058); ctx.quadraticCurveTo(w * 0.55, L * 0.05, w * 0.2, L * 0.047); ctx.lineTo(0, L * 0.041); ctx.lineTo(-w * 0.2, L * 0.047); ctx.quadraticCurveTo(-w * 0.55, L * 0.05, -w, L * 0.058); ctx.quadraticCurveTo(-w * 0.45, -L * 0.002, 0, -L * 0.008); ctx.closePath();
        ctx.restore();
    }
    function blueFlipper(ctx, L, sd, sw) { ctx.save(); ctx.translate(sd * L * 0.05 + _bwx(-0.22) * L, -L * 0.22); ctx.rotate(-sd * (0.95 + sw)); const fl = L * 0.14, wd = L * 0.016;
        ctx.beginPath(); ctx.moveTo(-wd, 0); ctx.quadraticCurveTo(-wd * 0.8, fl * 0.6, 0, fl); ctx.quadraticCurveTo(wd * 0.6, fl * 0.5, wd, 0); ctx.closePath(); ctx.restore(); }
    function drawBlueWhale(ctx, m) {
        if (!onCam(m.x, m.y, m.len)) return;
        const L = m.len, tint = waterTint(), under = m.mode === 'under', lunge = m.lunge || 0;
        // THE STROKE (references): slow up-and-down beats of the flukes, ~5.5 s each — seen from above
        // the flukes foreshorten as they angle through the stroke and lie flat at the top and bottom;
        // up near the surface they are nearer and clearer, down they sink into the blue. The body
        // barely bends sideways at all (a little into a turn).
        const phs = m.ph * (Math.PI * 2 / 5.5) + m.j * 1.7, stroke = Math.sin(phs);
        _BW = { bend: 0.006 * Math.sin(phs + 0.8) + 0.04 * Math.max(-1, Math.min(1, m.turn * 6)), fore: m.mode === 'dive' ? 1 : 0.62 + 0.38 * Math.abs(stroke), up: stroke };
        const sw = 0.2 * Math.sin(m.ph * 0.7 + m.j);
        const depth = under ? m.depth : 0.3;
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h);
        const mottles = (a) => { ctx.save(); blueShape(ctx, L); ctx.clip();
            // fine dapple across the back
            for (const [u, v, r, light] of m.mott) { const w = BLUE_PROFILE.reduce((a2, q) => q[0] <= u ? q[1] : a2, 0.01); ctx.fillStyle = light ? `rgba(238,242,248,${0.7 * a})` : `rgba(80,92,112,${0.45 * a})`; ctx.beginPath(); ctx.ellipse((_bwx(u) + v * w) * L, u * L, r * L, r * L * 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
            // the pale ridge of the back catching the light, head to tail stock, and the rostrum ridge to the blowholes
            ctx.strokeStyle = `rgba(236,241,247,${0.45 * a})`; ctx.lineCap = 'round'; ctx.lineWidth = L * 0.006;
            ctx.beginPath(); for (let u = -0.3; u <= 0.36; u += 0.03) ctx.lineTo(_bwx(u) * L, u * L); ctx.stroke();
            ctx.lineWidth = L * 0.003; ctx.beginPath(); ctx.moveTo(0, -L * 0.49); ctx.lineTo(0, -L * 0.34); ctx.stroke();
            // the snout a shade paler
            ctx.fillStyle = `rgba(230,234,240,${0.3 * a})`; ctx.beginPath(); ctx.ellipse(0, -L * 0.47, L * 0.03, L * 0.03, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore(); };
        // under the water: pale and glowing, the head a little darker, the flippers paler still
        for (const sd of [-1, 1]) { ctx.fillStyle = BLUE.fin; blueFlipper(ctx, L, sd, sw); ctx.fill(); }
        ctx.fillStyle = BLUE.under; blueShape(ctx, L); ctx.fill();
        // rounded: the sunlit ridge of the back pale, the flanks curving down into the blue on either side
        { ctx.save(); blueShape(ctx, L); ctx.clip(); const gw = L * 0.055, g = ctx.createLinearGradient(-gw, 0, gw, 0);
          g.addColorStop(0, 'rgba(40,78,110,0.55)'); g.addColorStop(0.3, 'rgba(60,95,125,0.12)'); g.addColorStop(0.5, 'rgba(235,240,246,0.18)'); g.addColorStop(0.7, 'rgba(60,95,125,0.12)'); g.addColorStop(1, 'rgba(40,78,110,0.55)');
          ctx.fillStyle = g; ctx.fillRect(-gw, -L * 0.5, gw * 2, L); ctx.restore(); }
        mottles(0.8);
        ctx.fillStyle = BLUE.fluke; blueFlukes(ctx, L); ctx.fill();
        ctx.globalAlpha = 0.3 + depth * 0.55; ctx.fillStyle = `rgb(${tint})`; blueShape(ctx, L); ctx.fill(); for (const sd of [-1, 1]) { blueFlipper(ctx, L, sd, sw); ctx.fill(); }
        // the flukes: veiled more on the downstroke, less at the top of the upstroke; their pale
        // undersides catch the light as they turn over at the top
        ctx.globalAlpha = Math.max(0.12, 0.3 + depth * 0.55 - 0.25 * (_BW.up || 0)); blueFlukes(ctx, L); ctx.fill();
        if ((_BW.up || 0) > 0.7) { ctx.globalAlpha = ((_BW.up - 0.7) / 0.3) * 0.35 * (1 - depth); ctx.fillStyle = '#e4f3f5'; blueFlukes(ctx, L); ctx.fill(); }
        ctx.globalAlpha = 1;
        if (lunge > 0.01) { drawBlueLunge(ctx, m, L, mottles); ctx.restore(); return; }
        // THE ROLL: head, splash guard and blowholes first; then the back goes on and on; the tiny
        // dorsal shows only at the very end, just before it slips under
        const p = (m.mode === 'surface' && m.rollT < 4.5) ? m.rollT / 4.5 : m.mode === 'dive' ? 0.45 + (1 - m.t / 6) * 0.55 : 2;
        if (p >= 0 && p <= 1) {
            const c = -L * 0.44 + p * L * 0.72, half = L * 0.2 * Math.sin(Math.PI * Math.min(1, p * 1.1 + 0.06)), wx = L * 0.056;
            for (const [kx, ky, a] of [[1.35, 1.25, 0.35], [1, 1, 0.6], [0.65, 0.75, 1]]) {
                ctx.save(); ctx.beginPath(); ctx.ellipse(0, c, wx * kx, half * ky, 0, 0, Math.PI * 2); ctx.clip(); ctx.globalAlpha = a; ctx.fillStyle = BLUE.wet; blueShape(ctx, L); ctx.fill(); mottles(0.9); ctx.restore();
            }
            ctx.globalAlpha = 1;
            ctx.save(); ctx.beginPath(); ctx.ellipse(0, c, wx * 0.9, half * 0.9, 0, 0, Math.PI * 2); ctx.clip();
            ctx.fillStyle = 'rgba(210,225,232,0.14)'; ctx.fillRect(-wx * 0.25, c - half, wx * 0.5, 2 * half);
            ctx.fillStyle = BLUE.guard; ctx.beginPath(); ctx.ellipse(0, -L * 0.345, L * 0.02, L * 0.014, 0, 0, Math.PI * 2); ctx.fill();   // the pale raised splash guard
            // the blowholes: a black V, the two slits closing toward the snout
            ctx.strokeStyle = '#141a20'; ctx.lineWidth = L * 0.0045; ctx.lineCap = 'round';
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * L * 0.003, -L * 0.332); ctx.lineTo(sd * L * 0.011, -L * 0.316); ctx.stroke(); }
            ctx.fillStyle = BLUE.dark; ctx.beginPath(); ctx.moveTo(-L * 0.005, L * 0.2); ctx.lineTo(0, L * 0.225); ctx.lineTo(L * 0.005, L * 0.2); ctx.closePath(); ctx.fill();   // the tiny dorsal
            ctx.restore();
            ctx.lineCap = 'round';
            // white water heaped at the front of the rising back and streaming off its sides — one connected sheet
            if (half > L * 0.04) { const fw = ctx.createRadialGradient(0, c - half * 0.95, 0, 0, c - half * 0.95, wx * 1.4); fw.addColorStop(0, 'rgba(255,255,255,0.6)'); fw.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = fw; ctx.beginPath(); ctx.ellipse(0, c - half * 0.9, wx * 1.4, half * 0.35, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, c, wx * 1.12, half * 1.02, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
            if (half > L * 0.04) for (const sd of [-1, 1]) for (let q = 0; q < 3; q++) { const x0 = sd * wx * (0.95 + q * 0.12), y0 = c - half * (0.55 - q * 0.25); ctx.strokeStyle = `rgba(255,255,255,${0.5 - q * 0.12})`; ctx.lineWidth = 1.2 - q * 0.2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + sd * 3, y0 + half * 0.6, x0 + sd * 1.5, y0 + half * 1.1); ctx.stroke(); }
        }
        const fl = m.fluke || 0;
        if (fl > 0.05) {
            _BW.fore = 1;
            ctx.save(); ctx.globalAlpha = 0.3 * fl; ctx.fillStyle = 'rgb(10,25,40)'; ctx.translate(L * 0.05 * fl, L * 0.1 * fl); blueFlukes(ctx, L); ctx.fill(); ctx.restore();
            ctx.save(); ctx.translate(0, L * 0.4); ctx.scale(1, 1 - fl * 0.5); ctx.translate(0, -L * 0.4); ctx.globalAlpha = 1; ctx.fillStyle = BLUE.fluke; blueFlukes(ctx, L); ctx.fill(); ctx.restore();
        }
        ctx.restore();
    }
    // THE LUNGE, drawn in the whale's frame over its underwater body: the front half is out of the water
    // (crisp, wet, dark) in proportion to the roll; the pale ventral pleats come into view on the side it
    // rolls toward and the dark back slides away from it; the top-side flipper lifts clear into the air;
    // the jaws gape (dark baleen in the gap) and the throat pouch balloons out sideways; white water
    // sheets off the head and along the pouch; krill spills round the mouth.
    function drawBlueLunge(ctx, m, L, mottles) {
        const sd = m.sd, r = m.roll || 0, g = m.gape || 0, p = m.pouch || 0, W0 = L * 0.053;
        // the front half out of the water — its waterline soft: the wet body fades back into the veil
        for (const [cut, a] of [[0.16, 0.25], [0.09, 0.45]]) { ctx.save(); ctx.beginPath(); ctx.rect(-L, -L * 0.6, 2 * L, L * (0.6 + cut)); ctx.clip(); ctx.globalAlpha = Math.min(1, r * 1.6) * a; ctx.fillStyle = BLUE.wet; blueShape(ctx, L); ctx.fill(); ctx.restore(); }
        ctx.save(); ctx.beginPath(); ctx.rect(-L, -L * 0.6, 2 * L, L * 0.62); ctx.clip();
        ctx.globalAlpha = Math.min(1, r * 1.6);
        ctx.fillStyle = BLUE.wet; blueShape(ctx, L); ctx.fill(); mottles(0.8);
        // rolling: the pale belly and its long grooves come round on the side it rolls to
        ctx.save(); blueShape(ctx, L); ctx.clip();
        // the belly as a lens hugging the body's own outline on that side, widening as it rolls, fading out
        // toward the tail where it is still under the water
        const bk = 0.85 * r;
        const belly = () => { ctx.save(); ctx.translate(sd * W0 * (1 - bk), 0); ctx.scale(bk, 1); blueShape(ctx, L); ctx.restore(); };
        const bg = ctx.createLinearGradient(0, -L * 0.5, 0, L * 0.05); bg.addColorStop(0, '#e2e1db'); bg.addColorStop(0.75, '#d6d7d2'); bg.addColorStop(1, 'rgba(214,215,210,0)');
        ctx.fillStyle = bg; belly(); ctx.fill();
        ctx.save(); belly(); ctx.clip(); ctx.strokeStyle = 'rgba(140,130,125,0.5)'; ctx.lineWidth = 0.7;
        for (let k = 1; k < 7; k++) { const f = k / 7; ctx.save(); ctx.translate(sd * W0 * (1 - bk * f), 0); ctx.scale(bk * f, 1); ctx.beginPath(); for (let u = -0.47; u <= 0; u += 0.03) { const w = BLUE_PROFILE.reduce((a2, q) => q[0] <= u ? q[1] : a2, 0.02); ctx.lineTo(-sd * w * L, u * L); } ctx.restore(); ctx.stroke(); }
        ctx.restore();
        ctx.restore();
        ctx.restore();
        ctx.globalAlpha = 1;
        // the upper flipper, lifted clear on the side away from the roll: pale, with its shadow on the sea
        if (r > 0.2) { const fl = (r - 0.2) / 0.8;
            ctx.save(); ctx.globalAlpha = 0.3 * fl; ctx.fillStyle = 'rgb(10,25,40)'; ctx.translate(L * 0.03 * fl, L * 0.05 * fl); blueFlipper(ctx, L, -sd, -0.5 * fl); ctx.fill(); ctx.restore();
            ctx.fillStyle = `rgba(214,226,230,${fl})`; blueFlipper(ctx, L, -sd, -0.5 * fl); ctx.fill(); }
        // the pouch: ballooning out past the flank on the rolled side, pleated, pinkish cream
        if (p > 0.02) {
            const pw = L * 0.1 * p * (0.4 + 0.6 * r);
            const pouch = () => { ctx.beginPath(); ctx.moveTo(sd * W0 * 0.6, -L * 0.47); ctx.bezierCurveTo(sd * (W0 + pw), -L * 0.45, sd * (W0 + pw * 1.05), -L * 0.22, sd * W0 * 0.8, -L * 0.09); ctx.lineTo(sd * W0 * 0.3, -L * 0.12); ctx.lineTo(sd * W0 * 0.3, -L * 0.44); ctx.closePath(); };
            ctx.fillStyle = 'rgba(10,25,40,0.2)'; ctx.save(); ctx.translate(5, 8); pouch(); ctx.fill(); ctx.restore();
            ctx.fillStyle = BLUE.pleat; pouch(); ctx.fill();
            ctx.save(); pouch(); ctx.clip(); ctx.strokeStyle = 'rgba(160,125,118,0.55)'; ctx.lineWidth = 0.8;
            for (let k = 0; k < 9; k++) { const f = k / 8; ctx.beginPath(); ctx.moveTo(sd * W0 * 0.6, -L * 0.47); ctx.bezierCurveTo(sd * (W0 * 0.5 + (pw + W0 * 0.5) * f), -L * 0.44, sd * (W0 * 0.5 + (pw + W0 * 0.5) * f), -L * 0.22, sd * W0 * 0.7, -L * 0.1); ctx.stroke(); }
            ctx.restore(); ctx.strokeStyle = SOFT; ctx.lineWidth = 0.6; pouch(); ctx.stroke();
            m._pw = pw;
        } else m._pw = 0;
        // the gape: the upper jaw lifts off the lower, dark baleen showing along the gap
        if (g > 0.02) { ctx.fillStyle = '#23282c'; ctx.beginPath(); ctx.moveTo(0, -L * 0.5); ctx.quadraticCurveTo(sd * W0 * (0.4 + 0.8 * g * r), -L * 0.44, sd * W0 * (0.3 + 0.5 * g), -L * 0.33); ctx.lineTo(sd * W0 * 0.15, -L * 0.33); ctx.quadraticCurveTo(sd * W0 * 0.1, -L * 0.45, 0, -L * 0.5); ctx.fill();
            ctx.fillStyle = `rgba(205,80,62,${0.55 * g})`; for (let q = 0; q < 30; q++) { const a = q * 2.3, rr = L * (0.03 + (q % 6) * 0.012); ctx.beginPath(); ctx.arc(Math.cos(a) * rr + sd * W0 * 0.6, -L * 0.44 + Math.sin(a) * rr, 1.3, 0, Math.PI * 2); ctx.fill(); } }
        ctx.restore();
        // white water at the head and sheeting along the pouch, growing with the roll
        const k = r * 0.6 + p * 0.4, ch = Math.cos(m.h), sh = Math.sin(m.h);
        const hx = m.x + sh * L * 0.46, hy = m.y - ch * L * 0.46;
        if (k > 0.05) whiteWater(ctx, hx, hy, L * 0.06 * (0.5 + k), 0.25 + 0.4 * k, m.j + 3);
        if (p > 0.1) { const off = W0 + (m._pw || 0) * 0.9, px = m.x + sh * L * 0.28 + ch * sd * off, py = m.y - ch * L * 0.28 + sh * sd * off; whiteWater(ctx, px, py, L * 0.045 * p, 0.3 * p, m.j + 7); }
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h);
    }
    // A blue whale's blow (references: the tallest, straightest blow of any whale — a slim column up
    // to 9-12 m, seen from far off). From straight above a column is seen end-on: an explosive bright
    // burst at the blowholes, then a dense white core with the mist spreading out over it and leaning
    // off downwind in a lumpy cloud as it thins; its HEIGHT shows in the long soft shadow the column
    // throws across the sea, down and to the right; and a fine fall-out of mist whitens the water
    // under the drift. The core rides on with the whale for a moment (the blow leaves it moving).
    function drawBlueBlow(ctx, B) {
        const t = B.t, s = B.s || 1, k = Math.min(1, t / 6), sd = B.seed || 0;
        const w = state.wind || { direction: 0 }, dx = -Math.sin(w.direction), dy = Math.cos(w.direction);
        const carry = Math.min(t, 0.8);
        const bx = B.x + (B.vx || 0) * carry * 0.5, by = B.y + (B.vy || 0) * carry * 0.5;
        const soft = (x, y, r, a, col) => { if (a <= 0.005 || r <= 0) return; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.55, `rgba(${col},${a * 0.55})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
        // the column's shadow: long, soft, down-right from the base; it grows as the column rises and fades with it
        const rise = Math.min(1, t / 0.6), sh = (1 - Math.min(1, t / 3.2)) * rise;
        if (sh > 0.01) { const L = 150 * s * rise, ux = 0.54, uy = 0.84;
            ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.atan2(uy, ux));
            const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, `rgba(10,25,40,${0.16 * sh})`); g.addColorStop(1, 'rgba(10,25,40,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -7 * s); ctx.quadraticCurveTo(L * 0.6, -16 * s, L, -4 * s); ctx.lineTo(L, 4 * s); ctx.quadraticCurveTo(L * 0.6, 16 * s, 0, 7 * s); ctx.closePath(); ctx.fill(); ctx.restore(); }
        // fall-out: a faint pale patch on the water under the drifting mist
        if (t > 0.8) { const f = Math.min(1, (t - 0.8) / 1.2) * (1 - k); soft(bx + dx * 55 * s * k, by + dy * 55 * s * k, 60 * s * (0.6 + k), 0.12 * f, '225,240,244'); }
        // the burst: in the first quarter-second a sharp bright core and torn spray thrown up round it
        if (t < 0.5) { const b = t / 0.5; soft(bx, by, (12 + 28 * b) * s, 0.95 * (1 - b * 0.4), '255,255,255');
            ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - b)})`;
            for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + sd, r = (10 + 22 * b) * s * (0.8 + 0.3 * Math.abs(Math.sin(i * 3.1 + sd))); ctx.beginPath(); ctx.ellipse(bx + Math.cos(a) * r, by + Math.sin(a) * r, 3.2 * s, 1.4 * s, a, 0, Math.PI * 2); ctx.fill(); } }
        // the mist: a dense core that thins, and lumps of cloud spreading and leaning off downwind
        const a0 = 0.95 * Math.pow(1 - k, 1.6);
        soft(bx + dx * 12 * s * k, by + dy * 12 * s * k, (22 + 18 * Math.min(1, t / 1.2)) * s, a0 * Math.max(0, 1 - t / 2.6) + a0 * 0.3, '252,253,254');
        for (let i = 0; i < 6; i++) {
            const f = (i + 1) / 6, j = Math.sin(i * 12.9 + sd * 3.3), jj = Math.cos(i * 7.7 + sd);
            const d = (20 + 120 * f) * s * Math.min(1, t / 3) + 10 * s * f;
            const r = (24 + 42 * f + 26 * k) * s * (0.8 + 0.25 * j);
            soft(bx + dx * d + (-dy) * jj * 14 * s * f, by + dy * d + dx * jj * 14 * s * f, r, a0 * (0.8 - 0.45 * f) * Math.min(1, t / 0.5), '246,249,251');
        }
    }
    function drawKrill(ctx, K) {
        if (!onCam(K.x, K.y, 200)) return;
        const ka = K.fade * (1 - K.eat * 0.9); if (ka < 0.02) return;
        ctx.save(); ctx.globalAlpha *= ka;
        // a red surface swarm: a patchy stain on the water, the krill themselves as flecks
        const g = ctx.createRadialGradient(K.x, K.y, 0, K.x, K.y, K.r);
        g.addColorStop(0, 'rgba(255,120,110,0.16)'); g.addColorStop(0.7, 'rgba(255,130,115,0.08)'); g.addColorStop(1, 'rgba(235,120,100,0)');
        ctx.fillStyle = g; ctx.beginPath(); for (let a = 0; a <= 32; a++) { const aa = a / 32 * Math.PI * 2, r = K.r * (0.85 + 0.12 * Math.sin(aa * 3 + K.i) + 0.06 * Math.sin(aa * 7 + K.ph * 0.1)); ctx.lineTo(K.x + Math.cos(aa) * r, K.y + Math.sin(aa) * r * 0.8); } ctx.fill();
        ctx.fillStyle = 'rgba(255,110,95,0.8)'; for (let q = 0; q < 110; q++) { const a = q * 2.39996 + K.ph * 0.05, r = K.r * 0.85 * Math.sqrt((q + 0.5) / 110); ctx.fillRect(K.x + Math.cos(a) * r, K.y + Math.sin(a) * r * 0.8, 1.8, 1.8); }
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
        drawGlow: (ctx, n) => { if (!cfg) return; for (const M of mantas) drawMantaGlow(ctx, M, n);
            // moonlight catching the golden bells near the surface (the bloom otherwise vanishes under the night wash)
            if (jellyBloom) { const cam = state.camera; for (const j of jellyBloom.jel) { if (j.depth > 0.5 || (cam && (Math.abs(j.x - cam.x) > 900 || Math.abs(j.y - cam.y) > 700))) continue;
                const r = 4.6 * j.size * 1.3, g = ctx.createRadialGradient(j.x, j.y, 0, j.x, j.y, r); g.addColorStop(0, `rgba(255,200,110,${0.22 * (1 - j.depth * 1.6) * n})`); g.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(j.x, j.y, r, 0, Math.PI * 2); ctx.fill(); } }
            // a swimming turtle's flipper strokes stir little puffs of light either side
            for (const H of hawksbills) if (H.mode === 'swim') { const st = Math.max(0, Math.sin(H.beat)); if (st < 0.2) continue; for (const sd of [-1, 1]) { const x = H.x + Math.cos(H.h) * sd * 10, y = H.y + Math.sin(H.h) * sd * 10, r = 7, g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(110,230,255,${0.3 * st * n})`); g.addColorStop(1, 'rgba(110,230,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); } }
            // a dugong's slow stroke stirs a faint glow along its flanks
            for (const G of dugongs) { const r = G.len * 0.55, g = ctx.createRadialGradient(G.x, G.y, 0, G.x, G.y, r); g.addColorStop(0, `rgba(90,210,230,${0.1 * n})`); g.addColorStop(1, 'rgba(90,210,230,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(G.x, G.y, r * 0.45, r, G.h, 0, Math.PI * 2); ctx.fill(); }
        },
        // The Sailing School's ducklings (school.js owns their motion).
        drawDucklings,
        // For tests and the venue card.
        debug: () => ({ colonies, pods, resident, flight, boil, baskers, divers, waders, cruisers, lurkers, stalkers, perchers, leaps, shoals, poppers, fishers, runs, soarers, rompers, whalePods, blows, splashes, riders, flyfish, gliders, prints, flyPatches, stripers, condors, bands, coyotes, boilsHit, orcaPods, penguinColonies: colonies2, floeGroups, swimmers, treks, lseals, ternFlocks, visited: [...visited], jellyBloom, mantas, foxFlocks, hawksbills, dugongs, blood, foams, seaOtterRafts, slHauls, slGroups, whites, bluePods, blueBlows, krill, huntCool, woken: [...lurkWoken], feats: [...feats] }),
        forceBoil: (x, y) => { boil = { x, y, t: 0, life: 45, seed: 1 }; if (flight) flight.mode = 'transit'; },
        // The drawing functions, for a look-bench (eval/_wildlife_bench.js) — not used by the game.
        art: { drawBoilAt: (ctx, x, y, t) => { const o = boil, oT = T; boil = { x, y, t: 10, life: 60, seed: 3 }; T = t; drawBoil(ctx); boil = o; T = oT; }, drawGullFlying, drawGullPerched, drawPelicanFlying, drawPelicanSitting, drawPorpoise,
               drawTurtle, drawTurtleUnder, drawGrebe, drawLoon, drawBeaver, drawMoose, drawSlap, drawWakeTrail, drawDuckling, drawDucklings,
               drawCruiser, seaTurtleShape, eagleRayShape, reefSharkShape, drawGator, drawEgret, drawAnhinga, drawFrog, drawLeap, drawShoal, drawSeal, drawSealHead, drawSealUnder, drawBear, drawSockeye, drawEagle, drawOtter, drawWhale, drawBlow, drawSplash, drawSpinner, drawFlyfish, drawAlbatross, drawPrint, drawMahi, setT: (t) => { T = t; }, drawStriperBoil, drawStriper, drawCondor, drawBighorn, drawCoyote, drawOrca, drawSwimmers, drawLeopardSeal, drawTern, drawTreks, PENG: () => PENG, drawGoldJelly, drawManta, drawFlyingFox, drawHawksbill, drawTurtleTracks, drawDugong, drawArcticSprite, arcticImg, drawSeaOtter, drawSeaOtterPup, drawSeaLion, drawWhiteShark, drawBlueWhale, drawBlueBlow, drawKrill },
        // Otter Point: set a shark hunting a given sea lion group now (probes and the bench)
        forceHunt: (wi, gi) => { const W = whites[wi], G = slGroups[gi]; if (!W || !G) return false; const q = G.members.find(m => !m.gone); W.mode = 'stalk'; W.t = 7; W.target = { G, q }; W.x = q.x - 300; W.y = q.y; return true; },
    };
})();

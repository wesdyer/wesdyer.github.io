// regatta/js/sim/course.js — the course itself: route DSL (window.Course),
// mark bodies and orientation, initCourse, buildCoursePaths (nav grid +
// pressure scan + DMC ruler), repositionBoats, and harbor-traffic lifecycle.
// Classic script; global scope. Extracted verbatim from script.js (2026-08-24).
function trafficClock() {
    const r = state.race;
    if (!r) return -Infinity;
    // The timer counts DOWN to the gun and UP after it, so seconds-from-the-gun is one
    // sign flip. Authoring against the GUN rather than against load is what makes a spawn
    // time mean the same thing however long the player sits around before starting.
    return (r.status === 'racing' || r.status === 'finished') ? r.timer : -r.timer;
}

function initTraffic() {
    state.traffic = [];
    const list = state.course && state.course.doc && state.course.doc.traffic;
    if (!list || !list.length || !window.Traffic) return;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    for (const e of list) {
        const path = window.Traffic.compilePath(e);
        if (!path || !(path.duration > 0)) continue;
        const kind = reg[e.kind] || {};
        const scale = e.scale || 1;
        const w = (kind.world || 40) * scale;
        // The oblong the hull really is, off the kind's measured `hull` — the entry may
        // override it, and a kind without one falls back to a slim default rather than
        // pretending the sprite's square frame is the boat.
        // THE WAKE COMES FROM THE KIND. A hull throws what its shape throws, wherever it is
        // sailing and whatever the schedule says — the same contract `hull` and `srcBox`
        // carry. Nothing in the document overrides it.
        const wk = kind.wake || {};
        const wake = {
            style: wk.kind || 'kelvin',
            hulls: Array.isArray(wk.hulls) && wk.hulls.length ? wk.hulls : [0],
            symmetric: !!wk.symmetric,
            beamFrac: wk.beam != null ? wk.beam : null
        };
        const hull = e.hull || kind.hull || [0.9, 0.3];
        const hullLen = (hull.along != null ? hull.along : hull[0]) * w;
        const hullBeam = (hull.beam != null ? hull.beam : hull[1]) * w;
        // HOW FAR THE LEE REACHES. Authored in units, or derived through the SAME rule
        // islands use — ten times the height of the thing casting it — rather than a second
        // invented one. A vessel authors no height, so the default takes its beam as a
        // stand-in for the stack it carries: a 720u container ship is 38 m across the deck
        // and stands roughly that much above the water, which is the figure the rule wants.
        const heightM = e.height != null ? e.height : (hullBeam / M_TO_U);
        const shadowLen = e.windShadow != null ? e.windShadow
                                               : heightM * SHADOW_HEIGHTS * M_TO_U;
        state.traffic.push({
            id: e.id, kind: e.kind, path, doc: e,
            scale,
            hullLen, hullBeam, shadowLen, windDir: 0, wake,
            // Each wake's own offset from the centreline and its own width, in units.
            wakeHulls: wake.hulls.map(o => o * w),
            wakeBeam: (wake.beamFrac != null ? wake.beamFrac * w : hullBeam),
            end: e.end || 'despawn',
            firstSpawn: isFinite(e.firstSpawn) ? e.firstSpawn : 0,
            respawn: !!e.respawn,
            respawnDelay: isFinite(e.respawnDelay) ? e.respawnDelay : 60,
            active: false, x: 0, y: 0, heading: 0, speed: 0, knots: 0, t: 0
        });
    }
}

function updateTraffic() {
    const list = state.traffic;
    if (!list || !list.length) return;
    const now = trafficClock();
    for (const v of list) {
        // ONE COPY OF THE RULE, in js/traffic.js, because the editor's scrubber has to answer
        // the same question — and a preview that disagreed with the race about when a ship is
        // on the water would be worse than no preview at all.
        const at = window.Traffic.localTime(v.doc, v.path, now);
        if (!at) { v.active = false; v.speed = 0; v.knots = 0; continue; }
        const local = at.t, reverse = at.reverse;
        const p = v.path.at(local);
        v.active = true;
        v.x = p.x; v.y = p.y;
        v.heading = reverse ? p.heading + Math.PI : p.heading;
        v.speed = p.speed; v.knots = p.knots; v.t = local; v.s = p.s; v.reverse = reverse;
        v.astern = !!p.astern;
        // THE WIND AT THE VESSEL, sampled ONCE a frame. shadowAt needs it to gate the lee
        // against the local breeze, and shadowAt is called for every boat and every sample
        // of the wind overlay — sampling the field in there would multiply one lookup by
        // hundreds. An island answers this from a cache keyed on its centroid because it
        // never moves; a ship has to be told each frame, and this is the frame.
        v.windDir = (typeof regionWindAt === 'function') ? regionWindAt(p.x, p.y).direction
                                                        : (state.wind ? state.wind.direction : 0);
    }
    checkBowCrossing(list);
}

// CROSSING A SHIP'S BOW — Lighthouse Cove's mechanic objective (Wake, the harbour porpoise):
// pass across a moving cargo ship's track within 3 boat lengths ahead of its bow. Judged in
// the ship's own frame: the player's side of its centreline is remembered each frame, and a
// change of side with the player between the bow and 3 lengths ahead of it is a crossing.
// Read-only — it announces a feat and changes nothing (the per-ship memory lives here, not on
// the boat or the vessel, both of which the golden traces hash).
const BOW_CROSS_LENGTHS = 3, BOW_CROSS_HULL = 55;   // rules.js HULL_LENGTH

// THROUGH THE GLASS — Stillwater Lake's mechanic objective (Diver, the loon). Mark 3 sits
// inside the NW calm (wind region 'wind-shore-bay', 2 kn). One pass = entering the region's
// polygon to leaving it; the feat is a pass that includes the mark-3 rounding with the
// player's boat speed never below GLASS_MIN_KN. Measured Sep 25 2026 (eval/_lake_glass.js):
// the fleet's minimum through the calm runs 0.7-4.9 kn, the autopilot's 3.4-4.3 — so 2 kn
// (the first idea) came free with any finish, and 4.5 asks for a clean, fast rounding.
// Read-only; the pass memory lives here, never on the boat (golden traces hash raceState).
const GLASS = { lake: { region: 'wind-shore-bay', mark: 'mark-3', minKn: 4.5, feat: 'lake:glass' } };
let _glass = null;
function checkGlassPass() {
    const g = state.course && GLASS[state.course.venueKey];
    const me = state.boats && state.boats[0];
    if (!g || !me || !me.isPlayer || state.race.status !== 'racing' || me.raceState.finished) { _glass = null; return; }
    if (!_glass || _glass.doc !== state.course.doc) {
        const d = state.course.doc || (window.VenueDoc && VenueDoc.get(state.course.venueKey));
        const reg = d && d.wind && (d.wind.regions || []).find(r => r.id === g.region);
        if (!reg) return;
        const ri = (d.course.route || []).findIndex(e => e.markId === g.mark);
        _glass = { doc: state.course.doc, poly: reg.poly.map(q => ({ x: q[0] !== undefined ? q[0] : q.x, y: q[1] !== undefined ? q[1] : q.y })),
                   legAfter: ri, inside: false, min: 99, legIn: 0 };
    }
    const G = _glass, rs = me.raceState;
    const inside = pointInPoly(me.x, me.y, G.poly);
    if (inside) {
        if (!G.inside) { G.inside = true; G.min = 99; G.legIn = rs.leg; }
        G.min = Math.min(G.min, me.speed / 0.25);
    } else if (G.inside) {
        G.inside = false;
        // The mark was rounded during this pass: the leg count moved past it while inside.
        const rounded = G.legAfter > 0 && G.legIn < G.legAfter + 1 && rs.leg >= G.legAfter + 1;
        if (rounded && G.min >= g.minKn && typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: g.feat, min: G.min });
    }
}
// RIDE THE CELL — Pearl Lagoon's mechanic objective (Nimbus, the spotted eagle ray). Stay
// on a squall's gust front (squallZoneAt === 'front', wind.js) for RIDE_SECS in a row. Wes set
// the squalls 25% larger and 50% slower on Sep 25 2026 so a front can be sat on; measured then
// (eval/_lagoon_squall.js, 6 seeds): the autopilot's longest ride is 1.6–15.5 s, typically 4,
// and ~10% of the fleet's boat-races pass 15 s by accident — Wes's call: 15 s. Timed on the
// sim clock; the ride memory lives here, never on the boat (golden traces hash raceState).
const SQUALL_RIDE = { lagoon: { secs: 15, feat: 'lagoon:squall-ride' } };
let _ride = null;
function checkSquallRide() {
    const g = state.course && SQUALL_RIDE[state.course.venueKey];
    const me = state.boats && state.boats[0];
    if (!g || !me || !me.isPlayer || state.race.status !== 'racing' || me.raceState.finished
        || typeof squallZoneAt !== 'function') { _ride = null; return; }
    if (!_ride || state.time < _ride.last) _ride = { since: null, paid: false, last: state.time };
    _ride.last = state.time;
    if (squallZoneAt(me.x, me.y) !== 'front') { _ride.since = null; return; }
    if (_ride.since === null) _ride.since = state.time;
    if (!_ride.paid && state.time - _ride.since >= g.secs && typeof GameEvents !== 'undefined') {
        _ride.paid = true;
        GameEvents.emit('player-feat', { id: g.feat, secs: state.time - _ride.since });
    }
}

// LANDFALL — Pearl Lagoon's explorer objective (Ribbon, the sea krait: the reef snake that
// comes ashore on sand cays). Sail round the lagoon side of the cay, reef to reef: the
// player's bearing from its centre must sweep `sweep` degrees, either way, without straying
// beyond `r` of it (straying resets the count: one deliberate rounding, not a season of
// passing by). The cay is a motu on the atoll rim — the southern barrier reef (shape-4) closes
// its far side, so a full loop cannot be sailed; measured (eval/_lagoon_ring_probe.js) the open
// water hugging it spans ~250-280 degrees at 430-490 u, ~200 at 600-850. A straight pass at
// ring distance sweeps at most ~115 degrees, and the course passes ~1000 u off, outside `r`.
// Wes chose shape-5 over shape-20 (abeam of the leeward mark, a reach out and a reach home,
// where shape-20 sits dead downwind with a 1000-unit beat back) and reef-to-reef over moving
// to a free-standing cay (Sep 25 2026).
const LANDFALL = { lagoon: { shape: 'shape-5', r: 800, sweep: 200, feat: 'lagoon:landfall' } };
let _landfall = null;
function checkLandfall() {
    const g = state.course && LANDFALL[state.course.venueKey];
    const me = state.boats && state.boats[0];
    if (!g || !me || !me.isPlayer || state.race.status !== 'racing' || me.raceState.finished) { _landfall = null; return; }
    if (!_landfall || _landfall.course !== state.course) {
        const isl = (state.course.islands || []).find(s => s.id === g.shape);
        if (!isl) return;
        let cx = 0, cy = 0; for (const v of isl.vertices) { cx += v.x; cy += v.y; }
        _landfall = { course: state.course, cx: cx / isl.vertices.length, cy: cy / isl.vertices.length, a: null, sum: 0, paid: false };
    }
    const L = _landfall;
    if (L.paid) return;
    const dx = me.x - L.cx, dy = me.y - L.cy;
    if (Math.hypot(dx, dy) > g.r) { L.a = null; L.sum = 0; return; }
    const a = Math.atan2(dy, dx);
    if (L.a !== null) L.sum += normalizeAngle(a - L.a);
    L.a = a;
    if (Math.abs(L.sum) >= g.sweep * Math.PI / 180 && typeof GameEvents !== 'undefined') {
        L.paid = true;
        GameEvents.emit('player-feat', { id: g.feat });
    }
}
// KNOW THE BAYOU — Gatorgrass Bayou's mechanic objective (Croak, the bullfrog). The bayou
// is a maze: four passages lead from the start to the windward gate, and every way through
// crosses exactly one of these gate lines — each drawn wall to wall across its passage's
// narrowest gap (mud is the only wall; weed and mud bars are sailable). Found and verified by
// eval/_swamp_gates.py (re-run it if the ridges are edited). Verified Sep 25 2026 on the grid: with all four blocked the gate cannot be reached, and each alone reconnects
// it; every one of Wes's 15 recorded races and 60 fleet races crosses exactly one.
//   cut      over the mud bar at the elbow, up between the two long central ridges — the
//            whole fleet's way (60 of 60), and the bar is where it grinds
//   east     round the south tip of the long central ridge and up the east channel —
//            Wes's own way (10 of 15, and all his fastest: 2:43-3:04 on this layout)
//   west     up the western basin and across the top — nobody has sailed it
//   longway  round the far south end of the south-eastern ridge — one run, 4:36
// Each crossing emits the passage as a feat VALUE; the last one before the finish is the
// race's route, and unlocks.js adds it to the venue's set in the career. Read-only.
const ROUTE_GATES = { swamp: { feat: 'swamp:route', gates: {
    cut:     { a: { x: -774,  y: 479 },  b: { x: -290,  y: 263 } },
    east:    { a: { x: 343,   y: 1766 }, b: { x: 656,   y: 1224 } },
    west:    { a: { x: -3611, y: 1288 }, b: { x: -2409, y: -366 } },
    longway: { a: { x: 976,   y: 5051 }, b: { x: 802,   y: 2557 } },
} } };
let _route = null;
// ⚠️ PRIVATE ON PURPOSE. This was a top-level `function segCross(p, q, a, b)` until Sep 25
// 2026, and in these classic scripts a top-level function is a GLOBAL: it silently replaced
// collision.js's own segCross(ax, ay, bx, by, cx, cy, dx, dy) — the crossing test behind every
// point-in-shape check — and boats hit phantom walls everywhere (Sockeye Run's golden traces
// went from 8 finishers to 0, Lake and Redrock lost most of theirs). Never add a top-level
// helper with a generic name here; check `grep -rn "function NAME" js` first.
function _routeGateCrossed(p, q, a, b) {
    const o = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return (o(a, b, p) > 0) !== (o(a, b, q) > 0) && (o(p, q, a) > 0) !== (o(p, q, b) > 0);
}
function checkSwampRoute() {
    const g = state.course && ROUTE_GATES[state.course.venueKey];
    const me = state.boats && state.boats[0];
    if (!g || !me || !me.isPlayer || state.race.status !== 'racing' || me.raceState.finished) { _route = null; return; }
    const here = { x: me.x, y: me.y };
    if (_route && Math.hypot(here.x - _route.x, here.y - _route.y) < 400) {
        for (const [name, gate] of Object.entries(g.gates)) {
            if (_routeGateCrossed(_route, here, gate.a, gate.b) && typeof GameEvents !== 'undefined') {
                GameEvents.emit('player-feat', { id: g.feat, value: name });
            }
        }
    }
    _route = here;
}
// SOCKEYE RUN — two objectives on the run home (the last leg, gate-1 down the gorge to the
// finish gate). Designed Sep 25 2026 from Wes's races against the fleet's (eval/_river_gorge.js):
//   river:scraped  the player touched a rock, a log or the bank on the run home. Snag's
//                  "Run the Gorge Clean" is a finish WITHOUT it. The rapids shove the bow
//                  (physics.js RAPIDS_YAW), and the fleet brushes something 48 races in 50;
//                  Wes ran clean in 5 of 9.
//   river:chute    the player went down the chute — the east arm round the finish island,
//                  through rapid R9, past the bear on the gravel bar (Grizzle). The fleet
//                  never takes it (0 of 50); Wes did 6 of 9, and it is ~5 s faster from the
//                  split. The gate runs land to land across the east arm only (island shore
//                  x 5260-5520, east bank from 6480 at y -6150; the west arm is 4780-5260).
const RIVER_RUN = { venue: 'river', chute: { a: { x: 5420, y: -6150 }, b: { x: 6560, y: -6150 } } };
let _riverRun = null;   // { last: {x,y}, chute, scraped } for the race in progress
function _riverOnLastLeg(me) { return me.raceState.leg === ((state.course.route || []).length - 1); }
function checkRiverRun() {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== RIVER_RUN.venue || !me || !me.isPlayer
        || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _riverRun = null; return; }
    if (!_riverRun) _riverRun = { last: null, chute: false, scraped: false };
    const here = { x: me.x, y: me.y };
    if (!_riverRun.chute && _riverRun.last && _riverOnLastLeg(me)
        && _routeGateCrossed(_riverRun.last, here, RIVER_RUN.chute.a, RIVER_RUN.chute.b) && typeof GameEvents !== 'undefined') {
        _riverRun.chute = true;
        GameEvents.emit('player-feat', { id: 'river:chute' });
    }
    _riverRun.last = here;
}
// LIGHTHOUSE COVE — Scoop's "Under the Bridges" (Wes, Sep 26 2026): sail under every bridge in
// the Cove in one race, then finish. A bridge is any placed kind carrying `chartSpan` (the three
// bridge kinds in venuedoc.js), so one Wes adds later joins the set; its gate is the deck's
// centreline, end to end along sprite-up (0.46 of the drawn size each way, the bakes' 92% fill).
// Only the towers are hard, so crossing that line anywhere a hull can reach is passing under.
// Wes's 25 recorded Cove races crossed 0-2, never the north one (580 u past mark 1):
// all three is a deliberate detour.
let _coveBridges = null;   // { key: course, gates: [{id, a, b}], last: {x,y}, under: Set } for the race in progress
function _coveBridgeGates() {
    const doc = state.course && state.course.doc, VD = window.VenueDoc;
    if (!doc || !VD) return [];
    const out = [];
    for (const p of doc.props || []) {
        const K = VD.PROP_KINDS[p.kind];
        if (!K || !K.chartSpan) continue;
        const L = 0.46 * K.world * (p.scale || 1), h = p.heading || 0, ux = Math.sin(h), uy = -Math.cos(h);
        out.push({ id: p.id, a: { x: p.x - ux * L, y: p.y - uy * L }, b: { x: p.x + ux * L, y: p.y + uy * L } });
    }
    return out;
}
function checkCoveBridges() {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== 'bay' || !me || !me.isPlayer
        || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _coveBridges = null; return; }
    if (!_coveBridges || _coveBridges.key !== state.course) _coveBridges = { key: state.course, gates: _coveBridgeGates(), last: null, under: new Set(), done: false };
    const B = _coveBridges, here = { x: me.x, y: me.y };
    if (B.last && !B.done) {
        for (const g of B.gates) {
            if (B.under.has(g.id) || !_routeGateCrossed(B.last, here, g.a, g.b)) continue;
            B.under.add(g.id);
            if (B.gates.length && B.under.size >= B.gates.length) {
                B.done = true;
                if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: 'bay:bridges' });
            }
        }
    }
    B.last = here;
}
if (typeof GameEvents !== 'undefined') GameEvents.on('player-contact', (e) => {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== RIVER_RUN.venue || !me || e.isFloe || !_riverOnLastLeg(me)) return;
    if (!_riverRun) _riverRun = { last: null, chute: false, scraped: false };
    if (_riverRun.scraped) return;
    _riverRun.scraped = true;
    GameEvents.emit('player-feat', { id: 'river:scraped' });
});
// BLUEWATER BONANZA — two objectives on the run home (designed Sep 25 2026, on the swell with
// sets, the crossing wind swell and the cape jet — see js/swell.js):
//   ocean:linked      Finley's "Link the Swells": 15 kn or more for 30 s straight on the run.
//                     A crest dies in ~25 s, so a stretch that long means rides LINKED across
//                     sets and trains. Bots 9% of runs; Wes 34.8 s and 34.0 s (eval/_ocean_objectives.js).
//   ocean:far-island  Mola's "The Far Island": round the offshore island (shape-4, the southern
//                     one) on the run. Pure exploration, +~47 s (eval/_ocean_island.js). The gate
//                     runs from inside the island's hard sand straight south past the arena's
//                     edge, so the only way across it is round the island's south side.
const OCEAN_RUN = { venue: 'ocean', linkKt: 15, linkSecs: 30, island: { a: { x: 3300, y: 7000 }, b: { x: 3300, y: 12500 } } };
let _oceanRun = null;   // { last: {x,y}, t, fast, linked, island } for the race in progress
function checkOceanRun() {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== OCEAN_RUN.venue || !me || !me.isPlayer
        || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _oceanRun = null; return; }
    if (!_oceanRun) _oceanRun = { last: null, t: state.race.timer, fast: 0, linked: false, island: false };
    const O = _oceanRun, here = { x: me.x, y: me.y }, dt = Math.max(0, state.race.timer - O.t);
    O.t = state.race.timer;
    const onRun = me.raceState.leg === ((state.course.route || []).length - 1);
    if (onRun && me.speed * 4 >= OCEAN_RUN.linkKt) O.fast += dt; else O.fast = 0;
    if (!O.linked && O.fast >= OCEAN_RUN.linkSecs && typeof GameEvents !== 'undefined') {
        O.linked = true;
        GameEvents.emit('player-feat', { id: 'ocean:linked' });
    }
    if (!O.island && onRun && O.last && _routeGateCrossed(O.last, here, OCEAN_RUN.island.a, OCEAN_RUN.island.b) && typeof GameEvents !== 'undefined') {
        O.island = true;
        GameEvents.emit('player-feat', { id: 'ocean:far-island' });
    }
    O.last = here;
}
// REDROCK RESERVOIR — the traffic venue (designed Sep 25 2026): every leg crosses the mark-3
// junction and legs 2 and 3 meet head-on in the M6 arm.
//   redrock:gave-way   Sawbill's "Right of Way": value = how many DIFFERENT rivals gave way
//                      to the player in the junction (within hubR of mark 3). A rival gives way
//                      when its own avoidance holds the GIVE_WAY role against the player at
//                      HIGH/IMMINENT risk and turns it more than dev rad off its course for hold
//                      seconds — bot.js's no-contact foul test, seen from the other side. Three
//                      happened once in 80 boat-races by accident (eval/_redrock_giveway.js).
//   redrock:butte      Trek's "Condor Butte": round the north-west butte island (shape-12).
//                      Two gates run out from inside the island — west to beyond the arena
//                      edge, and north — so crossing both means sailing its west AND north
//                      shores: all the way round, either way (eval/_redrock_butte.js).
const REDROCK_RUN = { venue: 'redrock', hubMark: 'mark-3', hubR: 700, dev: 0.35, hold: 0.8,
    butte: { w: { a: { x: -2330, y: -1500 }, b: { x: -3400, y: -1500 } }, n: { a: { x: -2330, y: -1500 }, b: { x: -2330, y: -2700 } } } };
let _redrockRun = null;   // { last, timers: Map(boat id → s), gave: Set(boat id), west, north, butte }
function checkRedrockRun() {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== REDROCK_RUN.venue || !me || !me.isPlayer
        || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _redrockRun = null; return; }
    if (!_redrockRun) _redrockRun = { last: null, timers: new Map(), gave: new Set(), west: false, north: false, butte: false };
    const R = _redrockRun, C = REDROCK_RUN, dt = 1 / 30;
    const hub = (state.course.marks || []).find(m => m.id === C.hubMark);
    const inHub = hub && Math.hypot(me.x - hub.x, me.y - hub.y) < C.hubR;
    for (const rv of state.boats) {
        const c = rv.controller; if (rv === me || !c || rv.raceState.finished) continue;
        const on = c.threatBoat === me && c.avoidanceRole === 'GIVE_WAY' && (c.riskState === 'HIGH' || c.riskState === 'IMMINENT') && c.lastAvoidDeviation > C.dev;
        const v = on ? (R.timers.get(rv.id) || 0) + dt : Math.max(0, (R.timers.get(rv.id) || 0) - dt / 2);
        R.timers.set(rv.id, v);
        if (on && v >= C.hold && inHub && !R.gave.has(rv.id)) {
            R.gave.add(rv.id);
            if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: 'redrock:gave-way', value: R.gave.size });
        }
    }
    const here = { x: me.x, y: me.y };
    if (R.last && !R.butte) {
        if (_routeGateCrossed(R.last, here, C.butte.w.a, C.butte.w.b)) R.west = true;
        if (_routeGateCrossed(R.last, here, C.butte.n.a, C.butte.n.b)) R.north = true;
        if (R.west && R.north) { R.butte = true; if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: 'redrock:butte' }); }
    }
    R.last = here;
}
// GLACIER SOUND — two objectives (designed Sep 25 2026; the wildlife went Antarctic, Wes):
//   arctic:iced   Tiny's "Untouched" is a finish WITHOUT it: any contact with ice — a floe, an
//                 ice island or the glacier shore (style 'ice'; granite does not count). The
//                 fleet finishes floe-free 6 times in 40, Wes 20 in 38 (eval/_arctic_ice.js).
//   arctic:face   Chime's "The Calving Face" (Spike's until Sep 27): within faceR of the north glacier front (props
//                 57-61) — the north-east bay past the rounding island, where no track goes
//                 (closest 1,100 u; a bot's detour costs ~100 s, eval/_arctic_face.js).
const ARCTIC_RUN = { venue: 'arctic', face: ['prop-57', 'prop-58', 'prop-59', 'prop-60', 'prop-61'], faceR: 350 };
let _arcticRun = null;   // { iced, face } for the race in progress
function checkArcticRun() {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== ARCTIC_RUN.venue || !me || !me.isPlayer
        || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _arcticRun = null; return; }
    if (!_arcticRun) _arcticRun = { iced: false, face: false };
    if (_arcticRun.face) return;
    for (const pr of state.course.props || []) {
        if (!ARCTIC_RUN.face.includes(pr.id) || Math.hypot(me.x - pr.x, me.y - pr.y) > ARCTIC_RUN.faceR) continue;
        _arcticRun.face = true;
        if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: 'arctic:face' });
        break;
    }
}
if (typeof GameEvents !== 'undefined') GameEvents.on('player-contact', (e) => {
    if (!state.course || state.course.venueKey !== ARCTIC_RUN.venue || !e || !e.ice) return;
    if (!_arcticRun) _arcticRun = { iced: false, face: false };
    if (_arcticRun.iced) return;
    _arcticRun.iced = true;
    GameEvents.emit('player-feat', { id: 'arctic:iced' });
});
// OTTER POINT (designed Sep 26 2026, Wes) — two objectives on the water:
//   otter:inside   Ruby's "Inside the Kelp Line": the count of the five north-coast kelp beds
//                  (kelp-c1..c5) passed on the INSIDE — through the 320-550 u of water between the
//                  bed and the shore (gates straight south from each bed to the first rock or
//                  land, eval/_otter_kelpgates.js). The fleet runs a kilometre offshore of them.
//   otter:scraped  the player touched rock anywhere in the race (the inside is full of it).
//   otter:tip      the player went round the furthest north-west tip — outside every stack
//                  and islet (west of the blade stacks, then north of the islet) — and
//   otter:arch     ...after that, shot the arch: under the span of the arch point, through the
//                  80-140 u channel between its two halves (Gilt's "Tip and Arch").
const OTTER_RUN = { venue: 'otter',
    inside: [['kelp-c1', -2348, -3199, -2875], ['kelp-c2', -591, -4136, -3746], ['kelp-c3', 1063, -4746, -4200], ['kelp-c4', 2796, -4980, -4626], ['kelp-c5', 4499, -5171, -4685]]
        .map(([id, x, y0, y1]) => ({ id, a: { x, y: y0 }, b: { x, y: y1 } })),
    tipW: { a: { x: -5700, y: -2400 }, b: { x: -7900, y: -2400 } },
    tipN: { a: { x: -4800, y: -3420 }, b: { x: -4800, y: -6700 } },
    arch: { a: { x: -1855, y: -4960 }, b: { x: -1855, y: -4820 } } };
let _otterRun = null;   // { last, inside:Set, scraped, w, n, tip, arch } for the race in progress
function checkOtterRun() {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== OTTER_RUN.venue || !me || !me.isPlayer
        || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _otterRun = null; return; }
    if (!_otterRun) _otterRun = { last: null, inside: new Set(), scraped: false, w: false, n: false, tip: false, arch: false };
    const R = _otterRun, here = { x: me.x, y: me.y }, emit = (id, value) => { if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', value === undefined ? { id } : { id, value }); };
    if (R.last) {
        for (const g of OTTER_RUN.inside) if (!R.inside.has(g.id) && _routeGateCrossed(R.last, here, g.a, g.b)) { R.inside.add(g.id); emit('otter:inside', R.inside.size); }
        if (!R.w && _routeGateCrossed(R.last, here, OTTER_RUN.tipW.a, OTTER_RUN.tipW.b)) R.w = true;
        if (!R.n && _routeGateCrossed(R.last, here, OTTER_RUN.tipN.a, OTTER_RUN.tipN.b)) R.n = true;
        if (!R.tip && R.w && R.n) { R.tip = true; emit('otter:tip'); }
        if (R.tip && !R.arch && _routeGateCrossed(R.last, here, OTTER_RUN.arch.a, OTTER_RUN.arch.b)) { R.arch = true; emit('otter:arch'); }
    }
    R.last = here;
}
if (typeof GameEvents !== 'undefined') GameEvents.on('player-contact', (e) => {
    if (!state.course || state.course.venueKey !== OTTER_RUN.venue || !e || e.isFloe || e.whale) return;
    if (!_otterRun) _otterRun = { last: null, inside: new Set(), scraped: false, w: false, n: false, tip: false, arch: false };
    if (_otterRun.scraped) return;
    _otterRun.scraped = true;
    GameEvents.emit('player-feat', { id: 'otter:scraped' });
});
// EMBERFALL ISLE (designed Sep 26 2026, Wes) — the Explorer rung:
//   volcanic:outer  Vent's "Round the Archipelago": the whole outside loop, outside EVERY island.
//                   A gate on the bearing (from the archipelago's centre) through each island's
//                   outermost point, plus twelve even bearings, each running from the outermost
//                   land on that bearing out to the sailing limit; a race through all of them has
//                   been round everything. Built from the geometry at the start of each race, so
//                   Wes's edits carry it. None of his five races did it (29-38 of 50 gates).
//   (volcanic:dodge, Torch's "Outrun the Bolt", is counted where the bolt lands — js/volcano.js.)
const VOLC_RUN = { venue: 'volcanic', margin: 30 };
let _volcRun = null;   // { gates, hit:Set, last, done } for the race in progress
function _volcOuterGates() {
    const B = state.course.doc && state.course.doc.world && state.course.doc.world.boundary;
    const poly = B && B.poly ? B.poly.map(([x, y]) => ({ x, y })) : null;
    const inB = (x, y) => poly ? pointInPoly(x, y, poly) : Math.hypot(x, y) < ((B && B.circle && B.circle.r) || 8000);
    const hard = (state.course.islands || []).filter(q => !q.awash && q.vertices && q.vertices.length > 2 && VenueDoc.traits(q).hard);
    let cx = 0, cy = 0, n = 0; for (const q of hard) for (const v of q.vertices) { cx += v.x; cy += v.y; n++; } if (!n) return [];
    cx /= n; cy /= n;
    const solid = (x, y) => hard.some(q => Math.hypot(x - q.x, y - q.y) < (q.radius || 1e9) && pointInPoly(x, y, q.vertices));
    const angs = [...Array(12)].map((_, k) => k / 12 * Math.PI * 2);
    for (const q of hard) { let bv = null, bd = -1; for (const v of q.vertices) { const d = Math.hypot(v.x - cx, v.y - cy); if (d > bd) { bd = d; bv = v; } }
        const a = Math.atan2(bv.x - cx, -(bv.y - cy)); if (!angs.some(u => Math.abs(Math.atan2(Math.sin(u - a), Math.cos(u - a))) < 0.03)) angs.push(a); }
    const gates = [];
    for (const a of angs) { const dx = Math.sin(a), dy = -Math.cos(a); let far = 0, edge = 0;
        for (let d = 0; d < 12000; d += 20) { const x = cx + dx * d, y = cy + dy * d; if (!inB(x, y)) { edge = d; break; } if (solid(x, y)) far = d; }
        if (edge > far) gates.push({ a: { x: cx + dx * (far + VOLC_RUN.margin), y: cy + dy * (far + VOLC_RUN.margin) }, b: { x: cx + dx * (edge + 80), y: cy + dy * (edge + 80) } }); }
    return gates;
}
function checkVolcanicRun() {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== VOLC_RUN.venue || !me || !me.isPlayer
        || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _volcRun = null; return; }
    if (!_volcRun) _volcRun = { gates: _volcOuterGates(), hit: new Set(), last: null, done: false };
    const R = _volcRun, here = { x: me.x, y: me.y };
    if (R.last && !R.done) {
        R.gates.forEach((g, i) => { if (!R.hit.has(i) && _routeGateCrossed(R.last, here, g.a, g.b)) R.hit.add(i); });
        if (R.gates.length && R.hit.size === R.gates.length) { R.done = true; if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: 'volcanic:outer' }); }
    }
    R.last = here;
}
// SPOONBILL FLATS (designed Sep 26 2026, Wes) — the tide's flats and the passages over them.
//   flats:mud        value = seconds the player has sailed AFLOAT over the flats — ground a boat would sit
//                    aground on at low water (Tide.groundAt > low water − draft; the cuts are dredged to
//                    −1.35 m, the channel's rim is −1.6), from the gun. Skitter's "Mud Runner" is 50 s and never
//                    aground. Wes's Sep 16 laps: 39-41 s; the bot fleet 2 of 54 clean at 50+ (eval/_flats_fleet_feats.js).
//   flats:route:<id> the player sailed onto a passage's FLAT and stayed afloat on it `hold` seconds. A
//                    passage's flat is the drying ground whose nearest marked line (doc.tide.passages,
//                    Wes edits them in editor.html) is that passage's, within `reach` u — the lines are
//                    where the cuts are, not lanes: Wes crossed the first loop's flat diagonally between
//                    the wantij and the gamble. The banner names the flat as you sail onto it
//                    ('flats-passage', js/ui/screens.js), so what you see is what counts. Scythe's
//                    "Chart the Flats" collects the six named ones across races (FLATS_PASSAGES).
//   flats:aground    the player touched the mud while racing (it also costs the clean star — js/tide.js touches).
const FLATS_RUN = { venue: 'flats', reach: 450, hold: 4 };
// the flats: ground a boat sits aground on at low water
const _flatsZ = () => { const T = state.tide; return T ? T.mid - T.amp - T.draft : -1.5; };
let _flatsRun = null;   // { lines, cur, curS, done:Set, mud, sent } for the race in progress
function _flatsDist(x, y, P) {
    let best = 1e9;
    for (let i = 1; i < P.length; i++) { const ax = P[i - 1][0], ay = P[i - 1][1], vx = P[i][0] - ax, vy = P[i][1] - ay, L2 = vx * vx + vy * vy || 1;
        let u = ((x - ax) * vx + (y - ay) * vy) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u; const d = Math.hypot(x - ax - u * vx, y - ay - u * vy); if (d < best) best = d; }
    return best;
}
// which passage's flat a point lies on (null in the channel, or away from every line)
function _flatsPassageAt(x, y, lines) {
    if (typeof Tide === 'undefined' || !Tide.groundAt || Tide.groundAt(x, y) <= _flatsZ()) return null;
    let best = null, bd = FLATS_RUN.reach;
    for (const ln of lines) { const d = _flatsDist(x, y, ln.pts); if (d < bd) { bd = d; best = ln; } }
    return best;
}
function checkFlatsRun(dt) {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== FLATS_RUN.venue || !me || !me.isPlayer
        || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _flatsRun = null; return; }
    if (!_flatsRun) { const P = ((state.course.doc && state.course.doc.tide && state.course.doc.tide.passages) || []).filter(p => p && p.id && Array.isArray(p.pts) && p.pts.length > 1);
        _flatsRun = { lines: P.map(p => ({ id: p.id, name: p.name || p.id, pts: p.pts })), cur: null, curS: 0, done: new Set(), mud: 0, sent: 0 }; }
    const R = _flatsRun, emit = (id, value) => { if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', value === undefined ? { id } : { id, value }); };
    const ln = me.aground ? null : _flatsPassageAt(me.x, me.y, R.lines);
    if (typeof Tide !== 'undefined' && Tide.groundAt && !me.aground && Tide.groundAt(me.x, me.y) > _flatsZ()) R.mud += dt;
    if (R.mud - R.sent >= 0.5) { R.sent = Math.floor(R.mud * 2) / 2; emit('flats:mud', R.sent); }
    if (ln !== R.cur) {
        R.cur = ln; R.curS = 0;
        if (ln && typeof FLATS_PASSAGES !== 'undefined' && FLATS_PASSAGES.includes(ln.id) && typeof GameEvents !== 'undefined') GameEvents.emit('flats-passage', { id: ln.id, name: ln.name, sailed: R.done.has(ln.id) });
    }
    if (ln) { R.curS += dt; if (!R.done.has(ln.id) && R.curS >= FLATS_RUN.hold) { R.done.add(ln.id); emit('flats:route:' + ln.id); } }
}
if (typeof GameEvents !== 'undefined') GameEvents.on('player-aground', () => {
    if (!state.course || state.course.venueKey !== FLATS_RUN.venue || !state.race || state.race.status !== 'racing') return;
    GameEvents.emit('player-feat', { id: 'flats:aground' });
});
// CLUBHOUSE POINT (designed Sep 26 2026, Wes) — the eval anchor, so nothing here touches a boat; this only
// watches the player's own crossings:
//   seatrials:everycan  Lateen's "Every Can": in one race, round BOTH top marks (the windward gate crossed near
//                       its port can on one lap and its starboard can on the other) and use BOTH halves of the
//                       bottom line across its three crossings (the start, the lap-one leeward gate, the finish).
//                       6 of Wes's 27 laps here would have earned it — the limit is the two top cans.
const SEA_RUN = { venue: 'seatrials', topY: -4000, botY: 0, reach: 900 };
let _seaRun = null;   // { last, top:Set, bot:Set, done } for the race in progress
function checkSeaTrialsRun() {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== SEA_RUN.venue || !me || !me.isPlayer
        || state.race.status !== 'racing') { if (!state.race || state.race.status !== 'racing') _seaRun = null; return; }
    if (!_seaRun) _seaRun = { last: null, top: new Set(), bot: new Set(), done: false };
    const R = _seaRun, here = { x: me.x, y: me.y };
    if (R.closed) return;   // (the frame the finish is crossed still counts — it is one of the three bottom crossings)
    if (R.last && !R.done) {
        for (const [yy, set] of [[SEA_RUN.topY, R.top], [SEA_RUN.botY, R.bot]]) {
            if ((R.last.y - yy) * (here.y - yy) < 0) { const xc = R.last.x + (here.x - R.last.x) * (yy - R.last.y) / (here.y - R.last.y); if (Math.abs(xc) < SEA_RUN.reach) set.add(xc < 0 ? 'L' : 'R'); }
        }
        // (the finish is the last crossing: count it, then stop)
        if (R.top.size === 2 && R.bot.size === 2 && typeof GameEvents !== 'undefined') { R.done = true; GameEvents.emit('player-feat', { id: 'seatrials:everycan' }); }
    }
    R.last = here;
    if (me.raceState.finished) R.closed = true;
}
// GLOWTIDE STRAIT (designed Sep 26 2026) — the venue's question is "follow the glow, or trust
// your own line?", and Veil's objective is the answer:
//   glowtide:glow   value = seconds the player has sailed in ANOTHER boat's glowing wake (within
//                   14 u of a live point of its bioTrail more than 0.4 s old), counted from the
//                   gun, start included (Wes). "Trust Your Own Line" is a win with 5 s or less.
//                   Every boat spends 20-100 s in the fleet's glow; the best winning bot of six,
//                   2 s after the first 20 s (eval/_glowtide_wakes.js).
//   glowtide:bloom  Bloom's "Find the Bloom": into the golden jellyfish bloom in the north-west
//                   lagoon (js/wildlife.js GLOWTIDE bloom; nobody's track goes within 1,500 u).
const GLOW_RUN = { venue: 'glowtide', r: 14, minAge: 0.4, bloom: { x: -2350, y: -2550, r: 300 } };
let _glowRun = null;   // { secs, sent, bloom } for the race in progress
function checkGlowRun(dt) {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== GLOW_RUN.venue || !me || !me.isPlayer
        || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _glowRun = null; return; }
    if (!_glowRun) _glowRun = { secs: 0, sent: 0, bloom: false };
    const G = _glowRun;
    let inWake = false;
    for (const o of state.boats) {
        if (o === me || !o.bioTrail || !o.bioTrail.length || Math.hypot(o.x - me.x, o.y - me.y) > 700) continue;
        for (const q of o.bioTrail) if (q.age > GLOW_RUN.minAge && Math.abs(q.x - me.x) < GLOW_RUN.r && Math.abs(q.y - me.y) < GLOW_RUN.r && Math.hypot(q.x - me.x, q.y - me.y) < GLOW_RUN.r) { inWake = true; break; }
        if (inWake) break;
    }
    if (inWake) G.secs += dt;
    if (G.secs - G.sent >= 0.1 && typeof GameEvents !== 'undefined') { G.sent = Math.round(G.secs * 10) / 10; GameEvents.emit('player-feat', { id: 'glowtide:glow', value: G.sent }); }
    if (!G.bloom && Math.hypot(me.x - GLOW_RUN.bloom.x, me.y - GLOW_RUN.bloom.y) < GLOW_RUN.bloom.r && typeof GameEvents !== 'undefined') { G.bloom = true; GameEvents.emit('player-feat', { id: 'glowtide:bloom' }); }
    if (!G.sw && Math.hypot(me.x - GLOW_SW.x, me.y - GLOW_SW.y) < GLOW_SW.r && typeof GameEvents !== 'undefined') { G.sw = true; GameEvents.emit('player-feat', { id: 'glowtide:mantas' }); }
}
// ── SIX RUNGS AT EVERY VENUE (Sep 27 2026, Wes) — events only, no raceState ─────────────────────────────
// A LOOP ROUND A POINT is the angle the player's track sweeps about it: a full turn is 2π. `_sweepAdd` keeps
// the running sum for one point from the player's last position.
function _sweepAdd(S, x, y, cx, cy) {
    const a = Math.atan2(y - cy, x - cx);
    if (S.a != null) { let d = a - S.a; d = Math.atan2(Math.sin(d), Math.cos(d)); S.sum += d; }
    S.a = a;
}
//   pond:raft   Pip's "Round the Raft": a full turn round the Sailing School's swim raft (prop-44), inside
//               raftR, during any section — the school's objective is judged when the section ends.
const POND_RAFT = { venue: 'pond', prop: 'prop-44', r: 260 };
let _pondRaft = null;
function checkPondRaft() {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== POND_RAFT.venue || !me || !me.isPlayer) { _pondRaft = null; return; }
    const pr = ((VenueDoc.get('pond') || {}).props || []).find(q => q.id === POND_RAFT.prop); if (!pr) return;
    if (!_pondRaft || _pondRaft.course !== state.course) _pondRaft = { course: state.course, S: { sum: 0, a: null }, sent: false };
    const R = _pondRaft;
    if (Math.hypot(me.x - pr.x, me.y - pr.y) > POND_RAFT.r) { R.S = { sum: 0, a: null }; return; }   // left the raft: start over
    _sweepAdd(R.S, me.x, me.y, pr.x, pr.y);
    if (!R.sent && Math.abs(R.S.sum) >= Math.PI * 2 * 0.95 && typeof GameEvents !== 'undefined') { R.sent = true; GameEvents.emit('player-feat', { id: 'pond:raft' }); }
}
//   lake:islands  Barbel's "Round Every Island": the whole race's track, closed from the finish back to the
//                 start, goes round every island in the lake — each ISLAND is a connected clump of hard land
//                 touching neither the shore nor the arena edge (_lakeIslands, found from the course so a
//                 venue edit carries through). A point inside each is swept; |sum| near 2π is enclosed.
function _lakeIslands() {
    const c = state.course; if (c._lakeIsl) return c._lakeIsl;
    const L = (c.islands || []).filter(s => !/\.hit$/.test(s.id) && VenueDoc.traits(s).hard && !VenueDoc.traits(s).reef && s.vertices && s.vertices.length > 2);
    const bb = s => { let a = Infinity, b = Infinity, d = -Infinity, e = -Infinity; for (const q of s.vertices) { a = Math.min(a, q.x); b = Math.min(b, q.y); d = Math.max(d, q.x); e = Math.max(e, q.y); } return [a, b, d, e]; };
    const B = L.map(bb), touch = (i, j) => { const A = B[i], C = B[j]; if (A[2] < C[0] - 5 || C[2] < A[0] - 5 || A[3] < C[1] - 5 || C[3] < A[1] - 5) return false;
        return L[i].vertices.some(q => pointInPoly(q.x, q.y, L[j].vertices)) || L[j].vertices.some(q => pointInPoly(q.x, q.y, L[i].vertices)); };
    const par = L.map((_, i) => i), f = i => par[i] === i ? i : (par[i] = f(par[i]));
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (touch(i, j)) par[f(i)] = f(j);
    const comps = {}; L.forEach((s, i) => (comps[f(i)] = comps[f(i)] || []).push(i));
    const E = Arena.extent(c.boundary), W = Math.max(E.maxX - E.minX, E.maxY - E.minY), out = [];
    for (const ids of Object.values(comps)) {
        const X = ids.map(i => B[i]).reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[2]), Math.max(a[3], q[3])]);
        if (X[2] - X[0] > W * 0.6 || X[3] - X[1] > W * 0.6) continue;   // the shore
        const big = ids.reduce((a, i) => ((B[i][2] - B[i][0]) * (B[i][3] - B[i][1]) > (B[a][2] - B[a][0]) * (B[a][3] - B[a][1]) ? i : a));
        const v = L[big].vertices; let x = v.reduce((a, q) => a + q.x, 0) / v.length, y = v.reduce((a, q) => a + q.y, 0) / v.length;
        if (!pointInPoly(x, y, v)) { x = (v[0].x + v[Math.floor(v.length / 2)].x) / 2; y = (v[0].y + v[Math.floor(v.length / 2)].y) / 2; }
        out.push({ id: ids.map(i => L[i].id).join('+'), x, y });
    }
    return (c._lakeIsl = out);
}
const LAKE_RUN = { venue: 'lake', need: Math.PI * 2 * 0.8 };
let _lakeRun = null;
function checkLakeRun() {
    const me = state.boats && state.boats[0];
    if (!state.course || state.course.venueKey !== LAKE_RUN.venue || !me || !me.isPlayer || !state.race) { _lakeRun = null; return; }
    if (state.race.status !== 'racing' && state.race.status !== 'finished') { _lakeRun = null; return; }
    if (me.raceState.leg < 1 && !me.raceState.finished) return;
    if (!_lakeRun || _lakeRun.me !== me) _lakeRun = { me, isl: _lakeIslands().map(p => ({ p, S: { sum: 0, a: null } })), x0: me.x, y0: me.y, done: false };
    const R = _lakeRun; if (R.done) return;
    for (const q of R.isl) _sweepAdd(q.S, me.x, me.y, q.p.x, q.p.y);
    if (me.raceState.finished) {
        R.done = true;
        if (me.raceState.resultStatus) return;
        // close the loop: the start and finish share the gate, so the straight hop home is short
        for (const q of R.isl) { const S = { sum: q.S.sum, a: q.S.a }; for (let k = 1; k <= 8; k++) _sweepAdd(S, me.x + (R.x0 - me.x) * k / 8, me.y + (R.y0 - me.y) * k / 8, q.p.x, q.p.y); q.closed = S.sum; }
        const n = R.isl.filter(q => Math.abs(q.closed) >= LAKE_RUN.need).length;
        if (typeof GameEvents !== 'undefined') { GameEvents.emit('player-feat', { id: 'lake:islands-n', value: n });
            if (n === R.isl.length && n > 0) GameEvents.emit('player-feat', { id: 'lake:islands' }); }
    }
}
//   river:route:keep-right / keep-left   Pennant's "Right, Then Left": the three river islands the course passes
//               (the big island in the gorge and the two above the finish), each passed with it on the SAME side
//               of you — all on your left (you took the right-hand channel every time) or all on your right.
//               A pass is sweeping 90°+ round the island while inside its ring; the sweep's sign is the side.
//   river:bears Grizzle's "Close to the Bears": within a boat length of both fishing grizzlies in one race.
const RIVER_SPLITS = { venue: 'river', islands: [{ id: 'shape-13', x: 3150, y: -3792, r: 450 }, { id: 'shape-42', x: 4661, y: -6056, r: 480 }, { id: 'shape-43', x: 5575, y: -6344, r: 700 }],
    bears: [[5500, -6070], [2320, -4300]], bearR: 110 };
let _riverSplits = null;
function checkRiverSplits() {
    const me = state.boats && state.boats[0], C = RIVER_SPLITS;
    if (!state.course || state.course.venueKey !== C.venue || !me || !me.isPlayer || !state.race) { _riverSplits = null; return; }
    if (state.race.status !== 'racing' && state.race.status !== 'finished') { _riverSplits = null; return; }
    if (me.raceState.leg < 1 && !me.raceState.finished) return;
    if (!_riverSplits || _riverSplits.me !== me) _riverSplits = { me, isl: C.islands.map(p => ({ p, S: null, side: 0 })), bears: C.bears.map(() => false), done: false };
    const R = _riverSplits; if (R.done) return;
    const emit = (id) => { if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id }); };
    const close = (q) => { if (q.S && Math.abs(q.S.sum) >= Math.PI / 2) q.side = q.S.sum > 0 ? 1 : -1; q.S = null; };
    for (const q of R.isl) {
        if (Math.hypot(me.x - q.p.x, me.y - q.p.y) < q.p.r) { if (!q.S) q.S = { sum: 0, a: null }; _sweepAdd(q.S, me.x, me.y, q.p.x, q.p.y); }
        else if (q.S) close(q);
    }
    if (!me.raceState.finished) C.bears.forEach((b, i) => { if (!R.bears[i] && Math.hypot(me.x - b[0], me.y - b[1]) < C.bearR) { R.bears[i] = true; if (R.bears.every(Boolean)) emit('river:bears'); } });
    if (me.raceState.finished) {
        R.done = true;
        if (me.raceState.resultStatus) return;
        for (const q of R.isl) if (q.S) close(q);
        // With y pointing down the screen, sweeping round an island with a NEGATIVE sum means it was on your left.
        if (R.isl.every(q => q.side === -1)) emit('river:route:keep-right');
        else if (R.isl.every(q => q.side === 1)) emit('river:route:keep-left');
    }
}
//   glowtide:mantas  Blink's "Where the Mantas Feed": the far south-west shoal behind the west peninsula, by the
//                    bonfire (Wes, Sep 27 2026), where three mantas circle — within r of its centre.
const GLOW_SW = { venue: 'glowtide', x: -2804, y: 3306, r: 450 };

// BOAT HANDLING & CONDITIONS (Sep 27 2026) — events only, no raceState. From the gun to the player's finish:
//   wind:avg (value)   the average true wind at the player's boat, kn, sampled each second (Frond, Bulkhead, Chroma)
//   tack:n / gybe:n    the bow through head-to-wind / the stern through dead downwind, the new side held 1.5 s (Viper, Spin)
//   kite:hoisted       the spinnaker set at any time after the gun (One Sail, Forever — must NOT happen)
//   calm:30            under 2 kn of boatspeed for 30 s straight (Sunbather)
//   grip:<name>        a rival held within two boat lengths (110 u) astern for 60 s straight (Grip, Never Let Go)
const HANDLING = { settle: 1.5, calmKn: 2, calmS: 30, gripR: 110, gripS: 60 };
let _handling = null;
function checkHandling(dt) {
    const me = state.boats && state.boats[0];
    if (!me || !me.isPlayer || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _handling = null; return; }
    if (!_handling) _handling = { wSum: 0, wN: 0, wT: 0, side: 0, pend: 0, pendT: 0, pendKind: '', tacks: 0, gybes: 0, calm: 0, calmSent: false, hoisted: false, grip: new Map(), gripSent: new Set() };
    const H = _handling, emit = (id, value) => { if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', value === undefined ? { id } : { id, value }); };
    const w = typeof getWindAt === 'function' ? getWindAt(me.x, me.y) : state.wind;
    H.wT += dt; if (H.wT >= 1) { H.wT -= 1; H.wSum += w.speed; H.wN++; emit('wind:avg', Math.round(H.wSum / H.wN * 10) / 10); }
    // tacks and gybes: which side the wind is on; a change that holds for 1.5 s is a manoeuvre, through the bow or the stern
    const twa = normalizeAngle(me.heading - w.direction), side = twa < 0 ? -1 : 1;
    if (!H.side) H.side = side;
    if (side !== H.side) { if (H.pend !== side) { H.pend = side; H.pendT = 0; H.pendKind = Math.abs(twa) < Math.PI / 2 ? 'tack' : 'gybe'; } H.pendT += dt;
        if (H.pendT >= HANDLING.settle) { H.side = side; H.pend = 0; if (H.pendKind === 'tack') emit('tack:n', ++H.tacks); else emit('gybe:n', ++H.gybes); } }
    else H.pend = 0;
    // the kite, becalmed
    if (!H.hoisted && me.spinnaker) { H.hoisted = true; emit('kite:hoisted'); }
    if (me.speed * 4 < HANDLING.calmKn) { H.calm += dt; if (!H.calmSent && H.calm >= HANDLING.calmS) { H.calmSent = true; emit('calm:30'); } } else H.calm = 0;
    // GRIP: a rival within two lengths astern (behind the player's beam line, 27.5 u past the transom's centre-line reference), held
    const fx = Math.sin(me.heading), fy = -Math.cos(me.heading);
    for (const o of state.boats) { if (o === me || o.raceState.finished) continue;
        const dx = o.x - me.x, dy = o.y - me.y, d = Math.hypot(dx, dy), astern = dx * fx + dy * fy < -27.5;
        if (d < HANDLING.gripR && astern) { const t = (H.grip.get(o) || 0) + dt; H.grip.set(o, t); if (t >= HANDLING.gripS && !H.gripSent.has(o.name)) { H.gripSent.add(o.name); emit('grip:' + o.name); } }
        else H.grip.set(o, 0); }
}
// LEGAL AGGRESSION (Sep 27 2026) — events only, no raceState. From the player's start crossing to the finish:
//   pass:n (value)      Frenzy's 'Feeding Frenzy': GROSS passes — a rival ahead of the player (fleetRank's order) falls
//                       behind and stays there 4 s; a re-pass of the same boat within 10 s of its last counted pass doesn't count
//                       (4 s, not 2: at 2 the autopilot's tacking churn made 13 passes finishing 9th, eval/_aggro_feats.js).
//   passed:<name>       each rival passed (a counted pass) — Lance's 'Through the Fleet' collects them across a Series.
//   give:n (value)      Spike's 'Makes His Own Right of Way': how many DIFFERENT rivals gave way to the player —
//                       Redrock's junction detector (Sawbill), anywhere on the course: the rival's own avoidance holds
//                       GIVE_WAY against the player at HIGH/IMMINENT risk and turns > 0.35 rad off course for 0.8 s.
//   air:<name>          Corsair's 'Air Thief': a rival inside the player's own wind shadow — physics.js's bad-air cone
//                       (450 u downwind, 20 → 100 u wide), intensity ≥ 0.1 — for 30 s, a gap under 1 s forgiven.
const AGGRO = { hold: 4, repass: 10, dev: 0.35, giveHold: 0.8, airMin: 0.1, airS: 30, airGap: 1 };
let _aggro = null;
function _aggroAhead(o, me) {   // fleetRank's pairwise order: is o ahead of me?
    const A = me.raceState, B = o.raceState;
    if (B.finished) return true;
    if (B.leg !== A.leg) return B.leg > A.leg;
    return (B.nextWaypoint.dist || 0) < (A.nextWaypoint.dist || 0);
}
function _aggroShadow(me, o) {   // the intensity of the player's bad air at o (physics.js's cone, attributed)
    const w = typeof getWindAt === 'function' ? getWindAt(o.x, o.y) : state.wind;
    const wx = -Math.sin(w.direction), wy = Math.cos(w.direction), dx = o.x - me.x, dy = o.y - me.y;
    const down = dx * wx + dy * wy; if (down <= 10 || down > 450) return 0;
    const half = (20 + (down / 450) * 80) * 0.7, cross = Math.abs(dx * -wy + dy * wx);
    return cross < half ? 0.95 * (1 - cross / half) * (1 - down / 450) : 0;
}
function checkAggression(dt) {
    const me = state.boats && state.boats[0];
    if (!me || !me.isPlayer || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _aggro = null; return; }
    if (me.raceState.leg < 1) return;
    if (!_aggro) _aggro = { t: 0, ahead: new Map(), flipT: new Map(), last: new Map(), passes: 0, give: new Map(), gave: new Set(), air: new Map(), gap: new Map(), airSent: new Set() };
    const G = _aggro, emit = (id, value) => { if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', value === undefined ? { id } : { id, value }); };
    G.t += dt;
    // WHO WAS AHEAD AT EACH MARK (the Shark Pack, Sep 27 2026): the moment the player rounds a mark (leg L → L+1,
    // L ≥ 1 — the start is not a mark and the finish ends the check), every rival still ahead is 'mark:behind:<name>',
    // and at the first mark 'mark1:behind:<name>' too. Lash asks for Anvil ahead at mark 1; Nib for Lash never ahead.
    const L = me.raceState.leg;
    if (G.leg != null && L > G.leg && G.leg >= 1)
        for (const o of state.boats) if (o !== me && _aggroAhead(o, me)) { emit('mark:behind:' + o.name); if (G.leg === 1) emit('mark1:behind:' + o.name); }
    G.leg = L;
    for (const o of state.boats) {
        if (o === me) continue;
        // PASSES: the order as of the player's start is the reference, so the start itself is not a feast
        const now = _aggroAhead(o, me);
        if (!G.ahead.has(o)) G.ahead.set(o, now);
        if (now !== G.ahead.get(o)) { const f = (G.flipT.get(o) || 0) + dt; G.flipT.set(o, f);
            if (f >= AGGRO.hold) { G.ahead.set(o, now); G.flipT.set(o, 0);
                if (!now) { const l = G.last.get(o); if (l === undefined || G.t - l >= AGGRO.repass) { emit('pass:n', ++G.passes); emit('passed:' + o.name); G.last.set(o, G.t); } } } }
        else G.flipT.set(o, 0);
        if (o.raceState.finished) continue;
        // GIVE WAY
        const c = o.controller;
        if (c) { const on = c.threatBoat === me && c.avoidanceRole === 'GIVE_WAY' && (c.riskState === 'HIGH' || c.riskState === 'IMMINENT') && c.lastAvoidDeviation > AGGRO.dev;
            const v = on ? (G.give.get(o) || 0) + dt : Math.max(0, (G.give.get(o) || 0) - dt / 2); G.give.set(o, v);
            if (on && v >= AGGRO.giveHold && !G.gave.has(o.name)) { G.gave.add(o.name); emit('give:n', G.gave.size); } }
        // DIRTY AIR
        if (_aggroShadow(me, o) >= AGGRO.airMin) { G.air.set(o, (G.air.get(o) || 0) + dt); G.gap.set(o, 0);
            if (G.air.get(o) >= AGGRO.airS && !G.airSent.has(o.name)) { G.airSent.add(o.name); emit('air:' + o.name); } }
        else { const g = (G.gap.get(o) || 0) + dt; G.gap.set(o, g); if (g > AGGRO.airGap) G.air.set(o, 0); }
    }
}
// LEG & MARK CRAFT (Sep 27 2026) — events only, no raceState:
//   mark:held / mark:lost  Saffron's 'Perfect Roundings': the player's fleet rank ~4 boat lengths (220 u) before a mark
//                          (or gate) vs 220 u after it; the finish is not a mark.
//   pass:overtaken         Brine's 'Never Passed': from the start crossing, a place lost and held for 2 s.
//   kite:secs (value)      Splash's 'All Kite': seconds after the gun with the spinnaker up.
const LEG_CRAFT = { near: 220, hold: 2 };
let _legCraft = null;   // { leg, rankIn, pending: { marks, rankIn }, ref, worseT, betterT, kite, sent } for the race in progress
function _legCraftMarks(leg) { const e = typeof routeLeg === 'function' ? routeLeg(leg) : null, M = state.course.marks || [];
    if (!e) return []; const idx = e.marks || (e.mark && e.mark.markIdx != null ? [e.mark.markIdx] : []); return idx.map(i => M[i]).filter(Boolean); }
function checkLegCraft(dt) {
    const me = state.boats && state.boats[0];
    if (!me || !me.isPlayer || state.race.status !== 'racing' || me.raceState.finished) { if (!state.race || state.race.status !== 'racing') _legCraft = null; return; }
    if (!_legCraft) _legCraft = { leg: -1, rankIn: null, pending: null, ref: null, worseT: 0, betterT: 0, kite: 0, sent: 0 };
    const R = _legCraft, rs = me.raceState, emit = (id, value) => { if (typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', value === undefined ? { id } : { id, value }); };
    // the kite
    if (me.spinnaker && me.spinnakerDeployProgress > 0.5) R.kite += dt;
    if (R.kite - R.sent >= 0.5) { R.sent = Math.floor(R.kite * 2) / 2; emit('kite:secs', R.sent); }
    if (rs.leg < 1) return;
    const rank = fleetRank(me);
    // PERFECT ROUNDINGS: arm the leg's mark(s) on approach; on leaving, compare
    if (R.leg !== rs.leg) {
        if (R.leg >= 1 && R.rankIn != null) R.pending = { marks: _legCraftMarks(R.leg), rankIn: R.rankIn };
        R.leg = rs.leg; R.rankIn = null;
    }
    const isFinish = rs.leg >= state.race.totalLegs, M = _legCraftMarks(rs.leg), near = (L) => L.length && Math.min(...L.map(m => Math.hypot(me.x - m.x, me.y - m.y))) < LEG_CRAFT.near;
    if (!isFinish && R.rankIn == null && near(M)) R.rankIn = rank;
    if (R.pending && !near(R.pending.marks)) { emit(rank > R.pending.rankIn ? 'mark:lost' : 'mark:held', rank - R.pending.rankIn); R.pending = null; }
    // NEVER PASSED: a place lost for 2 s is a pass; a place gained for 2 s is the new reference
    if (R.ref == null) R.ref = rank;
    if (rank > R.ref) { R.worseT += dt; R.betterT = 0; if (R.worseT >= LEG_CRAFT.hold) { emit('pass:overtaken', rank); R.ref = rank; R.worseT = 0; } }
    else if (rank < R.ref) { R.betterT += dt; R.worseT = 0; if (R.betterT >= LEG_CRAFT.hold) { R.ref = rank; R.betterT = 0; } }
    else { R.worseT = 0; R.betterT = 0; }
}
// CLOSE RACING — Latch's 'Inches' (Sep 27 2026): the player on PORT crosses ahead of a boat on STARBOARD within
// one boat length — across its bow line, 0..55 u in front of its bow (hull half-length 27.5 past its centre).
// Per bot, the side of its centreline the player is on; a flip in front of its bow is a crossing. Events only.
const _inchesSide = new Map();
function checkCloseCrossing() {
    const me = state.boats && state.boats[0];
    if (!me || !me.isPlayer || state.race.status !== 'racing' || me.raceState.finished || typeof Rules === 'undefined') { _inchesSide.clear(); return; }
    const myTack = Rules.getTack(me);
    for (const o of state.boats) {
        if (o === me || o.raceState.finished) continue;
        const dx = me.x - o.x, dy = me.y - o.y;
        if (dx * dx + dy * dy > 200 * 200) { _inchesSide.delete(o); continue; }
        const fx = Math.sin(o.heading), fy = -Math.cos(o.heading), ahead = dx * fx + dy * fy - 27.5, side = Math.sign(dx * -fy + dy * fx) || 1;
        const was = _inchesSide.get(o); _inchesSide.set(o, side);
        if (was !== undefined && was !== side && ahead >= 0 && ahead <= 55 && myTack === -1 && Rules.getTack(o) === 1 && typeof GameEvents !== 'undefined')
            GameEvents.emit('player-feat', { id: 'close:inches', value: Math.round(ahead) });
    }
}
const _bowSide = new Map();
function checkBowCrossing(list) {
    const me = state.boats && state.boats[0];
    if (!me || !me.isPlayer || state.race.status !== 'racing' || me.raceState.finished) { _bowSide.clear(); return; }
    for (const v of list) {
        if (!v.active || !/cargo-ship/.test(v.kind) || !(v.knots > 0.5)) { _bowSide.delete(v.id); continue; }
        const fx = Math.sin(v.heading), fy = -Math.cos(v.heading);
        const dx = me.x - v.x, dy = me.y - v.y;
        const ahead = dx * fx + dy * fy - v.hullLen / 2;   // distance forward of the bow
        const side = Math.sign(dx * -fy + dy * fx) || 1;   // which side of the centreline
        const was = _bowSide.get(v.id);
        _bowSide.set(v.id, side);
        if (was !== undefined && was !== side && ahead >= 0 && ahead <= BOW_CROSS_LENGTHS * BOW_CROSS_HULL
            && typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: 'bay:bow-cross', ship: v.id, ahead });
    }
}

// ── THE KELVIN WAKE ──────────────────────────────────────────────────────────────────
// A cargo ship is thirteen hull lengths of the boat the wake code was written for, and
// scaling that ribbon up by thirteen does not give you a ship — from directly above, the
// only way this game is ever seen, it gives you a very large dinghy. What says tonnage
// from above is the SHAPE: the divergent arms standing off at a fixed angle either side of
// the track, with the churned water running down the middle.
//
// THE ANGLE IS NOT A TUNING KNOB. Kelvin's result is that a displacement hull's wake sits
// in a wedge of half-angle arcsin(1/3) = 19.47 degrees REGARDLESS OF SPEED — a slow ship
// and a fast one differ in how bright the arms are, never in how wide they stand. Getting
// that wrong is one of the few things about water a viewer can feel without knowing why.
function repositionBoats() {
    if (!state.boats || state.boats.length === 0) return;

    // BACK FROM THE LINE is a fact about the LINE, not about the wind: the pre-start side is
    // whichever side the route says the fleet crosses FROM. This used to be the reciprocal of
    // the wind vector, which is the same thing only while the line happens to lie square to
    // the breeze. On Glacier Sound the two are 80 degrees apart, so "400 units back" slid the
    // fleet 400 units ALONG the line instead — boats ended up 60 units off it, smeared past
    // the committee end, and over it before the gun.
    const cross = startCrossNormal();
    const backX = -cross.x;
    const backY = -cross.y;

    // Start Line Center and Geometry
    if (!state.course.marks || state.course.marks.length < 2) return;
    const [m0, m1] = startLinePts();
    const cx = (m0.x + m1.x) / 2;
    const cy = (m0.y + m1.y) / 2;

    const lDx = m1.x - m0.x;
    const lDy = m1.y - m0.y;
    const lLen = Math.sqrt(lDx*lDx + lDy*lDy);
    const rx = lDx / lLen;
    const ry = lDy / lLen;

    // Spawn at 400 units back
    const distBack = 400;

    // Lane-based grid. Each boat owns an evenly-spaced lane WITHIN the start
    // segment and spawns directly behind it, so it lines up with the line and can
    // run straight up without converging laterally (the old layout spread boats
    // ~2.5x the line width and shuffled them independent of their target lane, so
    // most crossed outside the segment and never started cleanly). Each AI boat's
    // start target (startLinePct) is set to its lane so spawn == target.
    const N = state.boats.length;
    const loPct = 0.15, hiPct = 0.85;
    let favBias = 0;
    try { favBias = (getFavoredEnd() === 1 ? 1 : -1) * 0.06; } catch (e) {}

    // Shuffle which boat gets which lane.
    const laneIdx = [];
    for (let i = 0; i < N; i++) laneIdx.push(i);
    for (let i = laneIdx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [laneIdx[i], laneIdx[j]] = [laneIdx[j], laneIdx[i]];
    }

    // Lane-aligned spawn. Each boat owns a lane within the start segment and spawns
    // directly behind it, so it lines up with the line and runs straight up without
    // converging laterally. (The old layout spread boats ~2.5x the line width and
    // shuffled them independent of their target lane, so most crossed outside the
    // segment and never started cleanly.) The start controller stages each boat just
    // behind the line in its lane and times a short crossing on the gun.
    let bi = 0;
    for (const boat of state.boats) {
        const k = laneIdx[bi++];
        let pct = N > 1 ? loPct + (hiPct - loPct) * (k / (N - 1)) : 0.5;
        pct = Math.max(0.1, Math.min(0.9, pct + favBias));

        const laneX = cx + (m1.x - m0.x) * (pct - 0.5);
        const laneY = cy + (m1.y - m0.y) * (pct - 0.5);
        const scatter = (Math.random() - 0.5) * 120;   // depth (along-wind) scatter
        const jitterLat = (Math.random() - 0.5) * 20;  // small lateral jitter
        const sx = laneX + backX * (distBack + scatter) + rx * jitterLat;
        const sy = laneY + backY * (distBack + scatter) + ry * jitterLat;

        boat.x = sx;
        boat.y = sy;

        // THE WIND EACH BOAT IS ACTUALLY LYING IN, sampled where it floats. A venue whose
        // regions bend the breeze has no single start-line wind: on Glacier Sound the mean is
        // 130 degrees and the line reads 217, so heading the whole fleet at the mean left
        // every boat ~87 degrees off the air it was sitting in. Per boat, because the gradient
        // runs ACROSS the line as well as along the course.
        const lw = getWindAt(sx, sy).direction;

        if (boat.isPlayer) {
            boat.heading = lw; // Head to wind — the wind HERE
            boat.velocity = { x: 0, y: 0 };
            boat.speed = 0;
        } else {
            if (boat.ai) boat.ai.startLinePct = pct;
            if (boat.controller) {
                boat.controller.startLinePct = pct;
                boat.controller.startStageDepth = 60;
            }
            // Start on Starboard Tack (Close Hauled)
            boat.heading = normalizeAngle(lw + Math.PI / 4);
            boat.speed = 0.5;
            boat.velocity = {
                x: Math.sin(boat.heading) * boat.speed,
                y: -Math.cos(boat.heading) * boat.speed
            };
        }
        boat.prevHeading = boat.heading;
        if (boat.raceState) boat.raceState.lastPos = { x: boat.x, y: boat.y };
    }
}

// HOW CLOSE COUNTS AS "NEEDING TO TAKE AVOIDING ACTION". The hulls are 55 long and 30
// wide, so two boats whose centres pass inside 60 units are in contact or within a few
// feet of it, and a right-of-way boat has to do something about it. Above that she may
// still choose to bear away — sailors do — but the Keep Clear definition asks whether
// she NEEDED to, and she did not.
function buildRoute(type, totalLegs) {
    const route = [];
    if (type === 'islandRound') {
        route.push({ kind: 'line',  marks: [0, 1], dir: +1, role: 'start' });
        route.push({ kind: 'round', side: 'starboard',      role: 'rounding' });
        route.push({ kind: 'line',  marks: [0, 1], dir: -1, role: 'finish', finish: true });
        return route;
    }
    // Windward-leeward. Leg 0 is the start (up through the line); odd legs beat
    // to the windward gate; even legs run back down to the start/leeward line.
    //
    // Two entries are generated PAST the finish. Several draw paths query the
    // player's leg after they have finished (leg becomes totalLegs+1), and the
    // old formula happily answered for any leg. Generating the tail keeps those
    // answers identical instead of relying on a fallback.
    for (let leg = 0; leg <= totalLegs + 1; leg++) {
        route.push({
            kind: leg === 0 ? 'line' : 'gate',
            marks: (leg % 2 !== 0) ? [2, 3] : [0, 1],
            dir: (leg === 0 || leg % 2 !== 0) ? +1 : -1,
            role: leg === 0 ? 'start' : (leg % 2 !== 0 ? 'windward' : 'leeward'),
            finish: leg === totalLegs
        });
    }
    return route;
}

const routeLeg  = (leg) => (state.course && state.course.route) ? (state.course.route[leg] || null) : null;
// Marks bounding the leg's target gate/line, or null for a rounding (no gate).
const legMarks  = (leg) => { const r = routeLeg(leg); return (r && r.marks) ? r.marks : null; };
// THE mark this leg rounds, or null if it is not a rounding leg. `course.roundMark`
// is only the FIRST rounding of the course — any consumer that wants "the mark I am
// rounding NOW" must ask the route, or a multi-rounding course pins it to mark one.
const legRoundMark = (leg) => { const r = routeLeg(leg); return (r && r.kind === 'round' && r.mark) ? r.mark : null; };
const legDir    = (leg) => { const r = routeLeg(leg); return r ? r.dir : 1; };
// Is this leg sailed upwind? Leg 0 counts: the start is a beat to the line.
// Where a leg is sailed TO: a gate/line midpoint, or a rounding mark.
function legTargetPoint(leg) {
    const r = routeLeg(leg);
    if (!r) return null;
    if (r.kind === 'round') return r.mark ? { x: r.mark.x, y: r.mark.y } : null;
    return legMid(leg);
}

// Does this leg's NET DIRECTION go upwind? A geometric fact about the course, derived
// from the mean wind — used for drawing laylines and mark zones, which need to know
// which way along the course axis a leg runs.
//
// This is NOT "the boat is beating". A boat beats, reaches and runs WITHIN a single leg
// depending on its actual heading; point of sail belongs to the boat, not the leg. See
// pointOfSail() below, which is what the rules and the character stats want.
//
// It used to be an authored `beat` flag, which is a fact that can disagree with the
// course — and silently did: Glacier Sound's rounding leg was marked `beat: true` while
// its wind points AWAY from the island, making that leg a run.
const legGoesUpwind = (leg) => {
    const to = legTargetPoint(leg);
    if (!to) return false;
    let dx, dy;
    const r = routeLeg(leg);
    if (leg === 0 || !legTargetPoint(leg - 1)) {
        // No previous leg to come from, so travel is the crossing direction itself:
        // the gate normal n = (dy, -dx) times the required crossing sign.
        const idx = legMarks(leg);
        if (!idx || !state.course.marks) return false;
        const a = state.course.marks[idx[0]], b = state.course.marks[idx[1]];
        if (!a || !b) return false;
        const sgn = (r && r.dir) || 1;
        dx = (b.y - a.y) * sgn; dy = -(b.x - a.x) * sgn;
    } else {
        const from = legTargetPoint(leg - 1);
        dx = to.x - from.x; dy = to.y - from.y;
    }
    if (!dx && !dy) return false;
    // heading convention: forward = (sin h, -cos h); the wind direction is the heading
    // that points dead upwind, so TWA = windDir - heading.
    //
    // BASE direction, not the live one. Whether a leg is a beat is a property of the
    // course and the mean wind, not of the momentary shift — using the oscillating
    // `wind.direction` made the answer flicker frame to frame on any leg lying near 90
    // degrees to the breeze, which showed up immediately in the 6-leg traces.
    const heading = Math.atan2(dx, -dy);
    return Math.abs(normalizeAngle(state.wind.baseDirection - heading)) < Math.PI / 2;
};
// The finish is simply the last route entry's gate.
const finishMarks = () => legMarks(state.race.totalLegs);

// The start/finish line — by route role, not by "the pair at index 0".
const startLineMarks = () => {
    const r = state.course && state.course.route && state.course.route[0];
    return (r && r.marks) ? r.marks : [0, 1];
};
// The two start-line marks as points. Every consumer wants the objects, and each one
// that reached for `marks[0]`/`marks[1]` itself was quietly asserting that the pin and
// the boat end are the first two marks in the array. That holds for the ten venues
// shipped today, but nothing enforces it: the editor is free to author a route whose
// opening line names any pair, and the moment it does, the fleet spawns behind the
// wrong marks, the laylines draw on the wrong marks and OCS is judged against them.
const startLinePts = () => {
    const [a, b] = startLineMarks();
    const m = state.course.marks;
    return [m[a], m[b]];
};

// THE WAY THE FLEET CROSSES THE START, as a unit vector. `dir * (gateDy, -gateDx)` over the
// route entry's own mark pair — the same expression updateBoatRaceState judges a crossing
// with, so "which side is pre-start" has ONE definition and the placement, the committee
// boat's heading and the OCS test cannot disagree about it.
//
// Deliberately NOT derived from the wind. A line is crossed the way its route says, and on a
// venue whose breeze bends across the course there is no single wind to ask — asking the
// global mean is what put the fleet alongside the line instead of behind it.
// +1 or -1: the sense in which the opening route entry says its line is crossed. ONE
// definition, so the placement, the AI's prestart geometry and the OCS test cannot
// disagree about which side is pre-start.
const startCrossSign = () => {
    const r = state.course && state.course.route && state.course.route[0];
    return (r && r.dir < 0) ? -1 : 1;
};

const startCrossNormal = () => {
    const r = state.course && state.course.route && state.course.route[0];
    const [a, b] = startLineMarks();
    const m = state.course.marks;
    if (!m || !m[a] || !m[b]) return { x: 0, y: -1 };
    const dx = m[b].x - m[a].x, dy = m[b].y - m[a].y;
    const l = Math.hypot(dx, dy) || 1;
    const s = (r && r.dir < 0) ? -1 : 1;
    return { x: s * dy / l, y: -s * dx / l };
};

// The course AXIS: leeward/start line midpoint -> windward gate midpoint, plus
// the unit vector along it. Six separate sites recomputed this from marks[0..3];
// it is one concept and belongs in one place.
//
// A course with no windward gate (islandRound) uses its rounding mark as the far
// end, which is the natural analogue. Note this is byte-identical to the old
// marks[2]/[3] computation there: those two placeholder marks are laid out
// symmetrically either side of the granite island, so their midpoint already WAS
// the island centre.
function courseAxis() {
    const a = legMid(0);
    let b = legMid(1);
    if (!b && state.course && state.course.roundMark) {
        b = { x: state.course.roundMark.x, y: state.course.roundMark.y };
    }
    if (!a || !b) return null;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { start: a, windward: b, dx, dy, len, ux: dx / len, uy: dy / len };
}

// A BOAT's point of sail, right now. Close-hauled up to 60 degrees off the true wind,
// reaching to 120, running beyond — the conventional split, and the one the character
// stats (upwind / reach / downwind) are written against.
//
// This is the question RRS 18.1(a) actually asks ("boats on opposite tacks on a beat to
// windward"), and the question a character's beat/run strength applies to. It uses the
// LIVE wind, because a boat's point of sail genuinely changes with every shift.
function pointOfSail(boat) {
    const twa = Math.abs(normalizeAngle(state.wind.direction - boat.heading));
    return twa < Math.PI / 3 ? 'beat' : twa < Math.PI * 2 / 3 ? 'reach' : 'run';
}

// Does this leg's target gate sit at the windward end? Distinct from legGoesUpwind:
// leg 0 runs upwind but targets the START line, so its net direction is upwind while it
// is not heading for the windward gate.
const legTargetsWindward = (leg) => (routeLeg(leg) || {}).role === 'windward';

// rules.js is loaded BEFORE script.js but runs after it, so these reach it via a
// namespace rather than relying on cross-script lexical bindings.
window.Course = {
    routeLeg: (l) => routeLeg(l),
    legMarks: (l) => legMarks(l),
    legGoesUpwind: (l) => legGoesUpwind(l),
    pointOfSail: (b) => pointOfSail(b),
    isBeating: (b) => pointOfSail(b) === 'beat',
    legTargetsWindward: (l) => legTargetsWindward(l),
    windwardMarks: () => {
        const r = state.course && state.course.route && state.course.route[1];
        return (r && r.marks) || null;
    }
};

function legMid(leg) {
    const idx = legMarks(leg);
    if (!idx || !state.course.marks) return null;
    const a = state.course.marks[idx[0]], b = state.course.marks[idx[1]];
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ── What a mark IS, physically ────────────────────────────────────────────────
// A buoy is a 24-unit circle you can round from any side. A committee boat is a 30ft
// vessel lying to an anchor, and treating it as the same circle means sailing through
// eight metres of hull. `bodyR` is the bounding radius about the mark POINT, and
// `body` is the set of circles that actually collide.
//
// bodyR 12 for a buoy is the old `markRadius`, and every consumer is written as
// (constant + bodyR) so a course of plain buoys computes exactly the numbers it
// always did — the golden traces are the proof.
const MARK_BODIES = {
    // Half the 85x37px hull, as a 3-circle capsule down the centreline. r=19 covers the
    // beam; the two end circles sit far enough out to cover the bow and transom, which a
    // single circle leaves free for a boat to clip.
    committee: { r: 19, along: [-22, 0, 22], offset: 19 },
    // The coach launch: a 61x112px hull in its 130 frame. r=30 covers the beam, the end
    // circles reach the round bow and the outboard.
    coach:     { r: 30, along: [-30, 0, 30], offset: 30 }
};
const markBody = (kind) => MARK_BODIES[kind] || null;

// ── Which way a committee boat lies ───────────────────────────────────────────
// It is a vessel at anchor at one end of a line, not a buoy: it has a heading, and the
// heading is a FACT ABOUT THE LINE, frozen once here.
//
// Three things this deliberately is not:
//
// (1) NOT the live wind. `state.wind.direction` oscillates every frame, so a boat that
//     lay head-to-wind would swing with every puff — visual noise, and the sprite's
//     baked orange flag would spend the race fighting the real breeze.
// (2) NOT the leg direction. The perpendicular of the line's own vector puts the hull
//     exactly square to the line it defines, which is what reads as "the line ends
//     here" even on a skewed course where leg 1 is not perpendicular to the start.
// (3) NOT recomputed per leg. A line used twice — start, then finish — is travelled in
//     opposite directions, and a boat that re-derived its heading would spin 180 degrees
//     mid-race. FIRST USE wins, which is also what the real thing does: the committee
//     anchors for the start and does not turn around when the fleet comes back down.
//
// The sprite is also nudged outboard along the line, away from the far end, by half a
// beam. The mark POINT is untouched — every line-crossing, OCS and gate test still uses
// it — but the hull now sits clear of the line's sailable span, with the flagstaff on
// the point. That is where a real line is sighted from, and without it a boat starting
// at the committee-boat end has to sail through the hull to cross.
function orientCourseMarks() {
    const marks = (state.course && state.course.marks) || [];
    const route = (state.course && state.course.route) || [];
    for (const m of marks) {
        m.heading = null; m.drawX = m.x; m.drawY = m.y; m.body = null; m.bodyR = 12;
    }
    for (let i = 0; i < marks.length; i++) {
        const m = marks[i];
        const spec = markBody(m.kind);
        if (!spec) continue;

        // FIRST route entry that uses this mark. Route order is the order the course is
        // sailed, so entry 0 is the start and "first use" is the start line's setup.
        let k = -1, other = -1;
        for (let e = 0; e < route.length && k < 0; e++) {
            const idx = route[e].marks;
            if (!idx || idx.length !== 2) continue;
            if (idx[0] === i) { k = e; other = idx[1]; }
            else if (idx[1] === i) { k = e; other = idx[0]; }
        }
        if (k < 0 || !marks[other]) {
            // A vessel that is not a line end — a coach boat parked on the pond — still has a
            // hull to hit. Moored head-to-wind, on its point, no outboard nudge.
            const wd = (state.wind && state.wind.baseDirection) || 0;
            const nx = Math.sin(wd), ny = -Math.cos(wd);
            m.heading = wd;
            m.body = spec.along.map(d => ({ x: m.x + nx * d, y: m.y + ny * d, r: spec.r }));
            m.bodyR = Math.max(...m.body.map(c => Math.hypot(c.x - m.x, c.y - m.y) + c.r));
            continue;
        }

        // Direction of travel through the line: the ROUTE'S OWN crossing normal, which is
        // `dir * (gateDy, -gateDx)` over the entry's mark pair in the entry's order — the
        // exact vector updateBoatRaceState judges a crossing with. So the hull faces the way
        // a boat legally crosses, by construction.
        //
        // This used to point at the NEXT WAYPOINT instead and take whichever normal agreed
        // with it. That is only the same vector when the next mark happens to lie square off
        // the line; on Glacier Sound, whose rounding sits 60 degrees off the line's normal,
        // it chose the opposite one and moored the committee boat facing back down the course.
        // The authored `dir` cannot disagree with the rules engine, and a bearing to a mark
        // can.
        const gi = route[k].marks;
        const ga = marks[gi[0]], gb = marks[gi[1]];
        const gdx = gb.x - ga.x, gdy = gb.y - ga.y;
        const gl = Math.hypot(gdx, gdy) || 1;
        const sgnDir = (route[k].dir >= 0) ? 1 : -1;
        const nx = sgnDir * gdy / gl, ny = -sgnDir * gdx / gl;

        // Along the line, away from the other end — the outboard nudge below.
        const o = marks[other];
        let lx = o.x - m.x, ly = o.y - m.y;
        const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;

        // Sprite-up is zero heading (art-pipeline.md 3), so heading is the bow's bearing.
        m.heading = Math.atan2(nx, -ny);
        // Outboard: along the line, away from the other end.
        m.drawX = m.x - lx * spec.offset;
        m.drawY = m.y - ly * spec.offset;
        m.body = spec.along.map(d => ({ x: m.drawX + nx * d, y: m.drawY + ny * d, r: spec.r }));
        m.bodyR = Math.max(...m.body.map(c =>
            Math.hypot(c.x - m.x, c.y - m.y) + c.r));
    }
}

// `opts.light` builds the course for the CLUBHOUSE BOARD, not for racing: it skips the
// three genuinely slow steps — the validator, the compile's priced estimate (planner +
// nav-grid raster) and buildCoursePaths' router legs — plus the pressure-field scan,
// which gets a cheap regions-derived spread instead. Everything else is identical, so
// the board, the chart and the background render all work from real course data; a
// light course simply has no `dmc` (the chart draws straight legs) and approximate
// distance numbers. `state.course.loadState` records which build this is, and starting
// a race upgrades a light course to a full one first — see startRace.
function initCourse(opts) {
    const light = !!(opts && opts.light);
    // DESIGNED VENUE, from a venue document. Land is vector polygons in world
    // units and the course is AUTHORED — marks, route and wind direction are read,
    // not inferred.
    //
    // This replaces a chain of inference from a painted mask: wind computed square
    // to a green line, flipped to point away from the island, the line re-laid at
    // fleet width, then its vertex order flipped again so the crossing normal
    // pointed up-course. Both flips were wrong at some point, each in a way that
    // was only visible by sailing it. Values that are drawn should be read.
    //
    // EVERY venue with a document takes this path. It used to be gated on the `mask` fx,
    // which only Glacier Sound had, so the other nine could not be authored at all — the
    // editor could open a document they would never race. A venue is designed when a
    // document exists for it, and that is the whole test.
    const doc = window.VenueDoc.get(settings.venue);
    if (doc) {
        // The validator runs on the FULL build only — its findings matter before racing,
        // not while flicking through the board, and it costs real time on big venues.
        if (!light) {
            const problems = window.VenueDoc.validate(doc);
            const errors = problems.filter(p => p.level === 'error');
            for (const p of problems) console[p.level === 'error' ? 'error' : 'warn'](`[venue ${settings.venue}] ${p.msg}`);
            if (errors.length) console.error(`[venue ${settings.venue}] ${errors.length} error(s); course may be unsailable`);
        }

        const c = window.VenueDoc.compile(doc, light ? { light: true } : undefined);
        // THE DAY IS THE REGIONS. Both the mean direction and the mean speed are derived
        // from what the wind regions state over the course — there is no venue wind range
        // and no venue oscillation left to blend with.
        if (c.windBase !== null) {
            state.wind.baseDirection = c.windBase;
            state.wind.direction = c.windBase;
        }
        if (c.windBaseSpeed > 0) {
            state.wind.baseSpeed = c.windBaseSpeed;
            state.wind.speed = c.windBaseSpeed;
        }
        state.course = { marks: c.marks, boundary: c.boundary };
        // NOTE: legLength is deliberately NOT set here. It is the player's Course
        // Distance setting (the config slider writes it, resetGame preserves it),
        // and writing to it made an Arctic race silently resize the next Bay
        // course. The island cutoff is measured from the real start->mark distance
        // in updateRace, not from legLength.
        // COURSE TYPE IS A FACT ABOUT THE ROUTE, not about which venue you are on. A route
        // containing a rounding is an island course; one made of lines and gates is a
        // windward-leeward. Hardcoding 'islandRound' here was safe only while Glacier Sound
        // was the sole document — the moment a second venue authored a beat, every
        // islandRound branch (laylines, zone circles, the HUD waypoint) read the wrong course.
        state.course.type = c.roundMark ? 'islandRound' : 'wl';
        state.race.totalLegs = c.legs;
        state.course.route = c.route;
        state.course.islands = c.islands;      // replaced below, once the floes exist
        state.course.props = c.props || [];
        state.course.navIslands = c.islands;
        state.course.navVersion = 0;
        state.course.doc = doc;
        // The vector land, kept separate from course.islands (which also carries
        // drifting floes). Anything asking "is this point on land?" must test these
        // POLYGONS — the landmass bounding radius is 9388, more than half the
        // world, and reasoning from it silently broke floe placement, collision and
        // wind shadow on three separate occasions.
        //
        // AWASH SHAPES ARE NOT IN IT, so the name stays true and all three callers get the
        // right answer for free: a shoal is open water to the placement test (it is), a
        // floe drifts over one instead of being shoved off it (it floats), and the chart
        // does not ink it as a coastline (it is not one — it draws it as shallows below).
        state.course.landShapes = c.islands.filter(i => !i.awash);
        // Where SCENERY lives, as opposed to where boats may sail. Drifting ice is
        // placed and kept inside this, not inside the arena.
        state.course.scenery = c.scenery;
        // WHERE IN ITS CYCLE THE DAY STARTS. The document's phase is a fixed offset per
        // region (derived from the id, so regions never pulse in unison), and on its own it
        // meant every race on a venue met the identical wind at the identical clock time.
        //
        // A RACE IS A DAY, so the phase is rolled per race. Measured on Gatorgrass: with a
        // fixed phase, forty seeds sailed the same beat to the same second; seeded, the
        // spread is ~90 s p5-p95 on one beat. That is the race-to-race variety, and it is
        // REPEATABLE — same seed, same wind — so replays and the eval's paired seeds still
        // reproduce exactly.
        //
        // ⚠️ A PRIVATE STREAM, not the shared one. Drawing from the seeded RNG here would
        // shift every subsequent draw on every venue and retire the golden traces — the
        // same reason the floes take `seed + 11` and the squalls `seed + 77`. Mutating
        // `c.windRegions` in place is safe because compile() hands back a structuredClone.
        //
        // Period is left alone deliberately: it is the region's authored rhythm, and the
        // 180-degree separation rule is checked against the authored numbers.
        if (c.windRegions && c.windRegions.length) {
            const rngW = state.race.seed ? mulberry32(state.race.seed + 29) : Math.random;
            for (const r of c.windRegions) r.phase = (r.phase + rngW() * Math.PI * 2) % (Math.PI * 2);
        }
        state.course.windRegions = c.windRegions;
        state.course.currentRegions = c.currentRegions;
        state.course.rapidsRegions = c.rapidsRegions;
        state.course.gustRegions = c.gustRegions;
        // Timing is authored per venue when the document says so. Absent means the
        // game's own default, so a document that says nothing races as it always did.
        state.course.startTime = c.startTime;
        state.race.startTimerDuration = (c.startTime != null)
            ? c.startTime : (state.race.userStartTime || 30.0);
        // An authored limit wins; otherwise the one derived from the route. Either way a
        // designed course gets a limit measured from the course, not from legLength.
        state.course.cutoff = (c.cutoff != null) ? c.cutoff : c.cutoffAuto;
        state.course.description = c.description;
        state.course.roundMark = c.roundMark;
        // HAND-PLACED ICE. Position and shape are authored; drift velocity, spin and
        // wander are drawn from the race RNG, so the layout is yours and every race
        // still plays out differently. Added BEFORE the generator so generated floes
        // reject candidates that would land on top of authored ones.
        // Diagnostic ablation knobs (same spirit as window.__START / window.__NAV):
        // __NOFLOES strips the drifting ice entirely; __FLOEFRAC (0..1) keeps a
        // deterministic fraction of it — a difficulty dial for isolating where the
        // AI's pack-handling breaks.
        const floeFrac = (typeof window !== 'undefined' && window.__NOFLOES) ? 0
            : (typeof window !== 'undefined' && window.__FLOEFRAC != null) ? window.__FLOEFRAC : 1;
        if (c.ice && c.ice.length && floeFrac > 0) {
            const rngI = state.race.seed ? mulberry32(state.race.seed + 11) : Math.random;
            const authored = c.ice.map(f => {
                const floe = makeFloe(f.x, f.y, f.r, rngI, f.local.map(p => ({ x: p.x, y: p.y })));
                floe.authored = true;
                floe.id = f.id;
                floe.kind = f.kind;
                floe.windShadow = f.windShadow;
                floe.currentShadow = f.currentShadow;
                return floe;
            });
            // Density dial: null out the decimated entries AFTER the map, so the
            // shapeOrder indices below still line up (they index the authored array
            // by document position). RNG draws above are untouched either way.
            if (floeFrac < 1) {
                for (let fi = 0; fi < authored.length; fi++) {
                    if (Math.floor((fi + 1) * floeFrac) === Math.floor(fi * floeFrac)) authored[fi] = null;
                }
            }
            // IN DOCUMENT ORDER, not land-then-ice. `islands` is painted back to front and
            // is also the order collision and the nav graph walk, so it is the designer's
            // stacking rather than an artifact of which array a shape was stored in. A
            // document that lists its land first — every one of the ten does — rebuilds
            // exactly the array the old concat produced.
            const ordered = [];
            for (const o of (c.shapeOrder || [])) {
                const src = o.drift ? authored : state.course.islands;
                if (o.i >= 0 && src[o.i]) ordered.push(src[o.i]);
            }
            state.course.islands = ordered;
        }
        // ── The venue's own effects, which a document does NOT replace ──────────
        // A document authors GEOMETRY: land, arena, marks, route, wind, current, ice.
        // Weed beds, brash, the river's shore and the glacier's calving are venue
        // CHARACTER — generated per race from the seed, and they stay that way, because
        // freezing them would fix the one part of a venue that is supposed to feel alive.
        //
        // Same rng stream and same order as the generated path (river, ice, weeds), so a
        // venue that gains a document keeps the effects it always had.
        //
        // NO RANDOM ICE FLOES, though: where the ice is, is a design decision, and
        // scattering it per race made the one thing a designer most wants to place the
        // one thing they could not. `doc.ice` is the answer.
        // Pathfinding skips scenery a boat can never reach. Ice beyond the arena exists to
        // be looked at, and a shape marked `nav: false` is out by the designer's own say-so;
        // feeding either to the A* visibility graph is pure cost, and every extra node
        // multiplies expansion (the river's 82 banks once caused multi-hundred-ms replan
        // spikes). Run UNCONDITIONALLY: it used to be skipped when no ice was added, which
        // was fine while land was one coastline and wrong the moment land could opt out.
        // AWASH SHAPES ARE NOT NAV ISLANDS. `navIslands` is the obstacle list — the bots'
        // visibility planner inflates it and steers round every member, and the wind lee
        // is cast off it. A shoal is neither: there is nothing to steer round and nothing
        // standing in the breeze. What the router DOES need to know about it is the time
        // the crossing costs, and that arrives as a per-cell cost on the grid instead
        // (grid._shoal in buildCoursePaths).
        const b0 = state.course.boundary;
        state.course.navIslands = state.course.islands.filter(i =>
            !i.isBank && !i.awash && Arena.signedDist(b0, i.x, i.y) > -(i.radius + 120));
        // Awash WITH DRAG — a painted shallows zone is awash too, but it must not switch
        // on the per-boat shoalField sampling (it can never change the answer).
        state.course._hasShoals = state.course.islands.some(i => i.awash && i.shoalMul < 1);
        state.course._hasShallows = state.course.islands.some(i => i.paint && !i.veg && !i.tide);
        state.course._hasVeg = state.course.islands.some(i => i.veg);
        state.course._hasReefs = state.course.islands.some(i => i.reef);
        orientCourseMarks();
        // Ice sits where it will actually be BEFORE anything is drawn. This has to be on the
        // DOCUMENT path, not merely at the end of initCourse: every venue is a document now,
        // so the tail below is the generated-course path and returns here without ever
        // reaching it.
        settleFloes();
        // Squalls spawn HERE, on the document path — the one place that is always
        // downstream of the wind this course actually races on (c.windBase, applied
        // above), whichever door the caller came through. Both earlier homes read a
        // wind that was later overwritten: resetGame's random roll, then resetGame
        // after applyVenueConditions — and each time the cells froze a stale course
        // and marched off the map. Their layout keys on the race seed, so restarting
        // re-deals them; the trades they march are this course's own.
        initSqualls();
        // The eruption cycle, the same way and for the same reasons: it keys on the race
        // seed and on the placed props, and every door into a race passes through here.
        if (window.Volcano) Volcano.init();
        // The tide, the same way: the field is built from the document here, on the one path
        // every race takes, and its clock is the race clock so nothing needs resetting.
        if (window.Tide) Tide.init();
        // Traffic, on the same path and for a simpler reason: it needs state.course.doc,
        // and every door into a race passes through here. Its vessels are pure functions
        // of the race clock, so this only compiles the path tables — there is no live
        // position to reset and restarting re-runs the same schedule identically.
        initTraffic();
        // The venue's animals, after traffic (porpoises run with the ships) and the islands
        // (the gulls perch on a named shape).
        if (window.Wildlife) Wildlife.init();
        // Same reason, and the same trap: this is the path every venue takes. It samples
        // the mean wind over sailable WATER, so it needs the boundary and every land shape
        // — floes included — already settled. The LIGHT build substitutes a spread read
        // straight off the authored regions: the board's "10–15 kt" does not need a
        // field scan that costs most of a second on a big venue.
        if (light) lightWindSpread(c); else computeWindPressureScale();
        // SEA STATE, and the same trap a third time — this is the path every venue takes,
        // and the tail of initCourse is never reached. After the compile has written the
        // day's mean wind, because the swell is aligned with the breeze that built it and
        // cannot be laid out before the breeze is known. A document with no `swell` block
        // gets none, which is every venue but Bluewater Bonanza.
        if (window.Swell) window.Swell.configure(doc, state.wind.baseDirection);
        // Whatever the last race left in the air is not this race's weather.
        if (window.SeaFX) window.SeaFX.reset();
        if (window.IceFX) window.IceFX.reset();
        // The router's leg paths are for RACING — the AI's carrot, the ruler, the leg
        // splits. The board's chart falls back to straight legs when `dmc` is null, so
        // the light build states that honestly instead of paying a second for it.
        // The light build still gets the SAVED paths (see VenueDoc.savedPaths): reading a
        // polyline costs nothing, and the chart draws the legs the race will measure.
        if (light) state.course.dmc = (window.VenueDoc && window.VenueDoc.savedPaths) ? window.VenueDoc.savedPaths(doc) : null;
        if (light) state.course.goalFields = null;      // a light build has no grid to field
        else buildCoursePaths();
        // Which build this is, and of what — startRace reads both to decide whether the
        // world is ready to race or needs the full load first.
        state.course.venueKey = settings.venue;
        state.course.loadState = light ? 'light' : 'full';
        return;
    }

    const d = state.wind.baseDirection, ux = Math.sin(d), uy = -Math.cos(d), rx = -uy, ry = ux;
    // Start-line width. With a 10-boat fleet, 550u packs lane-neighbours ~43u apart —
    // tighter than the boats' ~50u collision diameter — so the start jams structurally.
    // Tunable for sweeps.
    const _SPw = (typeof window !== 'undefined' && window.__START) ? window.__START : {};
    const w = _SPw.width != null ? _SPw.width : 1100;
    const dist = state.race.legLength || 4000;
    state.course = {
        marks: [
            { x: -rx*w/2, y: -ry*w/2, type: 'start' }, { x: rx*w/2, y: ry*w/2, type: 'start' },
            { x: ux*dist - rx*w/2, y: uy*dist - ry*w/2, type: 'mark' }, { x: ux*dist + rx*w/2, y: uy*dist + ry*w/2, type: 'mark' }
        ],
        boundary: { x: ux*dist/2, y: uy*dist/2, radius: Math.max(3500, dist + 500) } // Adjust boundary for long courses
    };

    // A generated course is always a windward-leeward. 'islandRound' is a fact about a
    // ROUTE — a rounding in it — so a designed course derives its own type above and this
    // branch, which has no route to read, cannot produce one.
    state.course.type = 'wl';
    state.course.roundMark = null;
    state.race.totalLegs = state.race.userLegs || 4;
    if (state.course.type === 'islandRound') state.race.totalLegs = 2;
    state.course.route = buildRoute(state.course.type, state.race.totalLegs);

    // No islands on a generated course: land is a thing a DOCUMENT authors. The random
    // island generator (and its navigability flood-fill) is gone — nothing had set
    // islandCount above zero since land moved into the venue documents.
    state.course.islands = [];

    // A GENERATED course has no venue features left to add. Weed beds, brash, the river's
    // banks and shore, the drifting floes and the wildlife on them were all per-race
    // scatter, and every one of them landed on top of whatever a designer had authored —
    // which is exactly what made a venue hard to edit. Geometry comes from the document
    // now, and nothing arrives uninvited.

    // Perf: a shape marked `nav: false` is out of the visibility graph by the designer's
    // own say-so. Feeding every one to A* is pure cost — the river's 82 banks once caused
    // multi-hundred-ms replan spikes.
    state.course.navIslands = state.course.islands.filter(i => !i.isBank);
    // A generated course has no land at all, so no shoals either — but the flag has to be
    // written rather than left over from the last venue raced, or a document's bar would
    // keep taxing boats on a course that has none.
    state.course._hasShoals = false;
    state.course._hasShallows = false;
    state.course._hasVeg = false;
    state.course._hasReefs = false;
    state.course.props = [];   // generated courses author no scenery
    state.course.navVersion = 0; // bumped when floes drift, so the planner's inflated cache refreshes
    orientCourseMarks();
    // Ice sits where it will actually be BEFORE anything is drawn, so no berg is ever seen
    // walking out of a headland it was authored inside. After navIslands, because the push
    // reads landShapes and rebuilds each floe's collider.
    settleFloes();
    // Last, because it samples the mean wind over sailable WATER — it needs the boundary
    // and every land shape already in place, floes included.
    computeWindPressureScale();
    // No document, so no sea state — and clear whatever the last venue laid out, so a
    // generated course can never inherit the ocean's swell.
    if (window.Swell) window.Swell.configure(null, 0);
    if (window.SeaFX) window.SeaFX.reset();
    if (window.IceFX) window.IceFX.reset();
    buildCoursePaths();
}

// THE RULER, built once per course. See CoursePath in planner.js for why it is one shared
// path per leg rather than one per boat, and why it avoids only static land.
function buildCoursePaths() {
    state.course.dmc = null;
    state.course.goalFields = null;
    // WHAT THIS COURSE REQUIRES OF EACH ROUNDING. Stamped here so the leg engine tests
    // against the geometry rather than a constant — see CoursePath.requiredSweep.
    if (typeof CoursePath !== 'undefined' && state.course.route) {
        for (let i = 0; i < state.course.route.length; i++) {
            const e = state.course.route[i];
            if (e && e.kind === 'round' && e.mark) e.mark.reqSweep = CoursePath.requiredSweep(state.course.marks, state.course.route, i);
        }
    }
    if (typeof CoursePath === 'undefined' || !state.course.marks || !state.course.route) return;
    try {
        // THE GRID FIRST. A visibility graph cannot path a keyholed coastline — Glacier
        // Sound's land is one such ring, and the planner emitted a straight line through
        // the island. The grid only supplies LAND AVOIDANCE here; the waypoints are the
        // course's own (start line, gate midpoints, zone rim, rounding arc), with no wind
        // and no tactical approach offsets in them.
        let grid = null;
        const doc = window.VenueDoc && window.VenueDoc.get(settings.venue);
        if (window.SailCheck && doc) {
            // AWASH SHAPES ARE NOT LAND HERE. `fixed` becomes the grid's walls, and a
            // shoal stamped as a wall is a shortcut the router can never take and the
            // player can — the two would disagree about the course on every bar. It is
            // priced instead, below, as the seconds the crossing actually costs.
            const fixed = window.VenueDoc.shapes(doc).filter(sh => {
                const t = window.VenueDoc.traits(sh);
                return t.motion === 'fixed' && !t.awash;
            });
            // CP1 (2026-08-08, lagoon night): HARD CONTACT PROPS ARE WALLS HERE
            // TOO. The compile turns them into hidden collider shapes so that
            // "collision, the drag field, the router and the chart all meet
            // them as ordinary shapes" — but THIS grid builds from the raw
            // document's shapes, not the compiled islands, and the promise
            // broke: 32 of the lagoon's 37 coral heads blocked ZERO grid cells
            // while physics stopped boats dead on them (owner-observed; the
            // model-accuracy ruling applies). Same 12-gon at the same scaled
            // contactR as compileVenueDoc emits. Soft props stay out of the
            // walls by the same awash rule as any bar — they are priced by the
            // shoal field below, which samples the COMPILED islands and
            // already carries their hidden shoals. Venues with no props add
            // nothing: byte-identical grids by construction.
            for (const p of (doc.props || [])) {
                if (!window.VenueDoc.PROP_KINDS[p.kind]) continue;
                const T = window.VenueDoc.propTraits(p);
                if (T.contact !== 'hard' || T.motion !== 'fixed') continue;
                // The same rings compileVenueDoc emits — the traced outline where the kind has
                // one, the contactR 12-gon where it does not (VenueDoc.propHitRings).
                window.VenueDoc.propHitRings(p).rings.forEach((ringC, i) =>
                    fixed.push({ id: p.id + (i ? `.hit${i + 1}` : '.hit'), kind: 'isle', outer: ringC, holes: [], hidden: true }));
            }
            // Icy venues keep centre-sampled land: sub-cell shore threads are a
            // trap under floe drift, and every arctic margin constant was priced
            // on this sampling. See buildGridRaw.
            const hasDrift = window.VenueDoc.shapes(doc).some(sh => window.VenueDoc.traits(sh).motion !== 'fixed');
            grid = window.SailCheck.buildGrid(fixed, state.course.boundary, null,
                hasDrift ? { noSubsample: true } : null);
            // Kept for the periodic floe-aware rebuild (refreshBotGrid): same land,
            // fresh floe circles, every few seconds.
            state.course._gridFixed = fixed;
            // ── SHOAL COST, per cell ────────────────────────────────────────
            // The multiplier the boat will actually feel, sampled at each cell centre and
            // stored as its RECIPROCAL, because the router's base cost is time: water that
            // sails at 0.5x takes 2x as long to cross, and 2 is what A* must add up. That
            // makes the detour arithmetic honest all by itself — a bar is worth going round
            // exactly when going round is shorter in seconds — so there is no hint weight
            // here to tune, and none that could invert the topology.
            //
            // Keyed like the lee mask, and for the same reason: buildGrid caches grids by
            // LAND, and shoals are no longer land, so two venues with the same coast could
            // hand back the same grid object. The key carries the shoals, so a cached grid
            // whose bars differ rebuilds this field instead of racing on the wrong one.
            if (grid) {
                const shoals = (state.course.islands || []).filter(i => i.awash);
                // Vent boils price like shoals (volcano.js, Volcano.boilMul): the same field,
                // keyed the same way, so a venue that gains a vent rebuilds its costs.
                const vents = (state.volcano && window.Volcano) ? state.volcano.vents : [];
                let sKey = '';
                for (const s of shoals) sKey += `|${s.id},${s.shoalMul},${s.shoalFeather},${s.x | 0},${s.y | 0},${s.radius | 0}`;
                for (const b of vents) sKey += `|vent,${b.x | 0},${b.y | 0},${b.a | 0},${b.b | 0},${b.ang.toFixed(2)},${b.strength}`;
                if (grid._shoalKey !== sKey) {
                    grid._shoalKey = sKey;
                    if (!shoals.length && !vents.length) {
                        grid._shoal = null;
                    } else {
                        // ── PRICE THE TRANSIT, NOT THE EQUILIBRIUM ──────────
                        // `1/shoalMul` is the STEADY-STATE cost: what a cell costs a
                        // boat that has been on the bar long enough to settle. The
                        // physics does not settle on contact — shoalMul multiplies the
                        // TARGET (~12219) and boat.speed chases it through
                        // SPEED_DECAY_DOWN, a ~9.25s constant. A boat crossing a bar in
                        // 1.5s moves ~15% of the way there and pays almost nothing.
                        //
                        // Measured against the owner's three fingerprint-verified lagoon
                        // laps (`_shoal_model.js`, 11 crossings, his RECORDED speed as
                        // ground truth): the steady-state price is wrong by a mean 83%
                        // and up to 237% — it charges 4.13x for a crossing that truly
                        // costs 1.26x — and it is wrong in one direction, always
                        // overcharging. That phantom is what makes the router pay ~1329u
                        // of detour on lagoon leg 2 to avoid a bar he sails straight over
                        // in 20.3s against the detour's ~27s.
                        //
                        // Solving the lag for a boat entering at open-water speed V and
                        // running s units into the bar:
                        //     u(s) = m + (1 - m) * exp(-s / (V * tau))
                        // and the cell's honest cost is 1/u. Same probe: mean |error|
                        // 2%, mean error -0% — unbiased, with NO fitted parameter. tau
                        // comes from SPEED_DECAY_DOWN and m from the field, so this
                        // tracks the physics rather than approximating it, and a change
                        // to either flows through here automatically.
                        //
                        // ⭐ IT IS ALSO SELF-SCOPING, which is why it is safe on swamp.
                        // The crossover length is V*tau, so it discounts only crossings
                        // short against the boat's own reach. Lagoon at ~100 u/s has a
                        // ~1200u scale and its 1-2.5s bars go nearly free; SWAMP at ~35
                        // u/s has a ~320u scale and its crossings are a median 13.0s with
                        // 64% running longer than tau (`_shoal_exposure.js`) — already at
                        // equilibrium, so it keeps the full price it has today. The
                        // venues that need opposite answers get them from one formula.
                        const N = grid.n, sc = new Float32Array(N * N);
                        const mm = new Float32Array(N * N);
                        // distance INTO the shoal, in cells: 0 outside, then a two-pass
                        // chamfer from the rim. Cheap, and exact enough at res-scale
                        // beside a crossover length of hundreds of units.
                        const dist = new Float32Array(N * N).fill(Infinity);
                        for (let j = 0; j < N; j++) {
                            for (let i = 0; i < N; i++) {
                                const [wx, wy] = grid.world(i, j);
                                let m = window.VenueDoc.shoalField(shoals, wx, wy);
                                if (vents.length) m = Math.min(m, Volcano.boilMul(wx, wy));
                                mm[j * N + i] = m;
                                if (m >= 0.999) dist[j * N + i] = 0;   // open water = the rim
                            }
                        }
                        const D1 = 1, D2 = Math.SQRT2;
                        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
                            const id = j * N + i; let d = dist[id];
                            if (i > 0) d = Math.min(d, dist[id - 1] + D1);
                            if (j > 0) d = Math.min(d, dist[id - N] + D1);
                            if (i > 0 && j > 0) d = Math.min(d, dist[id - N - 1] + D2);
                            if (i < N - 1 && j > 0) d = Math.min(d, dist[id - N + 1] + D2);
                            dist[id] = d;
                        }
                        for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
                            const id = j * N + i; let d = dist[id];
                            if (i < N - 1) d = Math.min(d, dist[id + 1] + D1);
                            if (j < N - 1) d = Math.min(d, dist[id + N] + D1);
                            if (i < N - 1 && j < N - 1) d = Math.min(d, dist[id + N + 1] + D2);
                            if (i > 0 && j < N - 1) d = Math.min(d, dist[id + N - 1] + D2);
                            dist[id] = d;
                        }
                        // V: the boat's own nominal reaching speed in THIS venue's air,
                        // from the same polar the physics uses — so light-air venues get
                        // a short crossover and fast ones a long one, with no venue test.
                        const wKt = (state.wind && state.wind.spread && state.wind.spread.med > 0)
                            ? state.wind.spread.med : (state.wind ? state.wind.speed : 10);
                        const vNom = Math.max(1, getTargetSpeed(1.57, false, wKt) * 0.25 * 60);
                        const scale = Math.max(1, vNom * SPEED_TAU_DOWN);
                        // ⚠️ THE DECAY IS IN TIME, AND THIS FIELD IS INDEXED BY
                        // DISTANCE. Substituting t = s/V into the time solution
                        // (u = m + (1-m)e^{-t/tau}) assumes the boat holds V all
                        // the way across, but it is SLOWING — so it covers less
                        // distance per second than that, and the true decay in
                        // DISTANCE is faster. The error grows as m shrinks, and
                        // it is not academic: the exponential-in-distance version
                        // under-priced swamp's bars (m down to 0.1) badly enough
                        // to send boats into them — swamp med +6.0, mean +21.5,
                        // land contacts +58%, while lagoon (m 0.2, but crossed in
                        // 1-2s) was -43.0.
                        //
                        // Do it exactly instead. With u = v/V and x = s/(V*tau),
                        //     du/dx = (m - u)/u
                        // separates and integrates to the closed form
                        //     x = (1 - u) - m * ln((u - m)/(1 - m))
                        // which is monotone in u, so invert by bisection per cell.
                        // Verified against direct integration of the ODE to 5
                        // decimal places for m in {0.1,0.2,0.31,0.5}, and against
                        // the owner's own longest lagoon crossing: at x=0.62 this
                        // gives u=0.624 where the exponential said 0.68 and his
                        // measured exit speed was 0.64.
                        const invU = (x, m) => {
                            if (!(x > 0)) return 1;
                            let lo = m + 1e-6, hi = 1;
                            for (let it = 0; it < 40; it++) {
                                const mid = (lo + hi) * 0.5;
                                // x is DECREASING in u: deeper in => slower
                                const xm = (1 - mid) - m * Math.log((mid - m) / (1 - m));
                                if (xm > x) lo = mid; else hi = mid;
                            }
                            return (lo + hi) * 0.5;
                        };
                        for (let k = 0; k < N * N; k++) {
                            const m = mm[k];
                            if (m >= 0.999) { sc[k] = 1; continue; }
                            // ⚠️ TWICE the rim distance, and this is exact rather
                            // than cautious. The state variable in the solution
                            // above is distance TRAVELLED inside the bar; this
                            // field is indexed by distance to the nearest RIM.
                            // They agree while the boat sails IN and diverge on
                            // the way OUT — indexed by rim distance the boat
                            // "un-slows" as it approaches the far edge, which it
                            // does not do; it stays slow until it exits. That
                            // under-prices every bar, worst where boats linger.
                            //
                            // A straight chord through a bar of local half-width W
                            // visits each depth d TWICE: at travelled distance d
                            // going in, and 2W-d coming out. So
                            //     grid total = int_0^{2W} f(depth(s)) ds
                            //                = 2 * int_0^W f(d) dd
                            // and choosing f(d) = 1/u(2d) gives, with sigma = 2d,
                            //     = int_0^{2W} dsigma / u(sigma)
                            // which is exactly the true cost of the crossing. The
                            // factor is a consequence of the geometry, not a knob,
                            // and it needs no knowledge of W.
                            const s = 2 * (dist[k] === Infinity ? 0 : dist[k]) * grid.res;
                            const u = invU(s / scale, m);
                            sc[k] = 1 / Math.max(m, Math.min(1, u));
                        }
                        // ⚠️ A BOIL IS PRICED AT ITS STEADY STATE, NOT ITS TRANSIT. The lag
                        // model above is right for a bar, where the physics lets speed
                        // drift toward the target and a 2 s crossing costs little. A vent's
                        // boil SCRUBS speed on contact (BOIL_SCRUB, physics.js), so the lag
                        // model under-prices it by an order of magnitude — measured 1.07
                        // for a crossing that halves boat speed in two seconds. The floor
                        // is the boil's own multiplier, and it applies only where a boil is.
                        if (vents.length) {
                            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
                                const k = j * N + i;
                                const [wx, wy] = grid.world(i, j);
                                const bm = Volcano.boilMul(wx, wy);
                                if (bm < 0.999) sc[k] = Math.max(sc[k], 1 / Math.max(0.08, bm));
                            }
                        }
                        grid._shoal = sc;
                    }
                }
            }
        }
        // The bots route on this same grid. Their visibility planner cannot inflate a
        // keyholed coastline (see RoutePlanner.updateIslands), so on a designed venue
        // static land belongs to the grid and only drifting floes stay in the graph.
        // The tide's ground per cell, so the router can price a cell by the water it will
        // find on arrival (Tide.routeCost in pathSailable). Before the wind stamp: the
        // safe grid below copies whatever is on the object.
        if (state.tide && window.Tide) Tide.stampGrid(grid);
        state.course.botGrid = grid;
        state.course._botGridStatic = grid;
        state.course._botGridT = null;
        state.course._tideStampT = null;
        // LEE-SHORE MASK for the bots' sailable router. A cell with blocked water a
        // few cells DOWNWIND is a place the breeze sets a boat onto the rocks; tax
        // it so routes run along windward shores and channel spines instead. Uses
        // the mean regional field (no gusts, race start phase) — a one-time build.
        if (grid) {
            // The mask samples the wind in EVERY cell — N² region blends — so it is keyed
            // on what it depends on and skipped when nothing changed. The grid object
            // itself is cached by SailCheck now, so the mask rides along on it: dragging a
            // mark rebuilds neither the grid nor this.
            let leeKey = `${state.wind.baseDirection}|${state.wind.baseSpeed}`;
            for (const r of (state.course.windRegions || [])) {
                leeKey += `|${r.direction},${r.speed},${r.dirVar},${r.speedVar},${r.period},${r.falloff},${r.bb ? r.bb.minX + r.bb.maxY : 0},${r.poly ? r.poly.length : 0}`;
            }
            if (grid._leeKey !== leeKey) {
            grid._leeKey = leeKey;
            const N = grid.n, lee = new Float32Array(N * N);
            const wfx = new Float32Array(N * N), wfy = new Float32Array(N * N);
            // Per-cell wind, quantized for the TIME-COST table (16 direction bins x
            // 6 speed bins — see SailCheck.buildTimeCost). Routing on TIME from the
            // real polar is what the sailing-routing literature (isochrone methods)
            // does: beating, reaching and running then price themselves and the
            // router stops needing hand-tuned upwind fudges.
            const wbin = new Uint8Array(N * N);
            const SPDS = [8, 12, 16, 20, 25, 30];
            const MARCH = 5, LEE_W = 2.5;
            // THE DAY'S MEAN, not the bake instant. This stamp is cached on the grid and
            // keyed by leeKey above, which carries neither `r.phase` nor `state.time` —
            // and must not, because a static stamp that varied with the day's phase would
            // be a different router every race. The oscillator made getWindAt a function
            // of both (page-load bakes even ran on UNSEEDED phases, so every process
            // shipped a different router — the bay golden-verify failures). regionWindAt
            // under WIND_MEAN_FIELD is the field this comment always claimed: no gusts,
            // no lee, no live shift, oscillator at zero.
            WIND_MEAN_FIELD = true;
            try {
            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    const id = j * N + i;
                    if (!grid.nav[id]) continue;
                    const [wx, wy] = grid.world(i, j);
                    const w = regionWindAt(wx, wy);
                    const wd = w.direction;
                    // Unit vector TOWARD the wind (the unsailable direction), per cell —
                    // the router prices beating with it, see pathSailable.
                    wfx[id] = Math.sin(wd); wfy[id] = -Math.cos(wd);
                    const dBin = ((Math.round(wd / (Math.PI * 2 / 16)) % 16) + 16) % 16;
                    let sBin = 0, sBest = Infinity;
                    for (let s = 0; s < SPDS.length; s++) {
                        const dd = Math.abs((w.speed || 0) - SPDS[s]);
                        if (dd < sBest) { sBest = dd; sBin = s; }
                    }
                    wbin[id] = dBin * 6 + sBin;
                    // Flow direction (where the wind pushes you): downwind of here.
                    const fx = -Math.sin(wd), fy = Math.cos(wd);
                    for (let k = 1; k <= MARCH; k++) {
                        const ci = Math.round(i + fx * k), cj = Math.round(j + fy * k);
                        if (!grid.at(ci, cj)) {
                            lee[id] = LEE_W * (MARCH - k + 1) / MARCH;
                            break;
                        }
                    }
                }
            }
            } finally { WIND_MEAN_FIELD = false; }
            grid._leeW = lee;
            grid._wfx = wfx; grid._wfy = wfy;
            grid._wbin = wbin;
            }
        }
        if (!state._dmcPlanner) state._dmcPlanner = new RoutePlanner();
        // THE DOCUMENT'S SAVED PATHS, when it carries current ones — the same polylines the
        // board's chart drew (see VenueDoc.savedPaths). Routing here is the fallback for a
        // document not saved from the editor since its course or land changed, and it says
        // so. ⚠️ Decided HERE, after the grid: everything above — botGrid, the lee stamp —
        // is the AI's, and an early return that skipped it left the bots with no nav grid.
        const saved = doc && window.VenueDoc.savedPaths ? window.VenueDoc.savedPaths(doc) : null;
        if (saved) state.course.dmc = saved;
        else {
            if (doc) console.warn('[dmc] ' + settings.venue + ': no current course.paths in the document — routing at load; Save it in editor.html');
            state.course.dmc = CoursePath.build(state.course.marks, state.course.route,
                                                state.course.islands || [], state._dmcPlanner,
                                                'dmc-' + (state.course.navVersion || 0),
                                                (state.tide && window.Tide) ? Tide.safeGrid(grid) : grid);
        }
        // GOAL FIELDS (Sep 14 2026): one precomputed distance-and-direction field per goal, read by
        // the off-screen chip, the progress dial and the leaderboard — see js/sim/goalfield.js. Built
        // on the STATIC grid: floes drift, fields do not. Needs the wind stamp above for the cone
        // metric, so it comes last.
        // ON THE TIDE'S SAFE GRID where there is one: the path line, the progress dial and the
        // ranking run on the water that is always there — the channel — and the shortcuts
        // across the flats are the player's own discovery (the floe rule, applied to mud).
        const gfGrid = state.course._botGridStatic || grid;
        state.course.goalFields = window.GoalField
            ? window.GoalField.build((state.tide && window.Tide) ? Tide.safeGrid(gfGrid) : gfGrid, state.course.route, state.course.marks) : null;
        // ...and a second set over ALL the water for the RANKING alone, so a boat crossing
        // the flats is scored by where she is, not by the channel she left (getBoatProgress).
        state.course.goalFieldsRank = (state.tide && window.Tide && window.GoalField)
            ? window.GoalField.build(gfGrid, state.course.route, state.course.marks) : null;
    } catch (e) {
        console.warn('[dmc] course path build failed', e);
        state.course.dmc = null;
        state.course.goalFields = null;
    }
}


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
        state.course._hasShallows = state.course.islands.some(i => i.paint && !i.veg);
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
        // Traffic, on the same path and for a simpler reason: it needs state.course.doc,
        // and every door into a race passes through here. Its vessels are pure functions
        // of the race clock, so this only compiles the path tables — there is no live
        // position to reset and restarting re-runs the same schedule identically.
        initTraffic();
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
        if (light) state.course.dmc = null; else buildCoursePaths();
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
                const rC = T.contactR, ringC = [];
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * Math.PI * 2;
                    ringC.push([p.x + rC * Math.sin(a), p.y - rC * Math.cos(a)]);
                }
                fixed.push({ id: p.id + '.hit', kind: 'isle', outer: ringC, holes: [], hidden: true });
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
                let sKey = '';
                for (const s of shoals) sKey += `|${s.id},${s.shoalMul},${s.shoalFeather},${s.x | 0},${s.y | 0},${s.radius | 0}`;
                if (grid._shoalKey !== sKey) {
                    grid._shoalKey = sKey;
                    if (!shoals.length) {
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
                                const m = window.VenueDoc.shoalField(shoals, wx, wy);
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
                        grid._shoal = sc;
                    }
                }
            }
        }
        // The bots route on this same grid. Their visibility planner cannot inflate a
        // keyholed coastline (see RoutePlanner.updateIslands), so on a designed venue
        // static land belongs to the grid and only drifting floes stay in the graph.
        state.course.botGrid = grid;
        state.course._botGridStatic = grid;
        state.course._botGridT = null;
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
        state.course.dmc = CoursePath.build(state.course.marks, state.course.route,
                                            state.course.islands || [], state._dmcPlanner,
                                            'dmc-' + (state.course.navVersion || 0), grid);
    } catch (e) {
        console.warn('[dmc] course path build failed', e);
        state.course.dmc = null;
    }
}


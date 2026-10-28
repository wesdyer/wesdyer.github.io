// regatta/js/sim/collision.js — collision detection and resolution: hull
// polygons, SAT tests, boat/mark/near-miss checks, rounding & foul constants,
// circle/hull-poly tests, traffic and island collisions, and the rule-19
// ledger. Resolution order (boats, marks, traffic, land last) is set by
// update() in script.js. Classic script; global scope. Extracted verbatim from
// script.js (refactor 2026-08-24).
const HULL_LOCALS = [
    {x: 0, y: -25}, {x: 15, y: -5}, {x: 15, y: 20},
    {x: 12, y: 30}, {x: -12, y: 30}, {x: -15, y: 20}, {x: -15, y: -5}
];
// Taking a POSE rather than a boat, so the previous frame's hull can be reconstructed from
// `lastPos` + `prevHeading` instead of cached alongside them. A cached copy is a second
// source of truth for where the boat was, and it went stale the moment anything drove
// updateBoatRaceState without going through updateBoat — which the gate tests do.
function hullPolygonAt(x, y, heading) {
    const cos = Math.cos(heading), sin = Math.sin(heading);
    return HULL_LOCALS.map(p => ({
        x: x + (p.x * cos - p.y * sin),
        y: y + (p.x * sin + p.y * cos)
    }));
}
function getHullPolygon(boat) { return hullPolygonAt(boat.x, boat.y, boat.heading); }

// How far the boat's LEADING EDGE is over a line — the quantity RRS judges a start by, and
// therefore the one the start AI has to steer. `normalize` scales to real units; unnormalized
// keeps the raw cross-product the approach timer was written against.
// ⚠️ SIGNED THE WAY THE ROUTE SAYS THE LINE IS CROSSED, not the way its two marks happen
// to be ordered in the array. `startCrossNormal()` already makes that point for the
// placement and the OCS test; this function is the AI's own view of the same line and it
// was the one place still reading the raw mark order.
//
// Two of the ten venues author their start entry with `dir: -1` (Bluewater and Redrock,
// both gate starts). On those, every caller here got the sign INVERTED — so the prestart
// read a boat correctly sitting behind the line as OVER EARLY, and `getStartCommand`'s
// retreat branch backs off by `STAGE + pDist`, which grows as she retreats. A runaway.
// Measured before the fix: the fleet's median distance from the line went -386 -> -1731
// on ocean and -383 -> -1078 on redrock through the prestart, against -419 -> -128 on bay.
// They sailed away from the line for the whole prestart and only turned for it at the gun.
function hullLineOffset(boat, m0, m1, normalize, sgn) {
    const dx = m1.x - m0.x, dy = m1.y - m0.y;
    const len = normalize ? (Math.hypot(dx, dy) || 1) : 1;
    const s = sgn != null ? sgn : startCrossSign();
    let best = -Infinity;
    for (const p of hullPolygonAt(boat.x, boat.y, boat.heading)) {
        const d = s * ((p.x - m0.x) * dy - (p.y - m0.y) * dx) / len;
        if (d > best) best = d;
    }
    return best;
}

function projectPolygon(axis, poly) {
    let min = Infinity, max = -Infinity;
    for (const p of poly) {
        const dot = p.x * axis.x + p.y * axis.y;
        if (dot < min) min = dot;
        if (dot > max) max = dot;
    }
    return { min, max };
}

function projectCircle(axis, center, radius) {
    const dot = center.x * axis.x + center.y * axis.y;
    return { min: dot - radius, max: dot + radius };
}

function getAxes(poly) {
    const axes = [];
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
        const len = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
        axes.push({ x: -edge.y / len, y: edge.x / len });
    }
    return axes;
}

function satPolygonPolygon(polyA, polyB) {
    let overlap = Infinity;
    let smallestAxis = null;
    const axes = [...getAxes(polyA), ...getAxes(polyB)];

    for (const axis of axes) {
        const p1 = projectPolygon(axis, polyA);
        const p2 = projectPolygon(axis, polyB);
        if (p1.max < p2.min || p2.max < p1.min) return null;
        const o = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (o < overlap) {
            overlap = o;
            smallestAxis = axis;
        }
    }

    const centerA = polyA.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const centerB = polyB.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const dirX = (centerB.x/polyB.length) - (centerA.x/polyA.length);
    const dirY = (centerB.y/polyB.length) - (centerA.y/polyA.length);

    if (dirX * smallestAxis.x + dirY * smallestAxis.y < 0) {
        smallestAxis.x = -smallestAxis.x;
        smallestAxis.y = -smallestAxis.y;
    }
    return { overlap, axis: smallestAxis };
}

function satPolygonCircle(poly, circleCenter, radius) {
    let overlap = Infinity;
    let smallestAxis = null;
    let axes = getAxes(poly);

    let minDistSq = Infinity;
    let closestVertex = null;
    for(const p of poly) {
        const dSq = (p.x - circleCenter.x)**2 + (p.y - circleCenter.y)**2;
        if(dSq < minDistSq) { minDistSq = dSq; closestVertex = p; }
    }
    const axisToCenter = { x: circleCenter.x - closestVertex.x, y: circleCenter.y - closestVertex.y };
    const len = Math.sqrt(axisToCenter.x**2 + axisToCenter.y**2);
    if (len > 1e-5) axes.push({ x: axisToCenter.x / len, y: axisToCenter.y / len });

    for (const axis of axes) {
        const p1 = projectPolygon(axis, poly);
        const p2 = projectCircle(axis, circleCenter, radius);
        if (p1.max < p2.min || p2.max < p1.min) return null;
        const o = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (o < overlap) { overlap = o; smallestAxis = axis; }
    }

    const centerA = poly.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const dirX = circleCenter.x - (centerA.x/poly.length);
    const dirY = circleCenter.y - (centerA.y/poly.length);

    if (dirX * smallestAxis.x + dirY * smallestAxis.y < 0) {
        smallestAxis.x = -smallestAxis.x;
        smallestAxis.y = -smallestAxis.y;
    }
    return { overlap, axis: smallestAxis };
}

function checkBoatCollisions(dt) {
    const broadRadius = 40;
    for (let i = 0; i < state.boats.length; i++) {
        const b1 = state.boats[i];
        if (b1.raceState.finished && b1.fadeTimer <= 0) continue;

        const poly1 = getHullPolygon(b1);
        for (let j = i + 1; j < state.boats.length; j++) {
            const b2 = state.boats[j];
            if (b2.raceState.finished && b2.fadeTimer <= 0) continue;

            const dx = b2.x - b1.x, dy = b2.y - b1.y;
            if (dx*dx + dy*dy > (broadRadius*2)**2) continue;

            const poly2 = getHullPolygon(b2);
            const res = satPolygonPolygon(poly1, poly2);

            if (res) {
                if (window.onRaceEvent && state.race.status === 'racing') {
                    window.onRaceEvent('collision_boat', { boat: b1, other: b2 });
                    window.onRaceEvent('collision_boat', { boat: b2, other: b1 });
                }

                const tx = res.axis.x * res.overlap * 0.5;
                const ty = res.axis.y * res.overlap * 0.5;
                b1.x -= tx; b1.y -= ty;
                b2.x += tx; b2.y += ty;

                // Physics Response: Angle dependent friction
                const nx = res.axis.x, ny = res.axis.y;

                // B1: Normal points AWAY from B1? No, B1->B2. So points AWAY from B1.
                // If B1 moves TOWARDS B2, dot(h1, n) > 0.
                const h1x = Math.sin(b1.heading), h1y = -Math.cos(b1.heading);
                const impact1 = Math.max(0, h1x * nx + h1y * ny);

                // B2: Normal points INTO B2. We want normal pointing AWAY from B2 for impact calc. So -n.
                const h2x = Math.sin(b2.heading), h2y = -Math.cos(b2.heading);
                const impact2 = Math.max(0, h2x * (-nx) + h2y * (-ny));

                const friction = 0.99;
                const impactFactor = 0.5; // Multiplier at max impact (0.5 means lose 50%)

                b1.speed *= (friction - (friction - impactFactor) * impact1);
                b2.speed *= (friction - (friction - impactFactor) * impact2);

                // No penalties if either boat is finished
                if (rulesInForce() && !b1.raceState.finished && !b2.raceState.finished) {
                    const res = getRightOfWay(b1, b2);
                    const rowBoat = res.boat;

                    // If mark-room is active, entitled boat effectively has immunity
                    // (outside boat must give room regardless of Section A ROW)
                    const effectiveRow = res.markRoom
                        ? (res.markRoom === b1.id ? b1 : b2)
                        : rowBoat;


                    // Labelled by what DECIDED it: when mark-room set the right-of-way boat, the foul
                    // is the room not given (Rule 18), not the Section A rule mark-room overrode.
                    const pInfo = res.markRoom
                        ? { rule: 'Rule 18', reason: 'Mark-Room', kind: 'contact' }
                        : { rule: res.rule, reason: res.reason, kind: 'contact' };
                    // RRS 15: a boat that has JUST acquired right of way owes the
                    // other boat room to keep clear, initially. Contact inside that
                    // window (2 s, and only when the acquisition was NOT caused by
                    // the other boat's own actions — the oracle encodes the
                    // exception) is the acquirer failing to give that room, so the
                    // penalty goes to HER, not to the boat that had no room to
                    // respond. Mark-room entitlement is untouched: room owed at a
                    // mark does not lapse because its ower is newly ROW.
                    const r15 = !res.markRoom && res.constraints
                        && res.constraints.indexOf("Rule 15") !== -1;
                    // RRS 43.1(a) + 19.2(b): if the boat this contact would
                    // penalize was, at the moment of contact, being denied room
                    // at an obstruction BY the right-of-way boat — the rule-19
                    // obligation ledger has held against that boat for the
                    // stand-on detector's own HOLD, and there is land hard on
                    // her far side right now — her breach was compelled. The
                    // foul is the denier's (19.2(b)); the pinned boat is
                    // exonerated. Same conservatism guards as the grounding
                    // path: a persistent obligation and real land, never bare
                    // geometry at the instant of contact.
                    let r19Flip = false;
                    const loser19 = (effectiveRow === b1) ? b2 : (effectiveRow === b2) ? b1 : null;
                    if (loser19 && !res.markRoom) {
                        const sin19 = loser19._r19Since && loser19._r19Since[effectiveRow.id];
                        const HOLD19 = (window.__RULES && window.__RULES.hold != null) ? window.__RULES.hold : 0.8;
                        if (sin19 != null && state.race.timer - sin19 >= HOLD19) {
                            const g19 = state.course.botGrid;
                            if (g19) {
                                const dxF = loser19.x - effectiveRow.x, dyF = loser19.y - effectiveRow.y;
                                const lF = Math.hypot(dxF, dyF) || 1;
                                const uxF = dxF / lF, uyF = dyF / lF;
                                for (let dF = 25; dF <= 75; dF += 25) {
                                    const cF = g19.cell(loser19.x + uxF * dF, loser19.y + uyF * dF);
                                    if (!g19.at(cF[0], cF[1])) { r19Flip = true; break; }
                                }
                            }
                        }
                    }
                    if (r19Flip) {
                        triggerPenalty(effectiveRow, { rule: 'Rule 19', reason: 'Denied Room at Obstruction', kind: 'contact', with: loser19 });
                    } else if (r15 && effectiveRow) {
                        triggerPenalty(effectiveRow, { rule: 'Rule 15', reason: 'No Room to Respond', kind: 'contact', with: effectiveRow === b1 ? b2 : b1 });
                    } else if (effectiveRow === b1) triggerPenalty(b2, Object.assign({ other: b1.name, with: b1 }, pInfo));
                    else if (effectiveRow === b2) triggerPenalty(b1, Object.assign({ other: b2.name, with: b2 }, pInfo));
                    else {
                        triggerPenalty(b1, Object.assign({ with: b2 }, pInfo));
                        triggerPenalty(b2, Object.assign({ with: b1 }, pInfo));
                    }
                }
            }
        }
    }
}

// ── KEEP CLEAR: THE NO-CONTACT FOUL (PT-031, Oct 26 2026) ────────────────────────────────────
// RRS Definitions, Keep Clear: a boat keeps clear of a right-of-way boat "if the right-of-way boat
// can sail her course with no need to take avoiding action". Wes: call it only when a collision is
// imminent — otherwise it fires false positives — and the right-of-way boat still takes avoiding
// action, because a collision costs her far more than the turn. So the question is the jury's: had
// the right-of-way boat R sailed her course, would the hulls have touched the other boat K?
//
// WHO: judged whenever the PLAYER is one of the pair, in either role (a Scenario Lab boat on a script
// stands in for her). Bot against bot is left to the contact umpire: from outside, a give-way bot
// holding on cannot be told from one about to duck. WHEN: racing only — in the prestart boats crawl,
// luff and accelerate, there is no course to hold, and contact is judged there as before.
//
//   ONSET — R making way (KC_MINSPD), on a steady course (not turning, a bot's plan on her heading),
//   and the hulls overlap within KC_T s if R sails on and K holds her course. KC_T is the AI's own
//   IMMINENT horizon (updateRiskAssessment, tCPA < 2 s), the moment a stand-on bot starts to act.
//   R's GHOST then sails R's course — a bot's own plan (her heading before avoiding action, bot.js
//   `intentHeading`), a player's heading at onset — by the distance R really makes (she slows, surfs).
//   While R is on her course the ghost IS her, and K is judged on her real track: a touch is a call.
//   Once R takes avoiding action (KC_DEV off her course), K's later moves answer R's dodge, so:
//     a PLAYER K is watched on, and called when the collision R's course would meet is within KC_LATE
//       — too late to keep clear on her own — projecting the turn she is already making, on two
//       checks running;
//     a BOT K is judged once, at that moment, from her own avoidance before it has seen R's dodge: at
//       IMMINENT against R, the duck she chose is projected; short of it, no call (bots duck late).
//   The late projections ask for a clear hit (hulls shrunk to KC_CORE), not a graze.
//
// Every rule the oracle decides is covered (10, 11, 12, 13, 18 mark-room, 21); R is the boat the
// contact umpire above would exonerate. Guards — the limitations on R, and K's entitlements:
//   Rule 15 — R has just acquired right of way (the oracle's constraint): no call.
//   Rule 16 — R changed course by > KC_R16_ANG in the last KC_R16_WIN s and her earlier heading would
//             have missed; or her plan turns > KC_R16_ANG off her onset course during the call: she must
//             give K room to keep clear, no call. This is also how 16.2 is judged (a starboard boat bearing
//             off onto a port boat on a beat): the oracle's "Rule 16.2" flag marks EVERY opposite-tack pair
//             on a windward leg, whether or not anyone bore off, so it is not a guard here — read as one, it
//             switched the call off on every upwind port-starboard crossing (Port Rammer on a beat: 0/10).
//   Rule 18 — K is entitled to mark-room from R: K is the right-of-way boat for this test.
//   Rule 19 — K is owed room at an obstruction by R (the AI's r19 ledger): no call.
//   A boat taking a penalty turn is left to the contact umpire.
// One call per pair per KC_COOL s; a collision that follows folds into the same incident
// (triggerPenalty's INCIDENT_GAP).
//
// CALIBRATED BY COUNTERFACTUAL REPLAY: each call's race replayed to onset (reproducing the call to the
// frame), R made to sail her plan with no avoiding action, and the pair watched for contact — 156 races
// a build, half with the player's boat never avoiding anyone. A frozen straight-line R at her onset
// velocity called 39 fouls in 61 that never touched; the build here, 20 of 20 right where the player is
// involved. The July detector this replaces lived in the AI's controller: it judged only a bot with
// right of way, by her own deflection (> 20 deg for 0.8 s), which a tack away never completed
// (Scenario Lab "Port Rammer": the rammer was never penalized, 10/10).
const KC_T = 2.0;          // s: the onset horizon (the AI's IMMINENT)
const KC_LATE = 1.0;       // s: a player K is called when the collision is this close
const KC_STEP = 0.1;       // s: the umpire's tick
const KC_R16_WIN = 2.0, KC_R16_ANG = 0.17;   // Rule 16: the window, and a course change (10 deg)
const KC_INTENT = 0.35;    // rad: a bot whose plan is this far off her heading is between courses
const KC_TURNING = 0.5;    // rad/s: R turning faster than this has no course yet
const KC_DEV = 0.17;       // rad: R this far off her course has taken avoiding action
const KC_KTURN = 1.05;     // rad: the most of a player K's turn the projection continues
const KC_MINSPD = 30;      // u/s (2 kt): R with no way on has no course to hold
const KC_CORE = 0.85;      // the late projections' hull scale: a clear hit, not a graze
const KC_COOL = 20;        // s: one call per pair
const _kc = { t: 0, acc: 0, hist: {}, pend: {}, cool: {}, boats: null, wt: -Infinity };
function kcSpinning(b) {
    const rs = b.raceState;
    return !!((b.controller && b.controller.penaltySpin) || (rs.penalty && Math.abs(rs.penaltyRot || 0) >= 2.1));
}
// Is the AI steering her? (The player is not; nor is a Scenario Lab boat on a script, whose controller's
// update is replaced — it stands in for a player.)
function kcAI(b) {
    return !!(b.controller && !b.isPlayer && typeof BotController === 'function' && b.controller.update === BotController.prototype.update);
}
// A bot's own plan (her heading before any avoiding action); null for a player.
function kcPlan(b) {
    return kcAI(b) && b.controller.intentHeading != null ? b.controller.intentHeading : null;
}
function kcVel(b) {
    return b.velocity ? { x: b.velocity.x * 60, y: b.velocity.y * 60 } : { x: Math.sin(b.heading) * b.speed * 60, y: -Math.cos(b.heading) * b.speed * 60 };
}
// Do the hulls overlap within KC_T if R sails from (rx, ry) on (rvx, rvy) facing rh and K holds her course?
function kcHit(rx, ry, rvx, rvy, rh, K) {
    const kv = kcVel(K);
    for (let s = 0; s <= KC_T + 1e-9; s += 0.05) {
        const ax = rx + rvx * s, ay = ry + rvy * s, bx = K.x + kv.x * s, by = K.y + kv.y * s;
        if ((ax - bx) * (ax - bx) + (ay - by) * (ay - by) > 75 * 75) continue;   // hulls are 55 long: no overlap past 75
        if (satPolygonPolygon(hullPolygonAt(ax, ay, rh), hullPolygonAt(bx, by, K.heading))) return true;
    }
    return false;
}
// A hull shrunk about its centre: the late projection asks for a clear hit, not a graze a few units of
// model error would decide (counterfactual replay: a projected touch passed at 33 u between centres).
function kcCore(x, y, h) {
    return hullPolygonAt(x, y, h).map(p => ({ x: x + (p.x - x) * KC_CORE, y: y + (p.y - y) * KC_CORE }));
}
// K from now, doing what she is doing: (heading, position) at time t.
function kcKPath(K, now) {
    const kv = kcVel(K), sp = Math.hypot(kv.x, kv.y), h0 = K.heading;
    let rate, total;
    const tgt = kcAI(K) ? K.controller.targetHeading : null;
    if (tgt != null) {        // a bot: her helm toward the heading her avoidance chose
        rate = getTurnSpeed() * 60 * (1.0 + ((K.stats && K.stats.handling) || 0) * 0.03);
        total = normalizeAngle(tgt - h0);
    } else {                  // a player: the turn she is already making
        const hk = _kc.hist[K.id], k0 = hk && hk.length > 3 ? hk[hk.length - 4] : null;
        const w = k0 ? normalizeAngle(K.heading - k0.hd) / Math.max(0.1, now - k0.t) : 0;
        rate = Math.min(Math.abs(w), 1.2); total = Math.sign(w) * KC_KTURN;
    }
    const sgn = Math.sign(total), T1 = rate > 1e-3 ? Math.abs(total) / rate : 0;
    const drift = { x: kv.x - Math.sin(h0) * sp, y: kv.y + Math.cos(h0) * sp };   // current, set: kept as is
    return (t) => {
        // integrate the turn in small steps (exact enough at 0.05 s)
        let x = K.x, y = K.y, h = h0;
        for (let u = 0; u < t - 1e-9; u += 0.05) {
            const du = Math.min(0.05, t - u);
            if (u < T1) h = h0 + sgn * rate * Math.min(u + du, T1);
            x += (Math.sin(h) * sp + drift.x) * du; y += (-Math.cos(h) * sp + drift.y) * du;
        }
        return { x, y, h };
    };
}
// The Scenario Lab replays seeds on the SAME boats array and clock, so it resets this by hand with its
// other per-run state (scenario.js, beside Rules.interactions).
function resetKeepClear() {
    _kc.t = 0; _kc.acc = 0; _kc.hist = {}; _kc.pend = {}; _kc.cool = {}; _kc.boats = state.boats; _kc.wt = state.time;
}
function checkKeepClear(dt) {
    // A new race (a new boats array) or a rewound world clock starts the umpire's memory clean, so a run
    // never depends on the one before it.
    if (_kc.boats !== state.boats || !(state.time >= _kc.wt)) resetKeepClear();
    _kc.wt = state.time;
    if (!state.boats || state.race.status !== 'racing' || !rulesInForce()) { _kc.pend = {}; return; }
    _kc.t += dt; _kc.acc += dt;
    if (_kc.acc < KC_STEP) return;
    _kc.acc = 0;
    const now = _kc.t, live = state.boats.filter(b => !b.raceState.finished);
    for (const b of live) {
        const h = _kc.hist[b.id] || (_kc.hist[b.id] = []);
        h.push({ t: now, hd: b.heading });
        while (h.length && now - h[0].t > KC_R16_WIN + 1e-6) h.shift();
    }
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const b1 = live[i], b2 = live[j], key = Math.min(b1.id, b2.id) + '-' + Math.max(b1.id, b2.id);
        const q = _kc.pend[key];
        const reach = (b1.speed + b2.speed) * 60 * KC_T + 80;
        if (!q && (b1.x - b2.x) ** 2 + (b1.y - b2.y) ** 2 > reach * reach) continue;
        const res = getRightOfWay(b1, b2);
        const R = res.markRoom ? (res.markRoom === b1.id ? b1 : b2) : res.boat;
        const K = R === b1 ? b2 : b1;
        const blocked = !R || (q && q.R !== R)
            || (res.constraints && res.constraints.indexOf('Rule 15') !== -1)
            || kcSpinning(K) || kcSpinning(R)
            || (K._r19Since && K._r19Since[R.id] != null);
        if (!q) {
            if (blocked || now < (_kc.cool[key] || 0)) continue;
            if (kcAI(R) && kcAI(K)) continue;          // bot against bot: the contact umpire's alone (see the header)
            if (R.speed * 60 < KC_MINSPD) continue;   // a boat with no way on has no course to hold
            const pl = kcPlan(R);
            if (pl != null && Math.abs(normalizeAngle(pl - R.heading)) > KC_INTENT) continue;
            const hr = _kc.hist[R.id], prev = hr && hr.length > 1 ? hr[hr.length - 2] : null;
            if (prev && Math.abs(normalizeAngle(R.heading - prev.hd)) / Math.max(1e-3, now - prev.t) > KC_TURNING) continue;   // turning now: no course yet
            const rv = kcVel(R);
            if (!kcHit(R.x, R.y, rv.x, rv.y, R.heading, K)) continue;
            // Rule 16: did her own course change make this? Then her earlier heading would have missed.
            const hist = _kc.hist[R.id], old = hist && hist[0];
            if (old && Math.abs(normalizeAngle(R.heading - old.hd)) > KC_R16_ANG) {
                const d = normalizeAngle(old.hd - R.heading);
                const ox = rv.x * Math.cos(d) - rv.y * Math.sin(d), oy = rv.x * Math.sin(d) + rv.y * Math.cos(d);
                if (!kcHit(R.x, R.y, ox, oy, old.hd, K)) continue;
            }
            _kc.pend[key] = { R, t0: now, gx: R.x, gy: R.y, gh: R.heading, h0: R.heading, rpx: R.x, rpy: R.y,
                              kx: K.x, ky: K.y, kh: K.heading };
            continue;
        }
        if (blocked) { delete _kc.pend[key]; continue; }
        const el = now - q.t0;
        // The ghost sails R's course by the distance R really made this step.
        const step = Math.hypot(R.x - q.rpx, R.y - q.rpy); q.rpx = R.x; q.rpy = R.y;
        const pl = kcPlan(R), gh = pl != null ? pl : q.h0;
        // Rule 16 again, inside the window: if her own plan changes course, she must give K room to keep
        // clear, and the line K was keeping clear of is gone. No call ("Round Mark with Boat to Windward":
        // the leeward boat shaping up for the mark, toward the boat to windward).
        if (Math.abs(normalizeAngle(gh - q.h0)) > KC_R16_ANG) { delete _kc.pend[key]; continue; }
        const gx0 = q.gx, gy0 = q.gy, gh0 = q.gh;
        q.gx += Math.sin(gh) * step; q.gy -= Math.cos(gh) * step; q.gh = gh;
        let touched = false;
        if (Math.abs(normalizeAngle(R.heading - gh)) <= KC_DEV) {
            // R on her course: K's real track against her, swept across the step.
            for (let k = 1; k <= 4 && !touched; k++) {
                const f = k / 4;
                const kx = q.kx + (K.x - q.kx) * f, ky = q.ky + (K.y - q.ky) * f, kh = q.kh + normalizeAngle(K.heading - q.kh) * f;
                const rx = gx0 + (q.gx - gx0) * f, ry = gy0 + (q.gy - gy0) * f, rh = gh0 + normalizeAngle(gh - gh0) * f;
                if ((rx - kx) * (rx - kx) + (ry - ky) * (ry - ky) > 75 * 75) continue;
                touched = !!satPolygonPolygon(hullPolygonAt(rx, ry, rh), hullPolygonAt(kx, ky, kh));
            }
            q.kx = K.x; q.ky = K.y; q.kh = K.heading;
            if (!touched) { if (el > KC_T + 1e-6) delete _kc.pend[key]; continue; }
        } else {
            // R has taken avoiding action. From here K's later moves answer R's dodge, not the collision.
            const kc = kcAI(K) ? K.controller : null;
            if (kc) {
                // A BOT K (keeping clear of the player) is judged once, NOW, from her own avoidance at the moment
                // R acted — before it has seen R's dodge (afterwards it sees the threat gone and holds on, and a
                // ghost of R's course reads that as a ram: counterfactual replay, 3 wrong calls of 10). At
                // IMMINENT against R: project the duck she chose, a clear hit within KC_T is a call. Short of it:
                // bots duck late, at their own IMMINENT, so nothing says she would have failed — no call.
                delete _kc.pend[key];
                if (!(kc.threatBoat === R && kc.riskState === 'IMMINENT')) continue;
                const kp = kcKPath(K, now), rsp = R.speed * 60;
                for (let t = 0; t <= KC_T + 1e-9 && !touched; t += 0.05) {
                    const kq = kp(t), rx = q.gx + Math.sin(gh) * rsp * t, ry = q.gy - Math.cos(gh) * rsp * t;
                    if ((rx - kq.x) * (rx - kq.x) + (ry - kq.y) * (ry - kq.y) > 75 * 75) continue;
                    touched = !!satPolygonPolygon(kcCore(rx, ry, gh), kcCore(kq.x, kq.y, kq.h));
                }
            } else {
                // A PLAYER K (or a scripted lab boat standing in for one): keep watching, and call when the
                // collision R's course would meet is within KC_LATE — too late to keep clear on her own —
                // projecting the turn she is making, on two checks running.
                if (el > KC_T + KC_LATE) { delete _kc.pend[key]; continue; }
                const kp = kcKPath(K, now), rsp = R.speed * 60;
                for (let t = 0; t <= KC_LATE + 1e-9 && !touched; t += 0.05) {
                    const kq = kp(t), rx = q.gx + Math.sin(gh) * rsp * t, ry = q.gy - Math.cos(gh) * rsp * t;
                    if ((rx - kq.x) * (rx - kq.x) + (ry - kq.y) * (ry - kq.y) > 75 * 75) continue;
                    touched = !!satPolygonPolygon(kcCore(rx, ry, gh), kcCore(kq.x, kq.y, kq.h));
                }
                q.hits = touched ? (q.hits || 0) + 1 : 0;
                touched = q.hits >= 2;
            }
            if (!touched) continue;
        }
        delete _kc.pend[key];
        _kc.cool[key] = now + KC_COOL;
        const info = res.markRoom ? { rule: 'Rule 18', reason: 'Mark-Room' } : { rule: res.rule, reason: res.reason };
        triggerPenalty(K, Object.assign({ kind: 'no_contact', other: R.name, with: R }, info));
    }
}

function checkMarkCollisions(dt) {
    if (!state.course || !state.course.marks) return;

    // Reset collision flags for next frame's AI
    for (const boat of state.boats) {
        if (boat.ai) boat.ai.collisionData = null;
    }

    // A buoy is one 12-unit circle on its own point. A committee boat is a capsule of
    // three, offset outboard — so both the broad phase and the narrow phase read the
    // mark's own body instead of a constant. `bodyR` is 12 for a buoy, which makes the
    // broad-phase radius 50 exactly as it was.
    for (const boat of state.boats) {
        let close = false;
        for (const mark of state.course.marks) {
             const rr = 38 + (mark.bodyR || 12);
             if ((boat.x-mark.x)**2 + (boat.y-mark.y)**2 < rr*rr) { close = true; break; }
        }
        if (!close) continue;

        const poly = getHullPolygon(boat);
        if (window.School && School.courseHidden()) break;     // an unseen mark is not there to hit
        for (const mark of state.course.marks) {
          for (const circ of (mark.body || [{ x: mark.x, y: mark.y, r: 12 }])) {
            const res = satPolygonCircle(poly, circ, circ.r);
            if (res) {
                if (window.onRaceEvent && state.race.status === 'racing') window.onRaceEvent('collision_mark', { boat });
                // the player touching a mark (Popper's 'The Circle' must not) — an event only
                if (boat.isPlayer && state.race.status === 'racing' && !boat.raceState.finished && typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: 'close:touch', obj: mark });

                // Store Collision Data for AI
                if (boat.ai) {
                    boat.ai.collisionData = { type: 'mark', normal: res.axis };
                }

                // Direction: axis points from Poly to Circle
                // We want to move Poly away from Circle, so move opposite to axis
                boat.x -= res.axis.x * res.overlap;
                boat.y -= res.axis.y * res.overlap;

                // Physics
                const nx = res.axis.x, ny = res.axis.y;
                const hx = Math.sin(boat.heading), hy = -Math.cos(boat.heading);
                // Impact: Heading vs Normal (Boat -> Mark)
                const impact = Math.max(0, hx * nx + hy * ny);

                const friction = 0.99;
                let impactFactor = 0.5;
                if (boat.controller && boat.controller.livenessState === 'force') impactFactor = 0.9; // Slide off marks

                boat.speed *= (friction - (friction - impactFactor) * impact);

                // RRS 43.1(b): a boat sailing within MARK-ROOM she is entitled
                // to is exonerated for breaking rule 31 in an incident with the
                // boat required to give that room. The entitlement is the rules
                // engine's own zone snapshot for THIS mark; the incident is that
                // ower close aboard (2 hull lengths) on her outside at the
                // moment of the touch. A lone boat hitting the buoy is still
                // her own foul — exoneration needs the squeeze.
                let exon31 = false;
                if (rulesInForce() && window.Rules && window.Rules.interactions) {
                    const mIdx31 = state.course.marks.indexOf(mark);
                    const dSelf31 = Math.hypot(boat.x - mark.x, boat.y - mark.y);
                    for (const o31 of state.boats) {
                        if (o31 === boat || o31.raceState.finished) continue;
                        const dxM = o31.x - boat.x, dyM = o31.y - boat.y;
                        if (dxM * dxM + dyM * dyM > 110 * 110) continue;
                        const k31 = [boat.id, o31.id].sort((a, b) => a - b).join('-');
                        const dat31 = window.Rules.interactions[k31];
                        const snap31 = dat31 && dat31.zoneSnapshot;
                        if (!snap31 || snap31.markIndex !== mIdx31 || snap31.entitled !== boat.id) continue;
                        if (Math.hypot(o31.x - mark.x, o31.y - mark.y) <= dSelf31) continue;
                        exon31 = true; break;
                    }
                }
                if (rulesInForce() && !exon31) triggerPenalty(boat, { rule: 'Rule 31', reason: 'Touched a Mark', kind: 'contact', with: 'mark:' + state.course.marks.indexOf(mark) });
                // One response per MARK, not per circle: hitting a committee boat is
                // one Rule 31 touch, however many circles of its capsule you are in.
                break;
            }
          }
        }
    }
}

// The world clock runs slow on purpose: `state.time` phases animation (floe heading
// curl, wave sets, flag flutter, telltales) and 0.24 is what those were tuned
// against. Anything that wants SECONDS must scale by this, never read it raw —
// see refreshBotGrid for what reading it raw cost.
// Boat hull half-width for coarse collision against concave mask coastlines.
// How far out a rounding still counts, as a multiple of the mark's zone. The zone is
// the pass-within distance; this is the go-round-it distance. Generous enough that a
// wide, seamanlike rounding registers, bounded so circling far away does not.
const ROUND_ACTIVE = 2.5;
// HOW MUCH BANKED SWEEP SHE MAY GIVE BACK AND STILL BE ROUND. The latch exists to
// survive the unwind of fighting out through the ring, which measures 0.19-0.40 rad; it
// is NOT a licence to sail back round the other way. At half a turn's grace,
// `_string_truth_probe` caught arctic boats completing after giving back 0.52-1.10 rad,
// with the winding of their own track saying flatly that the string never wrapped the
// mark (actual -0.03 against a required 6.25). Half a radian covers the measured unwind
// with margin and nothing else. Scan, 6 arctic seeds, roundings whose string never
// touched the mark: half a turn 9%, 0.75 rad 6%, 0.5 rad 4%.
const ROUND_GIVEBACK = 0.5;

// THERE IS NO TOLERANCE IN THE RULE. RRS Sail the Course: the taut string "touches
// each mark designated in the sailing instructions to be a rounding mark". A track
// that sweeps less than the geometric requirement does not bend around the mark, so
// the string does not touch it, so it is not a rounding — at any distance. This was
// 0.75, which completed a rounding at three-quarters of the requirement (bay's
// hairpin: 137 degrees banked against 183 needed) and, because the AI's own exit
// logic reads the same constant, AIMED the fleet at three-quarters of a rounding.
// Note the rule has no PROXIMITY requirement either: a full rounding at a distance
// is legal, merely slow, which is why the test above the completion check pins a
// wide full rounding as valid. Keep this at 1.
const ROUND_SWEEP_TOL = 1.0;
// How close is "arrived at the mark", as a multiple of its own zone. Two: outside the
// rules zone, well inside the approach, and it scales with the mark rather than being a
// second tuned distance.
const ROUND_NEAR = 2.0;
// Slack on the exit bearing, on top of the tangent angle the geometry already allows.
// A sixth of a radian — a helm's width, not a discount.
const ROUND_EXIT_SLACK = 0.17;

// CLEARANCE radius, not the collider. The boat is 30 wide and 55 long, so 30 is roughly its
// half-LENGTH — the room it needs to turn in, which is the right question for "does this gap
// admit a boat" and the wrong one for "did I touch that berg". Collision uses the hull
// itself (getHullPolygon, HULL_DISCS); sailcheck.js keeps its own copy of this number for
// the same planning purpose and should stay conservative.
const HULL_R = 30;

// Circle vs (possibly concave, possibly keyholed) polygon. Returns the same
// {axis, overlap} shape satPolygonPolygon does, so the caller is unchanged.
// Handles the boat being INSIDE the shape too, which happens if it is pushed
// through by another boat — it escapes via the nearest edge rather than sticking.
// ── EDGE GRID FOR BIG POLYGONS ──────────────────────────────────────────────
// A hull disc against Otter's coast asked every one of its 276 edges, six discs a boat,
// ten boats a frame, and the four venue-sized shapes (coast, apron, meadow, forest) pass
// the bounding-circle broad phase EVERYWHERE, so the whole fleet paid ~70k edge tests a
// frame — 3 ms. The polygon is static, so its edges are bucketed once into cells of
// POLY_CELL units; a disc then asks only the edges in the cells its bbox touches.
//
// THE INSIDE TEST STAYS EXACT without walking the polygon: each cell records whether its
// CENTRE is inside (one pointInPoly per cell at build time). For a point in that cell,
// cast the short segment from the point to the cell centre — it never leaves the cell,
// so only edges bucketed in that cell can cross it — and the parity of crossings against
// the centre's answer is the point's answer. A cell with no edges is wholly one side.
const POLY_CELL = 160;
const POLY_GRID_MIN_EDGES = 48;      // small polygons are cheaper to walk than to index
function polyGrid(verts) {
    let g = verts._grid;
    if (g && g.n === verts.length) return g;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of verts) { if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x; if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y; }
    const cx0 = Math.floor(minX / POLY_CELL), cy0 = Math.floor(minY / POLY_CELL);
    const cw = Math.floor(maxX / POLY_CELL) - cx0 + 1, ch = Math.floor(maxY / POLY_CELL) - cy0 + 1;
    const cells = new Array(cw * ch).fill(null);
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const ax = verts[j].x, ay = verts[j].y, bx = verts[i].x, by = verts[i].y;
        const x0 = Math.floor(Math.min(ax, bx) / POLY_CELL) - cx0, x1 = Math.floor(Math.max(ax, bx) / POLY_CELL) - cx0;
        const y0 = Math.floor(Math.min(ay, by) / POLY_CELL) - cy0, y1 = Math.floor(Math.max(ay, by) / POLY_CELL) - cy0;
        // every cell the edge's bbox covers (a superset of the cells it crosses — safe)
        for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
            const k = cy * cw + cx; (cells[k] || (cells[k] = [])).push(j);
        }
    }
    // Each cell centre's inside flag, a ROW at a time: the crossings of the row's line with every edge, by
    // pointInPoly's own formula, then each centre counts the crossings to its right — the same parity, edge for
    // edge, that pointInPoly(centre) would find, without walking the whole ring once per cell (a curved coast's
    // ring and its hundreds of cells made this a few hundred ms of a race build).
    const inside = new Uint8Array(cw * ch), xs = [];
    for (let cy = 0; cy < ch; cy++) {
        const y = (cy0 + cy + 0.5) * POLY_CELL;
        xs.length = 0;
        for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
            const xi = verts[i].x, yi = verts[i].y, xj = verts[j].x, yj = verts[j].y;
            if ((yi > y) !== (yj > y)) xs.push(((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi);
        }
        for (let cx = 0; cx < cw; cx++) {
            const x = (cx0 + cx + 0.5) * POLY_CELL;
            let c = 0; for (let k = 0; k < xs.length; k++) if (x < xs[k]) c++;
            inside[cy * cw + cx] = c & 1;
        }
    }
    g = { n: verts.length, cx0, cy0, cw, ch, cells, inside };
    Object.defineProperty(verts, '_grid', { value: g, enumerable: false, writable: true, configurable: true });
    return g;
}
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
    // proper crossing of segments ab and cd (a shared endpoint counts once, by the half-open rule)
    const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
function circlePolyCollideGrid(cx, cy, r, verts, g) {
    const gx = Math.floor(cx / POLY_CELL) - g.cx0, gy = Math.floor(cy / POLY_CELL) - g.cy0;
    // the disc's cells (its bbox), clamped to the grid; off-grid means outside and clear
    const x0 = Math.floor((cx - r) / POLY_CELL) - g.cx0, x1 = Math.floor((cx + r) / POLY_CELL) - g.cx0;
    const y0 = Math.floor((cy - r) / POLY_CELL) - g.cy0, y1 = Math.floor((cy + r) / POLY_CELL) - g.cy0;
    if (x1 < 0 || y1 < 0 || x0 >= g.cw || y0 >= g.ch) return null;
    // inside: the centre's cell decides, corrected by crossings on the way to its centre
    let inside = false;
    if (gx >= 0 && gy >= 0 && gx < g.cw && gy < g.ch) {
        const k = gy * g.cw + gx; inside = !!g.inside[k];
        const E = g.cells[k];
        if (E) {
            const mx = (g.cx0 + gx + 0.5) * POLY_CELL, my = (g.cy0 + gy + 0.5) * POLY_CELL;
            let cross = 0;
            for (let e = 0; e < E.length; e++) { const j = E[e], i = (j + 1) % verts.length;
                if (segCross(verts[j].x, verts[j].y, verts[i].x, verts[i].y, cx, cy, mx, my)) cross++; }
            if (cross & 1) inside = !inside;
        }
    }
    let bestD2 = Infinity, bx = 0, by = 0;
    for (let gyy = Math.max(0, y0); gyy <= Math.min(g.ch - 1, y1); gyy++) for (let gxx = Math.max(0, x0); gxx <= Math.min(g.cw - 1, x1); gxx++) {
        const E = g.cells[gyy * g.cw + gxx]; if (!E) continue;
        for (let e = 0; e < E.length; e++) {
            const j = E[e], i = (j + 1) % verts.length;
            const ax = verts[j].x, ay = verts[j].y, bx2 = verts[i].x, by2 = verts[i].y;
            const ex = bx2 - ax, ey = by2 - ay;
            const len2 = ex * ex + ey * ey || 1;
            let t = ((cx - ax) * ex + (cy - ay) * ey) / len2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const px = ax + ex * t, py = ay + ey * t;
            const d2 = (cx - px) ** 2 + (cy - py) ** 2;
            if (d2 < bestD2) { bestD2 = d2; bx = px; by = py; }
        }
    }
    if (!inside && bestD2 >= r * r) return null;
    // inside with no edge within reach (deep in land — a tunnel): fall back to the full walk
    if (inside && bestD2 === Infinity) return circlePolyCollideSlow(cx, cy, r, verts);
    const d = Math.sqrt(bestD2);
    let nx = (cx - bx) / (d || 1), ny = (cy - by) / (d || 1);
    if (inside) { nx = -nx; ny = -ny; }
    return { axis: { x: -nx, y: -ny }, overlap: inside ? d + r : r - d };
}
// POINT-IN-POLYGON THROUGH THE SAME GRID: exact (cell-centre parity, corrected by the
// crossings on the short segment to the centre) and O(edges in one cell) instead of O(n).
// The surf's dry-edge tables probe every edge of every shape against the four venue-sized
// polygons (coast, apron, meadow, forest — 700 vertices between them): building the coast's
// own table was 200k vertex tests, a 20 ms hitch the first frame it came into view, and
// every rock ring that followed it cost another few ms — the stutter along the headland.
function pointInPolyFast(x, y, verts) {
    if (verts.length < POLY_GRID_MIN_EDGES) return pointInPoly(x, y, verts);
    const g = polyGrid(verts);
    const gx = Math.floor(x / POLY_CELL) - g.cx0, gy = Math.floor(y / POLY_CELL) - g.cy0;
    if (gx < 0 || gy < 0 || gx >= g.cw || gy >= g.ch) return false;
    const k = gy * g.cw + gx; let inside = !!g.inside[k];
    const E = g.cells[k];
    if (E) {
        const mx = (g.cx0 + gx + 0.5) * POLY_CELL, my = (g.cy0 + gy + 0.5) * POLY_CELL;
        let cross = 0;
        for (let e = 0; e < E.length; e++) { const j = E[e], i = (j + 1) % verts.length;
            if (segCross(verts[j].x, verts[j].y, verts[i].x, verts[i].y, x, y, mx, my)) cross++; }
        if (cross & 1) inside = !inside;
    }
    return inside;
}
if (typeof window !== 'undefined') window.pointInPolyFast = pointInPolyFast;
function circlePolyCollide(cx, cy, r, verts) {
    if (verts.length >= POLY_GRID_MIN_EDGES) return circlePolyCollideGrid(cx, cy, r, verts, polyGrid(verts));
    return circlePolyCollideSlow(cx, cy, r, verts);
}
function circlePolyCollideSlow(cx, cy, r, verts) {
    let bestD2 = Infinity, bx = 0, by = 0;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const ax = verts[j].x, ay = verts[j].y, bx2 = verts[i].x, by2 = verts[i].y;
        const ex = bx2 - ax, ey = by2 - ay;
        const len2 = ex * ex + ey * ey || 1;
        let t = ((cx - ax) * ex + (cy - ay) * ey) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + ex * t, py = ay + ey * t;
        const d2 = (cx - px) ** 2 + (cy - py) ** 2;
        if (d2 < bestD2) { bestD2 = d2; bx = px; by = py; }
    }
    const inside = pointInPoly(cx, cy, verts);
    const d = Math.sqrt(bestD2);
    if (!inside && d >= r) return null;
    // axis points from the surface toward the boat; caller subtracts it.
    let nx = (cx - bx) / (d || 1), ny = (cy - by) / (d || 1);
    if (inside) { nx = -nx; ny = -ny; }
    return { axis: { x: -nx, y: -ny }, overlap: inside ? d + r : r - d };
}

// ── THE HULL AGAINST CONCAVE LAND ───────────────────────────────────────────
// Land traced from a mask is concave and keyholed, and SAT is a convex test, so this path
// used ONE circle of radius HULL_R = 30 about the boat's centre instead. The hull is 30 wide
// and 55 long — half-beam 15 — so that circle was TWICE the boat's actual beam. You could be
// most of a boat-width clear of a berg abeam and still ground on it, which is what "I
// collided with an island when I hadn't actually hit it" is.
//
// A chain of discs down the centreline instead, each sized to the hull's real half-width
// there, so the collider tapers into the bow the way the boat does. Still exact against
// concave outlines (each disc is a circle-vs-polygon test, the primitive that was already
// right), still cheap, and it no longer claims beam the boat does not have.
//
// Offsets are read off getHullPolygon: x = ±15 between y = -5 and y = +20, tapering to a
// point at the bow (y = -25) and to ±12 at the transom (y = +30).
const HULL_DISCS = [
    { y: -20, r: 4.5 }, { y: -12, r: 10 }, { y: -3, r: 15 },
    { y:   8, r: 15 }, { y:  19, r: 15 }, { y: 27, r: 12 }
];
function hullPolyCollide(boat, verts) {
    const cos = Math.cos(boat.heading), sin = Math.sin(boat.heading);
    let worst = null;
    for (const d of HULL_DISCS) {
        // Local (0, d.y) rotated into the world — the discs sit on the centreline.
        const wx = boat.x - d.y * sin, wy = boat.y + d.y * cos;
        const hit = circlePolyCollide(wx, wy, d.r, verts);
        // Deepest wins, so the push-out clears the worst-embedded part of the hull rather
        // than whichever disc happened to be tested last.
        if (hit && (!worst || hit.overlap > worst.overlap)) worst = hit;
    }
    return worst;
}

// ── A HULL THAT PUSHES ───────────────────────────────────────────────────────────────
// The ship stops a boat, and a boat caught ahead of the bow is carried along.
//
// THIS IS PHYSICS, NOT ROUTING, and that distinction is what makes it buildable. The vessel
// never enters state.course.islands, never becomes a hidden collider, never touches the nav
// grid. Contact is resolved right here against the fleet, the same frame the hull moved.
//
// THE SHAPE IS A CAPSULE, because the manifest already worked out why a circle cannot do
// this job: "the hidden collider compile emits is a CIRCLE, and these hulls are 4.3:1.
// Sized to the beam it leaves two thirds of the ship sailable-through; sized to the length
// it is an invisible wall standing 100+ units off both sides in open water." A spine
// segment with a radius is the shape that fits, rotates with the heading for free, and
// hands back the push normal as the perpendicular from the spine.
const TRAFFIC_PUSH_RATE = 260;      // units/sec of positional correction — see the cap below
const TRAFFIC_GRIND = 0.55;         // speed kept after being struck

function checkTrafficCollisions(dt) {
    const fleet = state.traffic;
    if (!fleet || !fleet.length) return;
    for (const v of fleet) {
        if (!v.active) continue;
        // Spine: the hull's centreline minus a beam's worth at each end, so the capsule's
        // round caps land at the stem and the transom instead of standing off them.
        const r = v.hullBeam * 0.5;
        const half = Math.max(1, v.hullLen * 0.5 - r);
        const fx = Math.sin(v.heading), fy = -Math.cos(v.heading);
        const ax = v.x - fx * half, ay = v.y - fy * half;
        const reach = v.hullLen * 0.5 + 60;
        // The ship's own velocity, in units per FRAME, matching everything else here.
        const svx = fx * v.speed / 60, svy = fy * v.speed / 60;

        for (const boat of state.boats) {
            if (boat.raceState.finished && boat.fadeTimer <= 0) continue;
            const bdx = boat.x - v.x, bdy = boat.y - v.y;
            if (bdx * bdx + bdy * bdy > (reach + 60) ** 2) continue;

            // ⚠️ THE NORMAL COMES FROM THE BOAT'S CENTRE, NOT FROM ITS NEAREST CORNER.
            // Cornerwise looks more precise and oscillates: a hull straddling the
            // centreline has corners on BOTH sides, the nearest one flips the moment the
            // boat is nudged, and the push reverses every frame. Measured before the fix —
            // a boat amidships bounced +4.33u, -4.33u, +4.33u forever and never came out.
            // The centre moves monotonically outward, so the direction it picks is stable.
            const poly = getHullPolygon(boat);
            const wx = boat.x - ax, wy = boat.y - ay;
            const t = Math.max(0, Math.min(1, (wx * fx + wy * fy) / (2 * half))) * 2 * half;
            const cx = ax + fx * t, cy = ay + fy * t;
            let bnx = boat.x - cx, bny = boat.y - cy;
            let dc = Math.hypot(bnx, bny);
            if (dc < 1e-3) {
                // Dead on the spine, where "outward" is undefined. Any consistent side
                // resolves; prefer whichever way the boat is already sliding.
                const lat = boat.velocity.x * -fy + boat.velocity.y * fx;
                const sgn = lat >= 0 ? 1 : -1;
                bnx = -fy * sgn; bny = fx * sgn; dc = 0;
            } else { bnx /= dc; bny /= dc; }

            // How far the hull itself reaches along that normal — the convex support
            // function, exact and cheap. Without it the boat's CENTRE would have to clear
            // the capsule, so half a hull would be buried in the ship's side.
            let reachB = 0;
            for (const p of poly) {
                const e = (p.x - boat.x) * bnx + (p.y - boat.y) * bny;
                if (e > reachB) reachB = e;
            }
            const overlap = (r + reachB) - dc;
            if (overlap <= 0) continue;
            // CAPPED, exactly as the floe pass caps its own: "no floe is ever moved faster
            // than it can be seen to move". A boat overtaken by a bow at four knots can be
            // deeply inside the capsule in one frame, and teleporting it clear would read
            // worse than the overlap does. A rate rather than a per-frame constant, so it
            // looks the same at 30fps as at 144.
            const corr = Math.min(overlap, Math.max(2, TRAFFIC_PUSH_RATE * dt));
            // The ship is effectively infinite mass, so the boat takes the whole correction.
            boat.x += bnx * corr;
            boat.y += bny * corr;

            // Kill the component sailing INTO the hull, then add the ship's own motion along
            // the normal. "Pushed if in front" needs no special case: a boat under the bow is
            // simply carried at ship speed for as long as it stays in contact.
            const vn = boat.velocity.x * bnx + boat.velocity.y * bny;
            if (vn < 0) { boat.velocity.x -= vn * bnx; boat.velocity.y -= vn * bny; }
            const sn = svx * bnx + svy * bny;
            if (sn > 0) { boat.x += bnx * sn * dt * 60; boat.y += bny * sn * dt * 60; }

            boat.speed *= TRAFFIC_GRIND;

            // NOTHING IS TOLD ABOUT THIS. No collisionData, so the planner is untouched —
            // bots cannot see the vessel and will sail into it, which is accepted (a moving
            // caster is planner work, and the planner is being changed elsewhere). It is
            // survivable precisely BECAUSE it pushes: a static wall would trap a fleet that
            // does not know to avoid it, while a body that shoves and moves on cannot.
            if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
                window.onRaceEvent('collision_traffic', { boat, id: v.id });
            }
            // ...but the PLAYER'S hit is counted like any other hard contact (PT-001: a ferry
            // hit used to leave the results saying "A clean run"). An event only: no state, no RNG.
            if (boat.isPlayer && state.race.status === 'racing' && !boat.raceState.finished && typeof GameEvents !== 'undefined') {
                GameEvents.emit('player-contact', { leg: boat.raceState.leg, isFloe: false, traffic: true, obj: v });
            }
        }
    }
}

// ⭐ THE RULE 19 OBLIGATION LEDGER (2026-08-13, the penalty-conservatism ruling).
//
// The Rule 19 foul below fires the instant a boat touches land, against any
// overlapped boat sitting outboard of her. It is purely geometric and purely
// INSTANTANEOUS: nothing requires the obligation to have existed long enough for
// the accused to act on it. The stand-on forced-avoidance detector (~890) already
// requires exactly that — a leaky accumulator that must reach HOLD before it will
// claim — because a boat that has just become obligated is owed room to respond
// (RRS 15). This gives the Rule 19 path the same requirement, using the same
// constant, and nothing else.
//
// The ledger is the pre-contact record the trigger cannot build for itself: the
// trigger only runs while a hull is already inside a rock, so by then the history
// is gone. Stamped every frame, for close pairs only (the island scan runs only
// for a boat that has another boat within 130u, so a 2218-island venue costs
// nothing on the frames where no pair is close).
function updateRule19Ledger() {
    if (!state.course || !state.course.islands || state.race.status !== 'racing') return;
    const now = state.race.timer;
    const B = state.boats;
    for (const b of B) {
        if (b.raceState.finished) continue;
        let anyClose = false;
        for (const o of B) {
            if (o === b || o.raceState.finished) continue;
            const dx = o.x - b.x, dy = o.y - b.y;
            if (dx * dx + dy * dy < 130 * 130) { anyClose = true; break; }
        }
        if (!anyClose) { if (b._r19Since) b._r19Since = null; continue; }
        // nearest island by EDGE gap — the one she would ground on
        let isl = null, best = 1e18;
        for (const I of state.course.islands) {
            if (I.awash) continue;
            const dx = b.x - I.x, dy = b.y - I.y;
            const d2 = dx * dx + dy * dy;
            const lim = I.radius + 120;
            if (d2 > lim * lim) continue;
            if (d2 < best) { best = d2; isl = I; }
        }
        if (!isl) { if (b._r19Since) b._r19Since = null; continue; }
        const bx = b.x - isl.x, by = b.y - isl.y;
        const bl = Math.max(1, Math.sqrt(bx * bx + by * by));
        const ax = bx / bl, ay = by / bl;
        const led = b._r19Since || (b._r19Since = {});
        for (const o of B) {
            if (o === b || o.raceState.finished) continue;
            const dx = o.x - b.x, dy = o.y - b.y;
            if (dx * dx + dy * dy > 130 * 130) { delete led[o.id]; continue; }
            // Hysteresis on the outside test (RRS 43 wiring): an entry is
            // CREATED only when the other boat sits clearly outside (45u along
            // the escape axis), but once held it survives the gap COLLAPSING —
            // the collapse is the squeeze itself, and the contact umpire reads
            // this ledger at the moment the hulls meet, when the along-axis
            // distance is hull-to-hull. Without this the obligation record
            // deletes itself one frame before the only event that needs it.
            if (dx * ax + dy * ay < (led[o.id] != null ? 10 : 45)) { delete led[o.id]; continue; }
            if (!(window.Rules && window.Rules.isOverlapped && window.Rules.isOverlapped(b, o))) { delete led[o.id]; continue; }
            if (led[o.id] == null) led[o.id] = now;
        }
    }
}

// WHALES ARE HARD CONTACT — AT THE SURFACE (Bluewater Bonanza; Wes, Sep 25 2026). A humpback at
// the surface is thirty-odd tonnes; sail into one and you stop. Its body is a capsule (from
// Wildlife.surfacedWhales, which only returns whales breathing, rolling out on a dive or out of
// the water in a display — one cruising below is passed over). The hull's bow, middle and stern
// are tested against it; contact pushes the boat clear and takes almost all its speed, and the
// whale throws white water and goes down. Deterministic: whale motion runs on the sim clock off
// the wildlife module's own seeded stream, never the race RNG.
function checkWhaleContact(dt) {
    if (!window.Wildlife || !Wildlife.surfacedWhales) return;
    const bodies = Wildlife.surfacedWhales();
    if (!bodies.length) return;
    for (const boat of state.boats) {
        if (boat.raceState && boat.raceState.finished) continue;
        const hx = Math.sin(boat.heading), hy = -Math.cos(boat.heading);
        for (const B of bodies) {
            if (Math.hypot(boat.x - B.ax, boat.y - B.ay) > B.r + 200 && Math.hypot(boat.x - B.bx, boat.y - B.by) > B.r + 200) continue;
            const vx = B.bx - B.ax, vy = B.by - B.ay, vv = vx * vx + vy * vy;
            let hit = null;
            for (const s of [-24, 0, 24]) {
                const px = boat.x + hx * s, py = boat.y + hy * s;
                const u = Math.max(0, Math.min(1, ((px - B.ax) * vx + (py - B.ay) * vy) / vv));
                const cx = B.ax + vx * u, cy = B.ay + vy * u, dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
                const pad = B.r + 5;                                   // half a hull's beam
                if (d < pad && (!hit || pad - d > hit.over)) hit = { over: pad - d, nx: d > 0.01 ? dx / d : -hy, ny: d > 0.01 ? dy / d : hx, cx, cy };
            }
            if (!hit) continue;
            boat.x += hit.nx * hit.over; boat.y += hit.ny * hit.over;
            boat.speed *= 0.15;                                       // it stops you
            if (boat.ai) boat.ai.collisionData = { type: 'island', normal: { x: -hit.nx, y: -hit.ny }, isFloe: false };
            if (!boat._whaleT || state.time - boat._whaleT > 1.5) {
                boat._whaleT = state.time;
                Wildlife.startleWhale(B.m, hit.cx, hit.cy);
                if (window.onRaceEvent && state.race.status === 'racing') window.onRaceEvent('collision_island', { boat, isFloe: false, whale: true });
                if (boat.isPlayer && state.race.status === 'racing' && typeof GameEvents !== 'undefined') GameEvents.emit('player-contact', { leg: boat.raceState.leg, isFloe: false, whale: true, obj: B });
            }
        }
    }
}

// The bots' eye for whales: if the line ahead (out to ~4 s at this speed, at least 220 u) passes
// within a hull's reach of a surfaced whale's body, bear off to the side the whale is NOT on,
// by as much as it takes (up to ~50°). Read by updateAI (ai/bot.js). Pure; touches no state.
function whaleDodgeHeading(boat, heading) {
    if (!window.Wildlife || !Wildlife.surfacedWhales || typeof heading !== 'number') return heading;
    const bodies = Wildlife.surfacedWhales();
    if (!bodies.length) return heading;
    const look = Math.max(220, (boat.speed || 0) * 60 * 4);
    let best = null;
    for (const B of bodies) {
        const cx = (B.ax + B.bx) / 2, cy = (B.ay + B.by) / 2;
        if (Math.hypot(cx - boat.x, cy - boat.y) > look + 120) continue;
        for (let d = 20; d <= look; d += 20) {
            const px = boat.x + Math.sin(heading) * d, py = boat.y - Math.cos(heading) * d;
            const vx = B.bx - B.ax, vy = B.by - B.ay, u = Math.max(0, Math.min(1, ((px - B.ax) * vx + (py - B.ay) * vy) / (vx * vx + vy * vy)));
            const qx = B.ax + vx * u, qy = B.ay + vy * u;
            if (Math.hypot(px - qx, py - qy) < B.r + 30) { if (!best || d < best.d) best = { d, qx, qy }; break; }
        }
    }
    if (!best) return heading;
    // which side of our line is the whale on? steer to the other, harder the closer it is
    const side = Math.sign(Math.sin(heading) * (best.qy - boat.y) - -Math.cos(heading) * (best.qx - boat.x)) || 1;
    return normalizeAngle(heading - side * (0.35 + 0.5 * (1 - best.d / look)));
}

function checkIslandCollisions(dt) {
    if (!state.course || !state.course.islands) return;
    updateRule19Ledger();

    for (const boat of state.boats) {
        if (boat.raceState.finished && boat.fadeTimer <= 0) continue;

        // Optimization: Broad phase
        let potential = false;
        for (const isl of state.course.islands) {
            if (isl.awash) continue;
            const dx = boat.x - isl.x;
            const dy = boat.y - isl.y;
            if (dx*dx + dy*dy < (isl.radius + 50)**2) { potential = true; break; }
        }
        if (!potential) continue;

        const boatPoly = getHullPolygon(boat);

        for (const isl of state.course.islands) {
            // AWASH SHAPES ARE NOT COLLIDERS. A shoal is under the boat, not in front of
            // it — shoving a hull sideways out of water it is floating over would be a
            // shove with nothing to push against, and it would fire `collision_island` at
            // the eval harness for a contact that never happened. The bar's whole cost is
            // the drag in the speed model (shoalFieldAt); there is nothing to bounce off.
            if (isl.awash) continue;
            const dx = boat.x - isl.x;
            const dy = boat.y - isl.y;
            if (dx*dx + dy*dy > (isl.radius + 50)**2) continue;

            // Mask landmasses are concave and keyholed, and SAT is a CONVEX test —
            // run against them it collides with their convex hull, which spans
            // most of the map and reads as invisible walls all over open water.
            // Circle-vs-polygon instead: exact for concave shapes, and cheap.
            const res = isl.fromMask
                ? hullPolyCollide(boat, isl.vertices)
                : satPolygonPolygon(boatPoly, isl.vertices);
            if (res) {
                 // Push boat OUT
                 boat.x -= res.axis.x * res.overlap;
                 boat.y -= res.axis.y * res.overlap;

                 // Grounding Penalty, per frame of contact, by where the bow points against
                 // the land (res.axis points boat -> land): bow-on 60%, scraping along it 2%,
                 // and nothing once the bow points ~15° or more away — so a boat can always
                 // sail OUT. The flat 0.4 every frame trapped boats for good in a pocket the
                 // current pressed them into: the loss outran any speed the sails could build
                 // (PT-055, Sockeye Run R3 — 157 s at 0 kt in the shape-34 notch). Keep the
                 // scrape small: at 8% a boat sliding bow-out along a pinned face was crushed
                 // the same way (river bench, 60 races: 11 DNFs at 8%, 1 with none at all).
                 const intoLand = Math.sin(boat.heading) * res.axis.x - Math.cos(boat.heading) * res.axis.y;
                 const SCRAPE = 0.02;
                 boat.speed *= 1 - (intoLand > 0 ? SCRAPE + (0.6 - SCRAPE) * intoLand
                                                 : SCRAPE * Math.max(0, 1 + intoLand / 0.25));

                 // Tell the AI it is ON the ice, exactly as mark contact does. Without
                 // this the avoidance cost function sees every candidate blocked (the
                 // hull is inside the collider), falls back to least-deviation, and
                 // holds course INTO the floe — measured 16-second grinds at 120
                 // contacts/second on Glacier Sound.
                 if (boat.ai) boat.ai.collisionData = { type: 'island', normal: res.axis, isFloe: !!isl.isFloe };

                 // Groundings are the Arctic's real cost driver — surface them
                 // so the eval harness can measure ice avoidance directly
                 // instead of inferring it from race time.
                 if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
                     window.onRaceEvent('collision_island', { boat, isFloe: !!isl.isFloe });
                 }
                 // The player's own contacts, for venue objectives that ask for a clean run
                 // (Sockeye Run's gorge — sim/course.js). An event only: no state, no RNG.
                 if (boat.isPlayer && state.race.status === 'racing' && !boat.raceState.finished && typeof GameEvents !== 'undefined') {
                     GameEvents.emit('player-contact', { leg: boat.raceState.leg, isFloe: !!isl.isFloe, ice: isl.style === 'ice', obj: isl });
                 }

                 // RRS 19 (Room at an Obstruction): if an overlapped boat sat
                 // OUTSIDE us (between us and open water) while we hit the
                 // land, she denied us room — the foul is hers, not ours.
                 let squeezer = null;
                 if (state.race.status === 'racing' && window.Rules && window.Rules.isOverlapped) {
                     const bx = boat.x - isl.x, by = boat.y - isl.y;
                     const bl = Math.max(1, Math.sqrt(bx * bx + by * by));
                     const ax = bx / bl, ay = by / bl; // escape direction: island -> boat
                     // ── THE TWO GUARDS (2026-08-13, landed 2026-08-14) ──────
                     // OWNER: "penalties are sometimes erroneously assigned when
                     // collisions don't happen... we should be conservative here."
                     // 90% of no-contact fouls come from this line, on an
                     // obligation held a median of 0.00 s. Neither test below
                     // invents a number: HOLD is the stand-on detector's own
                     // constant, and room can only be given by a boat that has
                     // some. (A third guard — "the claim direction must have
                     // water in it" — was drafted but never wired in; every
                     // bench measured these two, so only these two land.)
                     const R19HOLD = (typeof window !== 'undefined' && window.__RULES && window.__RULES.hold != null)
                         ? window.__RULES.hold : 0.8;
                     const gR19 = state.course.botGrid;
                     const freeRun19 = (x, y, dxu, dyu, cap) => {
                         if (!gR19) return cap;
                         for (let d = 25; d <= cap; d += 25) {
                             const c = gR19.cell(x + dxu * d, y + dyu * d);
                             if (!gR19.at(c[0], c[1])) return d;
                         }
                         return cap;
                     };
                     for (const o of state.boats) {
                         if (o === boat || o.raceState.finished) continue;
                         const dx2 = o.x - boat.x, dy2 = o.y - boat.y;
                         // Tight attribution: blame only a boat close aboard
                         // (~2.5 lengths) sitting clearly on our open-water
                         // side — generous ranges over-penalized polar packs
                         // that were all legitimately dodging the same floe.
                         if (dx2 * dx2 + dy2 * dy2 > 130 * 130) continue;
                         if (dx2 * ax + dy2 * ay < 45) continue;        // not clearly outside us
                         if (!window.Rules.isOverlapped(boat, o)) continue;
                         // GUARD 1 (persistence, RRS 15): the obligation must have
                         // existed long enough for her to act on it. One frame of
                         // overlap at the instant of a grounding is not a foul.
                         const since = boat._r19Since && boat._r19Since[o.id];
                         if (since == null || state.race.timer - since < R19HOLD) continue;
                         // GUARD 2 (she had room to give): a boat pinned against
                         // land herself, or with a third boat outboard of her,
                         // cannot make room and is not the cause.
                         if (freeRun19(o.x, o.y, ax, ay, 100) < 100) continue;
                         let pinned = false;
                         for (const p of state.boats) {
                             if (p === o || p === boat || p.raceState.finished) continue;
                             const px = p.x - o.x, py = p.y - o.y;
                             if (px * px + py * py > 130 * 130) continue;
                             if (px * ax + py * ay >= 45) { pinned = true; break; }
                         }
                         if (pinned) continue;
                         squeezer = o;
                         break;
                     }
                 }
                 if (squeezer) {
                     triggerPenalty(squeezer, { rule: 'Rule 19', reason: 'Denied Room at Obstruction', kind: 'no-contact', with: boat });
                 }

                 // ── NO PENALTY FOR RUNNING AGROUND ──────────────────────────
                 // Land is not a mark. RRS 31 is "touching a mark", and the rest of Part 2
                 // is boat-on-boat — there is no rule against hitting an island, because
                 // the rocks already administer the punishment. Grounding cost a 360° turn
                 // here, which was both wrong as a rule and wrong as a game: the boat has
                 // already lost 60% of its speed, and the spin was a second, larger, purely
                 // invented penalty on top.
                 //
                 // What SURVIVES is Rule 19 above: if another boat denied you room at the
                 // obstruction, that is a real foul and it is HERS. That is the only
                 // penalty land can produce, and it is still assessed against the squeezer.
                 // (The measurement event already fired above, once, with its isFloe tag —
                 // this used to fire a second copy and every grounding counted double.)
            }
        }
    }
}

// Per-style palettes: tropical (default), grass (swamp/river banks), ice (polar floes)

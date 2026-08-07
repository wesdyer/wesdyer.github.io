// PUSH C — SCENARIO-POOL RESIDUAL (arctic solo-ice). Scene detection,
// snapshot, spawn-into-scenario restore, and the 20-40s scene episode.
//
// Reuses rlt_shared's observation/policy/installer (SHARED_SRC) UNCHANGED —
// same 12-dim obs, same bounded 2Hz slew-limited residual, same contested
// gate, same frozen bias. This file adds only the SCENE layer on top; the
// budget arithmetic is the whole point (20-40s episodes at ~1-2s wall each
// vs 20s wall for a full-race episode — the 10-20x multiplier the driver ES
// never had).
//
// Scene classes, SOLO-FIRST per the leader analysis (per-seed winners are
// traffic-free and still 45-60% slow — solo pack-sailing is the leader's
// whole gap): 'gap' approach, 'wiggle' entry, 'thread' (pack threading);
// 'squeeze' (boat+ice) harvested second at a lower rate.
//
// CRN pairing: an episode is deterministic given (scene, raceSeed) — the
// engine's only RNG is evalHarness's Mulberry32 behind Math.random, and the
// restore re-seeds it identically for the frozen twin and the policy run.
// scn_check.js proves determinism + zero-policy inertness per scene.
const { SHARED_SRC, OBS_DIM, PARAM_DIM, DPSI_MAX, zeroParams, makeRng } = require('./rlt_shared.js');

const SCN_SRC = `
// ---- harvest-side: classify + snapshot ----
window.__scnState = { scenes: [], cool: {}, prevWig: {} };
// Rising-edge classification per bot. Solo gate: no live rival within 300u
// (the contested() rival radius). Transit frames only — the start scrum is
// excluded (leg >= 1) and so are armed roundings and penalized boats.
window.__scnClassify = (boat) => {
    const c = boat.controller; if (!c) return null;
    const rs = boat.raceState;
    if (rs.finished || rs.roundArmed || rs.leg < 1) return null;
    if ((rs.penaltyTurnsOwed || 0) > 0 || rs.penalty) return null;
    let dRival = 1e9;
    for (const b2 of state.boats) {
        if (b2 === boat || b2.isPlayer || b2.raceState.finished) continue;
        const d = Math.hypot(b2.x - boat.x, b2.y - boat.y);
        if (d < dRival) dRival = d;
    }
    const hd = boat.heading;
    const bvx = Math.sin(hd) * boat.speed * 60, bvy = -Math.cos(hd) * boat.speed * 60;
    let ahead = 1e9, nNear = 0, aheadClosing = 0;
    for (const f of (state.course._floeObjs || [])) {
        const dx = f.x - boat.x, dy = f.y - boat.y;
        const d = Math.hypot(dx, dy), edge = d - f.radius;
        if (edge < 400) nNear++;
        const rel = normalizeAngle(Math.atan2(dx, -dy) - hd);
        if (Math.abs(rel) < 0.35 && edge < ahead) {
            ahead = edge;
            const ux = d > 1 ? dx / d : 0, uy = d > 1 ? dy / d : 0;
            aheadClosing = (bvx - (f.driftVx || 0) * 60) * ux + (bvy - (f.driftVy || 0) * 60) * uy;
        }
    }
    const wig = !!(c.wiggleActive || c.livenessState !== 'normal');
    const wigPrev = window.__scnState.prevWig[boat.name] || false;
    window.__scnState.prevWig[boat.name] = wig;
    const solo = dRival > 300;
    // Order matters: wiggle entry is the rarest and most valuable; a boat
    // entering a wiggle inside a pack would otherwise always classify 'thread'.
    if (solo && wig && !wigPrev) return 'wiggle';
    if (solo && ahead < 450 && aheadClosing > 30 && boat.speed > 0.8) return 'gap';
    if (solo && nNear >= 3 && boat.speed > 0.5) return 'thread';
    if (!solo && dRival < 300 && ahead < 350) return 'squeeze';
    return null;
};
window.__scnSnapBoat = (b) => ({
    name: b.name, x: b.x, y: b.y, heading: b.heading, speed: b.speed,
    vx: b.velocity.x, vy: b.velocity.y, sail: b.sailAngle, boom: b.boomSide,
    heel: b.heel, spin: !!b.spinnaker, leg: b.raceState.leg,
});
window.__scnSnap = (boat, cls) => {
    const floes = [];
    for (const isl of (state.course.islands || [])) {
        if (!isl.isFloe) continue;
        // Mutable floe state only. Identity fields (localHull, wanderRate,
        // wanderPhase, spinRate) are rebuilt identically by resetGame(seed).
        floes.push([+isl.x.toFixed(2), +isl.y.toFixed(2), +isl.spin.toFixed(4),
                    +isl.driftVx.toFixed(4), +isl.driftVy.toFixed(4)]);
    }
    const rivals = [];
    for (const b2 of state.boats) {
        if (b2 === boat || b2.isPlayer || b2.raceState.finished) continue;
        if (Math.hypot(b2.x - boat.x, b2.y - boat.y) < 800) rivals.push(window.__scnSnapBoat(b2));
    }
    return { cls, t: +state.race.timer.toFixed(2), ego: window.__scnSnapBoat(boat), rivals, floes };
};
// 2Hz sampler with a 12s per-boat cooldown (a scene is an EPISODE, not a
// frame — the same grind must not harvest sixty near-identical snapshots).
window.__scnHarvestTick = () => {
    for (const b of state.boats) {
        if (b.isPlayer) continue;
        const cls = window.__scnClassify(b);
        if (!cls) continue;
        const t = state.race.timer;
        if (t - (window.__scnState.cool[b.name] || -99) < 12) continue;
        window.__scnState.cool[b.name] = t;
        window.__scnState.scenes.push(window.__scnSnap(b, cls));
    }
};
window.__scnHarvestRace = (seed, WIN) => {
    window.evalHarness.seed = seed;
    window.resetGame(); window.startRace();
    state.course.cutoff = 900;
    const pl = state.boats.find(b => b.isPlayer);
    if (pl) { pl.x = -4500; pl.y = 4700; }
    window.__scnState = { scenes: [], cool: {}, prevWig: {} };
    const dt = 1 / 60; let lastS = -1;
    for (let it = 0; it < 60 * (WIN + 40); it++) {
        window.update(dt);
        if (state.race.status === 'finished') break;
        if (state.race.status !== 'racing') continue;
        if (state.race.timer > WIN) break;
        if (state.race.timer - lastS >= 0.5) { lastS = state.race.timer; window.__scnHarvestTick(); }
    }
    const sc = window.__scnState.scenes;
    for (const s of sc) s.seed = seed;
    return sc;
};

// ---- episode-side: restore + run ----
// Course-path progress in units: completed transit legs plus projection on
// the current one. Monotone across leg advances; the transit metric the
// campaign tracks, in the small.
window.__scnProgress = (boat) => {
    const legs = state.course.dmc && state.course.dmc.legs;
    if (!legs) return 0;
    const li = Math.min(boat.raceState.leg, legs.length - 1);
    let p = 0;
    for (let k = 1; k < li; k++) p += (legs[k] && legs[k].length) || 0;
    const leg = legs[li];
    if (leg && leg.length && leg.pts) {
        p += Math.max(0, Math.min(leg.length, CoursePath.project(leg, boat.x, boat.y, null)));
    }
    return p;
};
// Spawn-into-scenario. resetGame(scene.seed) rebuilds the exact course +
// floe IDENTITIES; the snapshot then overwrites the mutable floe state and
// the cast's kinematics. Everyone not in the scene is parked finished, far
// away and spread out. Prestart is skipped the way the engine's own sim
// test does it (status='racing' directly — the gun OCS check never runs).
window.__scnRestore = (scene) => {
    window.evalHarness.seed = scene.seed;
    window.resetGame(); window.startRace();
    state.race.status = 'racing';
    state.race.timer = scene.t;      // wiggle timers / cadences see scene time
    state.course.cutoff = 9000;
    const isls = (state.course.islands || []).filter(i => i.isFloe);
    for (let i = 0; i < isls.length && i < scene.floes.length; i++) {
        const s = scene.floes[i], isl = isls[i];
        isl.x = s[0]; isl.y = s[1]; isl.spin = s[2];
        isl.driftVx = s[3]; isl.driftVy = s[4];
        syncFloe(isl);
    }
    // The bots' floe map was baked at spawn positions — force a re-bake at
    // the restored positions or the ego routes on a 200u-wrong map.
    if (state.course.navVersion !== undefined) state.course.navVersion++;
    state.course._botGridT = null;
    refreshBotGrid();
    const pl = state.boats.find(b => b.isPlayer);
    if (pl) { pl.x = -6000; pl.y = 6000; pl.raceState.finished = true; pl.fadeTimer = 0; pl.opacity = 0; }
    const cast = {}; cast[scene.ego.name] = scene.ego;
    for (const r of (scene.rivals || [])) cast[r.name] = r;
    let park = 0, ego = null;
    for (const b of state.boats) {
        if (b.isPlayer) continue;
        const snap = cast[b.name];
        if (!snap) {
            b.raceState.finished = true; b.fadeTimer = 0; b.opacity = 0;
            b.x = -9000 - 500 * park; b.y = 9000 + 500 * park;
            b.speed = 0; b.velocity.x = 0; b.velocity.y = 0; park++;
            continue;
        }
        b.x = snap.x; b.y = snap.y;
        b.heading = snap.heading; b.prevHeading = snap.heading;
        b.speed = snap.speed; b.velocity.x = snap.vx; b.velocity.y = snap.vy;
        b.sailAngle = snap.sail; b.boomSide = snap.boom >= 0 ? 1 : -1;
        b.targetBoomSide = b.boomSide; b.heel = snap.heel;
        b.spinnaker = !!snap.spin; b.spinnakerDeployProgress = b.spinnaker ? 1 : 0;
        b.raceState.leg = snap.leg;
        b.raceState.legStartTime = scene.t;
        b.raceState.lastPos = { x: snap.x, y: snap.y };
        b.__rltT = null; b.__rltPsi = 0; b.__rltHint = null;
        if (b.name === scene.ego.name) ego = b;
    }
    // CRN: identical downstream randomness for the twin and the policy run.
    window.evalHarness.seed = ((scene.seed ^ 0x5DEECE) + Math.round(scene.t * 100)) >>> 0;
    return ego;
};
window.__scnEpisode = (P, scene, WIN) => {
    const ego = window.__scnRestore(scene);
    if (!ego) return null;
    if (P) window.__rltInstall(P); else window.__rltUninstall();
    window.__rltHits = {}; window.__rltLast = {};
    const prog0 = window.__scnProgress(ego);
    const t0 = state.race.timer;
    const dt = 1 / 60;
    for (let it = 0; it < Math.ceil(60 * WIN) + 5; it++) {
        window.update(dt);
        if (state.race.timer - t0 >= WIN) break;
        if (ego.raceState.finished) break;
    }
    const prog = window.__scnProgress(ego) - prog0;
    const hits = window.__rltHits[ego.name] || 0;
    const pens = ego.raceState.totalPenalties || 0;
    const acts = (window.__rlT && window.__rlT.n) || 0;
    window.__rltUninstall();
    // Symmetric contact shaping: 80u per contact EPISODE (the measured
    // human clearance scale), penalties heavily — a residual that wins
    // distance by fouling or grinding ice is not a win. Paired against the
    // twin, the shaping terms cancel unless the policy CHANGES them.
    return { cost: -prog + 80 * hits + 400 * pens, prog, hits, pens, acts };
};
`;

module.exports = { SHARED_SRC, SCN_SRC, OBS_DIM, PARAM_DIM, DPSI_MAX, zeroParams, makeRng };

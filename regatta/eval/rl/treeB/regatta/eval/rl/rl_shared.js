// Shared in-page source for the RL sweep-policy pilot: observation builder
// (rival-aware, 42 floats), linear policy, whole-episode rollout (batch
// stepping — one page.evaluate per EPISODE, not per step), and the fleet-gate
// installer that lets the policy drive every armed bot via window.__rl.actFor.
//
// Consumed by rl_train_cem.js (training) and rl_gate.js (fleet_leg2 gate).
// Node-side helpers at the bottom (init distribution, seeded RNG).

const OBS_DIM = 42;
const PARAM_DIM = 2 * OBS_DIM + 2; // 86: two linear heads + biases

const SHARED_SRC = `
window.__RL_OBS_DIM = ${OBS_DIM};
// 42-float observation for one armed boat (pilot scope: sweep phase).
// [0..15]  ice/land sector states on the ring at 1.1x zone (0 clear, 0.3 clear-
//          but-closing, 0.5 opening lead, 0.8 plugged, 1 hard) from botGrid+_soft+_futBlk
// [16]     sweep fraction banked (roundSweep / need, capped 1.5)
// [17,18]  bearing-from-mark sin/cos     [19] dist/zone (0..3)   [20] speed/3
// [21,22]  wind-drift dir rel to bearing [23,24] twa sin/cos     [25] time-in-phase/300
// [26..41] RIVAL ring occupancy: 16 sectors by bearing-from-mark; every other
//          unfinished bot within zone*2.5 adds (1 - d/(zone*2.5)) to its sector.
window.__rlObsFor = (boat) => {
    const rm = state.course.roundMark, g = state.course.botGrid;
    const o = new Array(${OBS_DIM}).fill(0);
    for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        const cc = g.cell(rm.x + Math.cos(a) * rm.zone * 1.1, rm.y + Math.sin(a) * rm.zone * 1.1);
        const id = cc[1] * g.n + cc[0];
        if (g.at(cc[0], cc[1])) o[k] = g._futBlk && g._futBlk[id] ? 0.3 : 0;
        else if (g._soft && g._soft[id] === 1) o[k] = 0.5;
        else if (g._soft && g._soft[id] === 2) o[k] = 0.8;
        else o[k] = 1;
    }
    const need = rm.reqSweep * ROUND_SWEEP_TOL;
    o[16] = Math.min(1.5, (boat.raceState.roundSweep || 0) / need);
    const brg = Math.atan2(boat.y - rm.y, boat.x - rm.x);
    o[17] = Math.sin(brg); o[18] = Math.cos(brg);
    o[19] = Math.min(3, Math.hypot(boat.x - rm.x, boat.y - rm.y) / rm.zone);
    o[20] = Math.min(1, boat.speed / 3);
    const lw = getWindAt(boat.x, boat.y);
    const dd = lw.direction - brg;
    o[21] = Math.sin(dd); o[22] = Math.cos(dd);
    const twa = boat.heading - lw.direction;
    o[23] = Math.sin(twa); o[24] = Math.cos(twa);
    if (boat.__rlT0 == null) boat.__rlT0 = state.race.timer;
    o[25] = Math.min(1, (state.race.timer - boat.__rlT0) / 300);
    const R = rm.zone * 2.5;
    for (const b2 of state.boats) {
        if (b2 === boat || b2.isPlayer || b2.raceState.finished) continue;
        const d2 = Math.hypot(b2.x - rm.x, b2.y - rm.y);
        if (d2 > R) continue;
        let k2 = Math.round(Math.atan2(b2.y - rm.y, b2.x - rm.x) / (Math.PI * 2) * 16);
        k2 = ((k2 % 16) + 16) % 16;
        o[26 + k2] = Math.min(1, o[26 + k2] + (1 - d2 / R));
    }
    return o;
};
// Linear policy, tanh-squashed into the env's action box.
// P[0..41] + P[84]: advance head -> [0.15, 1.2]; classical 0.85 at z=0.347.
// P[42..83] + P[85]: speed head  -> [0.4, 1.0];  classical 1.0 as z -> +inf.
window.__rlPolicyAct = (P, o) => {
    let z0 = P[84], z1 = P[85];
    for (let i = 0; i < ${OBS_DIM}; i++) { z0 += P[i] * o[i]; z1 += P[${OBS_DIM} + i] * o[i]; }
    return [0.675 + 0.525 * Math.tanh(z0), 0.7 + 0.3 * Math.tanh(z1)];
};
// Whole-episode rollout for the training hero. Assumes reset() fast-forwarded
// to arming and window.__rl.t0 is set. Reward per 0.5s step matches rl_env.js
// (3*dSweepFrac - 0.02 - 0.3*heroContact, +5 latch / -2 timeout) plus an
// arc-blocking proxy in fleet episodes: -fleetPen per armed rival within 350u.
window.__rlRollout = (P, opts) => {
    const hero = window.__hero, rm = state.course.roundMark;
    const need = rm.reqSweep * ROUND_SWEEP_TOL;
    const dt = 1 / 60, maxSteps = (opts && opts.maxSteps) || 600;
    const fleetPen = (opts && opts.fleetPen) || 0;
    const c00 = window.__rl.contacts;
    hero.__rlT0 = window.__rl.t0;
    let Rtot = 0, steps = 0, banked = false;
    while (steps < maxSteps) {
        window.__rl.act = window.__rlPolicyAct(P, window.__rlObsFor(hero));
        const s0 = hero.raceState.roundSweep || 0;
        const c0 = window.__rl.contacts;
        let terminal = 0, done = false;
        for (let i = 0; i < 30; i++) {
            window.update(dt);
            if (hero.controller._outbound || hero.raceState.leg >= 2) { done = true; terminal = 5; banked = true; break; }
            if (state.race.timer - window.__rl.t0 > 300) { done = true; terminal = -2; break; }
        }
        const s1 = hero.raceState.roundSweep || 0;
        let r = 3.0 * (s1 - s0) / need - 0.02 - 0.3 * (window.__rl.contacts - c0) + terminal;
        if (fleetPen) {
            let nb = 0;
            for (const b2 of state.boats) {
                if (b2 === hero || b2.isPlayer || b2.raceState.finished || !b2.raceState.roundArmed) continue;
                if (Math.hypot(b2.x - hero.x, b2.y - hero.y) < 350) nb++;
            }
            r -= fleetPen * nb;
        }
        Rtot += r; steps++;
        if (done) break;
    }
    window.__rl.act = null;
    return { R: Rtot, steps, banked, t: state.race.timer - window.__rl.t0,
             sweep: hero.raceState.roundSweep || 0, need,
             contacts: window.__rl.contacts - c00 };
};
// Fleet-gate installer: the policy drives EVERY armed, not-yet-outbound bot.
// Cached per boat per sim-timestamp (both script.js hook sites hit it each pass).
window.__rlInstallActFor = (P) => {
    window.__rl = window.__rl || { act: null, contacts: 0 };
    window.__rl.actFor = (boat) => {
        if (!boat.raceState || !boat.raceState.roundArmed) return null;
        if (boat.controller && boat.controller._outbound) return null;
        if (boat.__rlActT === state.race.timer) return boat.__rlAct;
        boat.__rlActT = state.race.timer;
        boat.__rlAct = window.__rlPolicyAct(P, window.__rlObsFor(boat));
        return boat.__rlAct;
    };
};
`;

// ---- node-side helpers ----
function initMean() {
    const m = new Array(PARAM_DIM).fill(0);
    m[PARAM_DIM - 2] = 0.347; // advance bias -> classical 0.85
    m[PARAM_DIM - 1] = 2.0;   // speed bias   -> ~1.0 (near-saturated)
    return m;
}
function initSigma() {
    const s = new Array(PARAM_DIM).fill(0.15);
    s[PARAM_DIM - 2] = 0.35; s[PARAM_DIM - 1] = 0.35;
    return s;
}
// Deterministic xorshift RNG so training runs are reproducible.
function makeRng(seed) {
    let x = seed >>> 0 || 88675123;
    const u = () => {
        x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
        return x / 4294967296;
    };
    // Box-Muller
    let spare = null;
    u.gauss = () => {
        if (spare != null) { const v = spare; spare = null; return v; }
        let a = 0, b = 0;
        do { a = u(); } while (a === 0);
        b = u();
        const r = Math.sqrt(-2 * Math.log(a));
        spare = r * Math.sin(2 * Math.PI * b);
        return r * Math.cos(2 * Math.PI * b);
    };
    return u;
}

module.exports = { SHARED_SRC, OBS_DIM, PARAM_DIM, initMean, initSigma, makeRng };

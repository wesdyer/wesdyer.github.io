// PHASE A — DRIVER-LEVEL RESIDUAL (transit). In-page source: observation
// builder, bounded zero-init residual policy, the installer that lets the
// policy steer every bot, and a whole-race episode runner.
//
// The residual bends the CLASSICAL desired heading before applyAvoidance sees
// it (script.js §3.9 seam, inert without window.__rlT). Zero parameters => zero
// residual => byte-identical to the classical stack; that is the floor the gate
// is protected by, and `rlt_inert.js` proves it every run.
//
// Consumed by rlt_train.js (CEM/ES) and rlt_gate.js (fleet gate).
const OBS_DIM = 12;
const PARAM_DIM = OBS_DIM + 1;      // linear head + (frozen) bias
const DPSI_MAX = 25 * Math.PI / 180; // bounded residual, per the research recipe
const SLEW = 0.12;                   // rad per 0.5s decision (0.24 rad/s)

const SHARED_SRC = `
window.__RLT_OBS_DIM = ${OBS_DIM};
window.__RLT_DPSI_MAX = ${DPSI_MAX};
// 12-float COMPACT egocentric observation. The first build used 44 dims and
// starved: at ~7.5 min/generation the budget is ~50 generations x 12 candidates,
// which is ~1 evaluation per parameter per generation against a fleet score
// whose per-seed dispersion is tens of seconds. Nothing can be learned at that
// ratio, and the log showed it — for three straight generations the best of
// twelve perturbations WAS the unperturbed mean.
//
// So: only the features a steering residual can actually act on, and SIGNED
// wherever a sign exists (a left/right asymmetry is the entire output space of
// this policy — the 44-dim build fed it |avoidance deviation| with the sign
// thrown away, which is the one number that says which way the classical layer
// is already turning).
//   [0] floe proximity 30 deg RIGHT of the bow   [1] same, LEFT
//   [2] floe proximity 60 deg RIGHT              [3] same, LEFT
//   [4] floe proximity DEAD AHEAD                [5] its closing rate
//   [6] rival proximity, right half              [7] rival proximity, left half
//   [8] SIGNED avoidance deviation last tick     [9] signed cross-track /300
//  [10] sin(bearing to carrot - heading)        [11] speed/3, centred
window.__rltObsFor = (boat, desiredHeading) => {
    const o = new Array(${OBS_DIM}).fill(0);
    const c = boat.controller;
    const hd = boat.heading;
    const R = 1200;
    // Floe ring: nearest edge in each of five bow-relative wedges.
    const wedge = [0, 0, 0, 0, 0];   // [ahead, R30, L30, R60, L60]
    let aheadClose = 0;
    const bvx = Math.sin(hd) * boat.speed * 60, bvy = -Math.cos(hd) * boat.speed * 60;
    for (const f of (state.course._floeObjs || [])) {
        const dx = f.x - boat.x, dy = f.y - boat.y;
        const d = Math.hypot(dx, dy), edge = d - f.radius;
        if (edge > R) continue;
        const rel = normalizeAngle(Math.atan2(dx, -dy) - hd);
        const a = Math.abs(rel);
        let k = -1;
        if (a < 0.26) k = 0;
        else if (a < 0.79) k = rel > 0 ? 1 : 2;
        else if (a < 1.31) k = rel > 0 ? 3 : 4;
        if (k < 0) continue;
        const prox = Math.max(0, 1 - Math.max(0, edge) / R);
        if (prox > wedge[k]) {
            wedge[k] = prox;
            if (k === 0) {
                const ux = d > 1 ? dx / d : 0, uy = d > 1 ? dy / d : 0;
                aheadClose = Math.max(-1, Math.min(1,
                    ((bvx - (f.driftVx || 0) * 60) * ux + (bvy - (f.driftVy || 0) * 60) * uy) / 60));
            }
        }
    }
    o[0] = wedge[1]; o[1] = wedge[2]; o[2] = wedge[3]; o[3] = wedge[4];
    o[4] = wedge[0]; o[5] = aheadClose;
    const RR = 600;
    for (const b2 of state.boats) {
        if (b2 === boat || b2.raceState.finished) continue;
        const dx = b2.x - boat.x, dy = b2.y - boat.y;
        const d = Math.hypot(dx, dy);
        if (d > RR) continue;
        const rel = normalizeAngle(Math.atan2(dx, -dy) - hd);
        if (Math.abs(rel) > 1.6) continue;         // behind the beam: not our problem
        const v = 1 - d / RR;
        const idx = rel > 0 ? 6 : 7;
        if (v > o[idx]) o[idx] = v;
    }
    // SIGNED: which way avoidance has already bent us, not just how far.
    o[8] = Math.max(-1, Math.min(1, ((c && c.lastAvoidDeviation) || 0)
        * (desiredHeading != null && c && c._lastAvoidChoice != null
            ? Math.sign(normalizeAngle(c._lastAvoidChoice - desiredHeading)) || 1 : 1)));
    const leg = state.course.dmc && state.course.dmc.legs
        ? state.course.dmc.legs[boat.raceState.leg] : null;
    if (leg && leg.length && leg.pts && leg.pts.length > 1) {
        const cum = leg.cum, pts = leg.pts;
        const ptAt = (target) => {
            if (target >= leg.length) return pts[pts.length - 1];
            let k = 1;
            while (k < cum.length - 1 && cum[k] < target) k++;
            const t = (target - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
            return { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t,
                     y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t };
        };
        const sProj = CoursePath.project(leg, boat.x, boat.y, boat.__rltHint);
        boat.__rltHint = sProj;
        const here = ptAt(sProj), p2 = ptAt(Math.min(leg.length, sProj + 60));
        const tx = p2.x - here.x, ty = p2.y - here.y, tl = Math.hypot(tx, ty) || 1;
        o[9] = Math.max(-1, Math.min(1,
            ((boat.x - here.x) * (-ty / tl) + (boat.y - here.y) * (tx / tl)) / 300));
    }
    const nav = c && c._lastNav;
    if (nav) o[10] = Math.sin(normalizeAngle(Math.atan2(nav.x - boat.x, -(nav.y - boat.y)) - hd));
    o[11] = Math.min(1, boat.speed / 3) - 0.7;
    return o;
};
// Bounded residual. All-zero params => 0 rad => the classical stack, exactly.
window.__rltPolicyAct = (P, o) => {
    let z = P[${OBS_DIM}];
    for (let i = 0; i < ${OBS_DIM}; i++) z += P[i] * o[i];
    return ${DPSI_MAX} * Math.tanh(z);
};
// Installer: every bot in transit runs the residual. Decisions at 2Hz with a
// slew limit, held between decisions — a per-frame residual would just be a
// noise source on top of a 10Hz controller.
window.__rltInstall = (P) => {
    window.__rlT = window.__rlT || {};
    window.__rlT.n = 0;
    window.__rlT.actFor = (boat, desiredHeading) => {
        const rs = boat.raceState;
        if (!rs || rs.finished || rs.roundArmed || rs.leg < 1) return 0;
        if (state.race.status !== 'racing') return 0;
        if (boat.isPlayer) return 0;
        // CONTESTED FRAMES ONLY. A residual that is live in open water is a
        // constant lean on every boat for the whole race, and a constant lean is
        // exactly what the bias-only control proved catastrophic (cost 202 ->
        // 333). The classical stack is already good in clear water; the residual
        // only gets to speak where the decision is actually contested.
        if (!window.__rltContested(boat)) { boat.__rltPsi = 0; return 0; }
        const t = state.race.timer;
        if (boat.__rltT == null || t - boat.__rltT >= 0.5) {
            boat.__rltT = t;
            const want = window.__rltPolicyAct(P, window.__rltObsFor(boat, desiredHeading));
            const prev = boat.__rltPsi || 0;
            const d = Math.max(-${SLEW}, Math.min(${SLEW}, want - prev));
            boat.__rltPsi = prev + d;
            window.__rlT.n++;
        }
        return boat.__rltPsi || 0;
    };
};
window.__rltContested = (boat) => {
    const c = boat.controller;
    if (c && Math.abs(c.lastAvoidDeviation || 0) > 0.05) return true;
    if (c && (c.riskState === 'HIGH' || c.riskState === 'IMMINENT')) return true;
    if (c && c._trajRisk != null && c._trajRisk < 6) return true;
    for (const f of (state.course._floeObjs || [])) {
        const d = Math.hypot(f.x - boat.x, f.y - boat.y) - f.radius;
        if (d < 400) return true;
    }
    for (const b2 of state.boats) {
        if (b2 === boat || b2.raceState.finished) continue;
        if (Math.hypot(b2.x - boat.x, b2.y - boat.y) < 300) return true;
    }
    return false;
};
window.__rltUninstall = () => { if (window.__rlT) window.__rlT.actFor = null; };

// ---- episode: one full arctic fleet race, scored on TRANSIT ----
// Per bot: time to roundArmed (the transit metric the campaign tracks), or a
// bounded shortfall charge if it never armed inside the window. Contacts and
// penalties are charged on top; penalties heavily, because acceptance is
// lexicographic and a policy that wins pace by fouling is not a win.
window.__rltEpisode = (P, seed, WIN) => {
    window.evalHarness.seed = seed;
    window.resetGame(); window.startRace();
    state.course.cutoff = 900;
    if (P) window.__rltInstall(P); else window.__rltUninstall();
    const bots = state.boats.filter(b => !b.isPlayer);
    const pl = state.boats.find(b => b.isPlayer);
    if (pl) { pl.x = -4500; pl.y = 4700; }
    for (const b of state.boats) { b.__rltT = null; b.__rltPsi = 0; b.__rltHint = null; }
    // BOTH maps, every episode. Leaving __rltLast populated made the dedup
    // window compare a fresh t against last race's timestamps (t - last is
    // negative, so < 0.5 is true) and silently swallowed the opening contacts
    // of every episode after the first — it read as a policy effect.
    window.__rltHits = {}; window.__rltLast = {};
    const info = bots.map(() => ({ arm: null, prog: 0, hits: 0 }));
    const dt = 1 / 60;
    for (let it = 0; it < 60 * (WIN + 40); it++) {
        window.update(dt);
        if (state.race.status === 'finished') break;
        if (state.race.status !== 'racing') continue;
        if (state.race.timer > WIN) break;
        for (let k = 0; k < bots.length; k++) {
            const b = bots[k], inf = info[k];
            if (inf.arm == null && (b.raceState.roundArmed || b.raceState.leg >= 2))
                inf.arm = state.race.timer;
        }
    }
    const leg1 = state.course.dmc && state.course.dmc.legs ? state.course.dmc.legs[1] : null;
    let cost = 0, armed = 0, hits = 0, pens = 0;
    for (let k = 0; k < bots.length; k++) {
        const b = bots[k], inf = info[k];
        if (inf.arm != null) { cost += inf.arm; armed++; }
        else {
            let f = 0;
            if (leg1 && leg1.length && b.raceState.leg === 1)
                f = Math.max(0, Math.min(1, CoursePath.project(leg1, b.x, b.y, null) / leg1.length));
            cost += WIN + 300 * (1 - f);
        }
        hits += (window.__rltHits[b.name] || 0);
        pens += b.raceState.totalPenalties || 0;
    }
    const n = bots.length;
    window.__rltUninstall();
    return {
        cost: cost / n + 1.5 * (hits / n) + 25 * (pens / n),
        rawT: cost / n, armed, hits, pens, n,
        acts: (window.__rlT && window.__rlT.n) || 0,
    };
};
// Contact counter with the probe's 0.5s dedup, so "hits" means contact
// EPISODES and a single grind is not billed sixty times a second.
window.__rltInstallCounter = () => {
    const inner = window.onRaceEvent;
    window.__rltHits = {}; window.__rltLast = {};
    window.onRaceEvent = (ty, d) => {
        try {
            if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer) {
                const nm = d.boat.name, t = state.race.timer;
                if (!(t - (window.__rltLast[nm] || -9) < 0.5)) {
                    window.__rltHits[nm] = (window.__rltHits[nm] || 0) + 1;
                }
                window.__rltLast[nm] = t;
            }
        } catch (e) {}
        return inner && inner(ty, d);
    };
};
`;

// ---- node-side ----
function zeroParams() {
    return new Array(PARAM_DIM).fill(0);
}
function makeRng(seed) {
    let x = seed >>> 0 || 88675123;
    const u = () => {
        x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
        return x / 4294967296;
    };
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

module.exports = { SHARED_SRC, OBS_DIM, PARAM_DIM, DPSI_MAX, zeroParams, makeRng };

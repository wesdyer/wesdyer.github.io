// Shared in-page source for CREW-level RL (four-level architecture: crew =
// controls execution — turn rate + sail power toward the tactician's commanded
// heading, never the command itself). Venue-agnostic by construction: training
// runs on open water with scripted commands and overridden wind.
//
// Consumed by crew_train_cem.js (training) and crew_gate.js (benches with the
// policy installed for every bot via window.__rlCrew.actFor — the script.js
// hook in updateAI).
//
// Obs (10): [0,1] sin/cos heading error (target-heading)
//           [2,3] sin/cos TWA (heading rel local wind)
//           [4,5] sin/cos target TWA (target rel local wind)
//           [6] speed/3   [7] local wind speed/30
//           [8] commanded speedLimit   [9] apparent wind speed/40
// Act (2):  turn in [-1,1] (x the classical steerage-capped rate),
//           power in [0,1] (forcedLuff = 1-power; capped by speedLimit in hook)
const OBS_DIM = 10;
const PARAM_DIM = 2 * OBS_DIM + 2; // 22

const CREW_SRC = `
window.__CREW_OBS_DIM = ${OBS_DIM};
window.__crewObs = (boat, target) => {
    const lw = getWindAt(boat.x, boat.y);
    const err = normalizeAngle(target - boat.heading);
    const twa = normalizeAngle(boat.heading - lw.direction);
    const twaT = normalizeAngle(target - lw.direction);
    const aw = boat.apparentWind || lw;
    const sl = boat.controller ? boat.controller.speedLimit : 1;
    return [Math.sin(err), Math.cos(err), Math.sin(twa), Math.cos(twa),
            Math.sin(twaT), Math.cos(twaT), Math.min(1, boat.speed / 3),
            Math.min(1, lw.speed / 30), sl, Math.min(1, (aw.speed || 0) / 40)];
};
window.__crewAct = (P, o) => {
    let z0 = P[${2 * OBS_DIM}], z1 = P[${2 * OBS_DIM + 1}];
    for (let i = 0; i < ${OBS_DIM}; i++) { z0 += P[i] * o[i]; z1 += P[${OBS_DIM} + i] * o[i]; }
    return [Math.tanh(z0), 0.5 + 0.5 * Math.tanh(z1)];
};
// Small deterministic RNG for the command script (independent of game RNG).
window.__crewRng = (seed) => { let x = (seed >>> 0) || 1234567;
    return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
// One crew episode. P = params (null = classical crew). epSeed drives wind +
// command script (CRN: same epSeed => byte-identical commands for every
// candidate). Returns mean VMG toward the commanded heading (game units/s),
// irons time, and per-condition detail.
// Command menu: target TWA alternating tack sign with forced tacks/gybes.
window.__crewEpisode = (P, epSeed) => {
    const rng = window.__crewRng(epSeed);
    const hero0 = window.__hero;
    // Independent episodes: same spot, fresh way on, race machinery disarmed.
    hero0.x = window.__crewX0; hero0.y = window.__crewY0;
    hero0.speed = 1.0; hero0.heading = rng() * Math.PI * 2;
    hero0.raceState.finished = false; hero0.raceState.leg = 0;
    state.race.timer = 0;
    // Wind for this episode: fixed direction, speed from a spread incl. the
    // arctic katabatic band. Region override + no gusts = clean control.
    const wdir = rng() * Math.PI * 2;
    const wspd = [8, 12, 16, 22, 28][Math.floor(rng() * 5) % 5];
    window.__crewWindSave = window.regionWindAt;
    window.regionWindAt = () => ({ direction: wdir, speed: wspd });
    const hero = window.__hero;
    // Command script: 9 segments, 5-9s each. TWA menu with forced side flips
    // (tacks + gybes) — the maneuvers ARE the test.
    const MENU = [0.75, 1.05, 1.57, 2.2, 2.9];
    let side = rng() < 0.5 ? 1 : -1;
    const segs = [];
    for (let k = 0; k < 9; k++) {
        const twa = MENU[Math.floor(rng() * MENU.length) % MENU.length];
        if (k > 0 && rng() < 0.55) side = -side; // tack/gybe roughly every other seg
        segs.push({ twa: side * twa, dur: 5 + rng() * 4 });
    }
    const dt = 1 / 60;
    let prog = 0, ironsT = 0, T = 0;
    for (const sg of segs) {
        // heading == windDir is head-to-wind in this engine (see spinnaker/awa
        // logic), so a commanded TWA t is simply windDir + t.
        const target = normalizeAngle(wdir + sg.twa);
        hero.controller.targetHeading = target;
        hero.controller.speedLimit = 1.0;
        const steps = Math.round(sg.dur / 0.1);
        for (let s = 0; s < steps; s++) {
            if (P) window.__rlCrew.act = window.__crewAct(P, window.__crewObs(hero, target));
            else window.__rlCrew.act = null;
            for (let i = 0; i < 6; i++) {
                state.gusts.length = 0;
                window.update(dt);
                // the no-op'd controller never moves the command; re-assert
                // anyway in case anything else touched it
                hero.controller.targetHeading = target;
                hero.controller.speedLimit = 1.0;
            }
            const err = normalizeAngle(target - hero.heading);
            prog += hero.speed * Math.cos(err) * 0.1;
            if (hero.speed < 0.4) ironsT += 0.1;
            T += 0.1;
        }
    }
    window.regionWindAt = window.__crewWindSave;
    window.__rlCrew.act = null;
    return { vmg: prog / T, ironsT, T, wspd, R: prog / T - 0.02 * ironsT };
};
`;

function initMean() {
    // Classical-ish init: turn = tanh(2.2*sin(err)) (saturates toward full
    // rate off-target, eases near it), power bias -> ~1.0.
    const m = new Array(PARAM_DIM).fill(0);
    m[0] = 2.2;              // sin(err) -> turn
    m[PARAM_DIM - 1] = 2.0;  // power bias -> ~0.98
    return m;
}
function initSigma() {
    const s = new Array(PARAM_DIM).fill(0.25);
    s[0] = 0.6; s[PARAM_DIM - 1] = 0.5;
    return s;
}
module.exports = { CREW_SRC, OBS_DIM, PARAM_DIM, initMean, initSigma };

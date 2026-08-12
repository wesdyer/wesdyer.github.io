// THE FAN CLEARS A RAY. DOES THE BOAT SAIL IT? (2026-08-11, redrock)
//
// `_veto_tie.js` killed the degeneracy hypothesis: on redrock the chosen
// candidate's land ray is CLEAR on 99.1% of avoidance ticks (99.0% inside the
// hot pocket), and the fully-vetoed tie the argmin cannot resolve is 0.5% of
// ticks with a median regret of 0u. So the fan is not knowingly steering at
// rock — and yet `_riv_entry` counts 807 grounding episodes over 6 seeds, 435
// grounded boat-seconds per race, with avoidance deflecting >15° in 87.6% of
// the seconds before first touch.
//
// Both can be true only if THE RAY IS NOT THE TRACK. The probe at ~4066 starts
// at the boat's CURRENT POSITION and runs along the CANDIDATE heading, but the
// boat is not on that heading and cannot be: `updateBoat` slews `boat.heading`
// toward `targetHeading` at `getTurnSpeed() * handling * steerageFactor` per
// frame (~11712). Until the slew completes she is sailing an ARC, and an arc
// from a boat doing 100 u/s asked for a 0.8 rad dodge is nowhere near the ray
// that was graded. `fbb1c27` fixed exactly this mismatch for the CURRENT term
// ("grade tracks, not headings") — that fix is gated on `current.speed > 0.01`
// and so cannot fire on redrock or arctic, where the water does not move but
// the rudder is still not instantaneous.
//
// ⚠️ Rule 19c is the trap here and it is why this is a MEASUREMENT and not a
// build: rolling candidates on the PLAN's curvature won river and lost redrock,
// because a plan-curved probe clears water the boat will not reach. The rule's
// own conclusion is the hypothesis under test — "curvature in a probe needs the
// boat's own achievable turn as its ceiling" — so measure the ACHIEVED track,
// not a model of it.
//
// For each avoidance decision whose chosen ray reads CLEAR, follow the boat and
// compare where she actually goes with where the ray said she would:
//   * max lateral distance from the graded ray
//   * whether the realized track enters a cell the grid calls land, and how
//     soon — a ray-clear decision that grounds the boat is the fan being wrong,
//     not the fan being outvoted
//   * split by the size of the turn it asked for, because that is the knob a
//     fix would act on
//
// usage: node _track_vs_ray.js <venue> <trials> <seed0> <tree> [cx cy r]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeVETO');
const CX = process.argv[6] !== undefined ? parseFloat(process.argv[6]) : -1075;
const CY = process.argv[7] !== undefined ? parseFloat(process.argv[7]) : -1400;
const RR = process.argv[8] !== undefined ? parseFloat(process.argv[8]) : 250;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = { n: 0, pk: 0, land: 0, pkLand: 0, lat: [], pkLat: [], hitAt: [], byTurn: {}, byTurnLand: {} };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CX, CY, RR }) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const S = { n: 0, pk: 0, land: 0, pkLand: 0, lat: [], pkLat: [], hitAt: [], byTurn: {}, byTurnLand: {} };
            const live = {};             // boat name -> active track
            window.__VETODIAG = (ctl, vd, best, desired) => {
                const bo = ctl.boat; if (!bo || bo.isPlayer || bo.raceState.finished) return;
                if (state.race.status !== 'racing') return;
                if (live[bo.name]) return;                       // one track at a time
                const chosenOff = norm(best - desired);
                let ch = vd[0];
                for (const c of vd) if (Math.abs(c.off - chosenOff) < Math.abs(ch.off - chosenOff)) ch = c;
                if (ch.sl == null) return;                       // land block never ran
                if (ch.d < ch.sl - 0.5) return;                  // the ray was NOT clear
                live[bo.name] = { x0: bo.x, y0: bo.y, h: best, len: ch.sl,
                                  turn: Math.abs(norm(best - bo.heading)),
                                  ux: Math.sin(best), uy: -Math.cos(best),
                                  maxLat: 0, hit: 0, hitS: 0, s: 0, lx: bo.x, ly: bo.y,
                                  pk: Math.hypot(bo.x - CX, bo.y - CY) <= RR };
            };
            const finish = (nm) => {
                const L = live[nm]; if (!L) return; delete live[nm];
                S.n++; if (L.pk) S.pk++;
                S.lat.push(L.maxLat); if (L.pk) S.pkLat.push(L.maxLat);
                const bin = L.turn < 0.15 ? '0.0-0.15' : L.turn < 0.35 ? '0.15-0.35' : L.turn < 0.7 ? '0.35-0.70' : L.turn < 1.2 ? '0.70-1.20' : '1.20+';
                S.byTurn[bin] = (S.byTurn[bin] || 0) + 1;
                if (L.hit) {
                    S.land++; if (L.pk) S.pkLand++;
                    S.hitAt.push(L.hitS);
                    S.byTurnLand[bin] = (S.byTurnLand[bin] || 0) + 1;
                }
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const g = state.course.botGrid;
                for (const bo of state.boats) {
                    const L = live[bo.name]; if (!L) continue;
                    if (bo.raceState.finished) { finish(bo.name); continue; }
                    L.s += Math.hypot(bo.x - L.lx, bo.y - L.ly); L.lx = bo.x; L.ly = bo.y;
                    // lateral distance from the graded ray (perpendicular component)
                    const dx = bo.x - L.x0, dy = bo.y - L.y0;
                    const along = dx * L.ux + dy * L.uy;
                    const lat = Math.abs(dx * L.uy - dy * L.ux);
                    if (along >= 0 && lat > L.maxLat) L.maxLat = lat;
                    if (g && !L.hit) {
                        const cc = g.cell(bo.x, bo.y);
                        if (!g.at(cc[0], cc[1])) { L.hit = 1; L.hitS = L.s; }
                    }
                    if (L.s >= L.len) finish(bo.name);
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            for (const nm in live) finish(nm);
            window.__VETODIAG = null;
            return S;
        }, { seed: SEED0 + t, CX, CY, RR });
        for (const k in r) {
            if (Array.isArray(r[k])) A[k].push(...r[k]);
            else if (typeof r[k] === 'object') { for (const q in r[k]) A[k][q] = (A[k][q] || 0) + r[k][q]; }
            else A[k] += r[k];
        }
        console.log(`seed ${SEED0 + t}: ${r.n} ray-clear decisions followed, ${r.land} of them ran the boat into land`);
    }
    await b.close();

    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    console.log(`\n=== ${VENUE.toUpperCase()}: THE RAY vs THE TRACK (${TRIALS} seeds) ===`);
    console.log(`ray-clear decisions followed: ${A.n}   of them in pocket (${CX},${CY}) r=${RR}: ${A.pk}`);
    console.log(`\n  ⭐ the boat then TOUCHED LAND inside the ray's own length: ${A.land} (${(100 * A.land / (A.n || 1)).toFixed(1)}%)` +
        `   in pocket ${A.pkLand} (${(100 * A.pkLand / (A.pk || 1)).toFixed(1)}%)`);
    console.log(`     distance sailed before that touch: med ${q(A.hitAt, .5).toFixed(0)}u  p90 ${q(A.hitAt, .9).toFixed(0)}u`);
    console.log(`\n  how far the realized track strays from the graded ray (max lateral):`);
    console.log(`     all      med ${q(A.lat, .5).toFixed(0)}u  p75 ${q(A.lat, .75).toFixed(0)}u  p90 ${q(A.lat, .9).toFixed(0)}u  max ${Math.max(...A.lat).toFixed(0)}u`);
    if (A.pkLat.length) console.log(`     pocket   med ${q(A.pkLat, .5).toFixed(0)}u  p75 ${q(A.pkLat, .75).toFixed(0)}u  p90 ${q(A.pkLat, .9).toFixed(0)}u`);
    console.log(`\n  by size of the turn the fan asked for (|chosen - current heading|, rad):`);
    for (const bin of ['0.0-0.15', '0.15-0.35', '0.35-0.70', '0.70-1.20', '1.20+']) {
        const n = A.byTurn[bin] || 0, l = A.byTurnLand[bin] || 0;
        if (!n) continue;
        console.log(`     ${bin.padEnd(10)} n=${String(n).padStart(6)}   ran into land ${(100 * l / n).toFixed(1)}%`);
    }
})();

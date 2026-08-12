// WHO SAILS THE EXTRA DISTANCE IN THE MIDDLE OF THE BEAT? (2026-08-12, arctic)
//
// After the two retrograde landings, `_leg1_where` puts the arctic residual in two
// places: bands 90-100 (+35.6 s, the rounding's remainder) and the MIDDLE OF THE
// BEAT, bands 30-60, at **+32.8 s with odometer ratios 1.6-2.2x and almost no
// head-to-wind time** — pure extra distance sailed under navigation.
//
// `_leg1_budget` says 64 s of leg 1's 100 s excess is distance at his own pace on
// IDENTICAL made good. So the question is whose distance it is: the ROUTER's plan
// (a long staircase between floes) or the fan's DEFLECTIONS off it. Those need
// completely different fixes and eight dead shapes on this venue never separated
// them.
//
// Per 10 Hz tick on the rounding leg this records the step's length and its
// component ALONG the leg's own ruler, keyed by the helm's last writer and by
// sub-leg band. Distance that is not along the ruler is the deflection.
//   node _beat_owner.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeTW3');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = { own: {}, odo: {}, along: {}, band: {}, boats: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            window.__exLog = []; window.__tkLog = { rec: [] };
            const S = { own: {}, odo: {}, along: {}, band: {}, boats: {} };
            const prev = {}; const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const lg = state.course.dmc && state.course.dmc.legs && state.course.dmc.legs[1];
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg !== 1) continue;
                    S.boats[b.name] = 1;
                    const P = prev[b.name];
                    let s = 0;
                    if (lg && typeof CoursePath !== 'undefined') { s = CoursePath.project(lg, b.x, b.y, P && P.hint); }
                    if (P) {
                        const step = Math.hypot(b.x - P.x, b.y - P.y);
                        const along = s - P.s;
                        const o = (b.controller && b.controller.__ovOwner) || 'nav';
                        const bd = Math.min(9, Math.max(0, Math.floor(10 * s / (lg ? lg.length : 1))));
                        S.own[o] = (S.own[o] || 0) + DT;
                        S.odo[o] = (S.odo[o] || 0) + step;
                        S.along[o] = (S.along[o] || 0) + along;
                        const k = bd + '|' + o;
                        S.band[k] = S.band[k] || [0, 0, 0];
                        S.band[k][0] += DT; S.band[k][1] += step; S.band[k][2] += along;
                    }
                    prev[b.name] = { x: b.x, y: b.y, s, hint: s };
                }
                if (state.race.timer > 895) break;
            }
            S.n = Object.keys(S.boats).length;
            return S;
        }, SEED0 + t);
        A.boats += r.n;
        for (const k of ['own', 'odo', 'along']) for (const o in r[k]) A[k][o] = (A[k][o] || 0) + r[k][o];
        for (const k in r.band) { A.band[k] = A.band[k] || [0, 0, 0]; for (let i = 0; i < 3; i++) A.band[k][i] += r.band[k][i]; }
        console.log(`seed ${SEED0 + t}: ${r.n} boats on leg 1`);
    }
    await br.close();
    const B = A.boats;
    console.log(`\n=== ${VENUE.toUpperCase()} LEG 1: DISTANCE BY HELM OWNER (${B} boat-legs) ===`);
    console.log(` owner        s/boat    odometer u/boat   along the ruler   WASTED (odo-along)`);
    for (const o of Object.keys(A.own).sort((a, b) => A.odo[b] - A.odo[a])) {
        const w = (A.odo[o] - A.along[o]) / B;
        console.log(`   ${o.padEnd(10)} ${(A.own[o] / B).toFixed(1).padStart(7)} ${(A.odo[o] / B).toFixed(0).padStart(16)} ${(A.along[o] / B).toFixed(0).padStart(17)} ${w.toFixed(0).padStart(18)}`);
    }
    const tot = Object.values(A.odo).reduce((a, x) => a + x, 0), al = Object.values(A.along).reduce((a, x) => a + x, 0);
    console.log(`   TOTAL      ${(Object.values(A.own).reduce((a, x) => a + x, 0) / B).toFixed(1).padStart(7)} ${(tot / B).toFixed(0).padStart(16)} ${(al / B).toFixed(0).padStart(17)} ${((tot - al) / B).toFixed(0).padStart(18)}`);
    console.log(`\n--- the MIDDLE OF THE BEAT (bands 30-60), where +32.8 s of the residual is ---`);
    const mids = {};
    for (const k in A.band) { const [bd, o] = k.split('|'); if (+bd >= 3 && +bd <= 5) { mids[o] = mids[o] || [0, 0, 0]; for (let i = 0; i < 3; i++) mids[o][i] += A.band[k][i]; } }
    console.log(` owner        s/boat    odometer u/boat   along the ruler   WASTED`);
    for (const o of Object.keys(mids).sort((a, b) => mids[b][1] - mids[a][1]))
        console.log(`   ${o.padEnd(10)} ${(mids[o][0] / B).toFixed(1).padStart(7)} ${(mids[o][1] / B).toFixed(0).padStart(16)} ${(mids[o][2] / B).toFixed(0).padStart(17)} ${((mids[o][1] - mids[o][2]) / B).toFixed(0).padStart(18)}`);
})();

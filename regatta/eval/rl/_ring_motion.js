// AROUND, OR IN AND OUT? (2026-08-11, arctic push)
//
// `_round_now`: inside the armed granite-isle rounding the fleet sails 8 159 u in
// 112.9 s — 72 u/s of path speed — but banks only 4.88 rad of sweep, which at a
// median radius of 699 u is a TANGENTIAL speed of about 30 u/s. He banks 5.63 rad
// in 31.3 s at 613 u: 0.18 rad/s, which is simply his boat speed divided by his
// radius. So he sails ROUND the mark and they do something else with more than
// half of their motion.
//
// This splits every armed tick's displacement into the radial and tangential
// components about the mark and attributes each to the helm's last writer, so
// "they wander in and out of the ring" becomes a number per layer.
//   node _ring_motion.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeTW');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = { own: {}, rad: {}, tan: {}, retro: {}, boats: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            window.__exLog = []; window.__tkLog = { rec: [] };
            const rm = state.course.roundMark;
            const S = { own: {}, rad: {}, tan: {}, retro: {}, boats: {} };
            const prev = {};
            const sgn = rm.side === 'port' ? -1 : 1;
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || !b.raceState.roundArmed || b.raceState.leg !== 1) continue;
                    S.boats[b.name] = 1;
                    const P = prev[b.name];
                    if (P) {
                        const dx = b.x - P.x, dy = b.y - P.y;
                        const br0 = Math.atan2(P.y - rm.y, P.x - rm.x);
                        const ur = [Math.cos(br0), Math.sin(br0)];
                        const ut = [-Math.sin(br0) * sgn, Math.cos(br0) * sgn];
                        const rc = dx * ur[0] + dy * ur[1];
                        const tc = dx * ut[0] + dy * ut[1];
                        const o = (b.controller && b.controller.__ovOwner) || 'nav';
                        S.own[o] = (S.own[o] || 0) + DT;
                        S.rad[o] = (S.rad[o] || 0) + Math.abs(rc);
                        S.tan[o] = (S.tan[o] || 0) + tc;                 // signed: the required way round
                        if (tc < 0) S.retro[o] = (S.retro[o] || 0) - tc; // going the WRONG way round
                    }
                    prev[b.name] = { x: b.x, y: b.y };
                }
                if (state.race.timer > 895) break;
            }
            S.n = Object.keys(S.boats).length;
            return S;
        }, SEED0 + t);
        A.boats += r.n;
        for (const k of ['own', 'rad', 'tan', 'retro']) for (const o in r[k]) A[k][o] = (A[k][o] || 0) + r[k][o];
        console.log(`seed ${SEED0 + t}: ${r.n} armed boats`);
    }
    await br.close();
    const B = A.boats;
    const tot = o => (A.rad[o] || 0) + Math.abs(A.tan[o] || 0);
    const allRad = Object.values(A.rad).reduce((a, x) => a + x, 0);
    const allTan = Object.values(A.tan).reduce((a, x) => a + x, 0);
    const allRetro = Object.values(A.retro).reduce((a, x) => a + x, 0);
    console.log(`\n=== ${VENUE.toUpperCase()}: IS SHE GOING ROUND, OR IN AND OUT? (${B} armed boats) ===`);
    console.log(`   RADIAL motion  ${(allRad / B).toFixed(0)} u/boat`);
    console.log(`   TANGENTIAL net ${(allTan / B).toFixed(0)} u/boat  (the required way round)`);
    console.log(`   ...of which RETROGRADE (the wrong way round) ${(allRetro / B).toFixed(0)} u/boat`);
    console.log(`   ⭐ radial share of all motion in the ring: ${(100 * allRad / (allRad + allTan + 2 * allRetro)).toFixed(1)}%`);
    console.log(`\n owner        armed s/boat   radial u/boat   net tangential   retrograde`);
    for (const o of Object.keys(A.own).sort((a, b) => A.own[b] - A.own[a]))
        console.log(`   ${o.padEnd(10)} ${(A.own[o] / B).toFixed(1).padStart(10)} ${((A.rad[o] || 0) / B).toFixed(0).padStart(14)} ${((A.tan[o] || 0) / B).toFixed(0).padStart(16)} ${((A.retro[o] || 0) / B).toFixed(0).padStart(12)}`);
})();

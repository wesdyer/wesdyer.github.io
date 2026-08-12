// HOW MUCH OF ARCTIC IS SAILED UNDER THE PACK SPEED DISCIPLINE? (2026-08-11)
//
// `_gap_grid` leg 1: in the hottest cells the fleet makes 48-90 u/s where he makes
// 95-117, with 88% of the time under NAVIGATION and little contact. A boat under
// navigation in open water that is 30% slower than the human is not being stopped
// by ice — it is being THROTTLED. `update()` ~1120 caps `speedRequest` to
// 0.7 + 0.15*deft (i.e. 70-85% power) whenever `planFloeTrajectory`'s rollout of
// the CURRENT heading predicts a floe contact within 3 s. This measures how much
// of a lap runs under that cap.
//   node _ice_throttle.js <venue> <trials> <seed0> <tree>
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
    const A = { n: 0, hit: 0, risk: 0, byLeg: {}, allByLeg: {}, spd: [], riskV: [] };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            window.__thr = { n: 0, hit: 0, risk: 0, byLeg: {}, allByLeg: {}, spd: [], riskV: [] };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            const T = window.__thr;
            return { n: T.n, hit: T.hit, risk: T.risk, byLeg: T.byLeg, allByLeg: T.allByLeg,
                     spd: T.spd.filter((_, i) => i % 20 === 0), riskV: T.riskV.filter((_, i) => i % 20 === 0) };
        }, SEED0 + t);
        A.n += r.n; A.hit += r.hit; A.risk += r.risk;
        for (const k in r.byLeg) A.byLeg[k] = (A.byLeg[k] || 0) + r.byLeg[k];
        for (const k in r.allByLeg) A.allByLeg[k] = (A.allByLeg[k] || 0) + r.allByLeg[k];
        A.spd.push(...r.spd); A.riskV.push(...r.riskV);
        console.log(`seed ${SEED0 + t}: ${r.hit}/${r.n} throttled ticks`);
    }
    await br.close();
    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    console.log(`\n=== ${VENUE.toUpperCase()}: THE PACK SPEED DISCIPLINE (${TRIALS} seeds) ===`);
    console.log(`racing-leg controller ticks ${A.n}`);
    console.log(`   a floe rollout ran and returned a risk at all: ${A.risk} (${(100 * A.risk / (A.n || 1)).toFixed(1)}%)`);
    console.log(`   ⭐ THROTTLED to 70-85% power:                  ${A.hit} (${(100 * A.hit / (A.n || 1)).toFixed(1)}%)`);
    for (const lg of Object.keys(A.allByLeg).sort())
        console.log(`      leg ${lg}: ${((100 * (A.byLeg[lg] || 0)) / A.allByLeg[lg]).toFixed(1)}% of its ticks throttled  (${(A.allByLeg[lg] / 10).toFixed(0)} boat-seconds)`);
    console.log(`   boat speed WHILE throttled: med ${q(A.spd, .5)} u/s   p25 ${q(A.spd, .25)}  p75 ${q(A.spd, .75)}`);
    console.log(`   predicted contact time when a risk exists: med ${q(A.riskV, .5)}s  p25 ${q(A.riskV, .25)}s`);
})();

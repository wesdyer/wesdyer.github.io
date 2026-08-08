// ARCTIC EXCESS-DISTANCE ATTRIBUTION — the solo bot sails 1.93x the human's
// odometer (49k vs 25.4k) at HIGHER moving speed. Where do 24,000 units go?
// Solo bot, per leg: odometer, net (straight-line leg length actually
// required), deflected distance (|lastAvoidDeviation| > 15°), tack count,
// and SINUOSITY per 30s window (path length / net displacement) histogram.
// Run the human comparison with: node _arc_dist.js human <trajFile>
//   node _arc_dist.js <trials> <seed0> <tree>
const fs = require('fs'); const path = require('path');
if (process.argv[2] === 'human') {
    const j = JSON.parse(fs.readFileSync(process.argv[3]));
    const F = j.format; const gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1);
    let odo = 0, tacks = 0;
    const legOdo = {}, sin30 = [];
    let prev = null, wStart = null, wOdo = 0, lastTack = null;
    for (const s of S) {
        if (prev) {
            const d = Math.hypot(gi(s, 'x') - gi(prev, 'x'), gi(s, 'y') - gi(prev, 'y'));
            if (d < 200) {
                odo += d; wOdo += d;
                const leg = gi(s, 'leg');
                legOdo[leg] = (legOdo[leg] || 0) + d;
            }
        }
        const tk = gi(s, 'playerTack');
        if (lastTack != null && tk !== lastTack && tk !== 0) tacks++;
        lastTack = tk;
        if (!wStart) { wStart = s; wOdo = 0; }
        else if (gi(s, 't') - gi(wStart, 't') >= 30) {
            const net = Math.hypot(gi(s, 'x') - gi(wStart, 'x'), gi(s, 'y') - gi(wStart, 'y'));
            if (net > 50) sin30.push(wOdo / net);
            wStart = s; wOdo = 0;
        }
        prev = s;
    }
    const med = a => { const q = [...a].sort((x, y) => x - y); return q.length ? q[Math.floor(q.length / 2)] : null; };
    console.log('HUMAN', path.basename(process.argv[3]), 'odo', odo.toFixed(0), 'tacks', tacks,
        'legOdo', JSON.stringify(Object.fromEntries(Object.entries(legOdo).map(([k, v]) => [k, Math.round(v)]))),
        'sinuosity30 med', med(sin30) ? med(sin30).toFixed(2) : '-',
        'p90', sin30.sort((a, b) => a - b)[Math.floor(sin30.length * 0.9)]?.toFixed(2));
    process.exit(0);
}
const { chromium } = require('playwright');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBP2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            const R = { seed, name: hero.name, odo: 0, deflOdo: 0, tacks: 0, legOdo: {}, sin30: [], fin: null };
            let px = hero.x, py = hero.y, lastTk = null, wx = hero.x, wy = hero.y, wT = null, wOdo = 0;
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                const d = Math.hypot(hero.x - px, hero.y - py); px = hero.x; py = hero.y;
                R.odo += d; wOdo += d;
                const leg = hero.raceState.leg;
                R.legOdo[leg] = (R.legOdo[leg] || 0) + d;
                const c = hero.controller;
                if (c && Math.abs(c.lastAvoidDeviation || 0) > 0.26) R.deflOdo += d;
                const w = getWindAt(hero.x, hero.y);
                const tk = Math.sign(norm(hero.heading - w.direction)) || 0;
                if (lastTk != null && tk !== lastTk && tk !== 0
                    && Math.abs(norm(hero.heading - w.direction)) < 1.2) R.tacks++;
                lastTk = tk;
                if (wT == null) { wT = t; wx = hero.x; wy = hero.y; wOdo = 0; }
                else if (t - wT >= 30) {
                    const net = Math.hypot(hero.x - wx, hero.y - wy);
                    if (net > 50) R.sin30.push(+(wOdo / net).toFixed(2));
                    wT = t; wx = hero.x; wy = hero.y; wOdo = 0;
                }
                if (hero.raceState.finished) { R.fin = +t.toFixed(0); break; }
            }
            return R;
        }, seed);
        const med = a => { const q = [...a].sort((x, y) => x - y); return q.length ? q[Math.floor(q.length / 2)] : null; };
        console.log('seed', seed, r.name, 'fin', r.fin, 'odo', r.odo.toFixed(0),
            'deflOdo', r.deflOdo.toFixed(0), `(${(100 * r.deflOdo / r.odo).toFixed(0)}%)`,
            'tacks', r.tacks,
            'legOdo', JSON.stringify(Object.fromEntries(Object.entries(r.legOdo).map(([k, v]) => [k, Math.round(v)]))),
            'sin30 med', med(r.sin30), 'p90', r.sin30.sort((a, b) => a - b)[Math.floor(r.sin30.length * 0.9)]);
    }
    await browser.close();
})();

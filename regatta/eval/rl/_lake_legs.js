// LAKE LEGS: distance or speed? Human per-leg (3 traces): L1 84.3s/6282u (74.5 u/s),
// L2 69.5s/5730u (82.4), L3 68.4s/3935u (57.5). Fleet med: L1 ~128s, L2 ~97s, L3 ~54s.
// This records per-boat per-leg odometer + time + mean local wind speed + under-1kt
// share so the 72s on L1/L2 splits into distance sailed vs pace vs parking.
//   node _lake_legs.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHEAD2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const legs = {};
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const inf = bots.map(() => ({}));
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                fr = (fr + 1) % 6;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], f2 = inf[k];
                    if (b.raceState.finished) continue;
                    const lg = b.raceState.leg;
                    if (lg < 1) continue;
                    if (f2.lg !== lg) { f2.lg = lg; f2.x = b.x; f2.y = b.y; }
                    const e = (f2[lg] = f2[lg] || { odo: 0, t: 0, slow: 0, ws: 0, wn: 0 });
                    e.odo += Math.hypot(b.x - f2.x, b.y - f2.y);
                    f2.x = b.x; f2.y = b.y;
                    e.t += dt;
                    if (b.speed < 1.0) e.slow += dt;
                    if (fr === 0) { e.ws += getWindAt(b.x, b.y).speed; e.wn++; }
                }
            }
            return inf.map(f2 => {
                const o = {};
                for (const k of Object.keys(f2)) if (!isNaN(+k)) o[k] = {
                    odo: Math.round(f2[k].odo), t: +f2[k].t.toFixed(1),
                    slow: +f2[k].slow.toFixed(1), ws: +(f2[k].ws / Math.max(1, f2[k].wn)).toFixed(1) };
                return o;
            });
        }, SEED0 + i);
        for (const boat of r) for (const [lg, e] of Object.entries(boat)) {
            const a = (legs[lg] = legs[lg] || { odo: [], t: [], slow: [], ws: [] });
            a.odo.push(e.odo); a.t.push(e.t); a.slow.push(e.slow); a.ws.push(e.ws);
        }
        console.log(`seed ${SEED0 + i} done`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
    console.log('\nFLEET per-leg (medians):');
    for (const lg of Object.keys(legs).sort()) {
        const a = legs[lg];
        console.log(`  leg ${lg}: t ${med(a.t)}s odo ${med(a.odo)}u -> ${(med(a.odo) / med(a.t)).toFixed(1)} u/s | under-1kt ${med(a.slow)}s | wind ${med(a.ws)}kt`);
    }
    console.log('\n(human: L1 84.3s/6282u=74.5u/s  L2 69.5s/5730u=82.4  L3 68.4s/3935u=57.5)');
    await browser.close();
})();

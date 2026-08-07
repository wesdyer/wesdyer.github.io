// P0 measurement — REDROCK slow-leg ANATOMY. Human leg splits (s2 lap, 214.7s):
// L1 39.9 L2 64.7 L3 51.3 L4 29.6 L5 26.1. Fleet med: L1 76.5 L2 163.5 L3 121
// L4 132 L5 45. Legs 2 and 4 run at ~26 u/s route-speed vs her 67-113 — is that
// distance sailed (detours/tacking), parked time, or grinding pace? Decompose
// per boat-leg: time, odometer, parked (<1kt), grind (1-3kt), avoidance-active
// share, TWA bands; spatial 400u heatmap of sub-3kt time for legs 2 and 4.
//   node _rr_leganat.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4H');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const legs = {}; const heat = { 2: {}, 3: {}, 4: {} };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const inf = bots.map(() => ({}));
            const heat = { 2: {}, 3: {}, 4: {} };
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;               // 10 Hz sampling, 0.1s credit
                const ds = 0.1;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], f2 = inf[k];
                    if (b.raceState.finished) continue;
                    const lg = b.raceState.leg;
                    if (lg < 1) continue;
                    if (f2.lg !== lg) { f2.lg = lg; f2.x = b.x; f2.y = b.y; }
                    const e = (f2[lg] = f2[lg] || { odo: 0, t: 0, park: 0, grind: 0, av: 0, up: 0, dn: 0 });
                    e.odo += Math.hypot(b.x - f2.x, b.y - f2.y);
                    f2.x = b.x; f2.y = b.y;
                    e.t += ds * 6;                    // credit the 6 skipped frames
                    const kt = b.speed * 4;
                    if (kt < 1) e.park += ds * 6; else if (kt < 3) e.grind += ds * 6;
                    const c = b.controller;
                    if (c && (c.lastAvoidDeviation || 0) !== 0) e.av += ds * 6;
                    const w = getWindAt(b.x, b.y);
                    const twa = Math.abs(norm(b.heading - w.direction)) * 180 / Math.PI;
                    if (twa > 130) e.up += ds * 6;    // bow near the eye (lake_stall: twa~180 = luffing)
                    if (twa < 50) e.dn += ds * 6;
                    if (kt < 3 && heat[lg]) {
                        const key = (Math.round(b.x / 400) * 400) + ',' + (Math.round(b.y / 400) * 400);
                        heat[lg][key] = (heat[lg][key] || 0) + ds * 6;
                    }
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            const out = inf.map(f2 => {
                const o = {};
                for (const k of Object.keys(f2)) if (!isNaN(+k)) {
                    const e = f2[k];
                    o[k] = { odo: Math.round(e.odo), t: +e.t.toFixed(1), park: +e.park.toFixed(1),
                             grind: +e.grind.toFixed(1), av: +e.av.toFixed(1), up: +e.up.toFixed(1), dn: +e.dn.toFixed(1) };
                }
                return o;
            });
            return { out, heat };
        }, seed);
        for (const boat of r.out) for (const [lg, e] of Object.entries(boat)) {
            const a = (legs[lg] = legs[lg] || { odo: [], t: [], park: [], grind: [], av: [], up: [], dn: [] });
            for (const k of Object.keys(a)) a[k].push(e[k]);
        }
        for (const lg of [2, 3, 4]) for (const [k, v] of Object.entries(r.heat[lg] || {}))
            heat[lg][k] = (heat[lg][k] || 0) + v;
        console.log('seed', seed, 'done');
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
    console.log('\nFLEET per-leg medians (t odo->u/s | park grind | avoid | upwindT dnT):');
    for (const lg of Object.keys(legs).sort((a, b) => a - b)) {
        const a = legs[lg];
        console.log(`  leg ${lg}: t ${med(a.t)}s odo ${med(a.odo)}u -> ${(med(a.odo) / med(a.t)).toFixed(1)} u/s | park ${med(a.park)} grind ${med(a.grind)} | av ${med(a.av)} | up ${med(a.up)} dn ${med(a.dn)}`);
    }
    for (const lg of [2, 3, 4]) {
        const top = Object.entries(heat[lg]).sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([k, v]) => `${k}:${Math.round(v)}`).join('  ');
        console.log(`\nleg ${lg} sub-3kt heat (400u bins, pooled boat-s): ${top}`);
    }
    console.log('\n(human s2: L1 39.9 L2 64.7 L3 51.3 L4 29.6 L5 26.1 — route-speed 57/67/122/113/114 u/s)');
    await browser.close();
})();

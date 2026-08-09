// WHY SLOW AT THE MARK-5 CANYON (redrock attribution step 2).
// L3 shore+m4 slow = ~95s/boat; solo draws park 269-339s on L3. During slow
// frames (<2.7kt) on legs 2-4 within 900u of marks[4] or in shore cells,
// sample the controller: armed, outbound, wiggle, riskState, TWA band,
// speedLimit source (_trajRisk), and whether the grid ahead is blocked (the
// hard-zone land veto's water). node _rr_why.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeSWT');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = {};
    const add = (k, v) => agg[k] = (agg[k] || 0) + v;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const m4 = state.course.marks[4];
            const g = state.course.botGrid;
            const c = {};
            const add = (k, v) => c[k] = (c[k] || 0) + v;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (it % 6 === 0 && state.race.status === 'racing') {
                    for (const b of state.boats) {
                        if (b.isPlayer || b.raceState.finished) continue;
                        const lg = b.raceState.leg;
                        if (lg < 2 || lg > 4) continue;
                        if (b.speed * 60 >= 40) continue;
                        const dM4 = Math.hypot(b.x - m4.x, b.y - m4.y);
                        if (dM4 > 900) continue;
                        add('slowTicks', 1);
                        const ct = b.controller;
                        if (b.raceState.roundArmed) add('armed', 1);
                        if (ct && ct.wiggleActive) add('wiggle', 1);
                        if (ct && ct.riskState && ct.riskState !== 'LOW') add('risk_' + ct.riskState, 1);
                        const w = getWindAt(b.x, b.y);
                        const twa = Math.abs(normalizeAngle(b.heading - w.direction));
                        if (twa < 0.5) add('inIrons', 1);
                        if (b.penaltyTurnsOwed > 0 || (b.raceState && b.raceState.penaltyTurnsOwed > 0)) add('penTurn', 1);
                        // water dead ahead (the land-veto's question): hard-blocked within 180u?
                        let blocked = 0;
                        for (const dd of [90, 180]) {
                            const cc = g.cell(b.x + Math.sin(b.heading) * dd, b.y - Math.cos(b.heading) * dd);
                            if (!g.at(cc[0], cc[1])) { blocked = 1; break; }
                        }
                        if (blocked) add('landAhead', 1);
                        // where: quadrant relative to m4
                        const qx = b.x < m4.x ? 'W' : 'E', qy = b.y < m4.y ? 'N' : 'S';
                        add('quad_' + qy + qx, 1);
                        add('leg_' + lg, 1);
                    }
                }
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return c;
        }, seed);
        for (const [k, v] of Object.entries(r)) add(k, v);
        console.log('seed', seed, 'slowTicks', r.slowTicks || 0);
    }
    const st = agg.slowTicks || 1;
    console.log('\npooled slow ticks near m4 (legs 2-4):', st, `(${(st * 0.1 / TRIALS / 8).toFixed(1)} s/boat/race)`);
    for (const [k, v] of Object.entries(agg).sort((a, b) => b[1] - a[1])) {
        if (k === 'slowTicks') continue;
        console.log(`  ${k}: ${Math.round(100 * v / st)}%`);
    }
    await browser.close();
})();

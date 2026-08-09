// One solo blowup, traced: the boat's path vs the router's leg path near m4.
// node _rr_trace.js <seed> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9402;
const ROOT = path.join(__dirname, process.argv[3] || 'treeSWT');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(async (seed) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        // keep bots[0] (the solo probe's convention — seed 9402's bots[0] was
        // the 537s blowup); no Math.random here, it would shift the seeded stream
        const bots = state.boats.filter(b => !b.isPlayer);
        const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
        bots.forEach((b, i2) => { if (i2 >= 1) { b.x = 1e6 + i2 * 500; b.y = 1e6; b.raceState.finished = true; } });
        const hero = bots[0];
        const m4 = state.course.marks[4];
        const out = { trace: [], dmc: {}, m4: { x: m4.x, y: m4.y } };
        const dt = 1 / 60;
        for (let it = 0; it < 60 * 900; it++) {
            window.update(dt);
            if (it % 120 === 0 && state.race.status === 'racing') {
                const lg = hero.raceState.leg;
                const dM = Math.hypot(hero.x - m4.x, hero.y - m4.y);
                if (dM < 1400) {
                    out.trace.push([+state.race.timer.toFixed(0), lg, Math.round(hero.x), Math.round(hero.y),
                        +(hero.speed * 60).toFixed(0), hero.raceState.roundArmed ? 1 : 0]);
                    const leg = state.course.dmc && state.course.dmc.legs && state.course.dmc.legs[lg];
                    if (leg && leg.pts && !out.dmc[lg]) {
                        out.dmc[lg] = leg.pts.filter(p => Math.hypot(p.x - m4.x, p.y - m4.y) < 1500)
                            .map(p => [Math.round(p.x), Math.round(p.y)]);
                    }
                }
            }
            if (state.race.status === 'finished') break;
            if (state.race.status === 'racing' && state.race.timer > 880) break;
        }
        out.fin = hero.raceState.finishTime || null;
        return out;
    }, SEED);
    console.log('fin:', r.fin, ' m4:', JSON.stringify(r.m4));
    console.log('dmc paths near m4 (per leg):');
    for (const [lg, pts] of Object.entries(r.dmc)) console.log(`  L${lg}: ${JSON.stringify(pts)}`);
    console.log('trace (t, leg, x, y, v, armed):');
    for (const row of r.trace) console.log(' ', JSON.stringify(row));
    await browser.close();
})();

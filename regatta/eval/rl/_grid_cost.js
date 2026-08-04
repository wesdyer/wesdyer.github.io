// What does one floe-map rebuild actually cost? refreshBotGrid rasterises the
// whole grid against every floe polygon; if the cadence is to be corrected the
// price has to be known first. Reports ms per rebuild and the grid size.
// node _grid_cost.js [seed] [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9100;
const ROOT = path.join(__dirname, process.argv[3] || 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(async (seed) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        const dt = 1 / 60;
        for (let it = 0; it < 60 * 40; it++) { window.update(dt); if (state.race.status === 'racing') break; }
        const g = state.course.botGrid;
        const nFloe = (state.course.islands || []).filter(f => f.isFloe).length;
        // Force N rebuilds and time them (bypass the cadence gate by clearing it).
        const ts = [];
        for (let k = 0; k < 12; k++) {
            for (let it = 0; it < 30; it++) window.update(dt);   // move the ice so the cache misses
            state.course._botGridT = null;
            const t0 = performance.now();
            window.refreshBotGrid ? window.refreshBotGrid() : null;
            ts.push(performance.now() - t0);
        }
        // Also time one pathSailable over the leg for scale.
        const legs = state.course.dmc.legs, L1 = legs[1];
        const tgt = L1.pts[L1.pts.length - 1];
        const b = state.boats.find(x => !x.isPlayer);
        const p0 = performance.now();
        for (let k = 0; k < 5; k++) window.SailCheck.pathSailable(state.course.botGrid, [b.x, b.y], [tgt.x, tgt.y]);
        const pms = (performance.now() - p0) / 5;
        return { n: g.n, cells: g.n * g.n, nFloe, ts, pms,
                 timeScale: 0.24, stateTime: state.time, raceT: state.race.timer };
    }, SEED);
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    console.log(`grid ${r.n}x${r.n} = ${r.cells} cells, ${r.nFloe} floes`);
    console.log(`refreshBotGrid: mean ${mean(r.ts).toFixed(1)}ms  (samples ${r.ts.map(x => x.toFixed(0)).join(',')})`);
    console.log(`pathSailable over leg 1: ${r.pms.toFixed(1)}ms`);
    console.log(`state.time ${r.stateTime.toFixed(1)} at race timer ${r.raceT.toFixed(1)}s  -> clock ratio ${(r.stateTime / r.raceT).toFixed(3)}`);
    await browser.close();
})();

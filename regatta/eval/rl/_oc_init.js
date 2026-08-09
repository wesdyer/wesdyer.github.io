// Compare post-resetGame initial state across two fresh pages, same seed.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9300;
const ROOT = path.join(__dirname, process.argv[3] || 'treeFL1B');
const VENUE = process.argv[4] || 'ocean';
(async () => {
    const browser = await chromium.launch();
    const snaps = [];
    for (let p = 0; p < 2; p++) {
        const page = await browser.newPage();
        await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
        await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        snaps.push(await page.evaluate((seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            window.update(1/60);
            const b0 = state.boats.find(b => !b.isPlayer);
            const s = {
                afterOne: [b0.name, b0.x, b0.y, b0.heading, b0.speed, b0.heel, b0.effectiveWindNow, b0.badAirIntensity, JSON.stringify(b0.apparentWind), state.wind.direction, state.wind.speed, state.wind.currentShift],
                boats: state.boats.map(b => [b.name, +b.x.toFixed(3), +b.y.toFixed(3), +b.heading.toFixed(5), b.stats && b.stats.upwind]),
                floes: (state.course._floeObjs || []).slice(0, 5).map(f => [+f.x.toFixed(2), +f.y.toFixed(2), +(f.spin || 0).toFixed(4)]),
                nFloes: (state.course._floeObjs || []).length,
                wind: [state.wind.baseDirection, state.wind.baseSpeed],
                time: state.time,
                gusts: (state.wind.gusts || []).map(g => [g.x && +g.x.toFixed(1), g.y && +g.y.toFixed(1), g.strength || g.speed || 0, g.age || g.t || 0]),
                nGusts: (state.wind.gusts || []).length,
                windKeys: Object.keys(state.wind),
                windFull: [state.wind.currentShift, state.wind.spread, state.wind.pressure, state.wind.debugTimer, (state.wind.history||[]).length, JSON.stringify((state.wind.history||[]).slice(-3))],
                conditions: JSON.stringify(state.race.conditions||{}).slice(0,300),
                swell: (window.Swell && window.Swell.state) ? JSON.stringify(window.Swell.state).slice(0,200) : (typeof window.__swellDbg !== 'undefined' ? 'dbg' : 'n/a'),
                seedNow: window.evalHarness.seed
            };
            return s;
        }, SEED));
        await page.close();
    }
    const [a, b] = snaps;
    console.log('equal:', JSON.stringify(a) === JSON.stringify(b));
    console.log('windKeys:', JSON.stringify(a.windKeys), 'nGusts:', a.nGusts, 'time:', a.time);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        for (const k of Object.keys(a)) {
            const ea = JSON.stringify(a[k]), eb = JSON.stringify(b[k]);
            if (ea !== eb) console.log('DIFF', k, ':', ea.slice(0, 200), 'VS', eb.slice(0, 200));
        }
    }
    await browser.close();
})();

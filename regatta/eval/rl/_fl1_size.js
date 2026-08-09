// FL1 SIZING: what fraction of the far-field roll()'s floe contact flags are
// PHANTOM — the bounding circle hits but the true hull (rotated to its
// predicted spin at sample time) does not? (2026-08-08, owner-directed:
// "Icebergs ARE NOT CIRCLES.")  Runs the fleet on treeFL1M (dual-count
// instrumentation) and reads window.__fl1c.
//   node _fl1_size.js <trials> <seed0> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeFL1M');
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
            window.__fl1c = { circleHits: 0, hullHits: 0 };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return window.__fl1c;
        }, seed);
        const ph = r.circleHits - r.hullHits;
        console.log('seed', seed, 'circleHits', r.circleHits, 'hullHits', r.hullHits,
            'PHANTOM', ph, '(' + (r.circleHits ? Math.round(100 * ph / r.circleHits) : 0) + '%)');
    }
    await browser.close();
})();

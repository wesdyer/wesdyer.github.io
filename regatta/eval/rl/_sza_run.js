// SZA runner: fleet race(s) on treeSZA, dump window.__sza (the rollout-fiction
// counters: polar-vs-assumed speed, wind-field deficit, rival dirty air,
// ignored current) per seed.  node _sza_run.js <trials> <seed0> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9100;
const VENUE = process.argv[4] || 'arctic';
const ROOT = path.join(__dirname, 'treeSZA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.__sza = null;
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
            return window.__sza;
        }, seed);
        if (!r) { console.log('seed', seed, 'NO ROLLOUTS (venue has no floes?)'); continue; }
        const st = r.steps || 1;
        console.log('seed', seed, 'venue', VENUE, 'rollouts', r.calls, 'steps', r.steps);
        console.log('  polar/assumed mean', (r.polarRatioSum / st).toFixed(2),
            ' polar<0.6x', Math.round(100 * r.polarUnder06 / st) + '%',
            ' windDef>20%', Math.round(100 * r.windDef20 / st) + '%',
            ' |dDir| mean', (r.dirSum / st).toFixed(2) + 'rad',
            ' dirtyAir', Math.round(100 * r.dirtySteps / st) + '%',
            ' cur mean', (r.curSum / st).toFixed(2) + 'kt');
    }
    await browser.close();
})();

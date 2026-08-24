// H1 smoke: does the pass mode fire, how often, page errors, quick contrast.
//   node _h1_smoke.js <tree> [seed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeH1');
const SEED = parseInt(process.argv[3]) || 9100;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(async (seed) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
        const hero = bots[0];
        for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
        const dt = 1 / 60;
        let h1Frames = 0, racing = 0, eps = 0, lastOn = false, minClrOn = Infinity;
        let hits = 0;
        const inner = window.onRaceEvent;
        window.onRaceEvent = (ty, d) => {
            try { if (d && d.boat === hero && ty === 'collision_island' && d.isFloe) hits++; } catch (e) { }
            if (inner) inner(ty, d);
        };
        for (let it = 0; it < 60 * 900; it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            if (state.race.timer > 880) break;
            if (hero.raceState.finished) break;
            const L = hero.raceState.leg;
            if (L !== 1 && L !== 2) continue;
            racing += dt;
            const c = hero.controller; if (!c) continue;
            const on = !!c._h1Floe;
            if (on) {
                h1Frames++;
                if (!lastOn) eps++;
                const f = c._h1Floe;
                // rough clearance now
                const d2 = Math.hypot(hero.x - f.x, hero.y - f.y) - (f.radius || 0);
                minClrOn = Math.min(minClrOn, d2);
            }
            lastOn = on;
        }
        return { seed, h1s: h1Frames / 60, racing, eps, minClrOn: Math.round(minClrOn), hits,
            fin: hero.raceState.finishTime || null, status: state.race.status };
    }, SEED);
    console.log(JSON.stringify(r));
    await browser.close();
})();

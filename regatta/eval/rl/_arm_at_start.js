// Which mark are bots ARMED for in the first 30s on arctic? (determinism check follow-up)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeRD7');
const SEED = parseInt(process.argv[3]) || 9201;
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
        const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
        const snaps = [];
        const dt = 1 / 60;
        for (let it = 0; it < 60 * 40; it++) {
            window.update(dt);
            if (state.race.status === 'racing' && Math.abs(state.race.timer - Math.round(state.race.timer)) < dt / 2
                && [1, 5, 10, 15, 20, 30].includes(Math.round(state.race.timer))) {
                const t = Math.round(state.race.timer);
                if (!snaps.find(s => s.t === t)) {
                    const bots = state.boats.filter(b => !b.isPlayer);
                    const armed = bots.filter(b => b.raceState.roundArmed);
                    const b0 = bots[0];
                    const rm = (typeof legRoundMark === 'function' ? legRoundMark(b0.raceState.leg) : null) || state.course.roundMark;
                    snaps.push({ t, leg: b0.raceState.leg, armedN: armed.length,
                        rmx: rm && Math.round(rm.x), rmy: rm && Math.round(rm.y),
                        zone: rm && (rm.zone || 165),
                        d0: rm && Math.round(Math.hypot(b0.x - rm.x, b0.y - rm.y)),
                        spd: +(b0.speed * 4).toFixed(1) });
                }
            }
        }
        return snaps;
    }, SEED);
    console.log(JSON.stringify(r, null, 1));
    await browser.close();
})();

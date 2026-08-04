// All-bots 2s trace of a time window. node jam_trace.js <seed> <t0> <t1>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9104;
const T0 = parseInt(process.argv[3]) || 420, T1 = parseInt(process.argv[4]) || 780;
const ROOT = path.join(__dirname, 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = await page.evaluate(async ({ seed, t0, t1 }) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
        const bots = state.boats.filter(b => !b.isPlayer);
        const rows = []; const dt = 1 / 60; let last = -999;
        for (let it = 0; it < 60 * (t1 + 40); it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            const t = state.race.timer;
            if (t > t1) break;
            if (t >= t0 && t - last >= 2) {
                last = t;
                rows.push({ t: Math.round(t), b: bots.map(b => ({
                    n: b.name.slice(0, 4), x: Math.round(b.x), y: Math.round(b.y),
                    s: +b.speed.toFixed(1), leg: b.raceState.leg,
                    fin: b.raceState.finished ? 1 : 0,
                    rk: (b.controller.riskState || 'L')[0], rl: (b.controller.avoidanceRole || '-')[0],
                    wg: b.controller.wiggleActive ? 1 : 0,
                    cl: b.ai && b.ai.collisionData ? (b.ai.collisionData.isFloe ? 'F' : 'I') : '',
                })) });
            }
        }
        return rows;
    }, { seed: SEED, t0: T0, t1: T1 });
    fs.writeFileSync(path.join(__dirname, `jam_${SEED}.json`), JSON.stringify(rows));
    console.log('rows', rows.length);
    await browser.close();
})();

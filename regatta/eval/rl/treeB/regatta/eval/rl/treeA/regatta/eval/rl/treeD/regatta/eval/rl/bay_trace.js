// Bay fleet 1Hz trace: all 9 bots, per-second x/y/leg/spd/twa. For diagnosing
// line quality vs the human trajectories. node bay_trace.js <seed> [maxT] [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9100;
const MAX_T = parseInt(process.argv[3]) || 420;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const out = await page.evaluate(async ({ seed, maxT }) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const pl = state.boats.find(b => b.isPlayer); pl.x = 5900; pl.y = -6100;
        const rows = bots.map(() => []);
        const dt = 1 / 60; let last = -999;
        for (let i = 0; i < 60 * (maxT + 40); i++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            if (state.race.timer > maxT) break;
            if (state.race.timer - last >= 1) {
                last = state.race.timer;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    if (b.raceState.finished) continue;
                    const lw = getWindAt(b.x, b.y);
                    const twa = ((b.heading - lw.direction + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                    rows[k].push([+state.race.timer.toFixed(1), Math.round(b.x), Math.round(b.y),
                        b.raceState.leg, +b.speed.toFixed(2), +twa.toFixed(3), +lw.speed.toFixed(1),
                        b.controller && b.controller.wiggleActive ? 1 : 0,
                        b.raceState.roundArmed ? 1 : 0,
                        b.raceState.isPlaning ? 1 : 0,
                        +state.wind.speed.toFixed(1),
                        b.controller && b.controller._exitClean ? 1 : 0,
                        b.controller && b.controller._outbound ? 1 : 0]);
                }
            }
        }
        return { names: bots.map(b => b.name), fins: bots.map(b => b.raceState.finished ? 1 : 0), rows };
    }, { seed: SEED, maxT: MAX_T });
    fs.writeFileSync(path.join(__dirname, `bay_trace_${SEED}.json`), JSON.stringify(out));
    console.log('saved bay_trace_' + SEED + '.json  bots:', out.names.join(','), 'finished:', out.fins.join(''));
    await browser.close();
})();

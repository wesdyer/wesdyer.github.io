// One-boat race trace — where does a full-speed DNF boat actually go?
// (2026-08-14 night: river seed 9402 'Petal' DNFs with ZERO land contact and
// 3.2 s under 30 u/s — sailing the whole race and never finishing.)
//   node _boat_trace.js <seed> <boatName> <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9402;
const NAME = process.argv[3] || 'Petal';
const ROOT = path.join(__dirname, process.argv[4] || 'treeHEADF');
const VENUE = process.argv[5] || 'river';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    const r = await page.evaluate(async ({ seed, name }) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
        const b = state.boats.find(x => x.name === name);
        if (!b) return { err: 'no boat ' + name };
        const dt = 1 / 60, out = [];
        for (let it = 0; it < 60 * 940; it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            const t = state.race.timer;
            if (t > 900) break;
            if (it % 120 === 0) out.push([+t.toFixed(0), Math.round(b.x), Math.round(b.y),
                b.raceState.leg, Math.round(b.speed * 60), b.raceState.roundArmed ? 1 : 0,
                b.raceState.totalPenalties || 0]);
        }
        return { rows: out, fin: b.raceState.finished ? 1 : 0, leg: b.raceState.leg };
    }, { seed: SEED, name: NAME });
    if (r.err) { console.log(r.err); await browser.close(); return; }
    console.log(`${NAME} seed ${SEED} ${VENUE}: finished=${r.fin} final leg=${r.leg}`);
    for (const row of r.rows) console.log('t' + row[0], `(${row[1]},${row[2]})`, 'leg', row[3], row[4] + 'u/s', row[5] ? 'ARMED' : '', 'pen', row[6]);
    await browser.close();
})();

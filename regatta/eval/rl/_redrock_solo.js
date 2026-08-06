// SOLO REDROCK — is the leg-3 wall execution or traffic?
// The fleet at 9-up: 6/72 ever finish, jam at the leg-3 upwind turn, 61 boat
// rubs/boat-race. If a SOLO boat finishes comfortably, the single-boat execution is
// adequate and the wall is the PILEUP (nine boats into a one-lane canyon); if solo
// also fails, the deficiency is single-boat canyon craft. 2 boats per race (they
// start 9; all but two are teleported out, same trick every probe uses on the player).
//   node _redrock_solo.js <trials> <seed0> <tree> [keep]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeNOW');
const KEEP = parseInt(process.argv[5]) || 1;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async ({ seed, keep }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            bots.forEach((b, i2) => { if (i2 >= keep) { b.x = 1e6 + i2 * 500; b.y = 1e6; b.raceState.finished = true; } });
            const live = bots.slice(0, keep);
            const dt = 1 / 60;
            const legSec = {}; const cl = {}; let tick = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++tick < 60) continue;
                tick = 0;
                for (const b of live) {
                    if (b.raceState.finished) continue;
                    legSec[b.raceState.leg] = (legSec[b.raceState.leg] || 0) + 1;
                    const key = `${Math.round(b.x / 300) * 300},${Math.round(b.y / 300) * 300}`;
                    cl[key] = (cl[key] || 0) + 1;
                }
            }
            const top = Object.entries(cl).sort((a, b) => b[1] - a[1]).slice(0, 5);
            return { boats: live.map(b => ({ name: b.name, finished: b.raceState.finished,
                fin: b.raceState.finishTime, leg: b.raceState.leg, pen: b.raceState.totalPenalties })),
                legSec, top };
        }, { seed: SEED0 + i, keep: KEEP });
        console.log(`seed ${SEED0 + i}:`, r.boats.map(b =>
            `${b.name} ${b.finished ? 'FIN ' + Math.round(b.fin) : 'DNF@leg' + b.leg} pen=${b.pen}`).join('  '),
            '| sec/leg', JSON.stringify(r.legSec), '| top', r.top.map(t => `(${t[0]})x${t[1]}`).join(' '));
    }
    await browser.close();
})();

// R3 SMOKE — does the mechanism FIRE (rule 17: a candidate that fires but
// benches byte-identical is pricing water the routes never buy)? One solo
// arctic race on treeR3G with the __r3c counters armed: admissible cells
// seen, admitted-route threads taken, adoptions (mid-thread takeovers),
// revocations (admitted gap closed inside the 5s window).
//   node _r3_smoke.js <seed> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9100;
const ROOT = path.join(__dirname, process.argv[3] || 'treeR3G');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; window.__r3c = { adm: 0, ticks: 0, threads: 0, adopt: 0, revoke: 0 }; window.__w1c = { fair: 0 }; });
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
        let floeEp = 0, lastHit = -10;
        const inner = window.onRaceEvent;
        window.onRaceEvent = (ty, d) => {
            try {
                if (d && d.boat === hero && ty === 'collision_island' && d.isFloe
                    && state.race.timer - lastHit > 0.5) { floeEp++; lastHit = state.race.timer; }
            } catch (e) { }
            if (inner) inner(ty, d);
        };
        for (let it = 0; it < 60 * 900; it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status === 'racing' && (state.race.timer > 880 || hero.raceState.finished)) break;
        }
        return { fin: hero.raceState.finished ? +hero.raceState.finishTime.toFixed(1) : null,
            floeEp, c: window.__r3c, w1: window.__w1c };
    }, SEED);
    await browser.close();
    console.log(`seed ${SEED} ${path.basename(ROOT)}: fin ${r.fin}  floeEp ${r.floeEp}`);
    console.log(`R3 counters: admissible-cell ticks ${r.c.ticks}, cells ${r.c.adm}, admitted THREADS ${r.c.threads}, adoptions ${r.c.adopt}, revocations ${r.c.revoke}`);
    console.log(`W1 counters: target fairings ${r.w1 ? r.w1.fair : 'n/a'}`);
})();

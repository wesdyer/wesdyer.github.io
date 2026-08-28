// WHERE THE EXTRA CONTACTS ARE (2026-08-27). SP-H buys glowtide a better start
// and costs it land contacts (+28% per boat at the fleet bench). ocean_bench
// counts contacts from the PRE-START on, so the first question is whether the
// reach-hold is sailing boats into rocks before the gun or whether the fleet
// simply arrives at the first constriction differently. Bucket the episodes.
//   node _st_land.js <tree> <venue> <seed0> <nraces>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2], VENUE = process.argv[3] || 'glowtide';
const SEED0 = parseInt(process.argv[4] || '9400'), N = parseInt(process.argv[5] || '4');
const ROOT = path.join(__dirname, TREE);
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const tot = { pre: 0, r0_30: 0, r30_60: 0, r60p: 0, boatPre: 0, boatRace: 0 };
    for (let i = 0; i < N; i++) {
        const r = await page.evaluate(async ({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(b => b !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90,
                nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const o = { pre: 0, r0_30: 0, r30_60: 0, r60p: 0, boatPre: 0, boatRace: 0 }; const T = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (d && d.boat && (ty === 'collision_island' || ty === 'collision_boat')) {
                        const pre = state.race.status === 'prestart';
                        const t = pre ? -state.race.timer : state.race.timer;
                        const k = d.boat.name + ':' + ty;
                        if (T[k] == null || t - T[k] >= 0.5) {
                            T[k] = t;
                            if (ty === 'collision_boat') { pre ? o.boatPre++ : o.boatRace++; }
                            else if (pre) o.pre++;
                            else if (state.race.timer < 30) o.r0_30++;
                            else if (state.race.timer < 60) o.r30_60++;
                            else o.r60p++;
                        }
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            for (let it = 0; it < 60 * 940; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 900) break;
                if (state.race.status === 'racing' && state.boats.every(b => b.raceState.finished)) break;
            }
            return o;
        }, { seed: SEED0 + i });
        for (const k of Object.keys(tot)) tot[k] += r[k];
    }
    await browser.close();
    const nb = N * 10;
    console.log(`${TREE} ${VENUE} ${N} races — LAND episodes/boat: prestart ${(tot.pre/nb).toFixed(2)}  race 0-30s ${(tot.r0_30/nb).toFixed(2)}  30-60s ${(tot.r30_60/nb).toFixed(2)}  60s+ ${(tot.r60p/nb).toFixed(2)}   | BOAT: prestart ${(tot.boatPre/nb).toFixed(2)} racing ${(tot.boatRace/nb).toFixed(2)}`);
})();

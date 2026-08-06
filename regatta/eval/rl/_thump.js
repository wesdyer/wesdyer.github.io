// HOW OFTEN DOES SHE HIT SOMETHING? — the same detector on both sides.
//
// The harness counts fleet collisions directly (`col: {floe, land, boat}`) but the human
// recordings carry no collision field, so the two have never been compared. Comparing a
// true count against a proxy is the apples-to-oranges error this campaign has made twice
// (per-tick deviation vs per-encounter deflection; contacts vs grounding episodes).
//
// So use a detector that both sides can support: a THUMP is the speed falling by more
// than 40% in one 0.1 s sample, from above 1 knot. That is what hitting ice looks like —
// a contact costs ~60% of speed — and it is computable from a recording's `spd` column
// and from a live boat identically.
//
// Human side (same definition) from `traj/*.json`:
//     arctic 1.2 per race / 0.3 per min | lake 0.0 | bay 0.0 | ocean 0.0
//
// ⚠️ THE COUNT IS GOOD; THE "what she hit" SPLIT IS NOT — it is printed for debugging
// only and must not be quoted. Attributing by nearest object reads 100.0% land on a
// course carrying 112 floes, and that is geometry, not a coding error: arctic's land
// radii are 8685/3245/2787 against a floe's ~69, so a boat is nearly always within a
// few hundred units of SOME point on a huge island's circumference while a small floe
// registers only when she is beside it (at random moments it reads 8 land : 1 floe).
// "Nearest edge" is not "what she hit" when obstacle sizes differ by two orders of
// magnitude. For the class split use the harness's own per-class collision counters,
// which every bench already reports as `col: {floe, land, boat}`.
//
//   node _thump.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeNOW');
const VENUE = process.argv[5] || 'arctic';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    let thumps = 0, boatMin = 0, races = 0, boatRaces = 0, lost = 0; const kind = {};
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const out = { thumps: 0, boatSec: 0, boats: bots.length, lostKt: 0, kind: {} };
            const prevSpd = bots.map(() => 0);
            const dt = 1 / 60; let acc = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++acc < 6) continue;             // 10 Hz, as the recorder samples
                acc = 0;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    if (b.raceState.finished) continue;
                    out.boatSec += 0.1;
                    const a = prevSpd[k], c = b.speed;
                    // same rule as the recordings: >1 kt before, lost >40% of it
                    if (a > 0.25 && c < a * 0.6) {
                        out.thumps++; out.lostKt += (a - c) / 0.25;
                        // WHAT DID SHE HIT? Nearest thing at the moment of the thump —
                        // where to aim depends entirely on this, and the harness's
                        // col{} counts contact FRAMES, not the impacts that cost speed.
                        let best = 'none', bd = 1e9;
                        for (const isl of (state.course.islands || [])) {
                            const d = Math.hypot(b.x - isl.x, b.y - isl.y) - isl.radius;
                            if (d < bd) { bd = d; best = isl.isFloe ? 'floe' : 'land'; }
                        }
                        for (const o of state.boats) {
                            if (o === b || o.isPlayer) continue;
                            const d = Math.hypot(b.x - o.x, b.y - o.y) - 40;
                            if (d < bd) { bd = d; best = 'boat'; }
                        }
                        if (bd > 120) best = 'nothing-near';
                        out.kind[best] = (out.kind[best] || 0) + 1;
                    }
                    prevSpd[k] = c;
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            return out;
        }, SEED0 + i);
        thumps += r.thumps; boatMin += r.boatSec / 60; races++; boatRaces += r.boats;
        lost += r.lostKt;
        for (const k in r.kind) kind[k] = (kind[k] || 0) + r.kind[k];
        console.error(`seed ${SEED0 + i} thumps=${r.thumps} boatSec=${r.boatSec.toFixed(0)}`);
    }
    console.log(`\nvenue=${VENUE}  ${races} races  ${boatRaces} boat-races  ${boatMin.toFixed(1)} boat-minutes`);
    console.log(`  THUMPS  ${thumps}  =  ${(thumps / Math.max(1, boatRaces)).toFixed(1)} per boat-race`
        + `  =  ${(thumps / Math.max(0.1, boatMin)).toFixed(1)} per boat-minute`);
    console.log(`  knots shed in them: ${(lost / Math.max(1, boatRaces)).toFixed(1)} per boat-race`);
    console.log('  [DEBUG ONLY — biased, do not quote] nearest object at impact:');
    for (const [k, v] of Object.entries(kind).sort((x, y) => y[1] - x[1]))
        console.log(`    ${k.padEnd(14)} ${String(v).padStart(5)}  ${(100 * v / Math.max(1, thumps)).toFixed(1)}%`);
    console.log(`  human, same detector: arctic 1.2/race 0.3/min | lake 0.0 | bay 0.0 | ocean 0.0`);
    await browser.close();
})();

// WAS A SPEED-KEEPING DUCK ON THE MENU? (2026-08-08, the ring convergence.)
// The fleet's granite-ring parking is 23% risk-slow, and the same-race ledger
// says the human gives way with 12-23° bends at 85+ u/s while the bots stop.
// treeDUCK instruments the argmin itself: for every give-way/high-risk slow
// tick inside the ring it dumps the full candidate fan. This reads the dumps:
//   DUCK candidate := |offset| in [0.15, 1.0], a SAILABLE angle (|h−wd| in
//   [0.9, 2.4] — not irons, not dead run), no static/boat collision flag.
//   For each snapshot: did such a candidate exist; if yes, what beat it —
//   the flat boatCollision on it (bc), ruleViolation (rv), proximityCost (px),
//   or was the CHOSEN one simply a stop/luff (chosen |h−wd| < 0.55)?
//   node _duck_fanlog.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeDUCK');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const nz = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    let snaps = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const out = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            window.__avLog = []; window.__avOn = true;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 700; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 680) break;
            }
            window.__avOn = false;
            const L = window.__avLog; window.__avLog = null;
            return L;
        }, seed);
        console.log('seed', seed, 'snapshots', out.length);
        snaps = snaps.concat(out);
    }
    // ── analysis ────────────────────────────────────────────────────────────
    let n = 0, hadDuck = 0, duckChosen = 0;
    const beatBy = { bc: 0, rv: 0, px: 0, cost: 0 };
    let chosenStop = 0, chosenWide = 0;
    for (const s of snaps) {
        n++;
        const chosenOff = Math.abs(nz(s.chosen - s.des));
        const chosenTwa = Math.abs(nz(s.chosen - s.wd));
        if (chosenTwa < 0.55) chosenStop++;
        if (chosenOff > 1.0) chosenWide++;
        // best duck candidate
        let duck = null;
        for (const f of s.fan) {
            const twa = Math.abs(nz(f.h - s.wd));
            if (Math.abs(f.off) >= 0.15 && Math.abs(f.off) <= 1.0
                && twa >= 0.9 && twa <= 2.4 && !f.sc && !f.bc) {
                if (!duck || f.c < duck.c) duck = f;
            }
        }
        if (!duck) continue;
        hadDuck++;
        const chosenFan = s.fan.reduce((a, b) => (a && a.c <= b.c) ? a : b, null);
        if (chosenFan && Math.abs(nz(duck.h - s.chosen)) < 0.08) { duckChosen++; continue; }
        // what does the duck lose to? compare duck cost vs the chosen's cost
        if (chosenFan) {
            if (duck.c <= chosenFan.c + 1) { duckChosen++; continue; }  // effectively tied
            // attribute the gap
            const gap = duck.c - chosenFan.c;
            if (duck.px > 0.5 * gap) beatBy.px++;
            else if (duck.rv) beatBy.rv++;
            else beatBy.cost++;
        }
    }
    // ducks EXCLUDED by flags entirely:
    let flaggedDuck = 0;
    for (const s of snaps) {
        for (const f of s.fan) {
            const twa = Math.abs(nz(f.h - s.wd));
            if (Math.abs(f.off) >= 0.15 && Math.abs(f.off) <= 1.0
                && twa >= 0.9 && twa <= 2.4 && (f.bc || f.sc)) { flaggedDuck++; break; }
        }
    }
    console.log(`\n${n} give-way/high-risk SLOW ticks in the ring (fleet, ${TRIALS} seeds)`);
    console.log(`  chosen was a STOP/LUFF (|h-wd|<0.55): ${chosenStop} (${(100 * chosenStop / (n || 1)).toFixed(0)}%)`);
    console.log(`  chosen was WIDE (>57° off desired):   ${chosenWide} (${(100 * chosenWide / (n || 1)).toFixed(0)}%)`);
    console.log(`  a clean sailable DUCK existed:        ${hadDuck} (${(100 * hadDuck / (n || 1)).toFixed(0)}%)`);
    console.log(`    …and was chosen/tied:               ${duckChosen}`);
    console.log(`    …beaten by proximityCost:           ${beatBy.px}`);
    console.log(`    …beaten by ruleViolation:           ${beatBy.rv}`);
    console.log(`    …beaten by other cost:              ${beatBy.cost}`);
    console.log(`  snapshots where every duck-shaped candidate carried a collision flag: ${flaggedDuck}`);
    await browser.close();
})();

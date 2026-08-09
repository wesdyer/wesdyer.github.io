// OSCILLATOR-CHASING A/B (2026-08-09). Solo neutral leg-1 tacks are 50-67 vs
// her 5, on a plan that equals her line — and the wind oscillator is NEW
// (pre-merge solo counts were 21-23). A: stock. B: same seed, every wind
// region's dirVar/speedVar zeroed after reset (mean field steady; phases and
// all else identical). If tacks collapse in B, the class is TACK-CHASING THE
// OSCILLATOR — the AI re-solves the favored board on every swing of a signal
// designed to be unforecastable.
//   node _arc_oscab.js <trials> <seed0> [tree] [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP0');
const VENUE = process.argv[5] || 'arctic';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
        window.__CHAR = 'neutral';
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const run = (seed, killOsc) => page.evaluate(async ({ seed, killOsc }) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        if (killOsc && state.course.windRegions) {
            // dirVar ONLY: zeroing speedVar changes the DAY'S ENERGY (regions may
            // author their wind in speedVar), which confounds the read — river
            // flipped sign on the v1 full-zero because of it. The tack-chasing
            // claim is about DIRECTION swings.
            for (const r of state.course.windRegions) { r.dirVar = 0; }
        }
        const hero = state.boats.find(b => !b.isPlayer);
        for (const b of state.boats) if (b !== hero) { b.x = 1e6; b.y = 1e6; }
        const dt = 1 / 60;
        let odo1 = 0, tacks1 = 0, lastSide = null, leg1T = null;
        for (let it = 0; it < 60 * 900; it++) {
            window.update(dt);
            if (state.race.status !== 'racing') continue;
            if (hero.raceState.finished) break;
            if (hero.raceState.leg === 1) {
                odo1 += (hero.speed || 0) * 60 * dt;
                const side = hero.lastWindSide;
                if (lastSide != null && side !== lastSide && side !== undefined) tacks1++;
                lastSide = side;
            } else if (hero.raceState.leg > 1 && leg1T === null) leg1T = state.race.timer;
        }
        return { fin: hero.raceState.finishTime && +hero.raceState.finishTime.toFixed(1),
                 leg1T: leg1T && +leg1T.toFixed(1), odo1: Math.round(odo1), tacks1 };
    }, { seed, killOsc });
    for (let t = 0; t < TRIALS; t++) {
        const seed = SEED0 + t;
        const a = await run(seed, false);
        const b = await run(seed, true);
        console.log(`seed ${seed}  STOCK: leg1 ${a.leg1T}s ${a.odo1}u tacks ${a.tacks1} fin ${a.fin}`);
        console.log(`          OSC=0: leg1 ${b.leg1T}s ${b.odo1}u tacks ${b.tacks1} fin ${b.fin}`);
    }
    await browser.close();
})();

// IS THE STUCK DETECTOR IN THE RIGHT REGIME FOR THIS VENUE? (2026-08-10)
//
// `BotController.update` (script.js ~344) runs the stuck timer on ABSOLUTE knots:
//     if (speed*4 < 1.0)      lowSpeedTimer += TICK;     // accumulate
//     else if (speed*4 > 2.5) lowSpeedTimer = 0;         // reset
// and `lowSpeedTimer > 3.0` (land venues) fires WIGGLE, which returns out of
// applyAvoidance entirely and steers a forced breakout for 5 s.
//
// speed*4 is knots and speed*60 is u/s, so the two thresholds are 15 u/s and
// 37.5 u/s. That is a hysteresis band with a DEAD ZONE between them: inside
// 1.0-2.5 kt the timer neither accumulates nor resets — it HOLDS whatever it had.
//
// ⭐ THE VENUE-CLASS BUG THIS IS LOOKING FOR: on 11-16 kt venues the fleet cruises
// at 85-127 u/s (5.7-8.5 kt), far above the reset, so the timer is cleared on
// essentially every frame and none of this is visible. Gatorgrass Bayou races in
// 0.9-4.8 kt and its fleet averages 31.1 u/s = 2.07 kt — BELOW THE RESET. A boat
// that dips into weed then cannot clear the timer by sailing normally, so it
// ratchets to 3 s and wiggles, repeatedly.
//
// Reports, per venue, the share of racing time in each band. A venue whose fleet
// lives below 2.5 kt has a stuck detector that cannot switch off.
//
//   node _stuck_band.js <tree> [venues...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeHD11');
const VENUES = process.argv.slice(3).length ? process.argv.slice(3)
    : ['swamp', 'redrock', 'lake', 'bay', 'river', 'lagoon', 'arctic', 'ocean'];
const TRIALS = 3, SEED0 = 4300;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    console.log(`\n=== STUCK-TIMER REGIME BY VENUE (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`accumulate < 1.0 kt (15 u/s)   dead band 1.0-2.5 kt   reset > 2.5 kt (37.5 u/s)\n`);
    console.log(`venue      meanSpd(kt)   %accum   %DEAD BAND   %reset   wiggle%   lowSpdTimer p50/p90`);
    for (const v of VENUES) {
        await page.addInitScript((vv) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })); }, v);
        await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        const A = { t: 0, acc: 0, dead: 0, res: 0, wig: 0, spd: 0, lst: [] };
        for (let s = 0; s < TRIALS; s++) {
            const r = await page.evaluate(({ seed }) => {
                window.evalHarness.seed = seed; window.resetGame(); window.startRace();
                state.course.cutoff = 900;
                const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
                const DT = 1 / 60; const o = { t: 0, acc: 0, dead: 0, res: 0, wig: 0, spd: 0, lst: [] };
                let tick = 0;
                for (let it = 0; it < 60 * 900; it++) {
                    window.update(DT);
                    if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                    tick++;
                    for (const b of state.boats) {
                        if (b.isPlayer || b.raceState.finished || b.raceState.leg < 1) continue;
                        const kt = (b.speed || 0) * 4;
                        o.t += DT; o.spd += kt * DT;
                        if (kt < 1.0) o.acc += DT; else if (kt > 2.5) o.res += DT; else o.dead += DT;
                        const c = b.controller;
                        if (c) { if (c.wiggleActive) o.wig += DT;
                                 if (tick % 120 === 0) o.lst.push(+(c.lowSpeedTimer || 0).toFixed(2)); }
                    }
                }
                return o;
            }, { seed: SEED0 + s });
            for (const k of ['t', 'acc', 'dead', 'res', 'wig', 'spd']) A[k] += r[k];
            A.lst = A.lst.concat(r.lst);
        }
        const q = (a, p) => { const s2 = a.slice().sort((x, y) => x - y); return s2.length ? s2[Math.floor(p * (s2.length - 1))] : NaN; };
        const P = x => (100 * x / A.t).toFixed(0) + '%';
        console.log(`${v.padEnd(10)} ${(A.spd / A.t).toFixed(2).padStart(9)}   ${P(A.acc).padStart(6)}   ${P(A.dead).padStart(10)}   ${P(A.res).padStart(6)}   ${P(A.wig).padStart(7)}   ${q(A.lst, 0.5).toFixed(1)}/${q(A.lst, 0.9).toFixed(1)}`);
    }
    await browser.close();
    console.log(`\n  → a venue with a large DEAD BAND + small %reset cannot clear its stuck timer`);
    console.log(`    by sailing normally, so wiggle fires on boats that are not stuck.`);
})();

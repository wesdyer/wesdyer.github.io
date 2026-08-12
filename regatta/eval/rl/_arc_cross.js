// WHAT DOES THE AVOIDANCE FAN PAY TO CROSS THE WIND? (2026-08-11, arctic push)
//
// `_tack_exec` established that only 20.0% of arctic's hull side-changes are made
// by the tactician; the avoidance stack makes 79% of them (avoid 47.2%, floe
// trajectory 15.9%, ice escape 15.9%). And leg 1 carries 53.8 manoeuvres per boat
// against his 5, for 49.1 s/boat of pure speed loss (`_tack_cost`) — 36% of the
// venue's 137.7 s/lap gap.
//
// So the question is no longer "why does the tactician tack so much" (it barely
// tacks at all). It is: when the avoidance argmin chooses a heading on the OTHER
// TACK, how much better was that choice than the best candidate that stayed on
// the boat's own board? A crossing costs a real manoeuvre — the polar is 0 kt
// inside 30 deg and recovery takes seconds — and the fan's only acknowledgement
// of that is `taxTack`, a flat 600*jamF, against collision terms of 10000-20000
// and a proximity scale of 3500-25000. If the margin is small, the fleet is
// buying tacks for pennies. If it is large, the crossings are earned and the
// manoeuvre count is the price of the ice.
//
// Runs on treeTW (probe-only instrumentation inside applyAvoidance's argmin).
// Per tick it records the best SAME-tack cost, the best CROSS-tack cost, the
// hold cost (offset 0), which was chosen, and whether the boat was beating.
//
// usage: node _arc_cross.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeTW');

(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const R = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            window.__avX = [];
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return window.__avX;
        }, SEED0 + t);
        R.push(...rows);
        console.log(`seed ${SEED0 + t}: ${rows.length} argmin ticks`);
    }
    await br.close();

    // cols: 0 beating 1 chosenCross 2 bestSame 3 bestCross 4 holdCost 5 minCost
    //       6 deviation 7 desTWA 8 speed 9 taxTackActive
    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const pc = (x, d) => `${x} (${(100 * x / (d || 1)).toFixed(1)}%)`;
    const beat = R.filter(r => r[0] === 1);
    const cross = beat.filter(r => r[1] === 1);
    console.log(`\n=== ${VENUE.toUpperCase()}: THE PRICE THE FAN PAYS TO CROSS THE WIND (${TRIALS} seeds) ===`);
    console.log(`argmin ticks on a racing leg: ${R.length}   of which BEATING (|TWA| < 1.2): ${pc(beat.length, R.length)}`);
    console.log(`   the argmin chose a heading on the OTHER TACK: ${pc(cross.length, beat.length)} of beating ticks`);
    console.log(`   taxTack was active on ${pc(beat.filter(r => r[9] === 1).length, beat.length)} of beating ticks`);
    const both = cross.filter(r => r[2] != null && r[3] != null);
    const marg = both.map(r => r[2] - r[3]);          // how much better crossing was
    console.log(`\nWHEN IT CROSSED, how much better was the best CROSS candidate than the best SAME-tack one?`);
    console.log(`   n=${both.length}   med ${q(marg, .5).toFixed(0)}   p25 ${q(marg, .25).toFixed(0)}   p75 ${q(marg, .75).toFixed(0)}   p90 ${q(marg, .9).toFixed(0)}`);
    for (const th of [600, 1000, 3000, 10000]) {
        console.log(`   margin < ${th} (i.e. a ${th}-sized honest tack cost would have flipped it): ${pc(marg.filter(m => m < th).length, marg.length)}`);
    }
    const hold = both.filter(r => r[4] != null);
    console.log(`\n   ...and against simply HOLDING COURSE (offset 0): crossing better by med ${q(hold.map(r => r[4] - r[5]), .5).toFixed(0)}  p25 ${q(hold.map(r => r[4] - r[5]), .25).toFixed(0)}`);
    console.log(`   deviation actually taken when crossing: med ${(q(cross.map(r => r[6]), .5) * 180 / Math.PI).toFixed(0)}deg   speed ${q(cross.map(r => r[8]), .5).toFixed(0)} u/s`);
    const nocross = beat.filter(r => r[1] === 0 && r[2] != null && r[3] != null);
    console.log(`\n   (control) when it did NOT cross, the best cross candidate was worse by med ${q(nocross.map(r => r[3] - r[2]), .5).toFixed(0)}`);
})();

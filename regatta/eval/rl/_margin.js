// BY HOW MUCH DID THE WINNER BEAT HOLDING COURSE? — the margin behind every deflection.
//
// The escape is `if (cost < minCost)` with offset 0 first in the list, so holding the
// proper course wins only EXACT ties. Any candidate cheaper by one unit takes the helm.
// The human's ledger says she holds course through 38-47% of encounters (no-tack rows,
// deflection < 5 deg at CPA); the fleet's says 17-23%.
//
// A margin requirement is the obvious answer and it is worth exactly one bench, but its
// value should come from a measurement rather than a sweep. If the winner typically
// beats hold by hundreds, a deadband is inert and this costs three minutes to learn. If
// the distribution piles up near zero, the size of the pile IS the constant.
//
// Reports the distribution of cost(0) - min(cost) over decisions that moved the helm,
// with the chosen offset alongside, and what fraction each candidate deadband would
// convert back into holding course.
//
//   node _margin.js <trials> <seed0> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, 'treeMARGIN');
const VENUE = process.argv[4] || 'lake';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    let marg = [], off = [], c0 = [], N = 0, MOVED = 0;
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            window.__margin = { n: 0, moved: 0, marg: [], off: [], c0: [] };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (bots.every(b => b.raceState.finished)) break;
            }
            const M = window.__margin;
            // thin: one in every 7 samples is plenty for a distribution
            return { n: M.n, moved: M.moved,
                     marg: M.marg.filter((_, j) => j % 7 === 0),
                     off: M.off.filter((_, j) => j % 7 === 0),
                     c0: M.c0.filter((_, j) => j % 7 === 0) };
        }, SEED0 + i);
        N += r.n; MOVED += r.moved;
        marg = marg.concat(r.marg); off = off.concat(r.off); c0 = c0.concat(r.c0);
        console.error(`seed ${SEED0 + i}  decisions=${r.n}  moved=${r.moved}`);
    }
    const q = (a, p) => a[Math.floor(p * (a.length - 1))];
    marg.sort((a, b) => a - b); off.sort((a, b) => a - b); c0.sort((a, b) => a - b);
    console.log(`\nvenue=${VENUE}  ${TRIALS} races  ${N} avoidance decisions, `
        + `${MOVED} moved the helm (${(100 * MOVED / Math.max(1, N)).toFixed(1)}%)`);
    console.log(`  margin cost(0)-min   med ${q(marg, .5).toFixed(1)}  p10 ${q(marg, .1).toFixed(1)}`
        + `  p25 ${q(marg, .25).toFixed(1)}  p75 ${q(marg, .75).toFixed(1)}  p90 ${q(marg, .9).toFixed(1)}`);
    console.log(`  cost(0) itself       med ${q(c0, .5).toFixed(1)}  p90 ${q(c0, .9).toFixed(1)}`);
    console.log(`  chosen |offset| rad  med ${q(off, .5).toFixed(2)}  p90 ${q(off, .9).toFixed(2)}`);
    // WHICH CANDIDATE WON? The near-reversals (2.2, 3.0 rad = 126 and 172 deg) are pushed
    // onto the fan for every venue with authored land, on the reasoning that they are the
    // only exit when nosed into a wall. If they are being CHOSEN in open water rather than
    // in a trap, they are not an emergency exit, they are a U-turn generator.
    const bins = [[0,0.05],[0.05,0.25],[0.25,0.55],[0.55,0.85],[0.85,1.4],[1.4,1.9],[1.9,2.6],[2.6,3.2]];
    console.log('  chosen-offset histogram (share of moves):');
    for (const [lo, hi] of bins) {
        const c = off.filter(x => x >= lo && x < hi).length;
        if (!c) continue;
        const pct = 100 * c / off.length;
        console.log(`    ${lo.toFixed(2)}-${hi.toFixed(2)} rad `
            + `${String((180*(lo+hi)/2/Math.PI).toFixed(0)).padStart(4)} deg  `
            + `${pct.toFixed(1).padStart(5)}%  ${'#'.repeat(Math.round(pct/2))}`);
    }
    const rev = 100 * off.filter(x => x >= 1.9).length / off.length;
    console.log(`  NEAR-REVERSALS (>=1.9 rad): ${rev.toFixed(1)}% of moves, `
        + `${(rev * MOVED / N).toFixed(1)}% of all decisions`);
    console.log('  a deadband of M would return this share of deflections to HOLD:');
    for (const M of [1, 5, 10, 25, 50, 100, 250, 500, 1000]) {
        const share = 100 * marg.filter(x => x < M).length / marg.length;
        console.log(`    M=${String(M).padStart(4)}   ${share.toFixed(1).padStart(5)}% of moves`
            + `   -> hold rate ${(100 * (N - MOVED + MOVED * share / 100) / N).toFixed(1)}%`);
    }
    await browser.close();
})();

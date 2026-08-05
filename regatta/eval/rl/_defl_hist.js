// WHERE DOES THE PINNED 46-48° DEFLECTION ACTUALLY COME FROM?
//
// Twelve traffic candidates have re-priced the avoidance cost and the mean
// deflection has not moved. Every one of them changed the COST; none changed
// the ACTION SET. The fan is {0, ±.1, ±.2, ±.4, ±.6, ±.8, ±1.2, ±1.6} (+±2.2,
// ±3.0 on grid venues) — the gaps above 0.2 rad are 0.2 rad wide, so if the
// cost landscape is really a near-binary "does this candidate clear the
// bubble", the argmin lands on the first fan point that clears and the
// deflection is QUANTIZED there, not chosen.
//
// This histograms the chosen offset during transit. A spectrum spread across
// the fan means pricing picks it (finer candidates buy nothing). Mass piled on
// one or two rungs means the fan picks it, and resolution is the lever.
// node _defl_hist.js <trials> <seed0> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const VENUE = process.argv[6] || 'arctic';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const tot = new Map();
    let frames = 0, active = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
            const bots = state.boats.filter(b => !b.isPlayer);
            const dt = 1 / 60;
            const h = {};
            let n = 0, act = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (const b of bots) {
                    const rs = b.raceState;
                    if (rs.finished || rs.leg !== 1 || rs.roundArmed) continue;   // transit only
                    const c = b.controller;
                    if (!c) continue;
                    n++;
                    const d = Math.abs(c.lastAvoidDeviation || 0);
                    if (d < 1e-6) continue;
                    act++;
                    // bin to 0.05 rad — fine enough to see fan rungs stand apart
                    const k = (Math.round(d / 0.05) * 0.05).toFixed(2);
                    h[k] = (h[k] || 0) + 1;
                }
            }
            return { h, n, act };
        }, seed);
        for (const k in r.h) tot.set(k, (tot.get(k) || 0) + r.h[k]);
        frames += r.n; active += r.act;
        console.log(`seed ${seed} done`);
    }
    const keys = [...tot.keys()].sort((a, b) => +a - +b);
    const sum = [...tot.values()].reduce((a, b) => a + b, 0);
    console.log(`\nTRANSIT avoidance deflection histogram (${frames} boat-frames, ${active} with deviation = ${(100 * active / frames).toFixed(0)}%)`);
    console.log('rad    deg    share    cum      bar');
    let cum = 0;
    for (const k of keys) {
        const v = tot.get(k), s = v / sum;
        if (s < 0.002) continue;
        cum += s;
        console.log(`${k.padStart(5)} ${(+k * 57.3).toFixed(0).padStart(5)}  ${(100 * s).toFixed(1).padStart(5)}%  ${(100 * cum).toFixed(0).padStart(4)}%  ${'#'.repeat(Math.round(s * 120))}`);
    }
    // fan rungs for reference
    console.log('\nfan rungs (rad): 0.1 0.2 0.4 0.6 0.8 1.2 1.6 2.2 3.0');
    await browser.close();
})();

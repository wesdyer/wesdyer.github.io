// HOW FAST DOES SHE ACTUALLY TURN? — realised heading change per second, fleet side.
//
// `_margin.js` says 34-41% of the fleet's helm movements COMMAND an offset of 80 degrees
// or more. The human's recordings say she never once turns 80 degrees in a second (0 of
// 6041 windows on lake, 0 of 27784 on bay; arctic 0.04%). Those are not the same
// quantity: a commanded offset is what the argmin picked, and the boat turns toward it at
// a limited rate, so a 172-degree command does not produce a 172-degree second.
//
// This measures the same thing the recordings measure — heading now vs heading 1 s ago,
// racing legs only, sampled at 10 Hz — so the fleet and the human can finally be put in
// one table without an apples-to-oranges caveat.
//
//   node _hdgrate.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeNOGO2');
const VENUE = process.argv[5] || 'lake';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    let ch = [];
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const hist = bots.map(() => []);
            const out = [];
            const dt = 1 / 60; let acc = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++acc < 6) continue;          // 10 Hz, as the recorder samples
                acc = 0;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    if (b.raceState.finished || b.raceState.leg < 1) continue;
                    const h = hist[k];
                    h.push(b.heading);
                    if (h.length > 11) h.shift();
                    if (h.length === 11) out.push(+Math.abs(norm(h[10] - h[0]) * 180 / Math.PI).toFixed(2));
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            return out.filter((_, j) => j % 5 === 0);
        }, SEED0 + i);
        ch = ch.concat(r);
        console.error(`seed ${SEED0 + i} windows=${r.length}`);
    }
    ch.sort((a, b) => a - b);
    const n = ch.length, q = (p) => ch[Math.floor(p * (n - 1))];
    console.log(`\nvenue=${VENUE}  tree=${path.basename(ROOT)}  ${n} one-second windows (10 Hz, racing legs)`);
    console.log(`  med ${q(.5).toFixed(1)}  p90 ${q(.9).toFixed(1)}  p99 ${q(.99).toFixed(1)}  max ${ch[n - 1].toFixed(1)} deg/s`);
    for (const t of [45, 80, 109]) {
        console.log(`  >=${t} deg in one second: ${(100 * ch.filter(x => x >= t).length / n).toFixed(2)}%`);
    }
    await browser.close();
})();

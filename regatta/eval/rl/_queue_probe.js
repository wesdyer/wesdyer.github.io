// IS IT A QUEUE? — how many boats are inside a mark's working water at once, and for
// how long each boat is stuck there.
//
// A mark with 100 units of clearance cannot be rounded by nine boats at once whatever
// the steering does, and the difference between "the AI rounds badly" and "the venue
// cannot take a fleet here" is measurable: occupancy. Reports, per mark, the peak and
// mean number of boats within R, and per boat the dwell time inside R against the time
// the leg should take.
//
//   node _queue_probe.js <trials> <seed0> <tree> [venue] [R]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHEAD');
const VENUE = process.argv[5] || 'lake';
const R = parseInt(process.argv[6] || '400');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = {};
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async ({ seed, R }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const marks = (state.course.marks || []).map(m => ({ id: m.id || m.kind, x: m.x, y: m.y }));
            const occ = marks.map(() => ({ peak: 0, sum: 0, n: 0, dwell: {}, slowDwell: {} }));
            const dt = 1 / 60; let acc = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++acc >= 30) {
                    acc = 0;
                    for (let k = 0; k < marks.length; k++) {
                        let c = 0;
                        for (const b of bots) {
                            if (b.raceState.finished) continue;
                            if ((b.x - marks[k].x) ** 2 + (b.y - marks[k].y) ** 2 < R * R) {
                                c++;
                                occ[k].dwell[b.name] = (occ[k].dwell[b.name] || 0) + 0.5;
                                if (b.speed / 0.25 < 1.5)
                                    occ[k].slowDwell[b.name] = (occ[k].slowDwell[b.name] || 0) + 0.5;
                            }
                        }
                        if (c > occ[k].peak) occ[k].peak = c;
                        occ[k].sum += c; occ[k].n++;
                    }
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            const fins = bots.filter(b => b.raceState.finished).map(b => Math.round(b.raceState.finishTime));
            return { marks, occ, fins: fins.sort((a, b) => a - b) };
        }, { seed: SEED0 + i, R });
        for (let k = 0; k < r.marks.length; k++) {
            const id = r.marks[k].id;
            const a = agg[id] = agg[id] || { peak: 0, sum: 0, n: 0, dwell: [], slow: [] };
            a.peak = Math.max(a.peak, r.occ[k].peak);
            a.sum += r.occ[k].sum; a.n += r.occ[k].n;
            for (const v of Object.values(r.occ[k].dwell)) a.dwell.push(v);
            for (const v of Object.values(r.occ[k].slowDwell)) a.slow.push(v);
        }
        console.error('seed ' + (SEED0 + i) + ' fins ' + r.fins.join(','));
    }
    const med = (arr) => { const s = arr.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
    console.log(`venue=${VENUE}  radius=${R}u  ${TRIALS} races`);
    for (const [id, a] of Object.entries(agg)) {
        console.log(`  ${id.padEnd(9)} peak boats ${a.peak}   mean boats ${(a.sum / Math.max(1, a.n)).toFixed(2)}`
            + `   dwell/boat med ${med(a.dwell).toFixed(1)}s max ${Math.max(0, ...a.dwell).toFixed(1)}s`
            + `   of which under 1.5 kt: med ${med(a.slow).toFixed(1)}s max ${Math.max(0, ...a.slow, 0).toFixed(1)}s`);
    }
    await browser.close();
})();

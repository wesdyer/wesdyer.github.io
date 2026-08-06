// THE FLEET'S TRAFFIC LEDGER — the same encounter analysis as `_human_ledger.py`, run on
// the bots, so the two are finally comparable in the same units.
//
// Every avoidance thread in this campaign has compared a fleet number (mean avoidance
// DEVIATION, from `_defl_hist` / `_transit_probe`) against a human number (deflection per
// ENCOUNTER, from the ledger). Those are different quantities: deviation is measured
// against the heading the AI wanted this tick, per tick; the ledger measures the heading
// change across a whole encounter against the 5 s trend before it opened, and excludes
// deliberate tacks. This runs the LEDGER's definition on the fleet.
//
// An encounter opens when a rival comes inside 600u and is closing, and closes when it
// opens back outside. Per encounter: closest approach, heading change at CPA against the
// pre-encounter trend, whether she tacked during it, and her speed ratio at CPA.
//
//   node _fleet_ledger.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeLANDED');
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
    let all = [];
    for (let i = 0; i < TRIALS; i++) {
        const enc = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            // per-boat heading history for the 5 s pre-encounter trend
            const hist = bots.map(() => []);
            const open = bots.map(() => ({}));      // key: rival index
            const prevD = bots.map(() => ({}));
            const out = [];
            const dt = 1 / 60; let acc = 0, t = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                t = state.race.timer;
                if (t > 900) break;
                if (++acc < 6) continue;            // 10 Hz, as the recorder samples
                acc = 0;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    if (b.raceState.finished) continue;
                    hist[k].push({ t, h: b.heading });
                    while (hist[k].length && t - hist[k][0].t > 5) hist[k].shift();
                    let sx = 0, sy = 0;
                    for (const q of hist[k]) { sx += Math.sin(q.h); sy += Math.cos(q.h); }
                    const trend = Math.atan2(sx, sy);
                    const tack = norm(b.heading - getWindAt(b.x, b.y).direction) > 0 ? 1 : -1;
                    for (let j = 0; j < bots.length; j++) {
                        if (j === k) continue;
                        const o = bots[j];
                        if (o.raceState.finished) continue;
                        const d = Math.hypot(o.x - b.x, o.y - b.y);
                        const was = open[k][j];
                        if (d < 600) {
                            const closing = prevD[k][j] == null || d < prevD[k][j] - 0.5;
                            if (!was && closing) {
                                open[k][j] = { h0: trend, cpa: d, dAt: 0, tack0: tack,
                                               tacked: 0, spd0: b.speed, spdCpa: b.speed };
                            } else if (was) {
                                const dfl = Math.abs(norm(b.heading - was.h0));
                                if (d <= was.cpa) { was.cpa = d; was.dAt = dfl; was.spdCpa = b.speed; }
                                if (tack !== was.tack0) was.tacked = 1;
                            }
                        } else if (was) {
                            out.push([+was.cpa.toFixed(0), +was.dAt.toFixed(4), was.tacked,
                                      was.spd0 > 0.05 ? +(was.spdCpa / was.spd0).toFixed(3) : 1]);
                            delete open[k][j];
                        }
                        prevD[k][j] = d;
                    }
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            for (let k = 0; k < bots.length; k++)
                for (const j of Object.keys(open[k])) {
                    const w = open[k][j];
                    out.push([+w.cpa.toFixed(0), +w.dAt.toFixed(4), w.tacked,
                              w.spd0 > 0.05 ? +(w.spdCpa / w.spd0).toFixed(3) : 1]);
                }
            return out;
        }, SEED0 + i);
        all = all.concat(enc);
        console.error('seed ' + (SEED0 + i) + ' encounters=' + enc.length);
    }
    const R = (deg) => deg * 180 / Math.PI;
    const rows = [['ALL', () => true],
                  ['  no tack', e => !e[2]],
                  ['  no tack, cpa<150u', e => !e[2] && e[0] < 150],
                  ['  no tack, cpa150-300', e => !e[2] && e[0] >= 150 && e[0] < 300],
                  ['  no tack, cpa>300u', e => !e[2] && e[0] >= 300],
                  ['tacked during', e => e[2]]];
    console.log(`venue=${VENUE}  ${TRIALS} races  ${all.length} encounters  (ledger definition)`);
    for (const [name, sel] of rows) {
        const E = all.filter(sel);
        if (!E.length) continue;
        const d = E.map(e => R(e[1])).sort((a, b) => a - b);
        const c = E.map(e => e[0]).sort((a, b) => a - b);
        const sr = E.map(e => e[3]).sort((a, b) => a - b);
        const q = (arr, p) => arr[Math.floor(p * (arr.length - 1))];
        console.log(`  ${name.padEnd(22)} n=${String(E.length).padStart(5)}`
            + `  AT-CPA med ${q(d, .5).toFixed(1).padStart(5)} mean ${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1).padStart(5)}`
            + ` p90 ${q(d, .9).toFixed(1).padStart(5)}  ZERO(<5) ${(100 * d.filter(x => x < 5).length / d.length).toFixed(0).padStart(3)}%`
            + `  tacked ${(100 * E.filter(e => e[2]).length / E.length).toFixed(0).padStart(3)}%`
            + `  cpa med ${String(q(c, .5)).padStart(4)}`
            + `  spd@cpa ${q(sr, .5).toFixed(2)}`);
    }
    await browser.close();
})();

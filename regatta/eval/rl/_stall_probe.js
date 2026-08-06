// WHY IS SHE UNDER A KNOT? — the fleet's slow time, classified by cause.
//
// After tonight's landing the fleet still spends 6.4% of its time on Stillwater Lake
// below 1 knot, against the human's 0.0%. In 6+ knots of breeze that is not the wind.
// The candidates are: IN IRONS (head to wind with no way on — light air makes a failed
// tack much more likely, and lake is the first light-air venue), ASHORE (pinned against
// land, which the landing halved but did not remove), IN A HOLE (genuinely no wind), or
// LUFFING ON PURPOSE (a penalty turn or a rounding).
//
// Reports, per 0.1s sample below the threshold: the boat's TWA, the local wind, distance
// to the nearest blocked cell, and whether she is serving a penalty — plus how long the
// episodes last, because a hundred one-second stalls and one hundred-second stall are
// different problems.
//
//   node _stall_probe.js <trials> <seed0> <tree> [venue] [ktThreshold]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeLANDED');
const VENUE = process.argv[5] || 'lake';
const KT = parseFloat(process.argv[6] || '1.0');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = { n: 0, total: 0, irons: 0, ashore: 0, hole: 0, penalty: 0, other: 0,
                  episodes: [], byLeg: {} };
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async ({ seed, KT }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const out = { n: 0, total: 0, irons: 0, ashore: 0, hole: 0, penalty: 0, other: 0,
                          episodes: [], byLeg: {} };
            const run = bots.map(() => 0);
            const dt = 1 / 60; let acc = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++acc < 6) continue;
                acc = 0;
                const g = state.course.botGrid;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    if (b.raceState.finished) continue;
                    out.total += 0.1;
                    const kt = b.speed / 0.25;
                    if (kt >= KT) {
                        if (run[k] > 0) { out.episodes.push(+run[k].toFixed(1)); run[k] = 0; }
                        continue;
                    }
                    run[k] += 0.1;
                    out.n += 0.1;
                    out.byLeg[b.raceState.leg] = (out.byLeg[b.raceState.leg] || 0) + 0.1;
                    const w = getWindAt(b.x, b.y);
                    const twa = Math.abs(norm(b.heading - w.direction)) * 180 / Math.PI;
                    // nearest blocked cell within 3 cells
                    let nearLand = false;
                    if (g) {
                        const c = g.cell(b.x, b.y);
                        for (let dj = -2; dj <= 2 && !nearLand; dj++)
                            for (let di = -2; di <= 2; di++)
                                if (!g.at(c[0] + di, c[1] + dj)) { nearLand = true; break; }
                    }
                    if ((b.raceState.penaltyTurnsOwed || 0) > 0) out.penalty += 0.1;
                    else if (twa < 35) out.irons += 0.1;
                    else if (nearLand) out.ashore += 0.1;
                    else if (w.speed < 2.5) out.hole += 0.1;
                    else out.other += 0.1;
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            for (let k = 0; k < bots.length; k++) if (run[k] > 0) out.episodes.push(+run[k].toFixed(1));
            return out;
        }, { seed: SEED0 + i, KT });
        for (const k of ['n', 'total', 'irons', 'ashore', 'hole', 'penalty', 'other']) agg[k] += r[k];
        agg.episodes = agg.episodes.concat(r.episodes);
        for (const k in r.byLeg) agg.byLeg[k] = (agg.byLeg[k] || 0) + r.byLeg[k];
        console.error('seed ' + (SEED0 + i) + ' slow ' + r.n.toFixed(0) + 's of ' + r.total.toFixed(0));
    }
    const pc = (v) => `${(100 * v / Math.max(0.01, agg.n)).toFixed(1).padStart(5)}%`;
    console.log(`venue=${VENUE}  ${TRIALS} races  under ${KT} kt for ${agg.n.toFixed(0)} of `
        + `${agg.total.toFixed(0)} boat-seconds (${(100 * agg.n / agg.total).toFixed(1)}%)`);
    console.log(`  IN IRONS   (TWA < 35 deg)          ${pc(agg.irons)}`);
    console.log(`  ASHORE     (blocked cell within 2) ${pc(agg.ashore)}`);
    console.log(`  IN A HOLE  (local wind < 2.5 kt)   ${pc(agg.hole)}`);
    console.log(`  PENALTY TURN                       ${pc(agg.penalty)}`);
    console.log(`  none of the above                  ${pc(agg.other)}`);
    const e = agg.episodes.sort((a, b) => a - b);
    if (e.length) {
        const q = (p) => e[Math.floor(p * (e.length - 1))];
        console.log(`  episodes ${e.length}  med ${q(.5).toFixed(1)}s  p90 ${q(.9).toFixed(1)}s`
            + `  max ${e[e.length - 1].toFixed(1)}s  (a few long stalls vs many short ones)`);
    }
    console.log('  by leg: ' + Object.entries(agg.byLeg).map(([k, v]) => `${k}:${v.toFixed(0)}s`).join(' '));
    await browser.close();
})();

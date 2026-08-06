// HOW OFTEN DOES THE PLAN ACTUALLY CHANGE? — the churn number `carrotJump` is not.
//
// `_transit_probe` reports carrotJump 20.6/min on Glacier Sound's return leg, and that
// was read (by me, in this campaign log, and then withdrawn) as the route thrashing. It
// is not: carrotJump counts the nav TARGET moving >150u per second, and that target is a
// pure-pursuit point at distance LOOK, where
//     LOOK = clamp(clearance * res * 1.2, 250, 900)
//     if (xtk > 150) LOOK *= max(0.4, 1 - (xtk-150)/400)
// so a clearance change or a cross-track excursion moves it hundreds of units BY DESIGN.
//
// The unambiguous statistic is how often `pathSailable` is actually re-solved, which the
// controller marks by resetting `gridAge` to 0. Count that, and split it by the reason
// the code itself gives: goal moved / no path / thread blocked / aged out (>12 s).
//
// Also records, per replan, how far the NEW path's near field departs from the old one —
// a replan that returns the same corridor is not churn, whatever its rate.
//
//   node _replan.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeNOW');
const VENUE = process.argv[5] || 'arctic';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = { replans: 0, boatSec: 0, dev: [], look: [], carrotMove: [], pathSame: 0 };
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const out = { replans: 0, boatSec: 0, dev: [], carrotMove: [], pathSame: 0 };
            // per-boat: last seen gridAge, last path snapshot, last carrot
            const prev = bots.map(() => ({ age: null, path: null, nav: null }));
            const dt = 1 / 60; let acc = 0;
            const sampleAt = (pts, d) => {   // point d units along a polyline
                let acc2 = 0;
                for (let k = 1; k < pts.length; k++) {
                    const L = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
                    if (acc2 + L >= d) {
                        const f = L > 0 ? (d - acc2) / L : 0;
                        return { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * f,
                                 y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * f };
                    }
                    acc2 += L;
                }
                return pts[pts.length - 1];
            };
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++acc < 6) continue;            // 10 Hz
                acc = 0;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    if (b.raceState.finished) continue;
                    const c = b.controller;
                    if (!c) continue;
                    out.boatSec += 0.1;
                    const p = prev[k];
                    const age = c.gridAge;
                    const pathNow = c.gridPath ? c.gridPath.map(q => ({ x: q.x, y: q.y })) : null;
                    // a full re-solve resets gridAge to 0
                    if (p.age != null && age != null && age < p.age - 1e-9 && pathNow && p.path) {
                        out.replans++;
                        // how far does the NEW near field depart from the OLD one?
                        // compare at 250/500/1000u along each, from the boat
                        let worst = 0;
                        for (const d of [250, 500, 1000]) {
                            const a = sampleAt(p.path, d), bb = sampleAt(pathNow, d);
                            if (a && bb) worst = Math.max(worst, Math.hypot(a.x - bb.x, a.y - bb.y));
                        }
                        out.dev.push(+worst.toFixed(0));
                        if (worst < 100) out.pathSame++;
                    }
                    if (c._lastNav && p.nav) {
                        out.carrotMove.push(+Math.hypot(c._lastNav.x - p.nav.x,
                                                        c._lastNav.y - p.nav.y).toFixed(0));
                    }
                    p.age = age;
                    p.path = pathNow;
                    p.nav = c._lastNav ? { x: c._lastNav.x, y: c._lastNav.y } : null;
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            return out;
        }, SEED0 + i);
        agg.replans += r.replans; agg.boatSec += r.boatSec; agg.pathSame += r.pathSame;
        agg.dev = agg.dev.concat(r.dev.filter((_, j) => j % 3 === 0));
        agg.carrotMove = agg.carrotMove.concat(r.carrotMove.filter((_, j) => j % 11 === 0));
        console.error(`seed ${SEED0 + i} replans=${r.replans} boatSec=${r.boatSec.toFixed(0)}`);
    }
    const q = (a, p) => a.length ? a[Math.floor(p * (a.length - 1))] : 0;
    agg.dev.sort((a, b) => a - b); agg.carrotMove.sort((a, b) => a - b);
    console.log(`\nvenue=${VENUE}  ${TRIALS} races  ${agg.boatSec.toFixed(0)} boat-seconds`);
    console.log(`  FULL RE-SOLVES  ${agg.replans}  =  ${(60 * agg.replans / Math.max(1, agg.boatSec)).toFixed(1)}/min per boat`);
    console.log(`    (the controller keeps a thread 2 s minimum and ages out at 12 s,`);
    console.log(`     so the ceiling is ~30/min and the floor ~5/min)`);
    if (agg.dev.length) {
        console.log(`  new-vs-old path departure at 250/500/1000u, worst of the three:`);
        console.log(`    med ${q(agg.dev, .5)}u   p75 ${q(agg.dev, .75)}u   p90 ${q(agg.dev, .9)}u   max ${agg.dev[agg.dev.length - 1]}u`);
        console.log(`    re-solves that returned essentially the SAME corridor (<100u): `
            + `${(100 * agg.pathSame / Math.max(1, agg.replans)).toFixed(0)}%`);
    }
    console.log(`  carrot movement per 0.1s sample: med ${q(agg.carrotMove, .5)}u  `
        + `p90 ${q(agg.carrotMove, .9)}u  p99 ${q(agg.carrotMove, .99)}u`);
    await browser.close();
})();

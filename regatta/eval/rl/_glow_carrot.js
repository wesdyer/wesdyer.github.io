// ⭐ IS THE CARROT REACHABLE FROM WHERE SHE ACTUALLY IS? (2026-08-13)
//
// `_riv_entry.js` on glowtide: **97.9% of groundings happen with the boat's own path
// ahead already showing blockage for the entire second before she touches**, and the
// modal helm owner is NAVIGATION (59.4% of episodes, 62.5% of grounded time) — not the
// avoidance fan and not the escape. Avoidance was deflecting her in 58.3% of those
// pre-seconds.
//
// THE HYPOTHESIS THAT EXPLAINS BOTH: `pathSailable` is an A* over navigable cells, so
// the plan cannot cross rock WHEN IT IS BUILT — but it is only rebuilt every 2-12 s
// (`gridTimer` / `gridAge`). Between rebuilds avoidance pushes the boat OFF that line,
// and the carrot that was reachable from the old position is now across a rock from
// the new one. Navigation then steers straight at it.
//
// ⚠️ This is NOT the degenerate "distance from its own plan" metric (probe caveat 2):
// that reads ~0 because `gridPath` is re-anchored at the boat on every REBUILD. The
// question here is different and well-posed — sample the STRAIGHT SEGMENT from the
// boat's current position to the carrot she is actually steering at, and ask the grid
// whether it crosses a blocked cell. Sampled along the segment, never at its ends
// (rule 18).
//
//   node _glow_carrot.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeFINAL');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 250)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const g = () => state.course.botGrid;
            // does the STRAIGHT segment a->b cross a blocked cell? sampled ALONG it
            const segBlocked = (ax, ay, bx, by) => {
                const G = g(); if (!G) return { hit: 0, at: -1 };
                const L = Math.hypot(bx - ax, by - ay); if (L < 1) return { hit: 0, at: -1 };
                const step = 25;
                for (let d = step; d < L; d += step) {
                    const f = d / L, x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
                    const c = G.cell(x, y);
                    if (!G.at(c[0], c[1])) return { hit: 1, at: Math.round(d) };
                }
                return { hit: 0, at: -1 };
            };
            const out = [];
            let sample = 0;
            for (let i = 0; i < 60 * 940; i++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++sample % 6) continue;                     // 10 Hz
                for (const b of bots) {
                    const c = b.controller; if (!c || b.raceState.finished) continue;
                    if (b.raceState.leg < 1) continue;
                    const gp = c.gridPath;
                    if (!gp || !gp.length) continue;
                    // ⚠️ THE CARROT IS `_lastNav` (script.js ~731). There is NO
                    // `controller.navTarget` — `navTarget` is only a PARAMETER name in
                    // `planFloeTrajectory`. Falling back to `gp[0]` would be worse than
                    // useless: a fresh rebuild re-anchors node 0 at the boat, so the
                    // segment is ~0 long and never crosses anything, and the probe would
                    // report a confident 0% (rule 4's zero statistic).
                    const car = c._lastNav;
                    if (!car || car.x == null) continue;
                    const seg = segBlocked(b.x, b.y, car.x, car.y);
                    // and how STALE is the plan she is following?
                    out.push([
                        b.raceState.leg,
                        seg.hit, seg.at,
                        Math.round(Math.hypot(car.x - b.x, car.y - b.y)),
                        +(c.gridAge || 0).toFixed(1),
                        Math.round(b.speed * 60),
                        +(c.lastAvoidDeviation || 0).toFixed(2),
                        // is the FIRST path node behind her? (she has been pushed past it)
                        Math.round(Math.hypot(gp[0].x - b.x, gp[0].y - b.y))
                    ]);
                }
            }
            return out;
        }, SEED0 + t);
        A.push(...r);
        console.log(`  seed ${SEED0 + t}: ${r.length} nav samples`);
    }
    await br.close();
    const q = (a, f) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
    const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '-';
    const hit = A.filter(r => r[1]), clean = A.filter(r => !r[1]);
    console.log(`\n=== ${VENUE} — IS THE CARROT REACHABLE IN A STRAIGHT LINE? (${A.length} nav samples, 10 Hz) ===`);
    console.log(`  ⭐ the segment boat -> carrot crosses BLOCKED water on   ${pct(hit.length, A.length)}`);
    console.log(`     ...and on leg 1 alone                                ${pct(A.filter(r => r[0] === 1 && r[1]).length, A.filter(r => r[0] === 1).length)}`);
    const byLeg = {}; for (const r of A) { byLeg[r[0]] = byLeg[r[0]] || [0, 0]; byLeg[r[0]][1]++; if (r[1]) byLeg[r[0]][0]++; }
    console.log('     by leg: ' + Object.keys(byLeg).sort().map(k => `${k}:${pct(byLeg[k][0], byLeg[k][1])}`).join('  '));
    const col = (a, i) => a.map(r => r[i]);
    console.log(`\n  WHEN IT DOES CROSS (n=${hit.length})            vs WHEN IT DOES NOT (n=${clean.length})`);
    const row = (lbl, i) => console.log(`   ${lbl.padEnd(30)} med ${String(q(col(hit, i), .5)).padStart(6)}  p75 ${String(q(col(hit, i), .75)).padStart(6)}   |   med ${String(q(col(clean, i), .5)).padStart(6)}`);
    row('distance to the blockage', 2);
    row('distance to the carrot', 3);
    row('plan age (s)', 4);
    row('her speed (u/s)', 5);
    row('avoidance deviation (rad)', 6);
    row('distance to path node 0', 7);
    console.log(`\n  ⭐ THE STALENESS TEST — is she following an OLD plan when the carrot is unreachable?`);
    for (const th of [1, 3, 6, 10]) {
        const a = A.filter(r => r[4] >= th);
        console.log(`   plan age >= ${String(th).padStart(2)} s: ${pct(a.filter(r => r[1]).length, a.length)} of ${a.length} samples cross blocked water`);
    }
    console.log(`\n  ⭐ AND IS SHE OFF THE LINE? (distance to path node 0, which a fresh rebuild puts at ~0)`);
    for (const th of [50, 100, 200]) {
        const a = A.filter(r => r[7] >= th);
        console.log(`   >= ${String(th).padStart(3)}u off node 0: ${pct(a.filter(r => r[1]).length, a.length)} of ${a.length} samples cross blocked water`);
    }
    fs.writeFileSync(path.join(__dirname, `_glow_carrot_${path.basename(ROOT)}.json`), JSON.stringify(A));
})();

// IS THE LONG ROUTE PLANNED, OR IS IT WANDER? (2026-08-10, the swamp push.)
//
// Swamp's gap decomposes ~74% DISTANCE / ~29% speed: she sails 8709u at 40.2 u/s,
// the fleet 15118u at 31.1 u/s. So the question that decides the whole build is
// whether the extra 74% of distance is:
//   (A) PLANNED — the router's own path is long, because the 2051-trunk forest at
//       CLEARANCE 44u closes the direct corridors and A* returns a detour; or
//   (B) WANDER  — the plan is short and the boat fails to follow it (wiggle is 25%
//       of racing time and 57% of slow time, which is a lot of thrash).
// These want opposite builds, and guessing wrong wastes the night.
//
// TWO MEASUREMENTS, both per 1 Hz sample, both against the SAME goal:
//   1. PLAN LENGTH vs straight line to the goal  -> the detour the router intends.
//   2. PLAN DRAG vs the boat's ACTUAL drag       -> whether the weed is chosen or
//      arrived at. `_swamp_why` found the fleet's mean multiplier is 0.680 against
//      her 0.921 and that 75% of its slow time is weed, so if the PLAN samples
//      clean (~0.9+) while the boat sits at 0.68, the weed is an execution
//      outcome and no amount of route pricing reaches it. Rule 17's shape exactly.
//
//   node _swamp_plan.js [trials] [seed0] [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 6;
const SEED0 = parseInt(process.argv[3]) || 4300;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHD11');
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'swamp' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = { detour: [], planMul: [], boatMul: [], planLen: [], straight: [], noPath: 0, n: 0, wig: 0, t: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const awash = (state.course.islands || []).filter(i => i.awash);
            const SF = (x, y) => window.VenueDoc.shoalField(awash, x, y);
            const out = { detour: [], planMul: [], boatMul: [], planLen: [], straight: [], noPath: 0, n: 0, wig: 0, t: 0 };
            const DT = 1 / 60; let acc = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg < 1) continue;
                    out.t += DT; if (b.controller && b.controller.wiggleActive) out.wig += DT;
                }
                if (++acc < 60) continue;      // 1 Hz
                acc = 0;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg < 1) continue;
                    const c = b.controller; if (!c) continue;
                    out.n++;
                    const gp = c.gridPath;
                    if (!gp || gp.length < 2) { out.noPath++; continue; }
                    // plan length from the boat's position along the remaining path
                    let L = 0; const pts = gp;
                    let prevx = b.x, prevy = b.y;
                    const muls = [];
                    for (let k = 0; k < pts.length; k++) {
                        L += Math.hypot(pts[k].x - prevx, pts[k].y - prevy);
                        prevx = pts[k].x; prevy = pts[k].y;
                        muls.push(SF(pts[k].x, pts[k].y));
                    }
                    const gx = pts[pts.length - 1].x, gy = pts[pts.length - 1].y;
                    const straight = Math.hypot(gx - b.x, gy - b.y);
                    if (straight < 200) continue;         // near the goal the ratio explodes
                    out.detour.push(L / straight);
                    out.planLen.push(L); out.straight.push(straight);
                    out.planMul.push(muls.reduce((x, y) => x + y, 0) / muls.length);
                    out.boatMul.push(b.shoalMul != null ? b.shoalMul : 1);
                }
            }
            return out;
        }, { seed: SEED0 + t });
        for (const k of ['detour', 'planMul', 'boatMul', 'planLen', 'straight']) A[k] = A[k].concat(r[k]);
        A.noPath += r.noPath; A.n += r.n; A.wig += r.wig; A.t += r.t;
        console.log(`seed ${SEED0 + t}: ${r.detour.length} plan samples, ${r.noPath} with NO PATH`);
    }
    await browser.close();

    console.log(`\n=== SWAMP: PLANNED DETOUR vs WANDER (${TRIALS} seeds from ${SEED0}, ${path.basename(ROOT)}) ===`);
    console.log(`${A.n} boat-samples at 1 Hz   NO PATH AT ALL on ${A.noPath} (${(100 * A.noPath / A.n).toFixed(1)}%)`);
    console.log(`  wiggle ${(100 * A.wig / A.t).toFixed(0)}% of racing time`);
    console.log(`\n  ⭐ PLANNED DETOUR (plan length / straight line to the same goal)`);
    console.log(`     p25 ${q(A.detour, 0.25).toFixed(2)}x   med ${q(A.detour, 0.5).toFixed(2)}x   p75 ${q(A.detour, 0.75).toFixed(2)}x   p90 ${q(A.detour, 0.9).toFixed(2)}x   mean ${mean(A.detour).toFixed(2)}x`);
    console.log(`     (her whole-leg odometer is 1.06x of straight; the fleet's realized is 1.95x)`);
    console.log(`\n  ⭐ WEED: CHOSEN OR ARRIVED AT?`);
    console.log(`     mean drag multiplier ALONG THE PLAN   ${mean(A.planMul).toFixed(3)}`);
    console.log(`     mean drag multiplier UNDER THE BOAT   ${mean(A.boatMul).toFixed(3)}`);
    console.log(`     her line, for reference               0.915`);
    console.log(`\n  → plan detour ~1.7x+  => ROUTING: the forest closes the corridors (admission).`);
    console.log(`  → plan detour ~1.1x but realized 1.95x => WANDER: execution, not the map (rule 17).`);
    console.log(`  → plan clean but boat weeded => the weed is arrived at, not chosen.`);
})();

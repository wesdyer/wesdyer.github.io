// IS THE CROSS-TRACK KNEE THE BINDING CONSTRAINT? (2026-08-10)
//
// The avoidance layer is NOT blind to displacement after all — `script.js` ~2093
// already steepens the recovery angle by shrinking the pure-pursuit lookahead:
//     const xtk = Math.sqrt(best);
//     if (xtk > 150) LOOK *= Math.max(0.4, 1 - (xtk - 150) / 400);
// So there IS a restoring force. The question is whether it engages where the
// damage happens. Measured displacement:
//     arctic approach  off-path med 66-97u   (p75 144-202u)
//     redrock bowl     off-path med 86u two seconds before contact
// i.e. the bulk of it sits BELOW the 150u knee, in the band where the correction
// factor is exactly 1.0 and nothing steepens at all.
//
// ⚠️ BUT CO-OCCURRENCE IS NOT CAUSE. Off-path and slowness could both simply be
// products of traffic, in which case moving the knee buys nothing and re-prices a
// working control law for no reason (actions-not-prices is 9-for-9, and 150u is
// NOT orders-of-magnitude wrong — it sits at the p75 of the observed displacement,
// so rule 1's structural-bug exception does NOT apply). This has to be earned.
//
// THE TEST, in xtk bins straddling the knee:
//   1. RECOVERY RATE — d(xtk)/dt while off-path. If the knee binds, boats below
//      150u should drift OUT (positive) or stagnate, and boats above it should
//      close (negative). A discontinuity AT the knee is the signature.
//   2. TIME SPENT — how long boats dwell in each bin. A long dwell just under the
//      knee is the "no restoring force" story made visible.
//   3. SPEED, held against traffic state, so the traffic confound is visible
//      rather than assumed: speed is reported separately for frames WITH and
//      WITHOUT an engaged threat.
//
//   node _xtk_knee.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeDB3');
const BINS = [0, 30, 60, 90, 120, 150, 200, 260, 340, 450, 9999];

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = BINS.map(() => ({ n: 0, t: 0, dxtk: 0, nDrift: 0, reset: 0, resetDrop: 0, v: 0, vThreat: 0, nThreat: 0, vFree: 0, nFree: 0, defl: 0 }));
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, BINS }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const acc = BINS.map(() => ({ n: 0, t: 0, dxtk: 0, nDrift: 0, reset: 0, resetDrop: 0, v: 0, vThreat: 0, nThreat: 0, vFree: 0, nFree: 0, defl: 0 }));
            const DT = 1 / 60, STEP = 6;                 // sample at 10 Hz
            const prev = {};
            let tick = 0;
            const binOf = (x) => { let i = 0; while (i < BINS.length - 1 && x >= BINS[i + 1]) i++; return i; };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                if (++tick % STEP) continue;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg < 1) continue;
                    const c = bo.controller; if (!c) continue;
                    const gp = c.gridPath; if (!gp || gp.length < 2) { delete prev[bo.name]; continue; }
                    let m = Infinity, px = gp[0].x, py = gp[0].y;
                    for (let k = 1; k < gp.length; k++) {
                        const ax = px, ay = py, bx = gp[k].x, by = gp[k].y;
                        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
                        let s = L ? ((bo.x - ax) * dx + (bo.y - ay) * dy) / L : 0;
                        s = Math.max(0, Math.min(1, s));
                        m = Math.min(m, Math.hypot(bo.x - (ax + s * dx), bo.y - (ay + s * dy)));
                        px = bx; py = by;
                    }
                    const v = (bo.speed || 0) * 60;
                    const engaged = !!(c.threatBoat && c.riskState && c.riskState !== 'LOW');
                    const i = binOf(m), a = acc[i];
                    a.n++; a.t += DT * STEP; a.v += v;
                    if (engaged) { a.vThreat += v; a.nThreat++; } else { a.vFree += v; a.nFree++; }
                    if (Math.abs(c.lastAvoidDeviation || 0) > 0.26) a.defl++;
                    const pv = prev[bo.name];
                    // Rate of change of cross-track error, u/s — the restoring force made visible.
                    // ⚠️ THE FILTER HERE WAS A BUG WORTH REMEMBERING. It was
                    // `Math.abs(m - pv) < 200`, which is SYMMETRIC in form but ASYMMETRIC in
                    // effect: the big jumps in this signal are the REPLAN RESETS (a replan is
                    // forced at best > 400*400 and re-anchors the path near the boat), so the
                    // guard silently deleted every recovery event and kept every drift one.
                    // The result was a monotonically positive drift at all scales — an artifact.
                    // Count drift and resets SEPARATELY instead of blending them.
                    if (pv != null) {
                        const d = (m - pv) / (DT * STEP);
                        if (m - pv < -100) { a.reset++; a.resetDrop += (pv - m); }
                        else { a.dxtk += d; a.nDrift++; }
                    }
                    prev[bo.name] = m;
                }
            }
            return acc;
        }, { seed: SEED0 + t, BINS });
        for (let i = 0; i < A.length; i++) for (const k of Object.keys(A[i])) A[i][k] += r[i][k];
        console.log(`seed ${SEED0 + t} done`);
    }
    await b.close();
    const TT = A.reduce((s, a) => s + a.t, 0);
    console.log(`\n=== ${VENUE.toUpperCase()}: THE CROSS-TRACK KNEE AT 150u (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`the correction factor is EXACTLY 1.0 below 150u, and shrinks above it\n`);
    console.log(`xtk bin(u)  share  DRIFT d(xtk)/dt  resets/1000  mean drop | mean u/s | threat | free | defl%`);
    for (let i = 0; i < BINS.length; i++) {
        const a = A[i]; if (!a.n) continue;
        const lo = BINS[i], hi = BINS[i + 1] != null && BINS[i + 1] < 9999 ? BINS[i + 1] : '+';
        const mark = (lo === 150) ? '  <-- KNEE' : (lo === 120 ? '  <-- just below' : '');
        console.log(`${String(lo).padStart(4)}-${String(hi).padEnd(5)} ${(100 * a.t / TT).toFixed(1).padStart(6)}% ` +
            `${(a.nDrift ? a.dxtk / a.nDrift : 0).toFixed(2).padStart(14)} ${(1000 * a.reset / a.n).toFixed(1).padStart(12)} ` +
            `${(a.reset ? a.resetDrop / a.reset : 0).toFixed(0).padStart(10)}u |` +
            `${(a.v / a.n).toFixed(0).padStart(8)} |${(a.nThreat ? a.vThreat / a.nThreat : 0).toFixed(0).padStart(7)} |` +
            `${(a.nFree ? a.vFree / a.nFree : 0).toFixed(0).padStart(5)} |` +
            `${(100 * a.defl / a.n).toFixed(0).padStart(5)}%${mark}`);
    }
    console.log(`\n  → d(xtk)/dt POSITIVE below the knee and NEGATIVE above it = the knee binds:`);
    console.log(`    boats drift out where nothing corrects and close once it engages.`);
    console.log(`  → d(xtk)/dt negative on BOTH sides = the restoring force already works and`);
    console.log(`    the knee is NOT the constraint. Do not move it; the off-path is a symptom.`);
    console.log(`  → speed gap similar with and without a threat = displacement costs speed on`);
    console.log(`    its own; gap only "with threat" = it is the traffic, not the displacement.`);
})();

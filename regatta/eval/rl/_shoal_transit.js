// THE SHOAL CHARGE IS A STEADY-STATE PRICE ON A TRANSIENT EVENT (2026-08-10)
//
// `_lag_truth` found the mismatch the owner predicted: on his leg-2 line the
// shoal field reads 0.43 and the PHYSICS applies 0.43, yet his recorded speed
// goes 95 -> 93 -> 91 u/s across the bar. The charge is real in the model and
// absent in the water.
//
// The mechanism is momentum. `shoalMul` multiplies the TARGET (~12219) and
// `boat.speed` lerps toward it at 1 - 0.9982^60 ~= 10%/s decelerating (~9s
// constant, ~5.5s accelerating). A bar 150u wide crossed at 100 u/s is a 1.5s
// event, so the speed moves ~14% of the way to the reduced target and recovers
// on the far side. The router, meanwhile, charges `1/shoalMul` per cell as a
// TIME cost — the steady-state answer, correct only for a boat that lives on
// the bar long enough to reach equilibrium.
//
// This measures the gap directly, by simulating the speed ODE along a track:
//   CHARGED   = integral ds / shoalMul(s)              <- what A* adds up
//   TRUE      = integral ds / v(s), v from the actual lerp with the same field
// and reports them per crossing, against crossing DURATION, so the size of the
// error can be read as a function of how long the boat is actually on the bar.
//
// A steady-state price is right for a long transit and wrong for a short one;
// the question this answers is where lagoon's actually sit.
//
// usage: node _shoal_transit.js [venue] [tree] [fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'lagoon';
const ROOT = path.join(__dirname, process.argv[3] || 'treeGF2B');
const FP = (process.argv[4] || '').startsWith('fp=') ? process.argv[4].slice(3).split(',') : null;

const laps = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FP && !FP.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1);
    if (S.length < 20) continue;
    laps.push({ file: f.slice(5, -5), pts: S.map(s => [gi(s, 'x'), gi(s, 'y'), gi(s, 't'), gi(s, 'spd') * 60, gi(s, 'leg')]) });
}

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const out = await p.evaluate(({ laps }) => {
        window.evalHarness.seed = 7300; window.resetGame(); window.startRace(); window.update(1 / 60);
        const shoals = (state.course.islands || []).filter(i => i.awash);
        const mulAt = (x, y) => window.VenueDoc.shoalField(shoals, x, y);
        const res = [];
        for (const lap of laps) {
            // walk the recorded track; find contiguous runs with mul < 0.99
            const runs = []; let cur = null;
            let chargedTot = 0, distTot = 0;
            for (let i = 1; i < lap.pts.length; i++) {
                const [x0, y0, t0, s0, lg] = lap.pts[i - 1];
                const [x1, y1, t1] = lap.pts[i];
                const d = Math.hypot(x1 - x0, y1 - y0), dt = t1 - t0;
                if (d <= 0 || dt <= 0 || dt > 2) { cur = null; continue; }
                const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
                const m = mulAt(mx, my);
                distTot += d; chargedTot += d / m;
                if (m < 0.99) {
                    if (!cur) { cur = { leg: lg, d: 0, dt: 0, mMin: 1, mSum: 0, n: 0, vIn: s0, vMin: s0 }; runs.push(cur); }
                    cur.d += d; cur.dt += dt; cur.n++; cur.mSum += m;
                    if (m < cur.mMin) cur.mMin = m;
                    const vNow = lap.pts[i][3];
                    if (vNow < cur.vMin) cur.vMin = vNow;
                    cur.vOut = vNow;
                } else cur = null;
            }
            // simulate the speed ODE along the same track, with and without the field
            const sim = (useField) => {
                let v = lap.pts[0][3] / 60, T = 0;   // game-speed units
                for (let i = 1; i < lap.pts.length; i++) {
                    const [x0, y0, t0] = lap.pts[i - 1];
                    const [x1, y1, t1] = lap.pts[i];
                    const d = Math.hypot(x1 - x0, y1 - y0), dt = t1 - t0;
                    if (d <= 0 || dt <= 0 || dt > 2) continue;
                    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
                    // target: his own recorded speed is the open-water target here
                    const tgtOpen = lap.pts[i][3] / 60;
                    const tgt = useField ? tgtOpen * mulAt(mx, my) : tgtOpen;
                    const steps = Math.max(1, Math.round(dt * 60));
                    for (let s = 0; s < steps; s++) {
                        const acc = tgt > v;
                        const a = 1 - Math.pow(acc ? 0.9970 : 0.9982, 1);
                        v = v * (1 - a) + tgt * a;
                    }
                    T += d / Math.max(1e-6, v * 60);
                }
                return T;
            };
            res.push({ file: lap.file, dist: distTot, charged: chargedTot,
                       simField: sim(true), simOpen: sim(false),
                       runs: runs.filter(r => r.d > 20) });
        }
        return res;
    }, { laps });
    await b.close();

    console.log(`\n=== ${VENUE.toUpperCase()}: STEADY-STATE CHARGE vs TRANSIENT REALITY ===`);
    console.log(`\n"charged" = the router's own currency, integral ds/shoalMul — the steady-state answer.`);
    console.log(`"true"    = the same track with the speed lerp actually simulated.\n`);
    for (const r of out) {
        const chargedX = r.charged / r.dist;
        const trueX = r.simField / r.simOpen;
        console.log(`  ${r.file.slice(0, 20)}  dist ${r.dist.toFixed(0)}u`);
        console.log(`     CHARGED cost ${chargedX.toFixed(2)}x open water   TRUE cost ${trueX.toFixed(2)}x   ⭐ overcharge ${((chargedX / trueX - 1) * 100).toFixed(0)}%`);
        console.log(`     shoal crossings (>20u): ${r.runs.length}`);
        for (const q of r.runs.slice(0, 8)) {
            const charged = q.d / (q.mSum / q.n);
            console.log(`        leg ${q.leg}  ${q.d.toFixed(0).padStart(4)}u in ${q.dt.toFixed(1)}s   mean mul ${(q.mSum / q.n).toFixed(2)}  min ${q.mMin.toFixed(2)}   ` +
                `speed ${q.vIn.toFixed(0)}->${q.vMin.toFixed(0)} u/s (${(100 * (1 - q.vMin / Math.max(1, q.vIn))).toFixed(0)}% lost)   ` +
                `charged as ${(charged / q.d).toFixed(2)}x`);
        }
    }
    console.log(`\n  ⭐ A steady-state price is correct only if the boat is on the bar long enough`);
    console.log(`     to reach equilibrium (~9s decel constant). Compare each crossing's DURATION.`);
})();

// VALIDATE A PHYSICS-DERIVED SHOAL COST AGAINST MEASURED CROSSINGS (2026-08-10)
//
// Owner: "fix the router's pricing, but tie it to how the physics work" — and
// "be super careful that costs match closely real costs". So this does not
// propose a cost and argue for it; it derives one from the physics constants and
// then CHECKS IT against the owner's own recorded speed through every shoal
// crossing in his three fingerprint-verified lagoon laps.
//
// THE DERIVATION. The physics is a first-order lag (~12219):
//     targetGameSpeed = polar * shoalMul
//     speed += (target - speed) * (1 - DECAY^timeScale)
// so with tau = -1/(60*ln DECAY) seconds, a boat entering a bar at open-water
// speed V and running s units into it carries
//     u(s) = m + (1 - m) * exp(-s / (V*tau)),      u = v/V,  m = shoalMul
// and the honest cost of that cell is 1/u(s), NOT today's 1/m. At the edge u=1
// (free), deep inside u->m (today's number), and the crossover length is V*tau.
//
// THREE COSTS PER CROSSING, so the comparison is not self-referential:
//   CHARGED   today's router price, 1/mean(m) over the crossing
//   MODEL     the derived price above, integrated along the crossing
//   ACTUAL    from his RECORDED speed — the ground truth, no model at all
//
// A cost model that matches ACTUAL is worth landing; one that does not is
// another bounding circle. Reported per crossing and pooled.
//
// usage: node _shoal_model.js [venue] [tree] [fp=...]
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
        const DECAY = 0.9982;                       // the physics' decelerating constant
        const TAU = -1 / (60 * Math.log(DECAY));    // seconds
        const rows = [];
        for (const lap of laps) {
            let cur = null;
            for (let i = 1; i < lap.pts.length; i++) {
                const [x0, y0, t0, v0, lg] = lap.pts[i - 1];
                const [x1, y1, t1, v1] = lap.pts[i];
                const d = Math.hypot(x1 - x0, y1 - y0), dt = t1 - t0;
                if (d <= 0 || dt <= 0 || dt > 2) { cur = null; continue; }
                const m = mulAt((x0 + x1) / 2, (y0 + y1) / 2);
                if (m < 0.99) {
                    if (!cur) {
                        cur = { lap: lap.file, leg: lg, s: 0, T: 0, V: v0, vIn: v0,
                                charged: 0, model: 0, mSum: 0, n: 0 };
                        rows.push(cur);
                    }
                    // CHARGED: today's price
                    cur.charged += d / m;
                    // MODEL A: exponential in DISTANCE (the time solution with
                    // t = s/V substituted — assumes she holds V across the bar).
                    const uA = m + (1 - m) * Math.exp(-cur.s / Math.max(1, cur.V * TAU));
                    cur.model += d / uA;
                    // MODEL B: the EXACT distance-domain solution of du/dx=(m-u)/u,
                    //   x = (1-u) - m*ln((u-m)/(1-m)),  inverted by bisection.
                    const x = cur.s / Math.max(1, cur.V * TAU);
                    let lo = m + 1e-6, hi = 1;
                    for (let it = 0; it < 40; it++) {
                        const mid = (lo + hi) * 0.5;
                        const xm = (1 - mid) - m * Math.log((mid - m) / (1 - m));
                        if (xm > x) lo = mid; else hi = mid;
                    }
                    const uB = (lo + hi) * 0.5;
                    cur.modelB = (cur.modelB || 0) + d / uB;
                    cur.s += d; cur.T += dt; cur.mSum += m; cur.n++;
                    cur.vOut = v1;
                } else cur = null;
            }
        }
        return { TAU, rows: rows.filter(r => r.s > 20) };
    }, { laps });
    await b.close();

    console.log(`\n=== ${VENUE.toUpperCase()}: DOES THE DERIVED COST MATCH THE WATER? ===`);
    console.log(`tau (decel) = ${out.TAU.toFixed(2)}s, from the physics' own 0.9982\n`);
    console.log(`  crossing            len    dur    m     |  CHARGED   EXP    EXACT  ACTUAL | charged   exp     exact`);
    let cE = [], mE = [];
    for (const r of out.rows) {
        // ACTUAL: his own time across the bar vs what it would have taken at entry speed
        const actual = r.T / (r.s / r.V);
        const charged = r.charged / r.s;
        const model = r.model / r.s;
        const modelB = (r.modelB || 0) / r.s;
        cE.push(charged / actual - 1); mE.push(model / actual - 1);
        (globalThis.bE = globalThis.bE || []).push(modelB / actual - 1);
        console.log(`  leg ${r.leg}  ${String(r.s.toFixed(0)).padStart(5)}u ${r.T.toFixed(1).padStart(5)}s  ${(r.mSum / r.n).toFixed(2)}  |  ` +
            `${charged.toFixed(2).padStart(6)}  ${model.toFixed(2).padStart(6)}  ${modelB.toFixed(2).padStart(6)}  ${actual.toFixed(2).padStart(6)}  | ` +
            `${((charged / actual - 1) * 100).toFixed(0).padStart(6)}%  ${((model / actual - 1) * 100).toFixed(0).padStart(7)}%  ${((modelB / actual - 1) * 100).toFixed(0).padStart(7)}%`);
    }
    const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const absmean = a => mean(a.map(Math.abs));
    const bE = globalThis.bE || [];
    console.log(`\n  mean |error|:  CHARGED ${(100 * absmean(cE)).toFixed(0)}%   EXP ${(100 * absmean(mE)).toFixed(0)}%   EXACT ${(100 * absmean(bE)).toFixed(0)}%`);
    console.log(`  mean  error :  CHARGED ${(100 * mean(cE)).toFixed(0)}%   EXP ${(100 * mean(mE)).toFixed(0)}%   EXACT ${(100 * mean(bE)).toFixed(0)}%   (+ = overcharging)`);
    console.log(`\n  ⭐ ACTUAL is his recorded time across the bar vs the same distance at his`);
    console.log(`     ENTRY speed — measured, not modelled. The model must beat CHARGED on both.`);
})();

// IS LAGOON LEG 2 THE PLAN OR THE EXECUTION? (2026-08-10)
//
// `_lag_shoal` settled the pricing question: the router's shoal cost is right to
// within 1% of the true graded field, and HER line — straight through the
// deepest water, 47% in shoal at a 0.20 multiplier — is still 46% cheaper in
// seconds than the fleet's way round (4930 vs 7192 open-water-equivalent units).
// So the currency is honest and the fleet is still paying too much.
//
// That leaves two very different faults, and they want opposite fixes:
//   * THE PLAN — `pathSailable` itself returns the long way, because some OTHER
//     grid weight (wall standoff, narrow, lee, corridor) outvotes a shoal cost
//     that is only ~2.2x, or because the gap is not on the graph at all.
//   * THE EXECUTION — the plan goes straight and the boats do not follow it,
//     which is the redrock lesson (the grid accepted 96% of her line there and
//     the fleet still would not sail it).
//
// So ask the router directly, over the same endpoints, and compare three things:
// the A* path it returns, HER track, and where the fleet actually went. Also
// walk her own line cell by cell and report what the grid says about it —
// blocked, or merely expensive, and expensive because of WHAT.
//
// usage: node _lag_plan.js [venue] [leg] [tree] [fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'lagoon';
const LEG = parseInt(process.argv[3] !== undefined ? process.argv[3] : 2);
const ROOT = path.join(__dirname, process.argv[4] || 'treeGF2B');
const FP = (process.argv[5] || '').startsWith('fp=') ? process.argv[5].slice(3).split(',') : null;

const laps = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FP && !FP.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (S.length < 5) continue;
    laps.push(S.map(s => [gi(s, 'x'), gi(s, 'y')]));
}

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const out = await p.evaluate(({ laps, LEG }) => {
        window.evalHarness.seed = 7300; window.resetGame(); window.startRace(); window.update(1 / 60);
        const g = state.course.botGrid;
        const leg = state.course.dmc.legs[LEG];
        const A = leg.pts[0], B = leg.pts[leg.pts.length - 1];
        const shoals = (state.course.islands || []).filter(i => i.awash);

        // 1. what does the router return over the same endpoints?
        // ⚠️ pathSailable returns a PLAIN ARRAY OF WORLD COORDS, not {path}. An
        // earlier version of this probe read `sail.path`, got undefined, and
        // reported "no path found" for a route that exists — rule 18.
        const sail = window.SailCheck.pathSailable(g, [A.x, A.y], [B.x, B.y]);
        let planLen = 0; const planPts = [];
        if (Array.isArray(sail)) {
            for (const w of sail) planPts.push([w[0], w[1]]);
            for (let i = 1; i < planPts.length; i++)
                planLen += Math.hypot(planPts[i][0] - planPts[i - 1][0], planPts[i][1] - planPts[i - 1][1]);
        }

        // 2. walk HER line cell by cell: is any of it off the graph?
        const walk = (pts) => {
            let n = 0, blocked = 0, soft = 0, shoalCells = 0, minClear = 99;
            const seen = new Set();
            for (let i = 1; i < pts.length; i++) {
                const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
                const d = Math.hypot(x1 - x0, y1 - y0);
                if (d <= 0 || d > 400) continue;
                const steps = Math.max(1, Math.ceil(d / 10));
                for (let s = 0; s < steps; s++) {
                    const f = (s + 0.5) / steps;
                    const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
                    const c = g.cell(x, y); const id = c[1] * g.n + c[0];
                    if (seen.has(id)) continue;
                    seen.add(id); n++;
                    if (!g.at(c[0], c[1])) blocked++;
                    if (g._soft && g._soft[id]) soft++;
                    if (g._shoal && g._shoal[id] > 1.01) shoalCells++;
                    if (g._clear) minClear = Math.min(minClear, g._clear[id]);
                }
            }
            return { n, blocked, soft, shoalCells, minClear };
        };

        return {
            straight: Math.hypot(B.x - A.x, B.y - A.y),
            planLen, planFound: Array.isArray(sail) && sail.length > 0,
            planCost: null,
            herWalk: laps.map(l => walk(l)),
            planWalk: planPts.length ? walk(planPts) : null,
            A: [Math.round(A.x), Math.round(A.y)], B: [Math.round(B.x), Math.round(B.y)],
            gridRes: g.res, hasSoft: !!g._soft, hasShoal: !!g._shoal,
            // 3. sample the plan's own shoal exposure
            planShoal: (() => {
                if (!planPts.length) return null;
                let dist = 0, t = 0;
                for (let i = 1; i < planPts.length; i++) {
                    const d = Math.hypot(planPts[i][0] - planPts[i - 1][0], planPts[i][1] - planPts[i - 1][1]);
                    const mx = (planPts[i][0] + planPts[i - 1][0]) / 2, my = (planPts[i][1] + planPts[i - 1][1]) / 2;
                    const m = window.VenueDoc.shoalField(shoals, mx, my);
                    dist += d; t += d / m;
                }
                return { dist, cost: t / dist, eff: t };
            })(),
        };
    }, { laps, LEG });
    await b.close();

    console.log(`\n=== ${VENUE.toUpperCase()} LEG ${LEG}: PLAN vs EXECUTION ===`);
    console.log(`leg ${JSON.stringify(out.A)} -> ${JSON.stringify(out.B)}, straight-line ${out.straight.toFixed(0)}u, grid res ${out.gridRes}u`);
    console.log(`\n  THE ROUTER'S OWN ANSWER (pathSailable over the same endpoints)`);
    console.log(`    path found: ${out.planFound}   length ${out.planLen.toFixed(0)}u = ${(out.planLen / out.straight).toFixed(2)}x straight   cost ${out.planCost != null ? out.planCost.toFixed(0) : '-'}`);
    if (out.planShoal) console.log(`    the plan's own shoal exposure: drag ${out.planShoal.cost.toFixed(2)}x, effective ${out.planShoal.eff.toFixed(0)}u-equivalent`);
    console.log(`\n  IS HER LINE ON THE GRAPH?`);
    for (const w of out.herWalk)
        console.log(`    ${w.n} cells:  BLOCKED ${w.blocked} (${(100 * w.blocked / w.n).toFixed(1)}%)   soft ${w.soft}   shoal-taxed ${w.shoalCells} (${(100 * w.shoalCells / w.n).toFixed(0)}%)   min clearance ${w.minClear}`);
    if (out.planWalk) console.log(`    plan: ${out.planWalk.n} cells, blocked ${out.planWalk.blocked}, shoal-taxed ${out.planWalk.shoalCells} (${(100 * out.planWalk.shoalCells / out.planWalk.n).toFixed(0)}%)`);
    console.log(`\n  => plan ~= straight  => the ROUTER is right and the boats are not following it (EXECUTION).`);
    console.log(`  => plan ~= the fleet's 4500u => the ROUTER is choosing the long way (PLAN).`);
})();

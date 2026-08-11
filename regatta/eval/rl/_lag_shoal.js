// DOES THE ROUTER PRICE THE SHOAL SHE ACTUALLY SAILS? (2026-08-10, lagoon leg 2)
//
// Owner's steer, and both halves were right: leg 2 is a ROUTE difference (she
// sails 2213u on a 2220u straight line = 1.00x, the fleet sails 4500u = 2.03x,
// +2287u ~= 23 s/boat, which is essentially the whole 37.9 s/boat leg gap), and
// the shoal cost is NOT uniform. `shoalMulAt` grades it:
//     t = min(1, dist_to_edge / feather);  mul = 1 - (1-shoalMul)*smoothstep(t)
// so the RIM is free (mul 1.0) and only water more than `feather` (120u) inside
// the ring pays the full rate. Lagoon's 8 `tropicshoal` shapes are drag 0.80,
// i.e. mul 0.20 — a 5x time cost at depth, and nothing at the edge.
//
// The router prices this at ONE NUMBER PER CELL: `_shoal[nid] = 1/shoalField(cell
// centre)` (~21018), multiplied into the base time cost. That is exact for a
// path through the cell centre and wrong for any other path — and a boat
// skirting a rim is precisely the "any other path" case. So:
//
//   TRUE cost of her line     = integral of ds / mul(s) along her actual track
//   ROUTER's charge for it    = the same integral using each cell's CENTRE value
//
// If the router's charge is much larger than the truth, it is refusing a line
// that is cheap in the water she sails, and the 2287u detour is the consequence.
// Reported for her track, for the fleet's, and for the straight rhumb line.
//
// usage: node _lag_shoal.js [venue] [leg] [trials] [seed0] [tree] [fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'lagoon';
const LEG = parseInt(process.argv[3] !== undefined ? process.argv[3] : 2);
const TRIALS = parseInt(process.argv[4]) || 6;
const SEED0 = parseInt(process.argv[5]) || 7300;
const ROOT = path.join(__dirname, process.argv[6] || 'treeGF2B');
const FP = (process.argv[7] || '').startsWith('fp=') ? process.argv[7].slice(3).split(',') : null;

const laps = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FP && !FP.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (S.length < 5) continue;
    laps.push({ file: f.slice(5, -5), pts: S.map(s => [gi(s, 'x'), gi(s, 'y')]) });
}

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    // 1. fleet tracks on this leg
    const fleet = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const tr = {};
            for (let it = 0; it < 60 * 900; it++) {
                window.update(1 / 60);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                if (it % 6) continue;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg !== LEG) continue;
                    (tr[bo.name] || (tr[bo.name] = [])).push([Math.round(bo.x), Math.round(bo.y)]);
                }
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return Object.values(tr).filter(a => a.length > 3);
        }, { seed: SEED0 + t, LEG });
        for (const q of r) fleet.push(q);
    }

    // 2. price every track two ways, in the page (needs the compiled course)
    const out = await p.evaluate(({ laps, fleet, LEG }) => {
        window.evalHarness.seed = 7300; window.resetGame(); window.startRace(); window.update(1 / 60);
        const g = state.course.botGrid;
        const shoals = (state.course.islands || []).filter(i => i.awash);
        const trueMul = (x, y) => window.VenueDoc.shoalField(shoals, x, y);
        const cellMul = (x, y) => {
            if (!g || !g._shoal) return 1;
            const c = g.cell(x, y);
            const id = c[1] * g.n + c[0];
            const v = g._shoal[id];
            return v ? 1 / v : 1;   // _shoal stores the RECIPROCAL
        };
        // integrate ds/mul along a polyline, at 5u steps so the grading is resolved
        const price = (pts) => {
            let dist = 0, tTrue = 0, tCell = 0, inShoal = 0, worst = 1;
            for (let i = 1; i < pts.length; i++) {
                const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
                const d = Math.hypot(x1 - x0, y1 - y0);
                if (d <= 0 || d > 400) continue;    // skip lap seams
                const n = Math.max(1, Math.ceil(d / 5));
                for (let s = 0; s < n; s++) {
                    const f = (s + 0.5) / n;
                    const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
                    const ds = d / n;
                    const mt = trueMul(x, y), mc = cellMul(x, y);
                    dist += ds; tTrue += ds / mt; tCell += ds / mc;
                    if (mt < 0.999) inShoal += ds;
                    if (mt < worst) worst = mt;
                }
            }
            return { dist, tTrue, tCell, inShoal, worst };
        };
        const leg = state.course.dmc.legs[LEG];
        const A = leg.pts[0], B = leg.pts[leg.pts.length - 1];
        return {
            her: laps.map(l => ({ file: l.file, ...price(l.pts) })),
            fleet: fleet.map(f => price(f)),
            rhumb: price([[A.x, A.y], [B.x, B.y]]),
            hasShoalLayer: !!(g && g._shoal),
            gridRes: g ? g.res : null,
        };
    }, { laps, fleet, LEG });
    await b.close();

    const med = (a) => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : NaN;
    const R = (o) => `dist ${o.dist.toFixed(0).padStart(5)}u  in-shoal ${(100 * o.inShoal / o.dist).toFixed(0).padStart(3)}%  ` +
        `worst mul ${o.worst.toFixed(2)}  TRUE cost ${(o.tTrue / o.dist).toFixed(2)}x  ROUTER cost ${(o.tCell / o.dist).toFixed(2)}x  ` +
        `router overcharge ${((o.tCell / o.tTrue - 1) * 100).toFixed(0)}%`;

    console.log(`\n=== ${VENUE.toUpperCase()} LEG ${LEG}: WHAT THE SHOAL ACTUALLY COSTS ===`);
    console.log(`grid res ${out.gridRes}u   shoal layer present: ${out.hasShoalLayer}`);
    console.log(`\n  cost is expressed as a multiple of open-water time for the same distance.`);
    console.log(`\n  RHUMB LINE   ${R(out.rhumb)}`);
    console.log(`\n  HER LAPS`);
    for (const h of out.her) console.log(`    ${h.file.slice(0, 18)}  ${R(h)}`);
    console.log(`\n  THE FLEET (n=${out.fleet.length})`);
    const f = out.fleet;
    console.log(`    median   dist ${med(f.map(o => o.dist)).toFixed(0)}u   in-shoal ${(100 * med(f.map(o => o.inShoal / o.dist))).toFixed(0)}%   TRUE cost ${med(f.map(o => o.tTrue / o.dist)).toFixed(2)}x`);
    const hMed = med(out.her.map(o => o.tTrue));
    const fMed = med(f.map(o => o.tTrue));
    console.log(`\n  ⭐ EFFECTIVE TIME (distance x drag, open-water units):`);
    console.log(`     her    ${hMed.toFixed(0)}u-equivalent`);
    console.log(`     fleet  ${fMed.toFixed(0)}u-equivalent   (${((fMed / hMed - 1) * 100).toFixed(0)}% worse)`);
    console.log(`     => if the fleet's detour were BUYING something, the two would be close.`);
})();

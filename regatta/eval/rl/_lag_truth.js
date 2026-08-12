// DOES THE SHOAL COST THE ROUTER CHARGES EXIST IN THE WATER? (2026-08-10)
//
// Owner's steer: "be super careful that costs match closely real costs" — the
// bounding-circle-for-an-irregular-iceberg failure mode, where the planner
// prices something the physics never charges.
//
// There is already a contradiction in my own numbers, and it has to be resolved
// before anything is built on top of them:
//   * `_lag_shoal` says 47% of HIS leg-2 line is inside shoal water with a worst
//     multiplier of 0.20, which is a 5x time cost.
//   * `_leg_where` says his measured speed through those same subsections never
//     drops below 96 u/s (104/109/117/125/132/142/135/117/100/96), and he sails
//     the leg in 20.3s. At 0.20x he would be doing ~26 u/s and taking ~49s.
// Both cannot be true. Either the field I sampled is not the field the physics
// applies, or the physics does not apply it at all.
//
// So read the ACTUAL chain, in the running game, at points along his own track:
//   1. state.course._hasShoals — the gate the physics checks (~12218). Note it
//      is `awash && shoalMul < 1`, while the ROUTER's `_shoal` layer is built
//      from `filter(i => i.awash)` with NO shoalMul test (~21006). If those two
//      predicates disagree, the router taxes water the boat sails at full speed.
//   2. window.VenueDoc.shoalField(...) — what the field function returns.
//   3. boat.shoalMul after a real update() — what the boat actually got.
//   4. the resulting targetSpeed vs the same boat in open water — the REAL cost.
// and compare against his recorded speed at that same point.
//
// usage: node _lag_truth.js [venue] [tree] [fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'lagoon';
const ROOT = path.join(__dirname, process.argv[3] || 'treeHDP');
const FP = (process.argv[4] || '').startsWith('fp=') ? process.argv[4].slice(3).split(',') : null;

const track = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FP && !FP.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    for (const s of j.samples) {
        if (gi(s, 'phase') !== 1 || gi(s, 'leg') !== 2) continue;
        track.push([gi(s, 'x'), gi(s, 'y'), gi(s, 'spd') * 60]);
    }
    if (track.length) break;   // one lap is enough for a field audit
}

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const out = await p.evaluate(({ track }) => {
        window.evalHarness.seed = 7300; window.resetGame(); window.startRace(); window.update(1 / 60);
        const isl = state.course.islands || [];
        const awash = isl.filter(i => i.awash);
        const routerSet = awash;                                   // what ~21006 uses
        const physicsGate = isl.some(i => i.awash && i.shoalMul < 1);  // what ~20836 uses
        const g = state.course.botGrid;

        // what do the awash shapes actually look like once compiled?
        const shapes = awash.map(i => ({
            id: i.id, shoalMul: i.shoalMul, feather: i.shoalFeather,
            rings: i.shoalRings ? i.shoalRings.length : 0,
            verts: i.vertices ? i.vertices.length : 0,
            r: Math.round(i.radius || 0),
        }));

        // sample along his track
        const rows = [];
        const boat = state.boats.find(x => !x.isPlayer);
        for (let k = 0; k < track.length; k += Math.max(1, Math.floor(track.length / 40))) {
            const [x, y, spd] = track[k];
            const field = window.VenueDoc.shoalField(routerSet, x, y);
            let cellMul = 1;
            if (g && g._shoal) { const c = g.cell(x, y); const v = g._shoal[c[1] * g.n + c[0]]; cellMul = v ? 1 / v : 1; }
            // what the PHYSICS would give a boat standing here
            let physMul = null;
            if (boat) {
                const ox = boat.x, oy = boat.y;
                boat.x = x; boat.y = y;
                physMul = state.course._hasShoals
                    ? window.VenueDoc.shoalField(state.course.islands, boat.x, boat.y) : 1;
                boat.x = ox; boat.y = oy;
            }
            rows.push({ x: Math.round(x), y: Math.round(y), spd: Math.round(spd),
                        field: +field.toFixed(3), cell: +cellMul.toFixed(3), phys: physMul == null ? null : +physMul.toFixed(3) });
        }
        return { hasShoals: state.course._hasShoals, physicsGate, nAwash: awash.length,
                 shapes, rows, hasShoalLayer: !!(g && g._shoal) };
    }, { track });
    await b.close();

    console.log(`\n=== ${VENUE.toUpperCase()}: DOES THE CHARGED SHOAL EXIST IN THE WATER? ===`);
    console.log(`awash shapes ${out.nAwash}   router _shoal layer built: ${out.hasShoalLayer}`);
    console.log(`PHYSICS GATE  state.course._hasShoals = ${out.hasShoals}   (predicate 'awash && shoalMul < 1' = ${out.physicsGate})`);
    console.log(`\n  the compiled awash shapes:`);
    for (const s of out.shapes)
        console.log(`    ${String(s.id).padEnd(9)} shoalMul ${String(s.shoalMul).padEnd(6)} feather ${String(s.feather).padEnd(5)} shoalRings ${s.rings} verts ${s.verts} r ${s.r}`);
    console.log(`\n  ALONG HIS LEG-2 TRACK (his recorded speed vs what each layer thinks the water is):`);
    console.log(`      x       y   his u/s   shoalField   grid cell   physics`);
    let nSlowField = 0, nSlowPhys = 0;
    for (const r of out.rows) {
        console.log(`  ${String(r.x).padStart(6)} ${String(r.y).padStart(7)}    ${String(r.spd).padStart(4)}      ${String(r.field).padStart(6)}     ${String(r.cell).padStart(6)}    ${r.phys}`);
        if (r.field < 0.99) nSlowField++;
        if (r.phys != null && r.phys < 0.99) nSlowPhys++;
    }
    console.log(`\n  samples where the FIELD says shoal: ${nSlowField}/${out.rows.length}`);
    console.log(`  samples where the PHYSICS applies it: ${nSlowPhys}/${out.rows.length}`);
    console.log(`\n  ⭐ if the field says 0.2 and his speed stays >96 u/s, the charge is FICTION.`);
})();

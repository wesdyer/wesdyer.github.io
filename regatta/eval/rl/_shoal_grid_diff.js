// HOW MUCH DOES THE NEW PRICE MOVE THE GRID? (2026-08-10)
//
// Before blaming a bench swing on the cost model, measure the perturbation the
// model actually makes to the router's graph. Two trees, same venue, same seed:
// dump `grid._shoal` from each and compare cell by cell.
//
// A venue whose cells barely move cannot have its route changed by this term,
// so any bench swing there is downstream (execution in the water the route now
// visits) or noise — not pricing. A venue whose cells move a lot is genuinely
// being re-routed and the bench is measuring the re-route.
//
// usage: node _shoal_grid_diff.js <venue> <treeA> <treeB>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'swamp';
const A = path.join(__dirname, process.argv[3] || 'treeGF2B');
const B = path.join(__dirname, process.argv[4] || 'treeSHP2');

const dump = async (root) => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 160)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(root, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(root, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await p.evaluate(() => {
        window.evalHarness.seed = 7300; window.resetGame(); window.startRace(); window.update(1 / 60);
        const g = state.course.botGrid;
        return { n: g.n, res: g.res, shoal: g._shoal ? Array.from(g._shoal) : null };
    });
    await br.close();
    return r;
};

(async () => {
    const a = await dump(A), b = await dump(B);
    console.log(`\n=== ${VENUE.toUpperCase()}: GRID SHOAL COST, ${path.basename(A)} vs ${path.basename(B)} ===`);
    if (!a.shoal || !b.shoal) { console.log(`  one tree has no shoal layer (a:${!!a.shoal} b:${!!b.shoal})`); return; }
    let n = 0, taxedA = 0, taxedB = 0, sumA = 0, sumB = 0, moved = 0;
    let maxA = 0, maxB = 0;
    const buckets = { cheaper: 0, same: 0, dearer: 0 };
    for (let k = 0; k < a.shoal.length; k++) {
        const x = a.shoal[k], y = b.shoal[k];
        if (x > 1.001 || y > 1.001) {
            n++;
            if (x > 1.001) { taxedA++; sumA += x; }
            if (y > 1.001) { taxedB++; sumB += y; }
            if (x > maxA) maxA = x;
            if (y > maxB) maxB = y;
            if (Math.abs(x - y) > 0.02) { moved++; (y < x ? buckets.cheaper++ : buckets.dearer++); }
            else buckets.same++;
        }
    }
    const P = (v, d) => d ? (100 * v / d).toFixed(1) + '%' : '-';
    console.log(`  grid ${a.n}x${a.n} @ ${a.res}u   cells touched by either: ${n}`);
    console.log(`  taxed cells:    ${path.basename(A)} ${taxedA}   ${path.basename(B)} ${taxedB}`);
    console.log(`  mean cost on taxed cells:  ${(sumA / Math.max(1, taxedA)).toFixed(2)}x  ->  ${(sumB / Math.max(1, taxedB)).toFixed(2)}x`);
    console.log(`  max cost:                  ${maxA.toFixed(2)}x  ->  ${maxB.toFixed(2)}x`);
    console.log(`  cells that moved >0.02:    ${moved} (${P(moved, n)})   cheaper ${buckets.cheaper}  dearer ${buckets.dearer}`);
    console.log(`\n  => a small mean move with few cells changed means the ROUTE cannot`);
    console.log(`     have shifted much, and a bench swing is downstream or noise.`);
})();

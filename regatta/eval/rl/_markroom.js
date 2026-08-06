// IS THERE ROOM TO ROUND IT? — free water around every mark on a venue.
//
// A rounding is a circuit of the mark at some radius; if the water at that radius is
// not there, the fleet grinds the shore instead of rounding, and no amount of steering
// fixes it. Reports, per mark: clearance at the mark itself, the largest radius whose
// full circle is navigable, and the arc fraction navigable at the zone radius and at a
// few working radii.
//
//   node _markroom.js <tree> [venue] [seed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeHEAD');
const VENUE = process.argv[3] || 'lake';
const SEED = parseInt(process.argv[4] || '9100');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate((seed) => {
        window.evalHarness.seed = seed;
        window.resetGame();
        const g = state.course.botGrid;
        if (!g) return { err: 'no grid' };
        if (!g._clear && window.SailCheck) g._clear = window.SailCheck.clearanceField(g);
        const out = [];
        const arcFree = (m, R) => {
            let free = 0, n = 72;
            for (let k = 0; k < n; k++) {
                const a = k * 2 * Math.PI / n;
                const c = g.cell(m.x + Math.cos(a) * R, m.y + Math.sin(a) * R);
                if (g.at(c[0], c[1])) free++;
            }
            return free / n;
        };
        for (const m of (state.course.marks || [])) {
            const c = g.cell(m.x, m.y);
            const id = c[1] * g.n + c[0];
            const clr = g._clear ? g._clear[id] : -1;
            let biggestFull = 0;
            for (let R = 40; R <= 600; R += 20) { if (arcFree(m, R) > 0.999) biggestFull = R; else break; }
            out.push({ id: m.id || m.kind, x: Math.round(m.x), y: Math.round(m.y),
                       zone: Math.round(m.zone || 0),
                       navAtMark: !!g.at(c[0], c[1]),
                       clearCells: clr, clearU: clr >= 0 ? Math.round(clr * g.res) : -1,
                       fullCircleTo: biggestFull,
                       arc: [80, 120, 165, 220, 300].map(R => [R, +arcFree(m, R).toFixed(2)]) });
        }
        // route roles, so a rounding mark is distinguishable from a gate mark
        const roles = (state.course.route || []).map(e => ({ kind: e.kind || e.role,
            markId: e.markId || null, marks: e.marks || null, side: e.side || null }));
        return { marks: out, roles, res: g.res };
    }, SEED);
    if (r.err) { console.log(r.err); await browser.close(); return; }
    console.log(`venue=${VENUE}  grid res ${r.res}`);
    for (const m of r.marks) {
        console.log(`  ${String(m.id).padEnd(9)}(${String(m.x).padStart(6)},${String(m.y).padStart(6)})`
            + ` navAtMark ${m.navAtMark ? 'yes' : 'NO '}  clearance ${String(m.clearCells).padStart(3)} cells`
            + ` = ${String(m.clearU).padStart(4)}u   full circle to ${String(m.fullCircleTo).padStart(3)}u`
            + `   arc-free @80/120/165/220/300: ${m.arc.map(a => a[1].toFixed(2)).join(' ')}`);
    }
    console.log('  route: ' + JSON.stringify(r.roles));
    await browser.close();
})();

// WHAT CLEARANCE BAR WOULD ADMIT HER LINE? (2026-08-08 night, SECTION PUSH P3b)
// _riv_grid.js showed 21% of the human's track through river leg 3's dominant pocket
// sits in cells the bot grid calls unnavigable — sailed at 122-125 u/s, and her whole
// lap contains exactly TWO contacts, both in one 0.5 s bank scrape. So the grid's bar
// excludes water the physics allows. The bar is CLEARANCE = HULL_R + 14 = 44 u against
// a 30 u hull (sailcheck.js ~17), and the same file already records this disease once:
// "redrock's north channel exit is 46u clear the whole way through and read as a wall,
// which is why the fleet's route ran the dead-upwind slot the human never sails."
//
// This sizes it: the distance from every one of her leg-3 track samples to the nearest
// land EDGE, so the next push can read straight off what bar admits what share of her
// line — and see whether the two samples she actually hit are separable from the rest.
//   node _riv_bar.js <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeCP1');
const FROZEN_FP = 'f2b03316:36253';
const pts = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_river_'))) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (j.venueFingerprint !== FROZEN_FP) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    for (const s of j.samples) {
        if (gi(s, 'phase') !== 1 || gi(s, 'leg') !== 3) continue;
        pts.push([gi(s, 'x'), gi(s, 'y'), gi(s, 'spd') * 60]);
    }
}
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const d = await page.evaluate(async (pts) => {
        window.evalHarness.seed = 9100;
        window.resetGame(); window.startRace(); window.update(1 / 60);
        // Same geometry the grid rasterises: the non-awash land shapes.
        const shapes = (state.course.landShapes || []).filter(l => l.vertices && l.vertices.length >= 3);
        const segDist = (px, py, a, b) => {
            const vx = b[0] - a[0], vy = b[1] - a[1];
            const wx = px - a[0], wy = py - a[1];
            const L = vx * vx + vy * vy;
            let t = L ? (wx * vx + wy * vy) / L : 0;
            t = Math.max(0, Math.min(1, t));
            return Math.hypot(px - (a[0] + t * vx), py - (a[1] + t * vy));
        };
        return pts.map(([x, y, spd]) => {
            let best = Infinity;
            for (const sh of shapes) {
                const V = sh.vertices;
                for (let i = 0; i < V.length; i++) {
                    const a = V[i], b = V[(i + 1) % V.length];
                    const dd = segDist(x, y, [a.x != null ? a.x : a[0], a.y != null ? a.y : a[1]],
                        [b.x != null ? b.x : b[0], b.y != null ? b.y : b[1]]);
                    if (dd < best) best = dd;
                }
            }
            return [Math.round(best), Math.round(spd)];
        });
    }, pts);
    await browser.close();
    const dist = d.map(x => x[0]).filter(x => isFinite(x));
    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
    console.log(`her leg-3 track: ${dist.length} samples, distance to nearest land edge`);
    console.log(`  min ${Math.min(...dist)}  p1 ${q(dist, 0.01)}  p2 ${q(dist, 0.02)}  p5 ${q(dist, 0.05)}` +
        `  p10 ${q(dist, 0.10)}  p25 ${q(dist, 0.25)}  med ${q(dist, 0.5)}`);
    for (const bar of [30, 34, 38, 40, 44, 50]) {
        const below = dist.filter(x => x < bar).length;
        console.log(`  bar ${String(bar).padStart(2)}u: ${below} samples (${(100 * below / dist.length).toFixed(1)}%) of her line are INSIDE it` +
            (bar === 44 ? '   <= the shipping CLEARANCE' : bar === 30 ? '   <= HULL_R, the physics bar' : ''));
    }
    const slow = d.filter(x => x[1] < 40), fast = d.filter(x => x[1] >= 40);
    console.log(`  her SLOW samples (<40 u/s, n=${slow.length}): min dist ${slow.length ? Math.min(...slow.map(x => x[0])) : '-'}` +
        `  med ${slow.length ? q(slow.map(x => x[0]), 0.5) : '-'}`);
    console.log(`  her FAST samples (n=${fast.length}): min dist ${Math.min(...fast.map(x => x[0]))}  p1 ${q(fast.map(x => x[0]), 0.01)}  p5 ${q(fast.map(x => x[0]), 0.05)}`);
})();

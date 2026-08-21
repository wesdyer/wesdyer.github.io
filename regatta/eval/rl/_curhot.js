// WHERE IS THE 2.3 kt CORNER THAT SPEAKS FOR ALL OF GLOWTIDE? (2026-08-13)
//
// `_curmax.js` found glowtide's `_avCurMax` = 2.31 against a p90 of 1.79 and only
// 0.6% of navigable cells at or over the 2.0 kt knee — and that single scalar
// switches off seven behaviours across the entire map. This asks the follow-up the
// landing argument needs: WHERE is that water, and does anybody race through it?
//
// Prints every navigable cell at >= 2.0 kt, clustered, with each cluster's distance
// to the nearest course leg (marks/gates in route order) — and the same for river,
// where the gate is correct, as the contrast.
//   node _curhot.js [tree] [venue ...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeGLB');
const VENUES = process.argv.slice(3).length ? process.argv.slice(3) : ['glowtide', 'river'];
(async () => {
    const br = await chromium.launch();
    for (const V of VENUES) {
        const p = await br.newPage();
        p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
        await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, V);
        await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        const r = await p.evaluate(() => {
            window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
            for (let i = 0; i < 120; i++) window.update(1 / 60);
            const g = state.course.botGrid;
            const hot = [], all = [];
            for (let y = 0; y < g.n; y += 4) for (let x = 0; x < g.n; x += 4) {
                if (!g.at(x, y)) continue;
                const wx = g.x0 + (x + 0.5) * g.res, wy = g.y0 + (y + 0.5) * g.res;
                const c = getCurrentAt(wx, wy);
                const s = c ? c.speed : 0;
                all.push({ wx, wy, s });
                if (s >= 2.0) hot.push({ wx, wy, s: +s.toFixed(2) });
            }
            // the course as a polyline of route targets, in order
            const pts = [];
            for (const leg of (state.course.route || [])) {
                const t = leg.mark || leg.gate || null;
                if (t && t.x != null) pts.push({ x: t.x, y: t.y });
                else if (leg.marks && leg.marks.length) pts.push({ x: (leg.marks[0].x + leg.marks[1].x) / 2, y: (leg.marks[0].y + leg.marks[1].y) / 2 });
            }
            if (!pts.length) for (const m of (state.course.marks || [])) pts.push({ x: m.x, y: m.y });
            const segDist = (px, py) => {
                let best = 1e18;
                for (let i = 0; i + 1 < pts.length; i++) {
                    const ax = pts[i].x, ay = pts[i].y, bx = pts[i + 1].x, by = pts[i + 1].y;
                    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
                    let t = ((px - ax) * vx + (py - ay) * vy) / L2; t = Math.max(0, Math.min(1, t));
                    const d = Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
                    if (d < best) best = d;
                }
                return best;
            };
            // crude clustering: 400u grid buckets
            const cl = {};
            for (const h of hot) {
                const k = Math.round(h.wx / 400) + ',' + Math.round(h.wy / 400);
                (cl[k] = cl[k] || []).push(h);
            }
            const clusters = Object.keys(cl).map(k => {
                const a = cl[k];
                const mx = a.reduce((s, v) => s + v.wx, 0) / a.length, my = a.reduce((s, v) => s + v.wy, 0) / a.length;
                return { n: a.length, x: Math.round(mx), y: Math.round(my), max: Math.max(...a.map(v => v.s)), toRoute: Math.round(segDist(mx, my)) };
            }).sort((a, b) => b.n - a.n);
            // how much of the ROUTE ITSELF is over 2.0 kt?
            let onRoute = 0, onRouteHot = 0;
            for (let i = 0; i + 1 < pts.length; i++) {
                const ax = pts[i].x, ay = pts[i].y, bx = pts[i + 1].x, by = pts[i + 1].y;
                const L = Math.hypot(bx - ax, by - ay);
                for (let d = 0; d < L; d += 50) {
                    const t = d / L, px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
                    const c = getCurrentAt(px, py); onRoute++;
                    if (c && c.speed >= 2.0) onRouteHot++;
                }
            }
            return { nav: all.length, hot: hot.length, clusters: clusters.slice(0, 8), onRoute, onRouteHot, marks: pts.length };
        });
        await p.close();
        console.log(`\n=== ${V} ===  navigable sampled ${r.nav}   cells >= 2.0 kt: ${r.hot} (${(100 * r.hot / r.nav).toFixed(2)}%)`);
        console.log(`  the RHUMB-LINE COURSE itself (${r.marks} route points, 50u steps): ${r.onRouteHot}/${r.onRoute} samples >= 2.0 kt = ${(100 * r.onRouteHot / Math.max(1, r.onRoute)).toFixed(1)}%`);
        for (const c of r.clusters)
            console.log(`   cluster n=${String(c.n).padStart(4)} at (${String(c.x).padStart(6)},${String(c.y).padStart(6)})  max ${c.max.toFixed(2)} kt   ${c.toRoute}u from the nearest leg`);
    }
    await br.close();
})();

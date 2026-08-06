// PRICE A ROUTE IN SECONDS, not units — and do it for whatever tree you point at, so
// two routers can be compared before a bench is spent on them.
//
// For each leg of the course, plans with SailCheck.pathSailable on the bots' own grid
// and integrates the polar along the result: at each step, the best speed the boat can
// make good toward that step's bearing in THAT step's wind. Reports length, that time,
// and how much of the path lies in water under 4 kt.
//
//   node _route_wind.js <tree> [venue] [seed]
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
        // Leg endpoints, from the compiled course: gate mid / mark / gate mid.
        const dmc = state.course.dmc;
        const pts = [];
        for (let li = 1; li < dmc.legs.length; li++) {
            const lp = dmc.legs[li].pts;
            if (!lp || !lp.length) continue;
            if (!pts.length) pts.push({ x: lp[0].x, y: lp[0].y });
            pts.push({ x: lp[lp.length - 1].x, y: lp[lp.length - 1].y });
        }
        // Time along a polyline, integrating the polar in each step's own wind.
        const timeOf = (poly) => {
            let len = 0, t = 0, calm = 0;
            for (let k = 1; k < poly.length; k++) {
                const dx = poly[k].x - poly[k - 1].x, dy = poly[k].y - poly[k - 1].y;
                const d = Math.hypot(dx, dy);
                if (d < 1e-6) continue;
                const bearing = Math.atan2(dx, -dy);
                const mx = (poly[k].x + poly[k - 1].x) / 2, my = (poly[k].y + poly[k - 1].y) / 2;
                const w = getWindAt(mx, my);
                let best = 0.05;
                for (let twa = 25; twa <= 180; twa += 5) {
                    const tr = twa * Math.PI / 180;
                    const v = getTargetSpeed(tr, twa > 95, w.speed);
                    for (const sgn of [1, -1]) {
                        const toward = Math.cos((w.direction + sgn * tr) - bearing) * v;
                        if (toward > best) best = toward;
                    }
                }
                // knots -> world units/sec: the sim runs 1 kt = 0.25 units/frame at 60fps
                const ups = best * 0.25 * 60;
                len += d; t += d / ups;
                if (w.speed < 4) calm += d;
            }
            return { len: Math.round(len), t: +t.toFixed(1), calmPct: +(100 * calm / Math.max(1, len)).toFixed(1) };
        };
        const out = { legs: [] };
        let totT = 0, totL = 0;
        for (let i = 1; i < pts.length; i++) {
            const seg = window.SailCheck.pathSailable(g, [pts[i - 1].x, pts[i - 1].y], [pts[i].x, pts[i].y]);
            if (!seg) { out.legs.push({ leg: i, err: 'no path' }); continue; }
            const poly = seg.map(q => ({ x: q[0], y: q[1] }));
            const m = timeOf(poly);
            const straight = timeOf([pts[i - 1], pts[i]]);
            out.legs.push({ leg: i, routeLen: m.len, routeT: m.t, routeCalmPct: m.calmPct,
                            straightLen: straight.len, straightT: straight.t, straightCalmPct: straight.calmPct });
            totT += m.t; totL += m.len;
        }
        out.totalRouteT = +totT.toFixed(1);
        out.totalRouteLen = totL;
        return out;
    }, SEED);
    console.log(JSON.stringify(r));
    await browser.close();
})();

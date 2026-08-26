// THE LANE QUESTION (2026-08-25, the swamp push). His fast laps (194-220s)
// sail 600-1300u off the planned line, nearly weed-free; his slow laps hug it
// and pay 20-34% weed time. Does the router's OWN cost model already prefer
// his lane (a search/cap problem), or does it genuinely price the weed alley
// cheaper (a pricing gap = S1's opening)?
//
// Model cost of a polyline: sum ds / (VMG_toward(bearing, cell wind) * u),
// u = 1/grid._shoal (the router's own transit-honest speed fraction). Same
// arithmetic for: (a) pathSailable's chosen leg-1 line, (b) his fast lap
// tracks, (c) pathSailable re-run with a SCATTER-AWARE _shoal (worst mul
// within R of the cell, R = measured execution scatter) — does the route
// flip to his lane, and at what modeled cost?
//   node _sw_lane.js [tree] [R]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeSW0');
const RADIUS = parseInt(process.argv[3] || '100');
(async () => {
    const files = fs.readdirSync(path.join(__dirname, 'traj')).filter(f => f.startsWith('traj_swamp'));
    const laps = files.map(f => ({ f, j: JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f))) }));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'swamp' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const out = await page.evaluate(({ laps, RADIUS }) => {
        window.evalHarness.seed = 12345;
        window.resetGame(); window.startRace();
        const g = state.course.botGrid;
        const N = g.n;
        const L1 = state.course.dmc.legs[1];
        const a0 = L1.pts[0], b0 = L1.pts[L1.pts.length - 1];
        const mulAt = (x, y) => window.VenueDoc.shoalField(state.course.islands, x, y);
        // VMG toward a bearing in this cell's MEAN wind (same field the bake uses)
        const vmgTo = (x, y, brg) => {
            const w = getWindAt(x, y);
            let best = 0.05;
            for (let k = 0; k < 32; k++) {
                const h = k / 32 * Math.PI * 2;
                const twa = Math.abs((((h - w.direction) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
                const twaDeg = twa * 57.3;
                const kts = getTargetSpeed(twa, twaDeg > 90, w.speed);
                const v = kts * 15 * Math.cos(h - brg); // u/s toward brg (rule 31: u/s = kt*15)
                if (v > best) best = v;
            }
            return best;
        };
        const uAt = (x, y) => {
            const c = g.cell(x, y); const id = c[1] * N + c[0];
            return g._shoal ? 1 / g._shoal[id] : 1;
        };
        const costPoly = (pts) => {
            let T = 0, D = 0, weedD = 0;
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i + 1];
                const d = Math.hypot(b.x - a.x, b.y - a.y);
                if (d < 1) continue;
                const n = Math.max(1, Math.ceil(d / 50));
                const brg = Math.atan2(b.x - a.x, -(b.y - a.y));
                for (let k = 0; k < n; k++) {
                    const x = a.x + (b.x - a.x) * (k + 0.5) / n, y = a.y + (b.y - a.y) * (k + 0.5) / n;
                    const ds = d / n;
                    T += ds / (vmgTo(x, y, brg) * uAt(x, y));
                    D += ds;
                    if (mulAt(x, y) < 0.7) weedD += ds;
                }
            }
            return { T: +T.toFixed(1), D: Math.round(D), weedPct: +(100 * weedD / Math.max(1, D)).toFixed(1) };
        };
        const res = {};
        // (a) the router's own choice
        const seg = window.SailCheck.pathSailable(g, [a0.x, a0.y], [b0.x, b0.y]);
        const segPts = seg.map(p => ({ x: p[0], y: p[1] }));
        res.router = costPoly(segPts);
        res.routerPath = segPts.filter((_, i) => !(i % 4));
        // (b) his lap leg-1 tracks (thinned to 1 sample/2s)
        res.him = [];
        for (const { f, j } of laps) {
            const pts = [];
            for (const s of j.samples) if (s[8] === 1) pts.push({ x: s[2], y: s[3] });
            const thin = pts.filter((_, i) => !(i % 20));
            if (thin.length < 5) continue;
            // his real leg-1 time
            let t0 = null, t1 = null, base = null;
            for (const s of j.samples) {
                if (s[8] === 1 && t0 == null) t0 = s[0];
                if (s[8] === 2 && t1 == null) t1 = s[0];
            }
            res.him.push({ fin: Math.round(j.finishTime), model: costPoly(thin),
                           real: (t0 != null && t1 != null) ? +(t1 - t0).toFixed(0) : null });
        }
        // (c) scatter-aware shoal: worst mul within RADIUS, transit formula kept
        //     crude (steady-state 1/minMul) — this is a FEASIBILITY probe, and
        //     steady-state OVER-prices, so if the route still doesn't flip the
        //     honest version won't either; if it flips, build the honest one.
        const old = g._shoal;
        const sc2 = new Float32Array(N * N);
        const span = Math.ceil(RADIUS / g.res);
        for (let j2 = 0; j2 < N; j2++) for (let i2 = 0; i2 < N; i2++) {
            const id = j2 * N + i2;
            let worst = old ? 1 / old[id] : 1;
            for (let dj = -span; dj <= span; dj++) for (let di = -span; di <= span; di++) {
                if (di * di + dj * dj > span * span) continue;
                const a = i2 + di, b = j2 + dj;
                if (a < 0 || b < 0 || a >= N || b >= N) continue;
                if (old) worst = Math.min(worst, 1 / old[b * N + a]);
            }
            sc2[id] = 1 / Math.max(0.05, worst);
        }
        g._shoal = sc2;
        const seg2 = window.SailCheck.pathSailable(g, [a0.x, a0.y], [b0.x, b0.y]);
        g._shoal = old;
        const seg2Pts = seg2 ? seg2.map(p => ({ x: p[0], y: p[1] })) : null;
        if (seg2Pts) {
            res.scatterRoute = costPoly(seg2Pts);   // costed under the ORIGINAL field
            res.scatterPath = seg2Pts.filter((_, i) => !(i % 4));
            // lateral distance between the two routes
            let mx = 0;
            for (const p of seg2Pts) {
                let bd = Infinity;
                for (const q of segPts) bd = Math.min(bd, Math.hypot(p.x - q.x, p.y - q.y));
                mx = Math.max(mx, bd);
            }
            res.routeShift = Math.round(mx);
        }
        return res;
    }, { laps, RADIUS });
    console.log(`ROUTER line   : model ${out.router.T}s  dist ${out.router.D}u  weed ${out.router.weedPct}%`);
    for (const h of out.him) console.log(`HIS lap fin ${h.fin} : model ${h.model.T}s  dist ${h.model.D}u  weed ${h.model.weedPct}%  REAL leg1 ${h.real}s`);
    if (out.scatterRoute) console.log(`SCATTER(R=${RADIUS}) route: model ${out.scatterRoute.T}s  dist ${out.scatterRoute.D}u  weed ${out.scatterRoute.weedPct}%  max shift from router line ${out.routeShift}u`);
    fs.writeFileSync(path.join(__dirname, '_sw_lane.json'), JSON.stringify(out));
    console.log('rows → _sw_lane.json');
    await browser.close();
})();

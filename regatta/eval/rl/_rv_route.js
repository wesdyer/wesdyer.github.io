// RIVER ENTRY PUSH — does the RULER (the DMC leg path every bot follows)
// hug the notch face? (2026-08-26, v2 — v1 sampled controller.planner.plan,
// which is the FLOE visibility planner, empty on river; the grid-venue line
// bots actually follow is state.course.dmc.legs[leg].pts, navigation.js:39.)
// Samples botGrid._clear along each leg's pts at 25u; prints min/p10/med
// clearance and >=50u stretches at clr<=2 with 200u-bin positions, to match
// against the P1 entry clusters (1200,-2800)/(1600,-2000)/(1200,-2600)/
// (1000,-2800).   node _rv_route.js <tree> <venue> <seed>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeRW';
const ROOT = path.join(__dirname, TREE);
const VENUE = process.argv[3] || 'river';
const SEED = parseInt(process.argv[4] || '9400');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
    }, VENUE);
    const out = await page.evaluate((seed) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        const g = state.course.botGrid;
        if (g && !g._clear && window.SailCheck) g._clear = window.SailCheck.clearanceField(g);
        const clrAt = (wx, wy) => {
            const c = g.cell(wx, wy);
            if (c[0] < 0 || c[1] < 0 || c[0] >= g.n || c[1] >= g.n) return 0;
            return g._clear[c[1] * g.n + c[0]];
        };
        const res = { gridKeys: Object.keys(g).filter(k => typeof g[k] !== 'function' && !(g[k] && g[k].length > 100)).map(k => k + '=' + g[k]).slice(0, 12) };
        const legs = (state.course.dmc && state.course.dmc.legs) || [];
        res.legs = {};
        legs.forEach((legObj, leg) => {
            const pts = legObj && legObj.pts;
            if (!pts || pts.length < 2) return;
            const st = { clrs: [], low: [] };
            let lowRun = null;
            for (let i = 0; i + 1 < pts.length; i++) {
                const x1 = pts[i].x != null ? pts[i].x : pts[i][0], y1 = pts[i].y != null ? pts[i].y : pts[i][1];
                const x2 = pts[i + 1].x != null ? pts[i + 1].x : pts[i + 1][0], y2 = pts[i + 1].y != null ? pts[i + 1].y : pts[i + 1][1];
                const L = Math.hypot(x2 - x1, y2 - y1), steps = Math.max(1, Math.round(L / 25));
                for (let s = 0; s <= steps; s++) {
                    const x = x1 + (x2 - x1) * s / steps, y = y1 + (y2 - y1) * s / steps;
                    const cl = clrAt(x, y);
                    st.clrs.push(cl);
                    if (cl <= 2) {
                        if (!lowRun) lowRun = { x0: Math.round(x), y0: Math.round(y), len: 0 };
                        lowRun.len += 25;
                    } else if (lowRun) { if (lowRun.len >= 50) st.low.push(lowRun); lowRun = null; }
                }
            }
            if (lowRun && lowRun.len >= 50) st.low.push(lowRun);
            st.clrs.sort((a, b) => a - b);
            const agg = {};
            for (const r of st.low) { const k2 = `${Math.round(r.x0 / 200) * 200},${Math.round(r.y0 / 200) * 200}`; agg[k2] = Math.max(agg[k2] || 0, r.len); }
            res.legs[leg] = { pts: pts.length, samples: st.clrs.length, minClr: st.clrs[0],
                p10: st.clrs[Math.floor(st.clrs.length * 0.1)], med: st.clrs[st.clrs.length >> 1],
                lowStretches: st.low.length, totalLowLen: st.low.reduce((a, r) => a + r.len, 0),
                lowClusters: Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6) };
        });
        return res;
    }, SEED);
    console.log(`tree ${TREE} venue ${VENUE} seed ${SEED}`);
    console.log('grid:', out.gridKeys.join(' '));
    for (const [leg, r] of Object.entries(out.legs)) {
        console.log(`leg ${leg}: pts ${r.pts} samples ${r.samples}  clr min ${r.minClr} p10 ${r.p10} med ${r.med}  low(<=2) stretches ${r.lowStretches} totalLen ${r.totalLowLen}u  at ${r.lowClusters.map(([k, v]) => `(${k})len${v}`).join(' ')}`);
    }
    await browser.close();
})();

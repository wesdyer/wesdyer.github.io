// RIVER ENTRY PUSH — can the grid route the notch legs at all? (kill-early)
// Leg 3's DMC is a 2-pt chord (SailCheck.pathBetween returned nothing) and
// the finish leg (raceState.leg == route.length) has no DMC entry. Before
// designing a ruler for them: (a) print route[] entries + finish geometry +
// leg semantics, (b) call pathBetween on leg 3's endpoints and on the
// last-anchor -> finish-line pair, (c) segClearGeom on both chords, (d) the
// corridor's tier anatomy (nav/_soft counts) along each chord.
//   node _rv_ruler.js <tree> <venue> <seed>
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
        const res = {};
        res.route = (state.course.route || []).map((e, i) => `leg${i}:${e && e.kind}${e && e.mark ? '@' + Math.round(e.mark.x) + ',' + Math.round(e.mark.y) : ''}`);
        const sl = state.course.startLine || state.course.line || {};
        res.line = JSON.stringify({ x1: Math.round(sl.x1 || 0), y1: Math.round(sl.y1 || 0), x2: Math.round(sl.x2 || 0), y2: Math.round(sl.y2 || 0), dir: sl.dir });
        res.totalLegs = state.course.totalLegs;
        const legs = state.course.dmc.legs;
        res.dmcLens = legs.map(l => l && l.pts ? l.pts.length : null);
        // leg 3 endpoints per the dmc chord
        const l3 = legs[3] && legs[3].pts;
        const probes = [];
        if (l3 && l3.length >= 2) probes.push(['leg3-chord', l3[0], l3[l3.length - 1]]);
        // finish leg: from route[3] anchor to line midpoint
        const lastE = (state.course.route || [])[3];
        const anchor = lastE && (lastE.mark || lastE);
        const mid = { x: ((sl.x1 || 0) + (sl.x2 || 0)) / 2, y: ((sl.y1 || 0) + (sl.y2 || 0)) / 2 };
        if (anchor && anchor.x != null) probes.push(['finish-leg', { x: anchor.x, y: anchor.y }, mid]);
        res.probes = probes.map(([tag, a, b]) => {
            const straight = Math.hypot(b.x - a.x, b.y - a.y);
            const seg = window.SailCheck.pathBetween(g, [a.x, a.y], [b.x, b.y]);
            let L = 0; if (seg) for (let k = 1; k < seg.length; k++) L += Math.hypot(seg[k][0] - seg[k - 1][0], seg[k][1] - seg[k - 1][1]);
            const clearGeom = window.SailCheck.segClearGeom ? window.SailCheck.segClearGeom(g, a.x, a.y, b.x, b.y) : null;
            // chord tier anatomy at 25u
            let nBlocked = 0, nSoft = 0, nTight = 0, nWater = 0, minClr = 99;
            const steps = Math.max(1, Math.round(straight / 25));
            for (let s = 0; s <= steps; s++) {
                const x = a.x + (b.x - a.x) * s / steps, y = a.y + (b.y - a.y) * s / steps;
                const c = g.cell(x, y); const id = c[1] * g.n + c[0];
                const inb = c[0] >= 0 && c[1] >= 0 && c[0] < g.n && c[1] < g.n;
                if (!inb || !g.nav[id]) {
                    nBlocked++;
                    if (inb && g._soft && g._soft[id]) nSoft++;
                    if (inb && g._tight && g._tight[id]) nTight++;
                } else { nWater++; const cl = g._clear[id]; if (cl < minClr) minClr = cl; }
            }
            // path low-clearance anatomy if a path exists
            let pathMin = null, pathMed = null, pathLen = null;
            if (seg && seg.length > 1) {
                const cls = [];
                for (let k = 0; k + 1 < seg.length; k++) {
                    const st2 = Math.max(1, Math.round(Math.hypot(seg[k + 1][0] - seg[k][0], seg[k + 1][1] - seg[k][1]) / 25));
                    for (let s = 0; s <= st2; s++) {
                        const x = seg[k][0] + (seg[k + 1][0] - seg[k][0]) * s / st2;
                        const y = seg[k][1] + (seg[k + 1][1] - seg[k][1]) * s / st2;
                        const c = g.cell(x, y);
                        if (c[0] >= 0 && c[1] >= 0 && c[0] < g.n && c[1] < g.n) cls.push(g._clear[c[1] * g.n + c[0]]);
                    }
                }
                cls.sort((x, y) => x - y);
                pathMin = cls[0]; pathMed = cls[cls.length >> 1]; pathLen = Math.round(L);
            }
            return { tag, a: `${Math.round(a.x)},${Math.round(a.y)}`, b: `${Math.round(b.x)},${Math.round(b.y)}`,
                straight: Math.round(straight), pathPts: seg ? seg.length : null, pathLen, pathMin, pathMed,
                clearGeom, chord: { nWater, nBlocked, nSoft, nTight, minClr: nWater ? minClr : null } };
        });
        return res;
    }, SEED);
    console.log(`tree ${TREE} venue ${VENUE} seed ${SEED}  totalLegs ${out.totalLegs}`);
    console.log('route:', out.route.join('  '));
    console.log('finish line:', out.line, ' dmc pts per leg:', JSON.stringify(out.dmcLens));
    for (const p of out.probes) console.log(JSON.stringify(p));
    await browser.close();
})();
// (v2 appendix executed separately — see _rv_sail.js)

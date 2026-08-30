// SAVED vs ROUTED COURSE PATHS (2026-08-30, the paths intake). The owner saved
// `course.paths` into every venue doc from the editor, and buildCoursePaths now
// PREFERS them over routing at load. The bots' carrot (`state.course.dmc`) is
// therefore the editor's polyline, not the router's. This asks, per venue: are
// they the same polylines? Loads the tree's page on the venue, takes the dmc the
// game built (saved), then routes the same course with CoursePath.build on the
// same grid and compares leg by leg (point count, length, max point distance).
//   node _pa_paths_eq.js <tree> [venue ...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treePA');
const VENUES = process.argv.slice(3).length ? process.argv.slice(3)
    : ['seatrials','ocean','bay','lake','lagoon','river','swamp','glowtide','redrock','arctic'];
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    for (const v of VENUES) {
        await page.evaluate((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, v);
        const r = await page.evaluate(async () => {
            window.evalHarness.seed = 9400;
            window.resetGame(); window.startRace();
            const saved = state.course.dmc;
            const grid = state.course._botGridStatic || null;
            let routed = null, err = null;
            try {
                routed = CoursePath.build(state.course.marks, state.course.route,
                    state.course.islands || [], state._dmcPlanner || new RoutePlanner(),
                    'dmc-probe', grid);
            } catch (e) { err = String(e); }
            const out = { venue: settings.venue, savedFlag: !!(saved && saved.saved), legs: [], err,
                          savedTotal: saved && saved.total, routedTotal: routed && routed.total };
            if (saved && routed) for (let k = 0; k < Math.max(saved.legs.length, routed.legs.length); k++) {
                const a = saved.legs[k], b = routed.legs[k];
                if (!a || !b) { out.legs.push({ k, missing: true }); continue; }
                if (!a.pts.length || !b.pts.length) { out.legs.push({ k, nA: a.pts.length, nB: b.pts.length, lenA: 0, lenB: 0, maxd: 0 }); continue; }
                let maxd = 0;
                const n = Math.max(a.pts.length, b.pts.length);
                // sample both polylines at 50 equal fractions of their own length
                const at = (L, f) => { const s = f * L.length; let i = 1; while (i < L.cum.length && L.cum[i] < s) i++;
                    if (i >= L.cum.length) return L.pts[L.pts.length - 1];
                    const t = (s - L.cum[i - 1]) / Math.max(1e-9, L.cum[i] - L.cum[i - 1]);
                    return { x: L.pts[i - 1].x + (L.pts[i].x - L.pts[i - 1].x) * t, y: L.pts[i - 1].y + (L.pts[i].y - L.pts[i - 1].y) * t }; };
                for (let s = 0; s <= 50; s++) { const p = at(a, s / 50), q = at(b, s / 50); maxd = Math.max(maxd, Math.hypot(p.x - q.x, p.y - q.y)); }
                out.legs.push({ k, nA: a.pts.length, nB: b.pts.length, lenA: Math.round(a.length), lenB: Math.round(b.length),
                                maxd: Math.round(maxd), sweepA: a.roundSweep, sweepB: b.roundSweep, zoneA: a.roundZone, zoneB: b.roundZone });
            }
            return out;
        });
        console.log(`${r.venue.padEnd(10)} savedFlag=${r.savedFlag} total saved ${r.savedTotal && r.savedTotal.toFixed(0)} routed ${r.routedTotal && r.routedTotal.toFixed(0)} ${r.err ? 'ERR ' + r.err : ''}`);
        for (const L of r.legs) console.log('   leg', L.k, L.missing ? 'MISSING' : `pts ${L.nA}/${L.nB} len ${L.lenA}/${L.lenB} maxΔ ${L.maxd}u sweep ${L.sweepA != null ? L.sweepA.toFixed(3) : '-'}/${L.sweepB != null ? L.sweepB.toFixed(3) : '-'} zone ${L.zoneA || '-'}/${L.zoneB || '-'}`);
    }
    await browser.close();
})();

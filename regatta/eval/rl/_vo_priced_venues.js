// WHICH VENUES CARRY PRICED WATER IN THE ROUTER'S GRID? (2026-09-13, the volcano push)
// grid._shoal is built for awash shoals with drag and for vent boils; the DMC's BFS never
// read it (see _vo_route_boil.js). Prints, per venue, the priced cell count, the max price,
// whether the saved course.paths were used, and the units of saved route inside priced cells.
//   node _vo_priced_venues.js [tree]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeVF3');
const VENUES = ['seatrials', 'ocean', 'bay', 'lake', 'lagoon', 'river', 'swamp', 'glowtide', 'redrock', 'arctic', 'volcanic'];
(async () => {
    const browser = await chromium.launch(); const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    for (const v of VENUES) {
        await page.evaluate((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, v);
        const r = await page.evaluate(() => {
            window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
            const g = state.course.botGrid; if (!g) return { grid: false };
            let priced = 0, max = 1; if (g._shoal) for (let k = 0; k < g._shoal.length; k++) { if (g._shoal[k] > 1.05) priced++; if (g._shoal[k] > max) max = g._shoal[k]; }
            const doc = state.course.doc; const saved = !!(doc && window.VenueDoc.savedPaths && window.VenueDoc.savedPaths(doc));
            let inPriced = 0, total = 0;
            for (const L of (state.course.dmc ? state.course.dmc.legs : [])) { const pts = L.pts || []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const d = Math.hypot(b.x - a.x, b.y - a.y); total += d; for (let s = 0; s < d; s += 10) { const c = g.cell(a.x + (b.x - a.x) * s / d, a.y + (b.y - a.y) * s / d); if (g._shoal && g._shoal[c[1] * g.n + c[0]] > 1.05) inPriced += 10; } } }
            return { grid: true, n: g.n, res: g.res, priced, max: +max.toFixed(2), saved, inPriced, total: Math.round(total) };
        });
        console.log(`${v.padEnd(10)} ${r.grid ? `grid ${r.n}@${r.res}  priced cells ${r.priced}  max price ${r.max}  savedPaths ${r.saved}  route ${r.total} u, in priced water ${r.inPriced} u` : 'no grid'}`);
    }
    await browser.close();
})();

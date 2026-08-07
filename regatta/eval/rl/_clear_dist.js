// Clearance distribution per venue — where does "wide water" begin?
// For the VO-entry onset scope: report the grid clearance-field distribution
// over navigable cells, and over the cells the fleet actually SAILS (sampled
// from a 90s bot race), per venue. The wide/narrow threshold should fall at
// a knee that separates bay/ocean/seatrials open water from lake's corridors
// — if no such knee exists, the scope is not a threshold.
//   node _clear_dist.js <tree> [venues...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeHEAD');
const VENUES = process.argv.slice(3).length ? process.argv.slice(3) : ['bay', 'lake', 'redrock', 'ocean', 'seatrials'];
(async () => {
    const browser = await chromium.launch();
    for (const v of VENUES) {
        const page = await browser.newPage();
        await page.addInitScript((vv) => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv }));
        }, v);
        await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        const r = await page.evaluate(async () => {
            window.evalHarness.seed = 9100;
            window.resetGame(); window.startRace();
            const g = state.course.botGrid;
            if (!g) return { err: 'no grid' };
            if (!g._clear && window.SailCheck && window.SailCheck.clearanceField)
                g._clear = window.SailCheck.clearanceField(g);
            const cl = g._clear;
            if (!cl) return { err: 'no clear' };
            const nav = [];
            for (let y = 0; y < g.n; y++) for (let x = 0; x < g.n; x++)
                if (g.at(x, y)) nav.push(cl[y * g.n + x]);
            nav.sort((a, b) => a - b);
            const q = p => nav[Math.min(nav.length - 1, Math.floor(nav.length * p))];
            // sailed cells: 90s of racing, all bots, sampled 1 Hz
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const sailed = [];
            for (let f = 0; f < 90 * 60; f++) {
                window.update(1 / 60);
                if (f % 60 === 0) for (const b of state.boats) {
                    if (b.isPlayer) continue;
                    const c = g.cell(b.x, b.y);
                    if (g.at(c[0], c[1])) sailed.push(cl[c[1] * g.n + c[0]]);
                }
            }
            sailed.sort((a, b) => a - b);
            const qs = p => sailed[Math.min(sailed.length - 1, Math.floor(sailed.length * p))];
            const frac = (arr, t) => (arr.filter(x => x >= t).length / arr.length);
            return {
                cells: nav.length,
                nav: { p10: q(.1), p25: q(.25), p50: q(.5), p75: q(.75), p90: q(.9) },
                sailedN: sailed.length,
                sailed: { p10: qs(.1), p25: qs(.25), p50: qs(.5), p75: qs(.75), p90: qs(.9) },
                sailedGE: { g3: frac(sailed, 3), g5: frac(sailed, 5), g8: frac(sailed, 8), g12: frac(sailed, 12), g20: frac(sailed, 20) }
            };
        });
        console.log(v, JSON.stringify(r));
        await page.close();
    }
    await browser.close();
})();

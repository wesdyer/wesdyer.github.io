// What the ROUTER can see of a light-air venue's wind.
//
// The router prices each step by a time-cost table indexed by (wind direction bin,
// wind SPEED bin, step direction). The speed bins are SPDS = [8,12,16,20,25,30] and
// the binning is nearest — so every cell under ~10 kt lands in bin 0 and prices
// identically. On a venue whose whole design is "the breeze only whispers", that is
// the difference between a 9-knot lane and dead glass costing the same to route
// through.
//
// This probe measures, on any venue: the distribution of per-cell wind speed over
// navigable water, how those cells bin today, and how much of the planned course
// path (the DMC) runs through water the router cannot tell from full breeze.
//
//   node _lake_wind.js <tree> [venue] [seed]
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
        const g = state.course.botGrid || state.course._botGridStatic;
        const out = { base: +state.wind.baseSpeed.toFixed(2),
                      baseDir: +(state.wind.baseDirection * 180 / Math.PI).toFixed(1),
                      hasGrid: !!g, hasWbin: !!(g && g._wbin) };
        if (!g) return out;
        // Per-cell wind over navigable water
        const N = g.n, spds = [];
        const binHist = {};
        const SPDS = [8, 12, 16, 20, 25, 30];
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            const id = j * N + i;
            if (!g.nav[id]) continue;
            const [wx, wy] = g.world(i, j);
            const w = getWindAt(wx, wy);
            spds.push(w.speed);
            let sBin = 0, sBest = Infinity;
            for (let s = 0; s < SPDS.length; s++) {
                const dd = Math.abs((w.speed || 0) - SPDS[s]);
                if (dd < sBest) { sBest = dd; sBin = s; }
            }
            binHist[sBin] = (binHist[sBin] || 0) + 1;
        }
        spds.sort((a, b) => a - b);
        const q = f => +spds[Math.floor(f * (spds.length - 1))].toFixed(2);
        out.navCells = spds.length;
        out.windQ = { p1: q(0.01), p5: q(0.05), p10: q(0.10), p25: q(0.25), med: q(0.5),
                      p75: q(0.75), p90: q(0.90), p99: q(0.99) };
        out.under = {};
        for (const t of [1, 2, 3, 4, 5, 6, 7, 8]) {
            out.under[t + 'kt'] = +(100 * spds.filter(s => s < t).length / spds.length).toFixed(1);
        }
        out.speedBinHist = binHist;   // how the router bins them TODAY
        // The planned course path: what wind does it run through?
        const dmc = state.course.dmc;
        if (dmc && dmc.legs) {
            out.legs = [];
            for (let li = 1; li < dmc.legs.length; li++) {
                const pts = dmc.legs[li].pts || [];
                if (!pts.length) continue;
                let len = 0, calm = 0, sum = 0, n = 0, minw = 99;
                for (let k = 1; k < pts.length; k++) {
                    const d = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
                    const w = getWindAt((pts[k].x + pts[k - 1].x) / 2, (pts[k].y + pts[k - 1].y) / 2).speed;
                    len += d; sum += w * d; n += d;
                    if (w < 4) calm += d;
                    if (w < minw) minw = w;
                }
                out.legs.push({ leg: li, len: Math.round(len), meanWind: +(sum / n).toFixed(2),
                                minWind: +minw.toFixed(2), pctUnder4kt: +(100 * calm / len).toFixed(1) });
            }
        }
        return out;
    }, SEED);
    console.log(JSON.stringify(r, null, 1));
    await browser.close();
})();

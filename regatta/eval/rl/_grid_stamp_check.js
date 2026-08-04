// Does the incremental floe stamp produce the SAME grid as a full rebuild?
//
// stampFloes exists only to make the floe map cheap enough to refresh often. It is
// worth nothing — worse than nothing — if it also quietly produces a different map,
// because that would be a behaviour change shipped inside a performance commit. So
// this drives a real arctic race and, at every rebuild, compares the stamped nav
// array against buildGrid's answer CELL FOR CELL, and times both.
// node _grid_stamp_check.js [seeds] [seed0] [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    let bad = 0, checks = 0, tStamp = 0, tBuild = 0, nT = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const dt = 1 / 60;
            let bad = 0, checks = 0, tS = 0, tB = 0, n = 0, firstBad = null;
            for (let it = 0; it < 60 * 240; it++) {
                window.update(dt);
                if (state.race.status !== 'racing') continue;
                if (it % 300 !== 0) continue;
                const c = state.course;
                if (!c._botGridStatic) continue;
                // Rebuild the exact inputs refreshBotGrid uses.
                const polys = [], circles = [];
                const LEAD = (typeof BOT_GRID_LEAD !== 'undefined') ? BOT_GRID_LEAD : 2;
                for (const f of (c.islands || [])) {
                    if (!f.isFloe) continue;
                    const sx = (f.driftVx || 0) * LEAD, sy = (f.driftVy || 0) * LEAD;
                    if (f.vertices && f.vertices.length >= 3) {
                        polys.push({ outer: f.vertices.map(v => [v.x + sx, v.y + sy]), holes: [] });
                    } else {
                        circles.push({ x: f.x + sx, y: f.y + sy, radius: (f.radius || 0) + 15 });
                    }
                }
                const t0 = performance.now();
                const A = window.SailCheck.stampFloes(c._botGridStatic, polys, circles);
                const t1 = performance.now();
                const B = window.SailCheck.buildGrid(c._gridFixed.concat(polys), c.boundary, circles);
                const t2 = performance.now();
                tS += t1 - t0; tB += t2 - t1; n++;
                checks++;
                let diff = 0;
                for (let k = 0; k < A.nav.length; k++) if (A.nav[k] !== B.nav[k]) diff++;
                if (diff) { bad++; if (firstBad == null) firstBad = { t: Math.round(state.race.timer), diff, cells: A.nav.length }; }
            }
            return { bad, checks, tS, tB, n, firstBad };
        }, seed);
        bad += r.bad; checks += r.checks; tStamp += r.tS; tBuild += r.tB; nT += r.n;
        console.log(`seed ${seed}: ${r.checks} comparisons, ${r.bad} mismatched` + (r.firstBad ? ` — first ${JSON.stringify(r.firstBad)}` : ''));
    }
    console.log(`\n${checks} rebuilds compared cell-for-cell across ${TRIALS} arctic races`);
    console.log(bad === 0 ? 'IDENTICAL — stampFloes agrees with buildGrid everywhere'
                          : `MISMATCH in ${bad} of ${checks} — do not ship`);
    console.log(`stampFloes ${(tStamp / nT).toFixed(1)}ms   buildGrid ${(tBuild / nT).toFixed(1)}ms   speedup ${(tBuild / tStamp).toFixed(1)}x`);
    await browser.close();
    process.exit(bad === 0 ? 0 : 1);
})();

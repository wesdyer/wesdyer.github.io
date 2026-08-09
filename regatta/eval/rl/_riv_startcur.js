// DOES THE RIVER START LINE SIT IN MOVING WATER AT ALL? (2026-08-08, treeCST1 audit)
// The current-aware start (getApproachTime with ground-speed closure) benched
// BYTE-IDENTICAL on river set B — all 119 paired deltas exactly 0.0, identical
// dirt. Standing rule 17 says a candidate that benches byte-identical is pricing
// water no decision buys; standing rule 18 says audit the probe (here: the SCOPE)
// before believing it. So measure the thing the scope tests: the blended current
// along the start line, and along each boat's actual crossing run.
//   node _riv_startcur.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9200;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHD9');
const VENUE = process.argv[5] || 'river';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            const [q0, q1] = startLinePts();
            const line = [];
            for (let s = 0; s <= 8; s++) {
                const cw = getCurrentAt(q0.x + (q1.x - q0.x) * s / 8, q0.y + (q1.y - q0.y) * s / 8);
                line.push(+((cw && cw.speed) || 0).toFixed(2));
            }
            // and in the STAGING water each boat actually starts from — 60u
            // downwind of its own lane, where getApproachTime is called
            const bots = state.boats.filter(b => !b.isPlayer);
            const stage = [];
            for (const b of bots) {
                const c = b.controller;
                if (!c) continue;
                const pctL = Math.max(0.1, Math.min(0.9, c.startLinePct || 0.5));
                const tx = q0.x + (q1.x - q0.x) * pctL, ty = q0.y + (q1.y - q0.y) * pctL;
                const wd = getWindAt(tx, ty).direction;
                const sx = tx - Math.sin(wd) * 60, sy = ty + Math.cos(wd) * 60;
                const cw = getCurrentAt(sx, sy);
                stage.push(+((cw && cw.speed) || 0).toFixed(2));
            }
            // the venue's overall maxima, for scale
            const gC = state.course.botGrid || state.course._botGridStatic;
            let gridMax = 0;
            if (gC && (state.course.currentRegions || []).length) {
                for (let y = 0; y < gC.n; y += 3) for (let x = 0; x < gC.n; x += 3) {
                    if (!gC.at(x, y)) continue;
                    const cw = getCurrentAt(gC.x0 + (x + 0.5) * gC.res, gC.y0 + (y + 0.5) * gC.res);
                    if (cw && cw.speed > gridMax) gridMax = cw.speed;
                }
            }
            return { seed, line, stage, gridMax: +gridMax.toFixed(2),
                     lineMax: Math.max(...line), stageMax: Math.max(...stage),
                     nRegions: (state.course.currentRegions || []).length };
        }, seed);
        console.log('seed', r.seed, 'regions', r.nRegions,
            '\n   current ALONG THE START LINE (kt):', r.line.join(' '), ' max', r.lineMax,
            '\n   current at each boat STAGING point: max', r.stageMax,
            '\n   venue max over navigable water:', r.gridMax,
            r.lineMax < 2 ? '\n   ⇒ SCOPE (line max ≥ 2kt) DOES NOT FIRE' : '\n   ⇒ scope fires');
    }
    await browser.close();
})();

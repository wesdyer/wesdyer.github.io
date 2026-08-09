// CUR1 audit: does the current stamp fire on river, and do routes actually move?
// node _cur1_audit.js <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const RL = '/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/eval/rl';
const ROOT = path.join(RL, process.argv[2] || 'treeCUR1');
const VENUE = process.argv[3] || 'river';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(async () => {
        window.evalHarness.seed = 9100;
        window.resetGame(); window.startRace();
        const dt = 1 / 60;
        for (let i = 0; i < 240; i++) window.update(dt);
        const g = state.course.botGrid;
        const out = { stamped: !!g._curStamped, hasField: !!g._curX, curMax: g._curMax || 0 };
        if (g._curX) {
            let n = 0, sum = 0;
            for (let i = 0; i < g._curX.length; i++) {
                const m = Math.hypot(g._curX[i], g._curY[i]);
                if (m > 0.01) { n++; sum += m; }
            }
            out.cellsWithCurrent = n; out.meanKt = +(sum / Math.max(1, n)).toFixed(2);
            // route divergence: same endpoints, field on vs off
            const b = state.boats.find(x => !x.isPlayer);
            const m1 = state.course.marks[1] || state.course.marks[0];
            const pOn = window.SailCheck.pathSailable(g, [b.x, b.y], [m1.x, m1.y]);
            const cxSave = g._curX, cySave = g._curY, cmSave = g._curMax;
            g._curX = null; g._curY = null; g._curMax = 0;
            const pOff = window.SailCheck.pathSailable(g, [b.x, b.y], [m1.x, m1.y]);
            g._curX = cxSave; g._curY = cySave; g._curMax = cmSave;
            if (pOn && pOff) {
                // mean lateral separation, sampled along the shorter path
                const L = Math.min(pOn.length, pOff.length);
                let dev = 0, mx = 0;
                for (let i = 0; i < L; i++) {
                    let best = Infinity;
                    for (let j = 0; j < pOff.length; j++) {
                        const d = Math.hypot(pOn[i][0] - pOff[j][0], pOn[i][1] - pOff[j][1]);
                        if (d < best) best = d;
                    }
                    dev += best; if (best > mx) mx = best;
                }
                out.routeMeanDev = +(dev / L).toFixed(1); out.routeMaxDev = +mx.toFixed(1);
                out.lenOn = pOn.length; out.lenOff = pOff.length;
            } else out.routeNull = { on: !!pOn, off: !!pOff };
        }
        return out;
    });
    console.log(VENUE, JSON.stringify(r));
    await browser.close();
})();

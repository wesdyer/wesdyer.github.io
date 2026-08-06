// What a step COSTS the router, per wind speed — the time-cost table's actual numbers.
// Prints, for a list of wind speeds, the best speed toward a bearing (best case: the
// bearing is a reach; worst case: dead upwind) and the resulting `tf` before and after
// the min(4,...) clamp. This is what decides whether the router can be made to route
// around glass at all.
//   node _tfcost.js <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeHEAD');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(() => {
        const gts = window.getTargetSpeed;
        const rows = [];
        // bearing relative to wind: 0 = dead upwind (unsailable), pi = dead downwind
        for (const ws of [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 25, 30]) {
            const out = { ws };
            for (const relDeg of [0, 45, 90, 135, 180]) {
                const bearingRel = relDeg * Math.PI / 180;
                let best = 0;
                for (let twa = 25; twa <= 180; twa += 5) {
                    const tr = twa * Math.PI / 180;
                    const v = gts(tr, twa > 95, ws);
                    for (const sgn of [1, -1]) {
                        const toward = Math.cos(sgn * tr - bearingRel) * v;
                        if (toward > best) best = toward;
                    }
                }
                out['rel' + relDeg] = +best.toFixed(2);
                out['tf' + relDeg] = +(10 / Math.max(0.001, best)).toFixed(2);
            }
            rows.push(out);
        }
        return rows;
    });
    console.log('ws    upwindVMG tf | 45deg tf | beam tf | 135 tf | run tf   (tf = 10/best, UNCLAMPED)');
    for (const r0 of r) {
        console.log('%s  %s %s | %s %s | %s %s | %s %s | %s %s'.replace(/%s/g, () => ''),
            String(r0.ws).padStart(4),
            String(r0.rel0).padStart(5), String(r0.tf0).padStart(6),
            String(r0.rel45).padStart(5), String(r0.tf45).padStart(6),
            String(r0.rel90).padStart(5), String(r0.tf90).padStart(6),
            String(r0.rel135).padStart(5), String(r0.tf135).padStart(6),
            String(r0.rel180).padStart(5), String(r0.tf180).padStart(6));
    }
    await browser.close();
})();

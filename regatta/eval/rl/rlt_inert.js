// Phase A inertness proof + episode cost measurement.
// Runs the same seed three ways: classical (no hook), zero-parameter residual
// (hook installed, policy returns exactly 0), and a small non-zero residual.
// The first two MUST agree exactly — that is the floor the gate rests on. The
// third must differ, or the hook is not wired to anything.
//   node rlt_inert.js [tree] [seeds] [win]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { SHARED_SRC, PARAM_DIM, zeroParams } = require('./rlt_shared.js');
const ROOT = path.join(__dirname, process.argv[2] || 'treeF');
const SEEDS = parseInt(process.argv[3] || '2');
const WIN = parseInt(process.argv[4] || '280');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.addScriptTag({ content: SHARED_SRC });
    await page.evaluate(() => window.__rltInstallCounter());

    const zero = zeroParams();
    const tiny = zeroParams(); tiny[PARAM_DIM - 1] = 0.5; // bias only: a constant lean
    let ok = true;
    for (let i = 0; i < SEEDS; i++) {
        const seed = 9100 + i;
        const t0 = Date.now();
        const a = await page.evaluate(([s, w]) => window.__rltEpisode(null, s, w), [seed, WIN]);
        const tA = (Date.now() - t0) / 1000;
        const t1 = Date.now();
        const b = await page.evaluate(([P, s, w]) => window.__rltEpisode(P, s, w), [zero, seed, WIN]);
        const tB = (Date.now() - t1) / 1000;
        const c = await page.evaluate(([P, s, w]) => window.__rltEpisode(P, s, w), [tiny, seed, WIN]);
        const same = JSON.stringify({ ...a, acts: 0 }) === JSON.stringify({ ...b, acts: 0 });
        if (!same) ok = false;
        console.log(`seed ${seed}: classical cost ${a.cost.toFixed(2)} armed ${a.armed} hits ${a.hits} pens ${a.pens} (${tA.toFixed(1)}s)`);
        console.log(`           zeroPol  cost ${b.cost.toFixed(2)} armed ${b.armed} hits ${b.hits} pens ${b.pens} acts ${b.acts} (${tB.toFixed(1)}s) -> ${same ? 'IDENTICAL' : '*** DIFFERS ***'}`);
        console.log(`           biasPol  cost ${c.cost.toFixed(2)} armed ${c.armed} hits ${c.hits} pens ${c.pens} acts ${c.acts} -> ${c.cost !== a.cost ? 'moves (hook live)' : '*** NO EFFECT ***'}`);
    }
    console.log(ok ? 'INERTNESS: PASS' : 'INERTNESS: FAIL');
    await browser.close();
})();

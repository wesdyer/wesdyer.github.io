// THE SCENARIO RUNNER — replays ONE Scenario Lab scenario headlessly and
// judges its assertions. The lab page itself is the fixture: this drives
// scenario.html through LAB.testAPI, so the runner and the page share one
// engine, one venue, one recording format and one evaluator
// (js/scenario_asserts.js) — they cannot drift apart.
//
//   node regatta/eval/run_scenario.js "Tack onto STBD 2"
//   node regatta/eval/run_scenario.js "Tack onto STBD 2" --seeds 5
//
// --seeds N runs the doc's seed plus N-1 successors (the page's CHECK ×5,
// scriptable); every assertion must hold on every seed. Scenarios come from
// the COMMITTED library (assets/scenarios.js) — save (with the file
// attached) before running. Exit 1 on any FAIL; GAP (expected-fail) rows
// count as ok; FIXED rows warn — promote them.
// (Running the whole library at once is deliberately deferred.)
const { chromium } = require('playwright');
const path = require('path');

const args = process.argv.slice(2);
const name = args.filter(a => !a.startsWith('--'))[0];
const seedsIx = args.indexOf('--seeds');
const NSEEDS = seedsIx >= 0 ? Math.max(1, parseInt(args[seedsIx + 1], 10) || 1) : 1;
if (!name) {
    console.error('usage: node regatta/eval/run_scenario.js "<scenario name>" [--seeds N]');
    process.exit(2);
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(__dirname, '../scenario.html'));
    await page.waitForFunction(() => window.__LAB && window.__LAB.ready && window.__LAB.testAPI, null, { timeout: 60000 });

    const loaded = await page.evaluate((n) => {
        try { window.__LAB.testAPI.load(n); return { ok: true, seed: window.__LAB.seed >>> 0 }; }
        catch (e) { return { ok: false, err: String(e.message || e) }; }
    }, name);
    if (!loaded.ok) { console.error('LOAD FAILED:', loaded.err); await browser.close(); process.exit(2); }

    console.log(`${name} — seed ${loaded.seed}${NSEEDS > 1 ? `, ${NSEEDS} seeds` : ''}`);
    let fails = 0, fixed = 0, rows = null;
    for (let i = 0; i < NSEEDS; i++) {
        const seed = (loaded.seed + i) >>> 0;
        const t0 = Date.now();
        const run = await page.evaluate((s) => window.__LAB.testAPI.run(s), seed);
        const ms = Date.now() - t0;
        if (!run.asserts.length) {
            console.log(`  seed ${seed}: no assertions — penalties: ${JSON.stringify(run.pens)} (${ms}ms)`);
            continue;
        }
        if (!rows) rows = run.asserts.map(a => a.label);
        console.log(`  seed ${seed} (${ms}ms):`);
        for (const a of run.asserts) {
            const mark = { pass: 'ok  ', fail: 'FAIL', gap: 'gap ', fixed: 'FIXD' }[a.status];
            console.log(`    ${mark}  ${a.label} — ${a.why}`);
            if (a.status === 'fail') fails++;
            if (a.status === 'fixed') fixed++;
        }
    }
    await browser.close();
    if (fixed) console.log(`NOTE: ${fixed} expected-fail row(s) PASSED — the gap may have closed; promote them.`);
    console.log(fails ? `FAILED (${fails})` : 'PASSED');
    process.exit(fails ? 1 : 0);
})();

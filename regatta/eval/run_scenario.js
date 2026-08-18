// THE SCENARIO RUNNER — replays ONE Scenario Lab scenario headlessly and
// judges its assertions. The lab page itself is the fixture: this drives
// scenario.html through LAB.testAPI, so the runner and the page share one
// engine, one venue, one recording format and one evaluator
// (js/scenario_asserts.js) — they cannot drift.
//
//   node regatta/eval/run_scenario.js "Tack onto STBD 2"
//
// A scenario IS a set of seeds (one or more, saved in the doc) — running it
// means running every seed, and every assertion must hold on all of them.
// Scenarios come from the COMMITTED library (assets/scenarios.js) — save
// (with the file attached) before running. Exit 1 on any FAIL; GAP
// (expected-fail) rows count as ok; FIXED rows warn — promote them.
// (Running the whole library at once is deliberately deferred.)
const { chromium } = require('playwright');
const path = require('path');

const name = process.argv.slice(2).filter(a => !a.startsWith('--'))[0];
if (!name) {
    console.error('usage: node regatta/eval/run_scenario.js "<scenario name>"');
    process.exit(2);
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(__dirname, '../scenario.html'));
    await page.waitForFunction(() => window.__LAB && window.__LAB.ready && window.__LAB.testAPI, null, { timeout: 60000 });

    const loaded = await page.evaluate((n) => {
        try { window.__LAB.testAPI.load(n); return { ok: true, seeds: window.__LAB.seeds.map(s => s >>> 0) }; }
        catch (e) { return { ok: false, err: String(e.message || e) }; }
    }, name);
    if (!loaded.ok) { console.error('LOAD FAILED:', loaded.err); await browser.close(); process.exit(2); }

    const t0 = Date.now();
    const out = await page.evaluate(() => window.__LAB.testAPI.run());
    // DETERMINISM TRIPWIRE: the whole set again from a cold cache — any
    // residual state leak turns a silent flake into a loud exit 3
    const sig2 = await page.evaluate(() => {
        window.__LAB.recs = {};
        const o = window.__LAB.testAPI.run();
        return JSON.stringify(o.runs);
    });
    const ms = Date.now() - t0;
    await browser.close();
    if (JSON.stringify(out.runs) !== sig2) {
        console.error('NONDETERMINISM: two back-to-back runs of the same seed set disagree.');
        console.error(' first :', JSON.stringify(out.runs));
        console.error(' second:', sig2);
        process.exit(3);
    }

    console.log(`${name} — ${out.seeds.length} seed(s) [${out.seeds.join(', ')}] (${ms}ms)`);
    for (const r of out.runs) {
        const pens = r.pens.length
            ? r.pens.map(p => `${p.boat} ${p.rule || p.kind || '?'}@${p.t}s`).join(', ')
            : 'none';
        console.log(`  seed ${r.seed}: penalties ${pens}`);
    }
    let fails = 0, fixed = 0;
    if (!out.asserts.length) console.log('  (no assertions)');
    for (const a of out.asserts) {
        const mark = { pass: 'ok  ', fail: 'FAIL', gap: 'gap ', fixed: 'FIXD' }[a.status] || '??  ';
        const agg = a.n > 1 ? ` [${a.ok}/${a.n}]` : '';
        console.log(`  ${mark}${agg}  ${a.label} — ${a.why}`);
        if (a.status === 'fail') fails++;
        if (a.status === 'fixed') fixed++;
    }
    if (fixed) console.log(`NOTE: ${fixed} expected-fail row(s) PASSED — the gap may have closed; promote them.`);
    console.log(fails ? `FAILED (${fails})` : 'PASSED');
    process.exit(fails ? 1 : 0);
})();

// THE LIBRARY RUNNER — every scenario in assets/scenarios.js, one table.
//
//   node regatta/eval/run_scenarios.js [--json out.json]
//
// Each scenario gets a FRESH PAGE (own context, own localStorage): a cold
// engine per scenario makes cross-scenario state leaks structurally
// impossible, and each run still carries the per-scenario determinism
// tripwire. Exit 1 if any hard FAIL anywhere; 3 on any nondeterminism;
// 0 when the library is green (GAP rows count as ok, FIXD rows warn).
//
// --json dumps every scenario's full per-seed results + metrics — the
// baseline mechanism: dump on HEAD, dump on the candidate, diff.
const { chromium } = require('playwright');
const fs = require('fs');
const { newLabPage, listScenarios, driveScenario } = require('./_drive');

const args = process.argv.slice(2);
const jsonIx = args.indexOf('--json');
const jsonPath = jsonIx >= 0 ? args[jsonIx + 1] : null;

(async () => {
    const browser = await chromium.launch();
    let names;
    {
        const page = await newLabPage(browser);
        names = await listScenarios(page);
        await page.close();
    }
    if (!names.length) { console.error('library is empty'); await browser.close(); process.exit(2); }

    const results = [];
    let anyFail = false, anyNondet = false, fixedTotal = 0;
    for (const name of names) {
        const page = await newLabPage(browser);   // fresh context per scenario
        const res = await driveScenario(page, name);
        await page.close();
        if (!res.ok) { results.push({ name, error: res.err }); anyFail = true; continue; }
        if (!res.deterministic) anyNondet = true;
        const counts = { pass: 0, fail: 0, gap: 0, fixed: 0 };
        for (const a of res.out.asserts) counts[a.status] = (counts[a.status] || 0) + 1;
        if (counts.fail) anyFail = true;
        fixedTotal += counts.fixed;
        results.push({ name, seeds: res.out.seeds.length, counts, ms: res.ms,
                       deterministic: res.deterministic,
                       failing: res.out.asserts.filter(a => a.status === 'fail'),
                       fixedRows: res.out.asserts.filter(a => a.status === 'fixed'),
                       out: res.out });
    }
    await browser.close();

    const W = Math.max(...results.map(r => r.name.length), 8) + 2;
    console.log('SCENARIO'.padEnd(W) + 'SEEDS  VERDICT  ok fail gap fixd    ms');
    for (const r of results) {
        if (r.error) { console.log(r.name.padEnd(W) + '—      ERROR   ' + r.error); continue; }
        const c = r.counts;
        const verdict = !r.deterministic ? 'NONDET' : c.fail ? 'FAIL' : (c.pass + c.gap + c.fixed) ? 'ok' : 'empty';
        console.log(r.name.padEnd(W)
            + String(r.seeds).padEnd(7)
            + verdict.padEnd(9)
            + String(c.pass).padStart(2) + String(c.fail).padStart(5)
            + String(c.gap).padStart(4) + String(c.fixed).padStart(5)
            + String(r.ms).padStart(6));
        for (const a of r.failing) console.log(' '.repeat(W) + `FAIL  ${a.label} — ${a.why}`);
        for (const a of r.fixedRows) console.log(' '.repeat(W) + `FIXD  ${a.label} — expected to fail but passed; promote it`);
    }
    const failing = results.filter(r => r.error || (r.counts && r.counts.fail));
    console.log(failing.length
        ? `LIBRARY: ${failing.length}/${results.length} scenario(s) failing (${failing.map(r => r.name).join(', ')})`
        : `LIBRARY: all ${results.length} scenarios green`);
    if (fixedTotal) console.log(`NOTE: ${fixedTotal} expected-fail row(s) PASSED across the library — gaps may have closed.`);

    if (jsonPath) {
        fs.writeFileSync(jsonPath, JSON.stringify({
            scenarios: results.map(r => r.error ? { name: r.name, error: r.error }
                : { name: r.name, ms: r.ms, deterministic: r.deterministic, ...r.out }),
        }, null, 1));
        console.log(`json → ${jsonPath}`);
    }
    process.exit(anyNondet ? 3 : anyFail ? 1 : 0);
})();

// THE SCENARIO RUNNER — replays ONE Scenario Lab scenario headlessly and
// judges its assertions. See eval/_drive.js for the page-is-fixture setup.
//
//   node regatta/eval/run_scenario.js "Around Mark" [--json out.json]
//
// A scenario IS a set of seeds — running it means running every seed, and
// every assertion must hold on all of them. Scenarios come from the
// COMMITTED library (assets/scenarios.js) — save (with the file attached)
// before running. Exit 1 on any FAIL; GAP (expected-fail) rows count as
// ok; FIXED rows warn — promote them. Exit 3 on nondeterminism.
//
// MEASUREMENTS print aggregated across the seed set (worst offenders);
// --json dumps everything per seed, which is the baseline-diff mechanism:
// dump on HEAD, dump on the candidate, diff the files.
const { chromium } = require('playwright');
const fs = require('fs');
const { newLabPage, driveScenario } = require('./_drive');

const args = process.argv.slice(2);
const name = args.filter(a => !a.startsWith('--'))[0];
const jsonIx = args.indexOf('--json');
const jsonPath = jsonIx >= 0 ? args[jsonIx + 1] : null;
if (!name) {
    console.error('usage: node regatta/eval/run_scenario.js "<scenario name>" [--json out.json]');
    process.exit(2);
}

// worst-across-seeds rollup of the per-seed metrics blocks
function aggregate(runs) {
    const boats = new Map(), pairs = new Map();
    for (const r of runs) {
        if (!r.metrics) continue;
        for (const b of r.metrics.boats) {
            const a = boats.get(b.name) || { name: b.name, maxDevM: null, maxDevSeed: null,
                turnMin: Infinity, turnMax: -Infinity, devFromMin: null, devFromMax: null,
                rangeMin: null, rangeMax: null };
            if (b.maxDevM != null && (a.maxDevM == null || b.maxDevM > a.maxDevM)) {
                a.maxDevM = b.maxDevM; a.maxDevSeed = r.seed;
            }
            a.turnMin = Math.min(a.turnMin, b.turnDeg); a.turnMax = Math.max(a.turnMax, b.turnDeg);
            if (b.devFromS != null) {
                a.devFromMin = a.devFromMin == null ? b.devFromS : Math.min(a.devFromMin, b.devFromS);
                a.devFromMax = a.devFromMax == null ? b.devFromS : Math.max(a.devFromMax, b.devFromS);
                if (b.devFromRangeU != null) {
                    a.rangeMin = a.rangeMin == null ? b.devFromRangeU : Math.min(a.rangeMin, b.devFromRangeU);
                    a.rangeMax = a.rangeMax == null ? b.devFromRangeU : Math.max(a.rangeMax, b.devFromRangeU);
                }
            }
            boats.set(b.name, a);
        }
        for (const p of r.metrics.pairs) {
            const k = p.a + '·' + p.b;
            const a = pairs.get(k) || { k, minDistU: Infinity, minDistAtS: 0,
                rightsMin: null, rightsMax: null, rules: new Set() };
            if (p.minDistU < a.minDistU) { a.minDistU = p.minDistU; a.minDistAtS = p.minDistAtS; }
            if (p.rightsAtS != null) {
                a.rightsMin = a.rightsMin == null ? p.rightsAtS : Math.min(a.rightsMin, p.rightsAtS);
                a.rightsMax = a.rightsMax == null ? p.rightsAtS : Math.max(a.rightsMax, p.rightsAtS);
                if (p.rule) a.rules.add(p.rule);
            }
            pairs.set(k, a);
        }
    }
    return { boats: [...boats.values()], pairs: [...pairs.values()] };
}

const rng = (lo, hi) => lo === hi ? String(lo) : lo + '–' + hi;

(async () => {
    const browser = await chromium.launch();
    const page = await newLabPage(browser);
    const res = await driveScenario(page, name);
    await browser.close();
    if (!res.ok) { console.error('LOAD FAILED:', res.err); process.exit(2); }
    if (!res.deterministic) {
        console.error('NONDETERMINISM: two back-to-back runs of the same seed set disagree.');
        process.exit(3);
    }
    const out = res.out;
    console.log(`${name} — ${out.seeds.length} seed(s) [${out.seeds.join(', ')}] (${res.ms}ms)`);
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
    const M = aggregate(out.runs);
    if (M.boats.length) {
        console.log('  measurements (across the seed set):');
        for (const b of M.boats) {
            const bits = [];
            if (b.maxDevM != null) bits.push(`max off-proper ${b.maxDevM}m (seed ${b.maxDevSeed})`);
            bits.push(`turn ${rng(b.turnMin, b.turnMax)}°`);
            bits.push(b.devFromMin != null
                ? `dev onset ${rng(b.devFromMin, b.devFromMax)}s`
                  + (b.rangeMin != null ? ` @${rng(b.rangeMin, b.rangeMax)}u` : '')
                : 'no deviation');
            console.log(`    ${b.name}: ${bits.join(' · ')}`);
        }
        for (const p of M.pairs) {
            console.log(`    ${p.k}: min ${p.minDistU}u @${p.minDistAtS}s`
                + (p.rightsMin != null
                    ? ` · rights ${rng(p.rightsMin, p.rightsMax)}s ${[...p.rules].join('/') || ''}`.trimEnd()
                    : ' · no determination'));
        }
    }
    if (jsonPath) {
        fs.writeFileSync(jsonPath, JSON.stringify({ name, ...out }, null, 1));
        console.log(`  json → ${jsonPath}`);
    }
    if (fixed) console.log(`NOTE: ${fixed} expected-fail row(s) PASSED — the gap may have closed; promote them.`);
    console.log(fails ? `FAILED (${fails})` : 'PASSED');
    process.exit(fails ? 1 : 0);
})();

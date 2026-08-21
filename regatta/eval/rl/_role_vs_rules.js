// DEFLECTION-PUSH PROBE: does the controller's latched avoidanceRole agree
// with the rules module's live answer, tick by tick, for the lab boats?
//
//   node regatta/eval/rl/_role_vs_rules.js "Rule 12" [seed]
const { chromium } = require('playwright');
const { newLabPage } = require('../_drive');

const name = process.argv[2] || 'Rule 12';
const seedWant = process.argv[3] ? Number(process.argv[3]) : null;
const LABNAMES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);

(async () => {
    const browser = await chromium.launch();
    const page = await newLabPage(browser);
    await page.evaluate(() => { window.__AVDBG = {}; });
    await page.evaluate((n) => { window.__LAB.testAPI.load(n); }, name);
    if (seedWant != null) {
        await page.evaluate((s) => { window.__LAB.seeds = [s]; }, seedWant);
    }
    await page.evaluate(() => window.__LAB.testAPI.run());
    const raw = await page.evaluate(() => window.__AVLOG || []);
    await browser.close();

    const log = raw.filter(r => LABNAMES.has(r.n) && r.rowDbg && !r.rowDbg.err);
    let burstIx = -1, lastT = Infinity;
    for (const r of log) { if (r.t < lastT) burstIx++; lastT = r.t; r.b = burstIx; }
    const firstBurst = log.filter(r => r.b === 0);
    console.log(`"${name}" burst 0 — ${firstBurst.length} rows`);
    let mism = 0;
    for (const r of firstBurst) {
        const rulesSay = r.rowDbg.row === r.n ? 'STAND_ON' : r.rowDbg.row ? 'GIVE_WAY' : 'NONE';
        const agree = (r.role === rulesSay) || (r.role === 'NONE' && r.risk === 'LOW');
        if (!agree) mism++;
        if (!agree || Math.abs(r.dev) > 0.02)
            console.log(`t=${(r.t - 100).toFixed(2)} ${r.n} rng=${r.rng} latched=${r.role}/${r.risk}`
                + ` rules=${rulesSay}(${r.rowDbg.rule || '—'}${r.rowDbg.cons ? ' +' + r.rowDbg.cons : ''})`
                + ` held=${r.rowDbg.held} dev=${(r.dev * 57.3).toFixed(0)}°${agree ? '' : '   <-- MISMATCH'}`);
    }
    console.log(`${mism} mismatched ticks of ${firstBurst.length}`);
})();

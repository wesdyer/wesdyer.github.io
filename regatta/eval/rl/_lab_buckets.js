// LAB LEDGER BUCKETS: one scenario, burst 0, per-boat per-second summary of
// the __AVDBG ledger — median |off|, dominant driver, role/risk, range,
// zero.bc share — the whole-run picture _deflect_why's first-8-ticks elides.
//   node _lab_buckets.js "<scenario>" [boatName]
const { chromium } = require('playwright');
const { newLabPage } = require('../_drive');
const name = process.argv[2] || 'Zone Entry';
const who = process.argv[3] || null;
function driver(r) {
    const z = r.zero, w = r.best;
    if (!z || !w) return '?';
    if (z.bc && !w.bc) return 'hardC';
    if (z.sc && !w.sc) return 'static';
    if (z.rv && !w.rv) return 'ruleV';
    const gap = z.cost - w.cost;
    if (gap <= 0) return 'tie';
    if ((z.prox - w.prox) >= gap * 0.8) return 'prox';
    if (z.bc && w.bc) return 'allBC';
    return 'other';
}
(async () => {
    const browser = await chromium.launch();
    const page = await newLabPage(browser);
    await page.evaluate(() => { window.__AVDBG = {}; });
    const ok = await page.evaluate((n) => { try { window.__LAB.testAPI.load(n); return true; } catch (e) { return String(e); } }, name);
    if (ok !== true) { console.error('load failed:', ok); await browser.close(); process.exit(2); }
    await page.evaluate(() => window.__LAB.testAPI.run());
    const raw = await page.evaluate(() => window.__AVLOG || []);
    await browser.close();
    const LABNAMES = new Set(['A','B','C','D','E','F','G','H','I','J']);
    const log = raw.filter(r => LABNAMES.has(r.n));
    // burst 0 only (t resets to ~100 per burst)
    let lastT = Infinity; const b0 = [];
    for (const r of log) { if (r.t < lastT && b0.length) break; lastT = r.t; b0.push(r); }
    const boats = [...new Set(b0.map(r => r.n))].filter(b => !who || b === who);
    for (const b of boats) {
        console.log(`== ${b}`);
        const mine = b0.filter(r => r.n === b);
        const buckets = {};
        for (const r of mine) {
            const s = Math.floor(r.t - 100);
            (buckets[s] = buckets[s] || []).push(r);
        }
        for (const s of Object.keys(buckets).map(Number).sort((a, b2) => a - b2)) {
            const rows = buckets[s];
            const offs = rows.map(r => r.best ? Math.abs(r.best.off) : 0).sort((a, b2) => a - b2);
            const drv = {};
            for (const r of rows) { const d = driver(r); drv[d] = (drv[d] || 0) + 1; }
            const roles = [...new Set(rows.map(r => r.role + '/' + r.risk))].join(',');
            const rng = Math.round(rows.reduce((p, r) => p + (r.rng || 0), 0) / rows.length);
            const held = rows.filter(r => r.rowDbg && r.rowDbg.held).length;
            console.log(`  t=${String(s).padStart(2)}s off med ${(offs[Math.floor(offs.length / 2)] * 57.3).toFixed(0).padStart(3)}° rng ${String(rng).padStart(4)} ${roles.padEnd(22)} drivers ${JSON.stringify(drv)} held ${held}/${rows.length}`);
        }
    }
})();

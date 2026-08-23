// DEFLECTION-PUSH PROBE: which cost term vetoes the straight course when
// a lab boat's avoidance deviation arms? Drives scenario.html with
// window.__AVDBG on, reads window.__AVLOG (per-tick candidate ledger from
// applyAvoidance's temp probe), and prints the onset anatomy per lab boat.
// Parked-fleet boats are filtered out (they stack at the parking spot).
//
//   node regatta/eval/rl/_deflect_why.js "Rule 10" [--verbose]
const { chromium } = require('playwright');
const { newLabPage } = require('../_drive');

const name = process.argv[2] || 'Rule 10';
const verbose = process.argv.includes('--verbose');
const LABNAMES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);

// which single term vetoes zero on this tick?
function driver(r) {
    const z = r.zero, w = r.best;
    if (z.bc && !w.bc) return 'hardCollision';
    if (z.sc && !w.sc) return 'static';
    if (z.rv && !w.rv) return 'ruleViolation';
    const gap = z.cost - w.cost;
    if (gap <= 0) return 'tieOrCommit';
    const proxGap = z.prox - w.prox;
    if (proxGap >= gap * 0.8) return 'proxGradient';
    if (z.bc && w.bc) return 'bothCollide-cheaperMiss';
    return 'other';
}

(async () => {
    const browser = await chromium.launch();
    const page = await newLabPage(browser);
    await page.evaluate(() => { window.__AVDBG = {}; });
    const ok = await page.evaluate((n) => {
        try { window.__LAB.testAPI.load(n); return true; } catch (e) { return String(e); }
    }, name);
    if (ok !== true) { console.error('load failed:', ok); await browser.close(); process.exit(2); }
    await page.evaluate(() => window.__LAB.testAPI.run());
    const raw = await page.evaluate(() => window.__AVLOG || []);
    await browser.close();

    const log = raw.filter(r => LABNAMES.has(r.n));
    if (!log.length) { console.log('no lab-boat rows in __AVLOG'); process.exit(1); }
    // bursts run sequentially; state.time re-pins to 100 per burst, so a
    // t drop marks a new burst (seed runs first, then any solo/proper runs)
    let burstIx = -1, lastT = Infinity;
    const bursts = [];
    for (const r of log) {
        if (r.t < lastT) { burstIx++; bursts[burstIx] = []; }
        lastT = r.t;
        bursts[burstIx].push(r);
    }
    console.log(`${log.length} lab rows over ${bursts.length} burst(s) — "${name}"`);
    for (let s = 0; s < bursts.length; s++) {
        const rows = bursts[s];
        const boats = [...new Set(rows.map(r => r.n))];
        console.log(`burst#${s} (${boats.join(',')})`);
        for (const b of boats) {
            const mine = rows.filter(r => r.n === b);
            const defl = mine.filter(r => r.dev > 0.02);
            if (!defl.length) { console.log(`  ${b}: never deflects (${mine.length} ticks)`); continue; }
            const first = defl[0];
            const t = +(first.t - 100).toFixed(2);
            console.log(`  ${b}: arms t=${t}s rng=${first.rng}u role=${first.role}/${first.risk} vo=${first.vo}/${first.voin}`
                + ` off=${first.best.off} — driver ${driver(first)}`
                + ` (zero ${Math.round(first.zero.cost)} vs best ${Math.round(first.best.cost)})`);
            const byDriver = {}, byRole = {};
            for (const r of defl) {
                const d = driver(r);
                byDriver[d] = (byDriver[d] || 0) + 1;
                const k = r.role + '/' + r.risk;
                byRole[k] = (byRole[k] || 0) + 1;
            }
            console.log(`  ${b}: deflected ${defl.length}/${mine.length} ticks — drivers ${JSON.stringify(byDriver)} roles ${JSON.stringify(byRole)}`);
            if (verbose) for (const r of defl.slice(0, 8))
                console.log(`      t=${(r.t - 100).toFixed(2)} rng=${r.rng} ${r.role}/${r.risk} off=${r.best.off} ${driver(r)}`
                    + ` zero{c:${r.zero.cost.toFixed(1)},p:${r.zero.prox.toFixed(1)},bc:${r.zero.bc}}`
                    + ` best{c:${r.best.cost.toFixed(1)},p:${r.best.prox.toFixed(1)},bc:${r.best.bc}}`);
        }
    }
})();

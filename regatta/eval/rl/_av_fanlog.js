// Read the instrumented argmin's own fan logs at big-dodge choices.
//   node _av_fanlog.js <trials> <seed0> <tree=treePROBE> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treePROBE');
const VENUE = process.argv[5] || 'redrock';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(v => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.__avCap = true; window.__avLog = [];
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
            }
            return window.__avLog;
        }, seed);
        all.push(...r);
        console.log('seed', seed, 'logged', r.length);
    }
    // ANALYSIS: for each logged choice, chosen candidate vs best small (|off|<=0.26)
    const med = a => { const q = [...a].sort((x, y) => x - y); return q.length ? q[Math.floor(q.length / 2)] : null; };
    const rows = [];
    for (const L of all) {
        const chosen = L.fan.reduce((m, c) => c.cost < m.cost ? c : m, L.fan[0]);
        const small = L.fan.filter(c => Math.abs(c.off) <= 0.26 && c !== chosen);
        if (!small.length) continue;
        const bs = small.reduce((m, c) => c.cost < m.cost ? c : m, small[0]);
        rows.push({ role: L.role, risk: L.risk, rivNear: L.rivNear, dev: L.dev,
            gap: bs.cost - chosen.cost, sSC: bs.sc, sBC: bs.bc, sRV: bs.rv, sPX: bs.px,
            cCost: chosen.cost, sCost: bs.cost });
    }
    console.log(`\n${VENUE}: ${rows.length} big-dodge fan snapshots`);
    const flag = (r) => r.sSC ? 'static' : r.sBC ? 'boat' : r.sRV ? 'rule' : (r.sPX > 2000 ? 'proxCost' : 'other');
    const byFlag = {};
    for (const r of rows) { const k = flag(r); byFlag[k] = (byFlag[k] || 0) + 1; }
    console.log('  why the best SMALL candidate lost:', JSON.stringify(byFlag));
    console.log('  cost gap med', med(rows.map(r => r.gap)), ' small px med', med(rows.map(r => r.sPX)));
    for (const k of ['static', 'boat', 'rule', 'proxCost', 'other']) {
        const rs = rows.filter(r => flag(r) === k);
        if (!rs.length) continue;
        const roles = {}; rs.forEach(r => roles[r.role + '/' + r.risk] = (roles[r.role + '/' + r.risk] || 0) + 1);
        console.log(`  ${k}: n=${rs.length} rivNear ${(100 * rs.filter(r => r.rivNear).length / rs.length).toFixed(0)}%  roles`, JSON.stringify(roles));
    }
    await browser.close();
})();

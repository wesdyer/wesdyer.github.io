// ⭐ DOES THE CANDIDATE ACTUALLY TAKE THE STAIRCASE OFF THE ROUTER'S OWN LINE?
//
// The clock benches say the probe/price half of the robust-current-statistic change
// is a large win on glowtide. This is the mechanism check behind that number: it
// counts, for the OFFSET-0 candidate only (the boat's intended course), how often
// `bandTrusted` was in force, what the two-valued 6667/3333 staircase charged, and
// how often the argmin ended up somewhere else.
//
// Requires a tree instrumented by `_mk_stair.py` and is inert unless `window.__STAIR`
// is set, so an instrumented tree still benches as itself.
//   node _glow_stair.js <venue> <trials> <seed0> <tree> [tree2 ...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 2;
const SEED0 = parseInt(process.argv[4]) || 9400;
const TREES = process.argv.slice(5).length ? process.argv.slice(5) : ['treeSTB', 'treeSTC'];
const q = (a, f) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
(async () => {
    const br = await chromium.launch();
    const out = {};
    for (const T of TREES) {
        const ROOT = path.join(__dirname, T);
        const p = await br.newPage();
        p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
        await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
        await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        const agg = { n: 0, trusted: 0, defeated: 0, clr: [], prox: [], cost0: [], clean0: [], dev: [], fins: [] };
        for (let t = 0; t < TRIALS; t++) {
            const r = await p.evaluate((seed) => {
                window.evalHarness.seed = seed; window.resetGame(); window.startRace();
                const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
                state.course.cutoff = 900;
                window.__STAIR = { n: 0, trusted: 0, defeated: 0, clr: [], prox: [], cost0: [], clean0: [], dev: [] };
                const bots = state.boats.filter(b => !b.isPlayer);
                const fins = [];
                for (let i = 0; i < 60 * 940; i++) {
                    window.update(1 / 60);
                    if (state.race.status === 'finished') break;
                    if (state.race.status !== 'racing') continue;
                    if (state.race.timer > 900) break;
                    for (const b of bots) if (b.raceState.finished && !b.__d) { b.__d = 1; fins.push(Math.round(state.race.timer)); }
                    if (bots.every(b => b.raceState.finished)) break;
                }
                const S = window.__STAIR; window.__STAIR = null;
                // subsample the big arrays so the transfer stays small
                const sub = (a, k) => a.filter((_, i) => i % k === 0);
                return { n: S.n, trusted: S.trusted, defeated: S.defeated,
                         clr: sub(S.clr, 7), prox: sub(S.prox, 7), cost0: sub(S.cost0, 7),
                         clean0: sub(S.clean0, 7), dev: sub(S.dev, 7), fins };
            }, SEED0 + t);
            agg.n += r.n; agg.trusted += r.trusted; agg.defeated += r.defeated;
            for (const k of ['clr', 'prox', 'cost0', 'clean0', 'dev']) agg[k].push(...r[k]);
            agg.fins.push(...r.fins);
            console.log(`  ${T} seed ${SEED0 + t}: ${r.fins.length} fins, ${r.n} decisions`);
        }
        await p.close();
        out[T] = agg;
    }
    await br.close();
    console.log(`\n=== ${VENUE}, ${TRIALS} seeds from ${SEED0} — THE STAIRCASE ON THE 0-RUNG ===`);
    const row = (label, f) => console.log('  ' + label.padEnd(42) + TREES.map(T => String(f(out[T])).padStart(14)).join(''));
    console.log('  ' + ''.padEnd(42) + TREES.map(T => T.padStart(14)).join(''));
    row('decisions sampled', a => a.n);
    row('bandTrusted in force on the 0-rung', a => a.n ? (100 * a.trusted / a.n).toFixed(1) + '%' : '-');
    row('0-rung clearance clr = 1 cell (pays 6667)', a => (100 * a.clr.filter(v => v === 1).length / (a.clr.length || 1)).toFixed(1) + '%');
    row('0-rung clearance clr = 2 cells (pays 3333)', a => (100 * a.clr.filter(v => v === 2).length / (a.clr.length || 1)).toFixed(1) + '%');
    row('0-rung clearance clr >= 3 (pays nothing)', a => (100 * a.clr.filter(v => v >= 3).length / (a.clr.length || 1)).toFixed(1) + '%');
    row("0-rung's proximityCost, median", a => q(a.prox, 0.5));
    row("0-rung's proximityCost, p75", a => q(a.prox, 0.75));
    row("0-rung's TOTAL cost, median", a => q(a.cost0, 0.5));
    row('0-rung carried no collision and no rule', a => (100 * a.clean0.filter(v => v).length / (a.clean0.length || 1)).toFixed(1) + '%');
    row('argmin left the 0-rung (>0.05 rad)', a => a.n ? (100 * a.defeated / a.n).toFixed(1) + '%' : '-');
    row('deflection when it did, median (deg)', a => (q(a.dev.filter(v => v > 0.05), 0.5) * 180 / Math.PI).toFixed(1));
    row('mean deflection over ALL ticks (deg)', a => (mean(a.dev) * 180 / Math.PI).toFixed(1));
    row('finish times, median', a => q(a.fins, 0.5));
    row('finish times, mean', a => mean(a.fins).toFixed(1));
})();

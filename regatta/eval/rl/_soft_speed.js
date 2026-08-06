// WHAT DOES A SOFT CELL ACTUALLY COST? — measured, against what the router charges.
//
// `pathSailable` prices floe-plugged water at 2.5x (an opening lead, `_soft==1`) and 6x
// (staying plugged, `_soft==2`). Those numbers were chosen, not measured. This measures
// them: at 10 Hz, classify every bot by the `_soft` value of the cell she is standing
// in, and report her speed as a fraction of what the polar says she should be doing on
// that heading in that wind. The ratio 1/frac is the honest multiplier.
//
// If the measurement is CHEAPER than the charge, the router is detouring around water it
// could grind through; if dearer, it is routing boats into plugs.
//
//   node _soft_speed.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHEAD');
const VENUE = process.argv[5] || 'arctic';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = { 0: [], 1: [], 2: [], hard: [] };
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const out = { 0: [], 1: [], 2: [], hard: [] };
            const dt = 1 / 60; let acc = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++acc >= 6) {          // 10 Hz
                    acc = 0;
                    const g = state.course.botGrid;
                    if (g) for (const b of bots) {
                        if (b.raceState.finished || b.raceState.leg < 1) continue;
                        const c = g.cell(b.x, b.y);
                        if (c[0] < 0 || c[1] < 0 || c[0] >= g.n || c[1] >= g.n) continue;
                        const id = c[1] * g.n + c[0];
                        const w = getWindAt(b.x, b.y);
                        const twa = Math.abs(norm(b.heading - w.direction));
                        const pol = getTargetSpeed(twa, twa > Math.PI / 2, w.speed);
                        if (pol < 0.5) continue;
                        const frac = (b.speed / 0.25) / pol;
                        let key;
                        if (g.at(c[0], c[1])) key = 0;
                        else if (g._soft && g._soft[id]) key = g._soft[id];
                        else key = 'hard';
                        out[key].push(+frac.toFixed(3));
                    }
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            return out;
        }, SEED0 + i);
        for (const k of Object.keys(agg)) agg[k] = agg[k].concat(r[k] || []);
        console.error('seed ' + (SEED0 + i) + ' done');
    }
    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
    const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const total = Object.values(agg).reduce((n, a) => n + a.length, 0);
    console.log(`venue=${VENUE}  ${TRIALS} races  ${total} samples`);
    const names = { 0: 'OPEN (nav)', 1: 'SOFT=1 opening lead  (router charges 2.5x)',
                    2: 'SOFT=2 plugged       (router charges 6x)', hard: 'HARD (land/blocked)' };
    for (const k of ['0', '1', '2', 'hard']) {
        const a = agg[k];
        if (!a.length) { console.log(`  ${names[k].padEnd(44)} no samples`); continue; }
        const m = mean(a);
        const open = mean(agg['0']) || 1;
        console.log(`  ${names[k].padEnd(44)} n=${String(a.length).padStart(6)}`
            + ` (${(100 * a.length / total).toFixed(1).padStart(4)}%)  frac-of-polar mean ${m.toFixed(3)}`
            + ` med ${q(a, 0.5).toFixed(3)} p10 ${q(a, 0.1).toFixed(3)}`
            + `  =>  vs OPEN ${(open / Math.max(0.02, m)).toFixed(2)}x`);
    }
    await browser.close();
})();

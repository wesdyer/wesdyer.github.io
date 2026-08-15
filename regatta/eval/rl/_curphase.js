// ⚠️ THE CURRENT IS TIME-VARYING, SO `_avCurMax` IS A SNAPSHOT (2026-08-13).
//
// `getCurrentAt` (script.js ~5352) oscillates every authored region:
//     osc = sin((state.time / r.period) * 2PI + r.phase)
//     speed = max(0, r.speed + r.speedVar * osc)
// and `state.course._avCurMax` is computed ONCE, lazily, at whatever `state.time`
// the first full replan happens to occur — then cached for the whole race and read
// by seven gates. Two things follow and both need measuring before any claim about
// the venue's current class:
//   1. the scalar is a snapshot of one tidal phase, not a property of the venue;
//   2. it is cached off a key that does not contain the time (trap 25's shape) —
//      the value is stable in practice only because every boat's first replan
//      lands in the first second.
//
// This sweeps a full period and reports max / p90 / p99 / %>=2.0 at each phase, so
// the venue-class question ("is this a 2+ kt stream?") is answered over the tide
// rather than at t=0.
//   node _curphase.js [tree] [venue ...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeGLB');
const VENUES = process.argv.slice(3).length ? process.argv.slice(3) : ['glowtide', 'river', 'bay', 'lagoon'];
(async () => {
    const br = await chromium.launch();
    for (const V of VENUES) {
        const p = await br.newPage();
        p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
        await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, V);
        await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        const r = await p.evaluate(() => {
            window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
            for (let i = 0; i < 60; i++) window.update(1 / 60);
            const g = state.course.botGrid;
            const regs = state.course.currentRegions || [];
            const periods = regs.map(r => r.period || 0).filter(p => p > 0);
            const P = periods.length ? Math.max(...periods) : 0;
            const t0 = state.time;
            const rows = [];
            const STEPS = 24;
            for (let s = 0; s < STEPS; s++) {
                state.time = t0 + (P > 0 ? (s / STEPS) * P : 0);
                const cur = [];
                for (let y = 0; y < g.n; y += 4) for (let x = 0; x < g.n; x += 4) {
                    if (!g.at(x, y)) continue;
                    const c = getCurrentAt(g.x0 + (x + 0.5) * g.res, g.y0 + (y + 0.5) * g.res);
                    cur.push(c ? c.speed : 0);
                }
                cur.sort((a, b) => a - b);
                const q = (f) => cur.length ? cur[Math.min(cur.length - 1, Math.floor(f * cur.length))] : 0;
                rows.push({
                    t: +(state.time - t0).toFixed(1), max: +(cur[cur.length - 1] || 0).toFixed(2),
                    p90: +q(0.90).toFixed(2), p99: +q(0.99).toFixed(2), med: +q(0.5).toFixed(2),
                    over: +(100 * cur.filter(v => v >= 2.0).length / (cur.length || 1)).toFixed(2)
                });
                if (P <= 0) break;
            }
            state.time = t0;
            return { rows, P, nreg: regs.length, periods: [...new Set(periods)].slice(0, 6),
                     speedVar: [...new Set(regs.map(r => +(r.speedVar || 0).toFixed(2)))].slice(0, 8) };
        });
        await p.close();
        console.log(`\n=== ${V} ===  ${r.nreg} current regions, periods ${JSON.stringify(r.periods)}, speedVar ${JSON.stringify(r.speedVar)}`);
        if (!r.P) { console.log('  no oscillating region — the snapshot IS the venue'); }
        const mx = Math.max(...r.rows.map(x => x.max)), p90mx = Math.max(...r.rows.map(x => x.p90));
        const p99mx = Math.max(...r.rows.map(x => x.p99)), ovmx = Math.max(...r.rows.map(x => x.over));
        console.log('   phase |   max    p90    p99    med   %>=2.0');
        for (const x of r.rows) console.log(`   ${String(x.t).padStart(6)} | ${String(x.max).padStart(5)} ${String(x.p90).padStart(6)} ${String(x.p99).padStart(6)} ${String(x.med).padStart(6)} ${String(x.over).padStart(7)}`);
        console.log(`  ⭐ WORST PHASE: max ${mx}   p90 ${p90mx}   p99 ${p99mx}   %>=2.0 ${ovmx}%` +
            `   => gate under MAX: ${mx >= 2.0 ? 'OFF' : 'ON '}   under p90: ${p90mx >= 2.0 ? 'OFF' : 'ON '}   under p99: ${p99mx >= 2.0 ? 'OFF' : 'ON '}`);
    }
    await br.close();
})();

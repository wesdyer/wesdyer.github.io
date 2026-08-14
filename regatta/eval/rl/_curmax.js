// WHAT IS `_avCurMax` ON EVERY VENUE — AND WHAT DOES IT SWITCH OFF? (2026-08-13)
//
// `state.course._avCurMax` is the MAXIMUM blended current over navigable cells
// (script.js ~2068, sampled every 4th cell). It is a single whole-venue scalar and
// it gates SEVEN separate behaviours at `< 2.0 kt`, including `bandTrusted` — the
// HZ3B waiver (script.js ~4429) that exempts the router's own plan-aligned line
// from the 10000-scale clearance staircase, and which is the redrock landing
// `08f734a` in its current form.
//
// Glowtide is a HIGH-CURRENT ROCK venue. If its MAX current is >= 2.0 anywhere on
// the map, every one of those seven gates is off venue-wide, and the staircase
// taxes the plan-aligned 0-rung on exactly the venue whose leg 3 is a rounding.
//
// Prints, per venue: _avCurMax, and the DISTRIBUTION of current over navigable
// cells (so we can see whether the max is a whole-venue property or one hot cell),
// plus whether the venue has floes (openWaterAv) and how many current regions.
//   node _curmax.js [tree] [venue ...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeGLB');
const VENUES = process.argv.slice(3).length ? process.argv.slice(3)
    : ['glowtide', 'redrock', 'river', 'arctic', 'lake', 'bay', 'ocean', 'lagoon', 'seatrials', 'swamp'];
(async () => {
    const br = await chromium.launch();
    const rows = [];
    for (const V of VENUES) {
        const p = await br.newPage();
        p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
        await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, V);
        await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        const r = await p.evaluate(() => {
            window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
            // step a little so the grid and any lazy fields exist
            for (let i = 0; i < 120; i++) window.update(1 / 60);
            const g = state.course.botGrid;
            const cur = [];
            let nav = 0;
            if (g && (state.course.currentRegions || []).length) {
                for (let y = 0; y < g.n; y += 4) for (let x = 0; x < g.n; x += 4) {
                    if (!g.at(x, y)) continue;
                    nav++;
                    const c = getCurrentAt(g.x0 + (x + 0.5) * g.res, g.y0 + (y + 0.5) * g.res);
                    cur.push(c ? c.speed : 0);
                }
            } else if (g) {
                for (let y = 0; y < g.n; y += 4) for (let x = 0; x < g.n; x += 4) if (g.at(x, y)) { nav++; cur.push(0); }
            }
            cur.sort((a, b) => a - b);
            const q = (f) => cur.length ? cur[Math.min(cur.length - 1, Math.floor(f * cur.length))] : 0;
            // how much of the navigable map is actually at/over the 2.0 knee?
            const over = cur.filter(v => v >= 2.0).length;
            return {
                avCurMax: state.course._avCurMax,
                regions: (state.course.currentRegions || []).length,
                floes: (state.course._floeObjs || []).length,
                navCells: nav,
                med: q(0.5), p75: q(0.75), p90: q(0.90), p99: q(0.99), max: cur.length ? cur[cur.length - 1] : 0,
                pctOver2: nav ? +(100 * over / nav).toFixed(1) : 0,
                islands: (state.course.islands || []).length
            };
        });
        await p.close();
        rows.push({ venue: V, ...r });
        console.log(`${V.padEnd(10)} avCurMax ${String(r.avCurMax).padStart(6)}  GATE ${r.avCurMax === undefined || r.avCurMax < 2.0 ? 'ON ' : 'OFF'}` +
            `  regions ${r.regions}  floes ${r.floes}  islands ${r.islands}` +
            `  | current over navigable: med ${(+r.med).toFixed(2)} p75 ${(+r.p75).toFixed(2)} p90 ${(+r.p90).toFixed(2)} p99 ${(+r.p99).toFixed(2)} max ${(+r.max).toFixed(2)}  %>=2.0 ${r.pctOver2}%`);
    }
    await br.close();
    fs.writeFileSync(path.join(__dirname, '_curmax.json'), JSON.stringify(rows, null, 1));
    console.log('\nGATE ON  = _avCurMax < 2.0  => bandTrusted (HZ3B staircase waiver), jam stamps, short probe, and four more are ALIVE');
    console.log('GATE OFF = _avCurMax >= 2.0 => all seven are dead venue-wide, on the strength of the single worst navigable cell');
})();

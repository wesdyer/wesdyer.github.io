// AT-THE-GUN FINGERPRINT ONLY — no racing, so it costs a second and can be run in
// as many processes as you like. Pair with `_riv_ndet.js` (which races).
//
// Purpose: river bench results differ across PROCESSES on the same tree and seed
// while redrock, lake and glowtide are byte-identical. Something is baked before
// `eval_harness` stubs Math.random and survives `resetGame`. This prints the world
// the moment the gun goes, field by field, so two processes can be diffed and the
// leak NAMED rather than inferred.
//
//   node _riv_fp.js <venue> <tree> <seed> [--late]
// `--late` sets the venue AFTER page load the way `run_traces.js` does (its
// localStorage write happens after goto, so the page loads on the DEFAULT venue and
// the target venue is only built by the first resetGame). `ocean_bench.js` instead
// uses addInitScript, so the page LOADS on the target venue — that difference is the
// leading suspect for why the goldens are stable while the bench is not.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const V = process.argv[2] || 'river';
const ROOT = path.join(__dirname, process.argv[3] || 'treeGLB');
const SEED = parseInt(process.argv[4]) || 9400;
const LATE = process.argv.includes('--late');
(async () => {
    const br = await chromium.launch();
    const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    if (!LATE) await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, V);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    if (LATE) await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), V);
    const r = await p.evaluate((seed) => {
        window.evalHarness.seed = seed; window.resetGame(); window.startRace();
        const bots = state.boats.filter(b => !b.isPlayer);
        const g = state.course.botGrid;
        let navCells = 0, clrSum = 0, gridHash = 0;
        if (g) {
            for (let y = 0; y < g.n; y++) for (let x = 0; x < g.n; x++) if (g.at(x, y)) { navCells++; gridHash = (gridHash * 31 + y * g.n + x) >>> 0; }
            if (g._clear) for (let i = 0; i < g._clear.length; i++) clrSum += g._clear[i];
        }
        const gs = state.course._botGridStatic;
        let statCells = 0;
        if (gs) for (let y = 0; y < gs.n; y++) for (let x = 0; x < gs.n; x++) if (gs.at(x, y)) statCells++;
        const cond = state.race.conditions || {};
        const S = (o) => JSON.stringify(o, (k, v) => typeof v === 'number' ? +v.toFixed(6) : v);
        return {
            venue: (window.settings || {}).venue,
            conditions: S({ w: cond.wind, c: cond.current, s: cond.swell, t: cond.tideDir }),
            navCells, statCells, clrSum, gridHash,
            islands: (state.course.islands || []).length,
            islandHash: (state.course.islands || []).map(i => `${Math.round(i.x)},${Math.round(i.y)},${Math.round(i.radius)}`).join('|').length,
            props: (state.course.props || []).length,
            marks: (state.course.marks || []).map(m => `${Math.round(m.x)},${Math.round(m.y)}`).join('|'),
            boats: bots.map(b => `${b.name}:${b.x.toFixed(4)},${b.y.toFixed(4)},${b.heading.toFixed(6)}`).join(' '),
            traits: bots.map(b => b.traits ? Object.keys(b.traits).sort().map(k => k + '=' + (+b.traits[k]).toFixed(3)).join(',') : '-').join(' '),
            stats: bots.map(b => b.stats ? Object.keys(b.stats).sort().map(k => k + '=' + b.stats[k]).join(',') : '-').join(' '),
            wind: [[0, 0], [1000, -1000], [-1500, 500], [3000, -3000], [-3000, 3000]].map(([x, y]) => { const w = getWindAt(x, y); return `${w.direction.toFixed(6)}/${w.speed.toFixed(6)}`; }).join(' '),
            cur: [[0, 0], [1000, -1000], [-1500, 500], [3000, -3000], [-3000, 3000]].map(([x, y]) => { const c = getCurrentAt(x, y); return c ? `${c.direction.toFixed(6)}/${c.speed.toFixed(6)}` : '-'; }).join(' '),
            stime: +state.time.toFixed(6),
            wfx: (() => { const gg = state.course.botGrid; if (!gg || !gg._wfx) return '-'; let s = 0; for (let i = 0; i < gg._wfx.length; i += 5) s += gg._wfx[i]; return s.toFixed(6); })(),
            leeW: (() => { const gg = state.course.botGrid; if (!gg || !gg._leeW) return '-'; let s = 0; for (let i = 0; i < gg._leeW.length; i += 5) s += gg._leeW[i]; return s.toFixed(6); })()
        };
    }, SEED);
    await br.close();
    console.log(JSON.stringify(r, null, 1));
})();

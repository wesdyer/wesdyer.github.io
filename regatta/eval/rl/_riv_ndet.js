// ⚠️⚠️ RIVER IS NOT REPRODUCIBLE ACROSS PROCESSES (2026-08-13). WHY?
//
// Two `ocean_bench.js 3 9400 ... treeGLB river` runs of the SAME TREE, same seed:
//   run 1   7 finishers  213,234,247,257,263,279,282
//   run 2   9 finishers  204,219,225,247,261,262,275,337,352
// while redrock, lake and glowtide are byte-identical across both processes AND
// across trees. So this is river-specific, and it is trap 25's family: a bake made
// at PAGE LOAD, before `eval_harness` stubs Math.random, cached past `resetGame`,
// and therefore carrying per-process entropy into every race the process runs.
//
// This probe separates the two possibilities without guessing:
//   A. WITHIN one process, race the same seed twice. If the two agree, the state
//      that differs is fixed before the first race and survives resetGame  =>
//      page-load bake. If they DISAGREE, something leaks between races instead.
//   B. Print the candidate baked fields and the RNG call count at the gun, so the
//      divergence has a name rather than a symptom. (`_bay_ndet` hunted the bay
//      case as constants -> RNG-count -> deep state diff; this is the same ladder.)
//
//   node _riv_ndet.js [venue] [tree] [seed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const V = process.argv[2] || 'river';
const ROOT = path.join(__dirname, process.argv[3] || 'treeGLB');
const SEED = parseInt(process.argv[4]) || 9400;
(async () => {
    const br = await chromium.launch();
    const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, V);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await p.evaluate(async (seed) => {
        const race = () => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            // fingerprint the world AT THE GUN, before any boat has moved
            const g = state.course.botGrid;
            let navCells = 0, clrSum = 0;
            if (g) {
                for (let y = 0; y < g.n; y += 2) for (let x = 0; x < g.n; x += 2) if (g.at(x, y)) navCells++;
                if (g._clear) for (let i = 0; i < g._clear.length; i += 7) clrSum += g._clear[i];
            }
            const cond = state.race.conditions || {};
            const stamp = {
                windDir: +(cond.windDir != null ? cond.windDir : (cond.wind && cond.wind.direction) || 0).toFixed(6),
                windSpd: +(cond.windSpeed != null ? cond.windSpeed : (cond.wind && cond.wind.speed) || 0).toFixed(6),
                curSpd: +((cond.current && cond.current.speed) || 0).toFixed(6),
                curDir: +((cond.current && cond.current.direction) || 0).toFixed(6),
                navCells, clrSum,
                marks: (state.course.marks || []).map(m => `${Math.round(m.x)},${Math.round(m.y)}`).join('|'),
                islands: (state.course.islands || []).length,
                boats: bots.map(b => `${b.name}:${b.x.toFixed(3)},${b.y.toFixed(3)},${b.heading.toFixed(5)}`).join(' '),
                traits: bots.map(b => b.traits ? Object.keys(b.traits).sort().map(k => k + '=' + (+b.traits[k]).toFixed(3)).join(',') : '-').join(' '),
                stats: bots.map(b => b.stats ? Object.keys(b.stats).sort().map(k => k + '=' + b.stats[k]).join(',') : '-').join(' '),
                windSample: [[0, 0], [1000, -1000], [-1500, 500], [3000, -3000]].map(([x, y]) => {
                    const w = getWindAt(x, y); return `${w.direction.toFixed(6)}/${w.speed.toFixed(6)}`;
                }).join(' '),
                curSample: [[0, 0], [1000, -1000], [-1500, 500], [3000, -3000]].map(([x, y]) => {
                    const c = getCurrentAt(x, y); return c ? `${c.direction.toFixed(6)}/${c.speed.toFixed(6)}` : '-';
                }).join(' ')
            };
            // race it
            const fins = [];
            for (let i = 0; i < 60 * 940; i++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (const b of bots) if (b.raceState.finished && !b.__done) { b.__done = 1; fins.push(Math.round(state.race.timer)); }
                if (bots.every(b => b.raceState.finished)) break;
            }
            return { stamp, fins: fins.slice().sort((a, b) => a - b), rng: (window.evalHarness && window.evalHarness.rngCount) || null };
        };
        const a = race(), b = race();
        return { a, b };
    }, SEED);
    await br.close();
    console.log(`\n=== ${V}, ${path.basename(ROOT)}, seed ${SEED} — TWO RACES IN ONE PROCESS ===`);
    console.log(`  race 1 finishers ${r.a.fins.length}: ${r.a.fins.join(',')}`);
    console.log(`  race 2 finishers ${r.b.fins.length}: ${r.b.fins.join(',')}`);
    console.log(`  => within-process: ${JSON.stringify(r.a.fins) === JSON.stringify(r.b.fins) ? 'IDENTICAL' : '⚠️ DIFFERENT'}`);
    console.log('\n  AT-THE-GUN FINGERPRINT (race 1 vs race 2):');
    for (const k of Object.keys(r.a.stamp)) {
        const same = String(r.a.stamp[k]) === String(r.b.stamp[k]);
        const show = (v) => { const s = String(v); return s.length > 110 ? s.slice(0, 110) + '…' : s; };
        console.log(`   ${same ? ' ' : '⚠️'} ${k.padEnd(11)} ${same ? show(r.a.stamp[k]) : show(r.a.stamp[k]) + '\n                 vs ' + show(r.b.stamp[k])}`);
    }
    fs.writeFileSync(path.join(__dirname, `_riv_ndet_${V}.json`), JSON.stringify(r));
    console.log('\n  Run this twice in two PROCESSES and diff the fingerprints to find the page-load bake.');
})();

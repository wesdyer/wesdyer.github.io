// WHERE DOES A RIVER RACE FIRST DIVERGE BETWEEN TWO PROCESSES? (2026-08-13)
//
// Established: two `ocean_bench` runs of the SAME tree and seed on river give
// different finish times, while redrock / lake / glowtide are byte-identical; and
// `_riv_fp.js` says the world AT THE GUN — conditions, grid, marks, boat positions,
// traits, stats, wind and current samples — is identical across processes. So the
// leak is inside the update loop.
//
// This records a per-second checkpoint (a hash of every boat's position, heading and
// speed, plus the wind and current sampled at a fixed point, plus the number of
// live gusts) and writes it to JSON. Run it in two processes and diff the files:
// the first differing checkpoint names the second, the boat and the quantity.
//
//   node _riv_diverge.js <venue> <tree> <seed> <outfile>
//   node _riv_diverge.js river treeGLB 9400 d1.json ; node ... d2.json ; node _riv_diverge.js --diff d1.json d2.json
const fs = require('fs'); const path = require('path');
if (process.argv[2] === '--diff') {
    const A = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    const B = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
    const n = Math.min(A.cps.length, B.cps.length);
    let first = -1;
    for (let i = 0; i < n; i++) { if (JSON.stringify(A.cps[i]) !== JSON.stringify(B.cps[i])) { first = i; break; } }
    if (first < 0) { console.log(`IDENTICAL over ${n} checkpoints (${A.cps.length} vs ${B.cps.length})`); process.exit(0); }
    console.log(`⚠️ FIRST DIVERGENCE at checkpoint ${first} (t = ${A.cps[first].t}s)`);
    const a = A.cps[first], b = B.cps[first];
    for (const k of Object.keys(a)) {
        if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
        console.log(`   ${k}:`);
        if (Array.isArray(a[k])) {
            for (let j = 0; j < Math.max(a[k].length, b[k].length); j++)
                if (JSON.stringify(a[k][j]) !== JSON.stringify(b[k][j]))
                    console.log(`      [${j}]  ${JSON.stringify(a[k][j])}\n         vs ${JSON.stringify(b[k][j])}`);
        } else console.log(`      ${JSON.stringify(a[k])}\n         vs ${JSON.stringify(b[k])}`);
    }
    if (first > 0) console.log(`\n   (checkpoint ${first - 1} at t=${A.cps[first - 1].t}s was identical)`);
    process.exit(0);
}
const { chromium } = require('playwright');
const V = process.argv[2] || 'river';
const ROOT = path.join(__dirname, process.argv[3] || 'treeGLB');
const SEED = parseInt(process.argv[4]) || 9400;
const OUT = process.argv[5] || 'divg.json';
const STEP = parseFloat(process.argv[6] || '1.0');
const TMAX = parseFloat(process.argv[7] || '300');
(async () => {
    // JSFLAGS lets the V8 optimizing tiers be pinned. If two processes agree under
    // `--no-opt` but disagree by default, the divergence is JIT-tier-dependent
    // floating point — i.e. it depends on how hot the machine let the code get,
    // which is a load-dependent bench reproducibility bug rather than a game bug.
    const JSFLAGS = process.env.JSFLAGS;
    const br = await chromium.launch(JSFLAGS ? { args: ['--js-flags=' + JSFLAGS] } : {});
    const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    // --late reproduces run_traces.js's setup: the venue is written to localStorage
    // AFTER the page has loaded, so the page boots on the DEFAULT venue and the target
    // venue is only ever built by the first seeded resetGame. ocean_bench.js instead
    // uses addInitScript, so the page LOADS on the target venue and whatever the
    // pre-harness requestAnimationFrame frames touch is target-venue state.
    const LATE = process.argv.includes('--late');
    if (!LATE) await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, V);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    if (LATE) await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), V);
    const r = await p.evaluate(([seed, STEP, TMAX]) => {
        window.evalHarness.seed = seed; window.resetGame(); window.startRace();
        const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const cps = [];
        let next = 0;
        for (let i = 0; i < 60 * (TMAX + 100); i++) {
            window.update(1 / 60);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            if (state.race.timer >= next) {
                next += STEP;
                const w = getWindAt(0, 0), c = getCurrentAt(0, 0);
                const G = state.race.gusts || state.gusts || state.course.gusts || [];
                cps.push({
                    t: +state.race.timer.toFixed(3),
                    b: bots.map(b => `${b.x.toFixed(6)},${b.y.toFixed(6)},${b.heading.toFixed(8)},${b.speed.toFixed(8)}`),
                    // the wind and current the BOAT actually has — a gust drifting
                    // across her is invisible in a fixed-point sample
                    bw: bots.map(b => { const q = getWindAt(b.x, b.y); return `${q.direction.toFixed(8)}/${q.speed.toFixed(8)}`; }),
                    bc: bots.map(b => { const q = getCurrentAt(b.x, b.y); return q ? `${q.direction.toFixed(8)}/${q.speed.toFixed(8)}` : '-'; }),
                    bs: bots.map(b => `${(b.shoalDrag != null ? b.shoalDrag : (typeof shoalFieldAt === 'function' ? shoalFieldAt(b.x, b.y) : 0))}`),
                    w: `${w.direction.toFixed(8)}/${w.speed.toFixed(8)}`,
                    c: c ? `${c.direction.toFixed(8)}/${c.speed.toFixed(8)}` : '-',
                    gN: G.length,
                    gH: G.map(g => `${(g.x || 0).toFixed(2)},${(g.y || 0).toFixed(2)},${(g.r || g.radius || 0).toFixed(2)},${(g.strength || g.mult || 0).toFixed(4)}`).join('|'),
                    sq: (state.race.squalls || state.squalls || []).length,
                    stime: +state.time.toFixed(6),
                    // ⭐ THE RNG CURSOR. eval_harness's `random()` mutates `this.seed`
                    // in place, so `evalHarness.seed` IS the generator state: if two
                    // processes differ here, a different NUMBER of draws was consumed
                    // and the divergence is a stochastic branch, not arithmetic.
                    rng: window.evalHarness.seed >>> 0,
                    dh: bots.map(b => b.controller ? [
                        b.controller.avoidanceRole, b.controller.riskState,
                        b.controller.threatBoat ? b.controller.threatBoat.name : '-',
                        (b.controller._lastAvoidChoice != null ? b.controller._lastAvoidChoice : 0).toFixed(6),
                        (b.controller.lastAvoidDeviation || 0).toFixed(6),
                        (b.controller.gridTimer || 0).toFixed(4), (b.controller.gridAge || 0).toFixed(4),
                        (b.controller.updateTimer || 0).toFixed(6),
                        b.controller.gridPath ? b.controller.gridPath.length : -1
                    ].join(',') : '-')
                });
            }
            if (state.race.timer > TMAX) break;
        }
        return { cps, seed };
    }, [SEED, STEP, TMAX]);
    await br.close();
    fs.writeFileSync(path.join(__dirname, OUT), JSON.stringify(r));
    console.log(`wrote ${OUT}: ${r.cps.length} checkpoints`);
})();

// HULL SIDE-CHANGES WITHOUT ENGINE INSTRUMENTATION (2026-08-21): samples
// Rules.getTack per frame per bot on racing legs; a flip counts when the
// previous side was stable >= 0.5s (tack-through jitter collapses). At each
// flip: controller role, threat presence, nearest-rival range, roundArmed.
// Replaces the __exLog-based ownership read for the NON-THREAT question
// (treeEX's instrumented engine predates the gwe landing) — this one runs
// on ANY tree. Census: what share of manoeuvres happen with no role, no
// threat, and no rival inside 300u?
//   node _flips.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGWE');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const rows = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const flips = [];
            const st = new Map();   // id -> {side, stable}
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
                if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished || bt.raceState.leg < 1) continue;
                    const side = window.Rules.getTack(bt);
                    if (!side) continue;
                    let s = st.get(bt.id);
                    if (!s) { st.set(bt.id, { side, stable: 0 }); continue; }
                    if (side === s.side) { s.stable++; continue; }
                    if (s.stable >= 30) {
                        const c = bt.controller || {};
                        let rng = Infinity;
                        for (const ob of state.boats) {
                            if (ob === bt || ob.isPlayer || ob.raceState.finished) continue;
                            const d = Math.hypot(ob.x - bt.x, ob.y - bt.y);
                            if (d < rng) rng = d;
                        }
                        flips.push({ t: +state.race.timer.toFixed(1), n: bt.name,
                                     role: c.avoidanceRole || 'NONE', threat: c.threatBoat ? 1 : 0,
                                     risk: c.riskState || '-',
                                     rng: rng === Infinity ? null : Math.round(rng),
                                     armed: bt.raceState.roundArmed ? 1 : 0,
                                     pen: bt.raceState.penalty ? 1 : 0,
                                     leg: bt.raceState.leg });
                    }
                    s.side = side; s.stable = 0;
                }
            }
            return flips;
        }, seed);
        for (const r of rows) { r.seed = seed; all.push(r); }
        console.log(`seed ${seed}: ${rows.length} side-changes`);
    }
    await browser.close();
    const cls = {};
    for (const r of all) {
        const bits = [];
        if (r.armed) bits.push('armed');
        if (r.pen) bits.push('pen');
        if (r.role !== 'NONE' && r.role !== '-') bits.push(r.role);
        else if (!r.threat && (r.rng == null || r.rng > 300)) bits.push('NOROLE-far');
        else if (!r.threat) bits.push('NOROLE-near');
        else bits.push('NOROLE-threat');
        const k = bits.join('/') || 'plain';
        cls[k] = (cls[k] || 0) + 1;
    }
    const rngs = all.map(r => r.rng).filter(x => x != null).sort((a, b) => a - b);
    console.log(`\n${all.length} side-changes over ${TRIALS} seed(s) — census:`);
    for (const [k, v] of Object.entries(cls).sort((x, y) => y[1] - x[1]))
        console.log(`  ${String(v).padStart(5)}  ${(100 * v / all.length).toFixed(1).padStart(5)}%  ${k}`);
    console.log(`nearest-rival at flip p25/med/p75: ${rngs[Math.floor(rngs.length * .25)]}/${rngs[Math.floor(rngs.length * .5)]}/${rngs[Math.floor(rngs.length * .75)]}u`);
    console.log(`flips/boat-race: ${(all.length / (TRIALS * 9)).toFixed(1)}`);
})();

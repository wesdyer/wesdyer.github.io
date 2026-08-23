// WEDGE-PUSH OPENING PROBE (2026-08-21): what puts a boat INTO the wedge?
// A wedge ENTRY = the first frame of a >=3s window with speed < 1kt on a
// racing leg (the stuck class — swamp/glow tail grinds live here, rule 28's
// speed-collapse). At entry, look BACK 5 real seconds and classify:
//   traffic  — a rival came inside 150u in the prior 5s
//   steered  — avoidance deviation exceeded 20 deg in the prior 5s
//   both     — both of the above
//   nav      — neither: her own course sailed her in
// plus role/pen/wiggle state and position. Dedupe: one entry per boat per
// 10s. This names the wedge push's lever: entry prevention (traffic vs
// nav-line) vs escape quality.
//   node _wedge_entry.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'swamp';
const TRIALS = parseInt(process.argv[3]) || 4;
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
            const HISTN = 100;           // 5s at 20Hz
            const hist = new Map();      // id -> {rng:[], dev:[], slow:0, lastEntryT:-99}
            const out = [];
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
                if (state.race.status !== 'racing' || (it % 3)) continue;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished || bt.raceState.leg < 1) continue;
                    let h = hist.get(bt.id);
                    if (!h) { h = { rng: [], dev: [], slow: 0, lastEntryT: -99 }; hist.set(bt.id, h); }
                    const c = bt.controller || {};
                    let rng = Infinity;
                    for (const ob of state.boats) {
                        if (ob === bt || ob.isPlayer || ob.raceState.finished) continue;
                        const d = Math.hypot(ob.x - bt.x, ob.y - bt.y);
                        if (d < rng) rng = d;
                    }
                    h.rng.push(rng); if (h.rng.length > HISTN) h.rng.shift();
                    h.dev.push(Math.abs(c.lastAvoidDeviation || 0)); if (h.dev.length > HISTN) h.dev.shift();
                    const slowNow = (bt.speed * 4) < 1.0;
                    h.slow = slowNow ? h.slow + 3 / 60 : 0;
                    // ENTRY: the slow window just crossed 3s (record ONCE),
                    // and look back past the 3s of slowing itself — the
                    // classification window is the 5s BEFORE the collapse
                    // began, i.e. the oldest 40 samples of the buffer.
                    if (h.slow >= 3 && state.race.timer - h.lastEntryT > 10) {
                        h.lastEntryT = state.race.timer;
                        const pre = h.rng.slice(0, 40), preD = h.dev.slice(0, 40);
                        const minRng = pre.length ? Math.min(...pre) : Infinity;
                        const maxDev = preD.length ? Math.max(...preD) : 0;
                        out.push({ t: +state.race.timer.toFixed(1), n: bt.name,
                                   x: Math.round(bt.x), y: Math.round(bt.y), leg: bt.raceState.leg,
                                   minRng: minRng === Infinity ? null : Math.round(minRng),
                                   maxDevDeg: Math.round(maxDev * 57.3),
                                   role: c.avoidanceRole || '-',
                                   pen: bt.raceState.penalty ? 1 : 0,
                                   wig: c.wiggleActive ? 1 : 0, esc: c.escActive ? 1 : 0 });
                    }
                }
            }
            return out;
        }, seed);
        for (const r of rows) { r.seed = seed; all.push(r); }
        console.log(`seed ${seed}: ${rows.length} wedge entries`);
    }
    await browser.close();
    const cls = {};
    for (const r of all) {
        const traffic = r.minRng != null && r.minRng < 150;
        const steered = r.maxDevDeg > 20;
        let k = traffic && steered ? 'both' : traffic ? 'traffic' : steered ? 'steered' : 'nav';
        if (r.pen) k += '/pen';
        cls[k] = (cls[k] || 0) + 1;
    }
    console.log(`\n${all.length} wedge entries over ${TRIALS} seeds — what preceded the collapse (5s lookback):`);
    for (const [k, v] of Object.entries(cls).sort((x, y) => y[1] - x[1]))
        console.log(`  ${String(v).padStart(4)}  ${(100 * v / all.length).toFixed(1).padStart(5)}%  ${k}`);
    const byLeg = {};
    for (const r of all) byLeg[r.leg] = (byLeg[r.leg] || 0) + 1;
    console.log('entries by leg:', JSON.stringify(byLeg), '| entries/boat-race:', (all.length / (TRIALS * 9)).toFixed(1));
    for (const r of all.slice(0, 10)) console.log(' ', JSON.stringify(r));
    // full rows for spatial/tail analysis — the 10-row sample above elides
    const outPath = path.join(__dirname, `_wedge_${VENUE}.json`);
    fs.writeFileSync(outPath, JSON.stringify(all));
    console.log('rows → ' + outPath);
})();

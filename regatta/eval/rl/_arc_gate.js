// PHASE A1 (redrock push cont., 2026-08-09): at mark-6 ARMED choices, which
// condition keeps arcK==0 — out-of-range (dM >= zone*1.5), current, or the
// queued-rival gate? Reads treeA1's __arcLog instrumentation (2 Hz per boat,
// armed only, dM<700). The build decision: if the queue gate is the sole
// blocker in <50% of slow armed samples, re-size Phase A before building.
//   node _arc_gate.js <venue> <markX> <markY> <trials> <seed0> [tree=treeA1]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const MARK = [parseFloat(process.argv[3]), parseFloat(process.argv[4])];
const TRIALS = parseInt(process.argv[5]) || 4;
const SEED0 = parseInt(process.argv[6]) || 9400;
const ROOT = path.join(__dirname, process.argv[7] || 'treeA1');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate(async ({ seed, MARK }) => {
            window.__arcLog = []; window.__arcMark = MARK;
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
            }
            return window.__arcLog;
        }, { seed: SEED0 + t, MARK });
        console.log(`seed ${SEED0 + t}: ${rows.length} armed samples near mark`);
        for (const r of rows) { r.seed = SEED0 + t; all.push(r); }
    }
    await b.close();
    const pct = (a, b2) => b2 ? Math.round(100 * a / b2) : -1;
    const rep = (label, rows) => {
        const n = rows.length; if (!n) { console.log(`${label}: 0 samples`); return; }
        const inR = rows.filter(r => r.inR === 1);
        const inRcur = inR.filter(r => r.curOK === 1);
        const arcOn = inRcur.filter(r => r.arcOn === 1);
        const qBlk = inRcur.filter(r => r.arcOn === 0);
        const dms = rows.map(r => r.dM).sort((a, c) => a - c);
        console.log(`${label}: n=${n} (${(n * 0.5).toFixed(0)}s of armed time)`);
        console.log(`  dM p25/50/75: ${dms[Math.floor(n * .25)]}/${dms[Math.floor(n * .5)]}/${dms[Math.floor(n * .75)]}  zone*1.5=${Math.round(rows[0].zone * 1.5)}`);
        console.log(`  in arc range: ${pct(inR.length, n)}%  | of in-range: curOK ${pct(inRcur.length, inR.length)}%`);
        console.log(`  of in-range+curOK: ARC ON ${pct(arcOn.length, inRcur.length)}%  QUEUE-BLOCKED ${pct(qBlk.length, inRcur.length)}%`);
        if (qBlk.length) {
            const np = qBlk.map(r => r.nPark).sort((a, c) => a - c);
            const dp = qBlk.map(r => r.dPark).sort((a, c) => a - c);
            console.log(`  queue-blocked detail: nPark p50 ${np[Math.floor(np.length / 2)]}  dPark p50 ${dp[Math.floor(dp.length / 2)]}u`);
        }
        const out = rows.filter(r => r.inR === 0);
        if (out.length) {
            const sOut = out.filter(r => r.spd < 40);
            console.log(`  OUT of range: ${pct(out.length, n)}% of samples; of those slow(<40): ${pct(sOut.length, out.length)}%`);
        }
    };
    rep('ALL armed samples (dM<700)', all);
    rep('SLOW (<40 u/s) armed samples', all.filter(r => r.spd < 40));
    rep('PARKED (<15 u/s) armed samples', all.filter(r => r.spd < 15));
})();

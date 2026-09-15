// WHY DID THE OPEN-WATER BEAT NEVER FIRE? (2026-09-14) Replays one seed on a tree and, every
// 2 s on leg 1, evaluates each OTB1 admission condition for every bot: clearance at the hull
// (cells, and cl*res*1.2 vs the 900 cap), the leg destination's bearing vs the wind (offF vs
// optTWA + 0.15), the straight-line LOS to the destination, and the distance. Prints the
// share of samples passing each condition and all of them.
//   node _ot_open.js [tree] [seed] [venue]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const TREE = process.argv[2] || 'treeOTB1', SEED = parseInt(process.argv[3] || '9400'), VENUE = process.argv[4] || 'otter';
const ROOT = path.join(__dirname, TREE);
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const R = await p.evaluate(({ seed }) => {
        window.evalHarness.seed = seed; window.resetGame(); window.startRace(); state.course.cutoff = 900;
        const pl = state.boats.find(x => x.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
        const nine = state.boats.filter(x => x !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300;
        const g = state.course.botGrid; const out = { res: g.res, n: g.n, hasClear: !!g._clear, sc: typeof SailCheck, los: typeof SailCheck !== 'undefined' && !!SailCheck.losClear, hasFloes: state.course._hasFloes, rows: [] };
        const DT = 1 / 60;
        for (let it = 0; it < 60 * 400; it++) {
            window.update(DT); if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing' || it % 120) continue;
            for (const b of state.boats) {
                const rs = b.raceState; if (rs.finished || rs.leg !== 1) continue;
                const c = b.controller; const dest = c && c._sEnterPt ? c._sEnterPt : null; if (!dest) { out.rows.push({ name: b.name, noDest: 1 }); continue; }
                const c0 = g.cell(b.x, b.y); const cl = g._clear ? g._clear[c0[1] * g.n + c0[0]] : -1;
                const dxF = dest.x - b.x, dyF = dest.y - b.y, dF = Math.hypot(dxF, dyF);
                const w = getWindAt(b.x, b.y); const offF = Math.abs(normalizeAngle(Math.atan2(dxF, -dyF) - w.direction));
                const optF = getCharacterOptimalVMGAngle('upwind', w.speed, b.stats);
                const los = (typeof SailCheck !== 'undefined' && SailCheck.losClear) ? SailCheck.losClear(g, b.x, b.y, dest.x, dest.y) : null;
                out.rows.push({ name: b.name, t: +state.race.timer.toFixed(0), cl, look0: +(cl * g.res * 1.2).toFixed(0), dF: Math.round(dF), offDeg: +(offF * 180 / Math.PI).toFixed(0), optDeg: +(optF * 180 / Math.PI).toFixed(0), los: los ? 1 : 0, ruler: c._rulerMode ? 1 : 0 });
            }
        }
        return out;
    }, { seed: SEED });
    await br.close();
    console.log(`res ${R.res} n ${R.n} _clear ${R.hasClear} SailCheck ${R.sc} losClear ${R.los} hasFloes ${R.hasFloes}; ${R.rows.length} samples on leg 1`);
    const rows = R.rows.filter(r => !r.noDest); console.log(`noDest samples: ${R.rows.length - rows.length}`);
    const pct = (f) => (100 * rows.filter(f).length / rows.length).toFixed(0) + '%';
    console.log(`  clearance cap (look0>=900): ${pct(r => r.look0 >= 900)}   dF>1200: ${pct(r => r.dF > 1200)}   upwind (off<opt+8.6°): ${pct(r => r.offDeg < r.optDeg + 8.6)}   LOS clear: ${pct(r => r.los)}   ALL: ${pct(r => r.look0 >= 900 && r.dF > 1200 && r.offDeg < r.optDeg + 8.6 && r.los)}`);
    const cls = rows.map(r => r.cl).sort((a, b) => a - b); console.log(`  clearance cells p10/p50/p90: ${cls[Math.floor(cls.length * .1)]}/${cls[Math.floor(cls.length * .5)]}/${cls[Math.floor(cls.length * .9)]}  (cap needs ${Math.ceil(750 / R.res)})`);
    for (const r of rows.filter((_, i) => i % 9 === 0).slice(0, 25)) console.log('   ', JSON.stringify(r));
})();

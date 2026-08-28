// What IS the end of the boat's gridPath? planRatio only means "the router's
// ambition for the whole leg" if the path runs to the leg's target; if it ends
// at a local carrot the ratio is a short-horizon number and must not be compared
// with a whole-leg track ratio. Measure the distance from the path's last point
// to the boat's own navigation target and to the leg's mark. (Standing rule 18.)
//   node _gp_end.js <venue> <leg> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay', LEG = parseInt(process.argv[3] || '1');
const TRIALS = parseInt(process.argv[4] || '3'), SEED0 = parseInt(process.argv[5] || '9400');
const ROOT = path.join(__dirname, process.argv[6] || 'treeSPP');
const q = (a, p) => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
(async () => {
    const b = await chromium.launch(); const page = await b.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const rows = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const out = [];
            for (let it = 0; it < 60 * 940; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (it % 60) continue;
                for (const bo of state.boats) {
                    if (bo.raceState.finished || bo.raceState.leg !== LEG) continue;
                    const c = bo.controller, gp = c && c.gridPath;
                    if (!gp || gp.length < 2) continue;
                    const e = gp[gp.length - 1];
                    const nt = c.navTarget;
                    const lm = (state.course.dmc && state.course.dmc.legs && state.course.dmc.legs[LEG])
                        ? state.course.dmc.legs[LEG] : null;
                    out.push({
                        nPts: gp.length,
                        endToNav: nt ? Math.hypot(e.x - nt.x, e.y - nt.y) : null,
                        boatToEnd: Math.hypot(e.x - bo.x, e.y - bo.y),
                        boatToNav: nt ? Math.hypot(nt.x - bo.x, nt.y - bo.y) : null,
                    });
                }
            }
            return out;
        }, { seed: SEED0 + t, LEG });
        rows.push(...r);
    }
    await b.close();
    console.log(`\n══ ${VENUE} leg ${LEG} — what does gridPath end at?  n=${rows.length} samples`);
    console.log(`  path points:            med ${q(rows.map(r=>r.nPts),.5)}`);
    console.log(`  path END -> navTarget:  p25 ${q(rows.map(r=>r.endToNav),.25).toFixed(0)}  MED ${q(rows.map(r=>r.endToNav),.5).toFixed(0)}  p75 ${q(rows.map(r=>r.endToNav),.75).toFixed(0)}`);
    console.log(`  boat -> path END:       MED ${q(rows.map(r=>r.boatToEnd),.5).toFixed(0)}`);
    console.log(`  boat -> navTarget:      MED ${q(rows.map(r=>r.boatToNav),.5).toFixed(0)}`);
})();

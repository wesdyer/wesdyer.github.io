// SOLO ARCTIC: is the leg-1 excess in the ROUTER'S PLAN or in EXECUTION?
// (2026-08-09 human-level push; the mean-field stamps changed the router, so
// the tack-count-era answer "the plan already equals her line" must be
// re-measured on treeP0.) Neutral solo bot; at each leg-1 replan sample the
// planned path length; at leg end report sailed odometer + tacks.
//   node _arc_plan.js <trials> <seed0> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP0');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
        window.__CHAR = 'neutral';
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            // solo: hero = bots[0], everyone else (incl. player) parked far away
            const hero = state.boats.find(b => !b.isPlayer);
            for (const b of state.boats) if (b !== hero) { b.x = 1e6; b.y = 1e6; }
            const dt = 1 / 60;
            const planLens = [];
            let odo = 0, tacks = 0, lastSide = null, leg1T = null;
            const pathLen = (p) => {
                if (!p || p.length < 2) return null;
                let L = 0;
                for (let i = 1; i < p.length; i++) {
                    const a = p[i - 1], b = p[i];
                    L += Math.hypot((b.x != null ? b.x : b[0]) - (a.x != null ? a.x : a[0]),
                                    (b.y != null ? b.y : b[1]) - (a.y != null ? a.y : a[1]));
                }
                return L;
            };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status !== 'racing') continue;
                if (hero.raceState.finished) break;
                if (hero.raceState.leg === 1) {
                    odo += (hero.speed || 0) * 60 * dt;
                    const side = hero.lastWindSide;
                    if (lastSide != null && side !== lastSide && side !== undefined) tacks++;
                    lastSide = side;
                    if (it % 300 === 0) {
                        const c = hero.controller || {};
                        const gp = c.gridPath || c._gridPath || (c.planner && c.planner.path) || null;
                        const L = pathLen(gp);
                        if (L != null) {
                            // remaining plan + distance already sailed ≈ full-line estimate
                            planLens.push(Math.round(L + odo));
                        }
                    }
                } else if (hero.raceState.leg > 1 && leg1T === null) {
                    leg1T = state.race.timer;
                }
            }
            return { fin: hero.raceState.finishTime || null, leg1T, odo: Math.round(odo), tacks,
                     planFirst: planLens[0] || null, planMed: planLens.length ? planLens.sort((a, b) => a - b)[Math.floor(planLens.length / 2)] : null,
                     nPlans: planLens.length };
        }, SEED0 + t);
        console.log(`seed ${SEED0 + t}: leg1 sailed ${r.odo}u tacks ${r.tacks} leg1T ${r.leg1T}  plan(first) ${r.planFirst}  plan(med est) ${r.planMed}  (${r.nPlans} samples)  fin ${r.fin}`);
    }
    await browser.close();
    console.log('HUMAN leg-1 reference: ~14-15k sailed (1.06-1.12x rhumb), 5 tacks.');
})();

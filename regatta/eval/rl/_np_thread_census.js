// NARROW-PASSAGE THREAD CENSUS (2026-08-21): do venue routes actually BUY
// tight-tier threads, and does the fleet sail near them?
// Per replan sample (every 2s, all bots): does the boat's gridPath cross a
// _tight cell within its first 12 points; is the boat ITSELF in/adjacent to
// a tight cell; land-contact frames while planTight vs not. Attribution for
// the venue gate: if redrock's land delta rides on planTight moments, the
// leniency scope is the lever; if not, routing/LOS is.
//   node _np_thread_census.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 2;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeNP2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = { samples: 0, planTight: 0, boatInTight: 0, boatNearTight: 0,
                  contactFrames: 0, contactWhilePlanTight: 0, tightCellsOnGrid: 0, boats: 0 };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const out = { samples: 0, planTight: 0, boatInTight: 0, boatNearTight: 0,
                          contactFrames: 0, contactWhilePlanTight: 0, tightCellsOnGrid: 0, boats: 0 };
            const dt = 1 / 60; let it = 0;
            const planTightNow = new Map();
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
                if (state.race.status !== 'racing') continue;
                const g = state.course.botGrid;
                if (!g || !g._tight) continue;
                if (!out.tightCellsOnGrid) {
                    let n = 0; for (let k = 0; k < g._tight.length; k++) n += g._tight[k];
                    out.tightCellsOnGrid = n;
                }
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished || bt.raceState.leg < 1) continue;
                    const c = bt.controller;
                    // contact frame? collisionData transient — use speed-collapse-free
                    // direct signal: the boat's cell is blocked on the static grid
                    const cc = g.cell(bt.x, bt.y);
                    const id = cc[1] * g.n + cc[0];
                    const inTight = !!(g._tight[id]);
                    if (it % 120 === 0) {  // 2s cadence
                        out.samples++;
                        let pt = false;
                        if (c && c.gridPath && c.gridPath.length) {
                            for (let pi = 0; pi < Math.min(12, c.gridPath.length); pi++) {
                                const pc = g.cell(c.gridPath[pi].x, c.gridPath[pi].y);
                                if (pc[0] >= 0 && pc[1] >= 0 && pc[0] < g.n && pc[1] < g.n
                                    && g._tight[pc[1] * g.n + pc[0]]) { pt = true; break; }
                            }
                        }
                        planTightNow.set(bt.id, pt);
                        if (pt) out.planTight++;
                        if (inTight) out.boatInTight++;
                        let near = inTight;
                        if (!near) for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) {
                            const ni = cc[0] + di, nj = cc[1] + dj;
                            if (ni >= 0 && nj >= 0 && ni < g.n && nj < g.n && g._tight[nj * g.n + ni]) { near = true; break; }
                        }
                        if (near) out.boatNearTight++;
                    }
                    // land contact frame census at full rate: blocked cell + slow
                    if (!g.at(cc[0], cc[1]) && !(g._tight[id]) && !(g._soft && g._soft[id])) {
                        out.contactFrames++;
                        if (planTightNow.get(bt.id)) out.contactWhilePlanTight++;
                    }
                }
            }
            out.boats = state.boats.filter(b => !b.isPlayer).length;
            return out;
        }, seed);
        for (const k of Object.keys(agg)) agg[k] += r[k] || 0;
        console.log('seed', seed, JSON.stringify(r));
    }
    console.log('AGG', JSON.stringify(agg));
    console.log(`planTight share of samples: ${(100 * agg.planTight / Math.max(1, agg.samples)).toFixed(1)}%  boatNearTight: ${(100 * agg.boatNearTight / Math.max(1, agg.samples)).toFixed(1)}%  blocked-cell frames while planTight: ${agg.contactWhilePlanTight}/${agg.contactFrames}`);
    await browser.close();
})();

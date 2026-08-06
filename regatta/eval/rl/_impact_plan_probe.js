// THE FIFTH HYPOTHESIS — at each floe impact, where was the boat relative to its
// OWN plan, and did the plan itself run through the floe it hit?
//
// Arctic takes ~19 separate collision episodes per boat-race against the human's ~1,
// with four causes already eliminated (fan resolution, drift blindness, double-count,
// floe pricing). What remains splits three ways, and each needs a different fix:
//   ON-plan impact, plan threads the floe NOW   -> the chosen thread went stale (the
//       replan keeper skips soft cells on purpose) or was stamped through a gap that
//       closed: ROUTING/refresh problem — the owner's "project the gap to arrival".
//   ON-plan impact, plan clear of the floe      -> the boat is where it should be and
//       still got clipped: the floe overtook the boat (drift/rotation) — per-encounter
//       AVOIDANCE margin problem.
//   OFF-plan impact                             -> avoidance (or traffic) pushed her
//       off the thread into ice: ESCAPE-SELECTION problem, not routing.
//
// Impact = thump (speed falls >40% in 0.1s from >0.25) with nearest FLOE edge < 40u
// and closer than any land circle — the class split the withdrawn nearest-object
// classifier could not make is safe here because it is floe-vs-land at 40u, not
// share-of-attention between radii of different orders.
//
//   node _impact_plan_probe.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeNOW');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = { impacts: 0, onPlanThreaded: 0, onPlanClear: 0, offPlan: 0, noPlan: 0,
                  offPlanD: [], planAge: [], boatRaces: 0 };
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const floes = (state.course.islands || []).filter(f => f.isFloe && f.vertices);
            const maxR = floes.map(f => Math.max(...f.localHull.map(p => Math.hypot(p.x, p.y))));
            const segD2 = (px, py, a, b2) => {
                const dx = b2.x - a.x, dy = b2.y - a.y;
                const L2 = dx * dx + dy * dy;
                const t = L2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / L2)) : 0;
                return (px - (a.x + t * dx)) ** 2 + (py - (a.y + t * dy)) ** 2;
            };
            const floeEdge = (px, py) => {
                let best = 1e9, bi = -1;
                for (let fi = 0; fi < floes.length; fi++) {
                    const f = floes[fi];
                    if (Math.hypot(px - f.x, py - f.y) - maxR[fi] > best + 1) continue;
                    const V = f.vertices;
                    let d2 = 1e18;
                    for (let k = 0, j = V.length - 1; k < V.length; j = k++)
                        d2 = Math.min(d2, segD2(px, py, V[j], V[k]));
                    const v = Math.sqrt(d2);
                    if (v < best) { best = v; bi = fi; }
                }
                return { d: best, fi: bi };
            };
            const polyDist = (px, py, pts, maxPts) => {
                let d2 = 1e18;
                const n = Math.min(pts.length, maxPts || pts.length);
                for (let k = 1; k < n; k++) d2 = Math.min(d2, segD2(px, py, pts[k - 1], pts[k]));
                if (n === 1) d2 = (px - pts[0].x) ** 2 + (py - pts[0].y) ** 2;
                return Math.sqrt(d2);
            };
            const out = { impacts: 0, onPlanThreaded: 0, onPlanClear: 0, offPlan: 0, noPlan: 0,
                          offPlanD: [], planAge: [], ctx: [], boats: bots.length };
            const prevSpd = bots.map(() => 0);
            const dt = 1 / 60; let acc = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++acc < 6) continue;   // 10 Hz
                acc = 0;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    if (b.raceState.finished) continue;
                    const a = prevSpd[k]; prevSpd[k] = b.speed;
                    if (!(a > 0.25 && b.speed < a * 0.6)) continue;
                    const fe = floeEdge(b.x, b.y);
                    // 40u of EXACT hull edge is the whole classifier. ⚠️ The first
                    // version also required "closer than land" using isl.radius — but
                    // arctic's land radii are bounding circles (8685u), so landD went
                    // NEGATIVE in open water and every thump filed as land: the probe
                    // returned zero at every statistic. Same trap as the withdrawn
                    // thump split; the standing rule caught it.
                    if (fe.d > 40) continue;
                    out.impacts++;
                    const c = b.controller;
                    // context at impact: was the trajectory planner steering (escaping
                    // ice), was there an active BOAT threat, was she in wiggle, how
                    // much was avoidance deflecting her
                    out.ctx.push({
                        traj: c && c._trajFloe ? 1 : 0,
                        boatThreat: c && c.threatBoat && c.riskState !== 'LOW' ? 1 : 0,
                        risk: c ? c.riskState : '?',
                        wig: c && c.wiggleActive ? 1 : 0,
                        dev: c ? +(c.lastAvoidDeviation || 0).toFixed(2) : 0,
                        spdBefore: +a.toFixed(2)
                    });
                    const plan = c && c.gridPath;
                    if (!plan || !plan.length) { out.noPlan++; continue; }
                    const dPlan = polyDist(b.x, b.y, plan);
                    out.offPlanD.push(Math.round(dPlan));
                    out.planAge.push(+(c.gridAge || 0).toFixed(1));
                    if (dPlan > 60) { out.offPlan++; continue; }
                    // ON plan. Does the plan AHEAD of the boat run through the hit floe?
                    const f = floes[fe.fi], V = f.vertices;
                    const insideHull = (qx, qy) => {
                        let ins = false;
                        for (let m = 0, j = V.length - 1; m < V.length; j = m++) {
                            if ((V[m].y > qy) !== (V[j].y > qy)) {
                                const xin = (V[j].x - V[m].x) * (qy - V[m].y) / (V[j].y - V[m].y) + V[m].x;
                                if (qx < xin) ins = !ins;
                            }
                        }
                        return ins;
                    };
                    let threaded = false;
                    for (let pi = 1; pi < plan.length && !threaded; pi++) {
                        if (Math.hypot(plan[pi].x - b.x, plan[pi].y - b.y) > 700 &&
                            Math.hypot(plan[pi - 1].x - b.x, plan[pi - 1].y - b.y) > 700) continue;
                        for (let t = 0; t <= 1.0001 && !threaded; t += 0.2) {
                            const qx = plan[pi - 1].x + (plan[pi].x - plan[pi - 1].x) * t;
                            const qy = plan[pi - 1].y + (plan[pi].y - plan[pi - 1].y) * t;
                            if (insideHull(qx, qy)) threaded = true;
                        }
                    }
                    if (threaded) out.onPlanThreaded++; else out.onPlanClear++;
                }
            }
            return out;
        }, SEED0 + i);
        agg.impacts += r.impacts; agg.onPlanThreaded += r.onPlanThreaded;
        agg.onPlanClear += r.onPlanClear; agg.offPlan += r.offPlan; agg.noPlan += r.noPlan;
        agg.offPlanD.push(...r.offPlanD); agg.planAge.push(...r.planAge);
        (agg.ctx = agg.ctx || []).push(...r.ctx);
        agg.boatRaces += r.boats;
        console.log(`seed ${SEED0 + i}: impacts ${r.impacts} = threaded ${r.onPlanThreaded} + onPlanClear ${r.onPlanClear} + offPlan ${r.offPlan} + noPlan ${r.noPlan}`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
    console.log(`\nTOTAL ${agg.impacts} floe impacts over ${agg.boatRaces} boat-races (${(agg.impacts / agg.boatRaces).toFixed(1)}/boat-race)`);
    console.log(`  ON  plan, plan threads the hit floe : ${agg.onPlanThreaded} (${(100 * agg.onPlanThreaded / agg.impacts).toFixed(0)}%)  <- stale/blind ROUTING`);
    console.log(`  ON  plan, plan clear of it          : ${agg.onPlanClear} (${(100 * agg.onPlanClear / agg.impacts).toFixed(0)}%)  <- floe came to the boat: AVOIDANCE margin`);
    console.log(`  OFF plan (>60u)                     : ${agg.offPlan} (${(100 * agg.offPlan / agg.impacts).toFixed(0)}%)  <- escape/traffic pushed her off`);
    console.log(`  no plan                             : ${agg.noPlan}`);
    console.log(`  off-plan distance med ${med(agg.offPlanD)}u | plan age at impact med ${med(agg.planAge)}s`);
    const C = agg.ctx || [];
    if (C.length) {
        const pc = (k) => (100 * C.filter(x => x[k]).length / C.length).toFixed(0);
        const risks = {};
        C.forEach(x => risks[x.risk] = (risks[x.risk] || 0) + 1);
        console.log(`  CONTEXT at impact: traj-planner steering ${pc('traj')}% | boat-threat active ${pc('boatThreat')}% | wiggle ${pc('wig')}%`);
        console.log(`  risk states:`, risks, `| avoid deviation med ${med(C.map(x => Math.abs(x.dev)))} rad | speed before med ${med(C.map(x => x.spdBefore))}`);
    }
    await browser.close();
})();

// WHY DOESN'T THE ARGMIN EVER PICK THE SMALL DODGE? The human's response to
// traffic is 12.6-23.4° at CPA (fresh 132-encounter ledger); the fleet's is
// 35.5-59.9°, and stand-on deviations land on the 0.5-1.2 rad fan rungs. At
// every deflection rising edge (|defl| ≥ 25°, racing legs), score the SMALL
// candidates (±8°, ±15° off desired, same side as the chosen dodge) with the
// argmin's own terms, and name the term that prices them out vs the chosen
// heading:
//   hard140  — land inside the 140u hard zone on the small candidate
//   farland  — far-blockage 30000·(1−frac)
//   boatprox — rival gradient Σ 5000/(d²+10), 5 samples
//   marksoft — mark berth 18000/(dSq+100)
//   irons    — twa < 0.55 rad (candidate unsailable)
//   none     — no term separates ≥ the deviation-cost gap (commitment /
//              hysteresis / risk-shaping own the choice)
//   node _rr_smallwhy.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBP2');
const VENUE = process.argv[5] || 'redrock';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(v => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = {}; let edges = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const g = state.course.botGrid;
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const hard140 = (b, h) => {
                for (const d of [45, 90, 140]) {
                    const cc = g.cell(b.x + Math.sin(h) * d, b.y - Math.cos(h) * d);
                    const id = cc[1] * g.n + cc[0];
                    if (!g.at(cc[0], cc[1]) && !(g._soft && g._soft[id])) return true;
                }
                return false;
            };
            const farCost = (b, h) => {
                const spd = Math.max(120, b.speed * 60), len = spd * 4;
                const steps = Math.max(2, Math.min(8, Math.ceil(len / (g.res * 0.6))));
                for (let sI = 1; sI <= steps; sI++) {
                    const frac = sI / steps;
                    const cc = g.cell(b.x + Math.sin(h) * len * frac, b.y - Math.cos(h) * len * frac);
                    const id = cc[1] * g.n + cc[0];
                    if (!g.at(cc[0], cc[1]) && !(g._soft && g._soft[id])) {
                        if (frac * len <= 140) return 500000;
                        return 30000 * (1 - frac);
                    }
                }
                return 0;
            };
            const rivalHard = (b, h) => {
                const spd = b.speed * 60;
                const vx = Math.sin(h) * spd, vy = -Math.cos(h) * spd;
                for (const o of state.boats) {
                    if (o === b || o.isPlayer || o.raceState.finished) continue;
                    const ovx = (o.velocity && o.velocity.x) ? o.velocity.x * 60 : Math.sin(o.heading) * o.speed * 60;
                    const ovy = (o.velocity && o.velocity.y) ? o.velocity.y * 60 : -Math.cos(o.heading) * o.speed * 60;
                    for (let s2 = 1; s2 <= 5; s2++) {
                        const t = s2 * 0.8;
                        const dx = (b.x + vx * t) - (o.x + ovx * t);
                        const dy = (b.y + vy * t) - (o.y + ovy * t);
                        if (dx * dx + dy * dy < 80 * 80) return true;
                    }
                }
                return false;
            };
            const boatProx = (b, h) => {
                const spd = b.speed * 60;
                const vx = Math.sin(h) * spd, vy = -Math.cos(h) * spd;
                let c = 0;
                for (const o of state.boats) {
                    if (o === b || o.isPlayer || o.raceState.finished) continue;
                    const ovx = (o.velocity && o.velocity.x) ? o.velocity.x * 60 : Math.sin(o.heading) * o.speed * 60;
                    const ovy = (o.velocity && o.velocity.y) ? o.velocity.y * 60 : -Math.cos(o.heading) * o.speed * 60;
                    for (let s2 = 1; s2 <= 5; s2++) {
                        const t = s2 * 0.8;
                        const dx = (b.x + vx * t) - (o.x + ovx * t);
                        const dy = (b.y + vy * t) - (o.y + ovy * t);
                        const d2 = dx * dx + dy * dy;
                        if (d2 < 250 * 250) c += 5000 / (d2 + 10);
                    }
                }
                return c;
            };
            const markSoft = (b, h) => {
                let c = 0;
                const spd = Math.max(120, b.speed * 60);
                const fx = b.x + Math.sin(h) * spd * 4, fy = b.y - Math.cos(h) * spd * 4;
                for (const m of (state.course.marks || [])) {
                    const cp = getClosestPointOnSegment(m.x, m.y, b.x, b.y, fx, fy);
                    const dSq = (cp.x - m.x) ** 2 + (cp.y - m.y) ** 2;
                    const soft = 103 + (m.bodyR || 12);
                    if (dSq < soft * soft) c += 18000 / (dSq + 100);
                }
                return c;
            };
            const st = {}; const out = {}; let edges = 0;
            const bump = k => out[k] = (out[k] || 0) + 1;
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                for (const b of bots) {
                    if (b.raceState.finished || b.raceState.leg < 1) continue;
                    const c = b.controller;
                    const dev = (c && c.lastAvoidDeviation) || 0;
                    const key = b.name;
                    const was = st[key] || 0; st[key] = Math.abs(dev);
                    if (Math.abs(dev) < 0.44 || was >= 0.44) continue;   // rising edge ≥25°
                    edges++;
                    // the CHOSEN candidate is the controller's post-avoidance
                    // target — at the rising edge the hull has not slewed yet,
                    // so b.heading is the OLD course, not the choice.
                    const chosen = c.targetHeading;
                    const desired = norm(chosen - dev);
                    const sgn = Math.sign(dev) || 1;
                    const w = getWindAt(b.x, b.y);
                    const chosenTot = (hard140(b, chosen) ? 500000 : farCost(b, chosen))
                        + boatProx(b, chosen) + markSoft(b, chosen)
                        + (Math.abs(norm(chosen - w.direction)) < 0.55 ? 500 : 0)
                        + Math.pow(Math.abs(dev), 3) * 200;
                    let best = null;
                    for (const off of [0.14 * sgn, 0.26 * sgn]) {
                        const h = norm(desired + off);
                        const terms = {
                            hard140: hard140(b, h) ? 500000 : 0,
                            rivalhard: rivalHard(b, h) ? 400000 : 0,
                            farland: 0, boatprox: boatProx(b, h), marksoft: markSoft(b, h),
                            irons: Math.abs(norm(h - w.direction)) < 0.55 ? 500 : 0
                        };
                        if (!terms.hard140) terms.farland = farCost(b, h);
                        const tot = terms.hard140 + terms.rivalhard + terms.farland + terms.boatprox
                            + terms.marksoft + terms.irons + Math.pow(Math.abs(off), 3) * 200;
                        if (best == null || tot < best.tot) {
                            let top = 'none', tv = 100;
                            for (const [tk, v] of Object.entries(terms)) if (v > tv) { top = tk; tv = v; }
                            best = { tot, top };
                        }
                    }
                    // does the best small candidate actually LOSE to the chosen one?
                    if (best.tot > chosenTot) bump(best.top);
                    else bump('SMALL_WINS(model)');
                }
            }
            return { out, edges };
        }, seed);
        for (const [k, v] of Object.entries(r.out)) agg[k] = (agg[k] || 0) + v;
        edges += r.edges;
        console.log('seed', seed, 'edges', r.edges, JSON.stringify(r.out));
    }
    console.log(`\n${VENUE}: ${edges} big-dodge edges — what prices out the best small candidate:`);
    for (const k of Object.keys(agg).sort((a, b) => agg[b] - agg[a]))
        console.log(' ', k.padEnd(18), agg[k], (100 * agg[k] / edges).toFixed(0) + '%');
    await browser.close();
})();

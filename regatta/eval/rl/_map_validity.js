// HOW MUCH OF THE ROUTER'S MAP IS REAL? — the Phase-1 premise test.
//
// The router stamps every floe hard and solves one A* over a ~12000-unit leg.
// A plan that far ahead is only worth solving if the map is still true when the
// boat gets there. Two measurements, both against the router's OWN grid:
//
//  1) CELL FLIP: of the cells blocked by floes at t0, what fraction is open at
//     t0+H (and vice versa)? A maze whose walls move is not a maze.
//  2) PLAN CHURN vs ARCLENGTH: run pathSailable from a fixed point to the leg
//     target at t0 and again at t0+H, and measure how far apart the two plans
//     are at each distance along them. If churn is small near the boat and huge
//     far from it, the far half of every plan is fiction and re-solving it is
//     what makes the carrot jump.
//
// node _map_validity.js <seeds> <seed0> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const HS = [4, 8, 16, 30, 60];
    const BANDS = [500, 1000, 2000, 4000, 8000, 16000];
    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ({ seed, HS, BANDS }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const dt = 1 / 60;
            // Snapshot of "which cells are floe-blocked" on the live bot grid.
            const blockedSet = () => {
                const g = state.course.botGrid, s = new Set();
                if (!g || !g._soft) return s;
                for (let k = 0; k < g._soft.length; k++) if (g._soft[k]) s.add(k);
                return s;
            };
            // A plan from a fixed point to the leg-1 target, resampled every 100u.
            const planFrom = (px, py, tx, ty) => {
                const g = state.course.botGrid;
                const seg = window.SailCheck.pathSailable(g, [px, py], [tx, ty]);
                if (!seg || seg.length < 2) return null;
                const pts = seg.map(q => ({ x: q[0], y: q[1] }));
                const out = []; let acc = 0;
                out.push({ s: 0, x: pts[0].x, y: pts[0].y });
                for (let k = 1; k < pts.length; k++) {
                    const d = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
                    let rem = d, a = pts[k - 1];
                    while (acc % 100 + rem >= 100) {
                        const need = 100 - (acc % 100);
                        const f = need / rem;
                        a = { x: a.x + (pts[k].x - a.x) * f, y: a.y + (pts[k].y - a.y) * f };
                        acc += need; rem -= need;
                        out.push({ s: acc, x: a.x, y: a.y });
                    }
                    acc += rem;
                }
                return out;
            };
            const at = (plan, s) => {
                if (!plan || !plan.length) return null;
                const k = Math.min(plan.length - 1, Math.round(s / 100));
                return plan[k];
            };
            // Wait for the fleet to be racing and the pack to matter.
            for (let it = 0; it < 60 * 60; it++) { window.update(dt); if (state.race.status === 'racing') break; }
            const bots = state.boats.filter(b => !b.isPlayer);
            const hero = bots[0];
            const legs = state.course.dmc.legs;
            const L1 = legs[1];
            const tgt = L1.pts[L1.pts.length - 1];
            const res = { flipOut: {}, flipIn: {}, churn: {}, n: {} };
            for (const H of HS) { res.flipOut[H] = []; res.flipIn[H] = []; res.churn[H] = {}; for (const B of BANDS) res.churn[H][B] = []; }
            // Sample from a set of fixed vantage points along the leg, at several race times.
            const SAMPLE_T = [20, 60, 100, 140, 180];
            let si = 0;
            const maxH = Math.max(...HS);
            for (const T0 of SAMPLE_T) {
                while (state.race.timer < T0 && state.race.status === 'racing') window.update(dt);
                if (state.race.status !== 'racing') break;
                const px = hero.x, py = hero.y;
                const b0 = blockedSet();
                const p0 = planFrom(px, py, tgt.x, tgt.y);
                const snaps = [];
                let tPrev = state.race.timer;
                for (const H of HS) {
                    while (state.race.timer < T0 + H && state.race.status === 'racing') window.update(dt);
                    const b1 = blockedSet();
                    let out = 0; for (const k of b0) if (!b1.has(k)) out++;
                    let inn = 0; for (const k of b1) if (!b0.has(k)) inn++;
                    res.flipOut[H].push(b0.size ? out / b0.size : 0);
                    res.flipIn[H].push(b0.size ? inn / b0.size : 0);
                    const p1 = planFrom(px, py, tgt.x, tgt.y);
                    for (const B of BANDS) {
                        const a = at(p0, B), b = at(p1, B);
                        if (a && b && p0[p0.length - 1].s >= B && p1[p1.length - 1].s >= B) {
                            res.churn[H][B].push(Math.hypot(a.x - b.x, a.y - b.y));
                        }
                    }
                }
            }
            return res;
        }, { seed, HS, BANDS });
        rows.push(r);
        console.log(`seed ${seed} done`);
    }
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    const cat = (f) => rows.flatMap(f);
    console.log('\nCELL FLIP (share of floe-blocked cells that changed state after H seconds)');
    console.log('H(s)   opened   newly-blocked');
    for (const H of HS) {
        console.log(`${String(H).padStart(3)}   ${(100 * mean(cat(r => r.flipOut[H]))).toFixed(0).padStart(5)}%   ${(100 * mean(cat(r => r.flipIn[H]))).toFixed(0).padStart(11)}%`);
    }
    console.log('\nPLAN CHURN — distance (u) between the plan made at t0 and the plan made at t0+H,');
    console.log('measured at each arclength along the plan. Same start point, same goal.');
    process.stdout.write('H(s) ');
    for (const B of BANDS) process.stdout.write(String(B).padStart(8));
    console.log('');
    for (const H of HS) {
        process.stdout.write(String(H).padStart(3) + '  ');
        for (const B of BANDS) {
            const v = mean(cat(r => r.churn[H][B]));
            process.stdout.write((isNaN(v) ? '  -' : v.toFixed(0)).padStart(8));
        }
        console.log('');
    }
    await browser.close();
})();

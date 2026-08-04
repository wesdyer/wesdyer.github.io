// IS THE ROUTE LONG, OR IS THE BOAT OFF IT? — the attribution the transit bins
// cannot make.
//
// Transit odometer runs 1.87x the DMC ruler and cross-track averages 587u, but
// those two numbers are consistent with two opposite stories:
//   ROUTER POLICY — the plan itself is long (wide-water preference, floe risk,
//     lee-shore tax) and the boat sails it faithfully;
//   EXECUTION — the plan is near-direct and the boat cannot hold it (avoidance,
//     tacking, leeway, carrot churn).
// The fix for one is worthless against the other. So sample, per second:
//   planLen  = length of the boat's OWN gridPath from the boat to its end
//   dmcLeft  = DMC ruler distance remaining on this leg
//   offPlan  = distance from the boat to its own gridPath polyline
//   xtkDmc   = distance from the boat to the DMC ruler
// planRatio = planLen/dmcLeft is the router's own ambition; offPlan is what the
// driver gives away against it. Read-only at frame boundaries.
// node _route_attrib.js <trials> <seed0> [tree] [label]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const LABEL = process.argv[5] || null;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
            const legs = state.course.dmc.legs;
            const dt = 1 / 60;
            const st = bots.map(b => ({ name: b.name, hint: null,
                s: { planLen: 0, dmcLeft: 0, offPlan: 0, xtk: 0, n: 0,
                     ratioSum: 0, ratioN: 0, noPlan: 0, planPts: 0 } }));
            let frame = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                frame++;
                if (frame % 60 !== 0) continue;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], s = st[k].s, rs = b.raceState;
                    if (rs.finished) continue;
                    if (rs.leg !== 1 || rs.roundArmed) continue;   // TRANSIT only
                    const c = b.controller;
                    const L = legs[1];
                    const sNow = CoursePath.project(L, b.x, b.y, st[k].hint);
                    st[k].hint = sNow;
                    const dmcLeft = Math.max(1, L.length - sNow);
                    // distance to the ruler at sNow
                    let xtk = 0;
                    {
                        const cum = L.cum, pts = L.pts;
                        let kk = 1;
                        while (kk < cum.length - 1 && cum[kk] < sNow) kk++;
                        const tt = (sNow - cum[kk - 1]) / Math.max(1e-6, cum[kk] - cum[kk - 1]);
                        const px = pts[kk - 1].x + (pts[kk].x - pts[kk - 1].x) * tt;
                        const py = pts[kk - 1].y + (pts[kk].y - pts[kk - 1].y) * tt;
                        xtk = Math.hypot(b.x - px, b.y - py);
                    }
                    const gp = c && c.gridPath;
                    if (!gp || !gp.length) { s.noPlan++; continue; }
                    // plan length from the boat: boat->first point, then along
                    let planLen = Math.hypot(gp[0].x - b.x, gp[0].y - b.y);
                    let off = planLen;
                    for (let q = 1; q < gp.length; q++) {
                        planLen += Math.hypot(gp[q].x - gp[q - 1].x, gp[q].y - gp[q - 1].y);
                        // point-to-segment for offPlan
                        const ax = gp[q - 1].x, ay = gp[q - 1].y, bx = gp[q].x, by = gp[q].y;
                        const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
                        let t2 = l2 ? ((b.x - ax) * ex + (b.y - ay) * ey) / l2 : 0;
                        t2 = t2 < 0 ? 0 : t2 > 1 ? 1 : t2;
                        const d2 = Math.hypot(b.x - (ax + ex * t2), b.y - (ay + ey * t2));
                        if (d2 < off) off = d2;
                    }
                    s.planLen += planLen; s.dmcLeft += dmcLeft; s.offPlan += off;
                    s.xtk += xtk; s.n++; s.planPts += gp.length;
                    s.ratioSum += planLen / dmcLeft; s.ratioN++;
                }
            }
            return st.map(x => ({ name: x.name, ...x.s }));
        }, seed);
        rows.push(...r.map(x => ({ seed, ...x })));
        console.log(`seed ${seed} done`);
    }
    const g = rows.filter(r => r.n > 5);
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    console.log(`\nTRANSIT route attribution (n=${g.length} boat-races, 1Hz samples)`);
    console.log(`  plan/dmc-remaining ratio: med ${med(g.map(r => r.ratioSum / r.ratioN)).toFixed(2)} mean ${mean(g.map(r => r.ratioSum / r.ratioN)).toFixed(2)}`);
    console.log(`  off-own-plan distance : med ${med(g.map(r => r.offPlan / r.n)).toFixed(0)}u mean ${mean(g.map(r => r.offPlan / r.n)).toFixed(0)}u`);
    console.log(`  cross-track to ruler  : med ${med(g.map(r => r.xtk / r.n)).toFixed(0)}u mean ${mean(g.map(r => r.xtk / r.n)).toFixed(0)}u`);
    console.log(`  plan waypoints        : mean ${mean(g.map(r => r.planPts / r.n)).toFixed(0)}`);
    console.log(`  seconds with NO plan  : mean ${mean(g.map(r => r.noPlan)).toFixed(1)} of ${mean(g.map(r => r.n + r.noPlan)).toFixed(0)}`);
    if (LABEL) {
        fs.writeFileSync(path.join(__dirname, `route_attrib_${LABEL}.json`), JSON.stringify(rows));
        console.log(`wrote route_attrib_${LABEL}.json`);
    }
    await browser.close();
})();

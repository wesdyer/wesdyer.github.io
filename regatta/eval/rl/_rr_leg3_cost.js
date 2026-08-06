// REDROCK LEG-3 ROUTE ECONOMICS. The human extends the reach north along x~-60
// to y~1200-1400 and arcs onto m5 from the north; the DMC turns west at
// (-71,636) into the dead-upwind cl-1 slot. This probe prices BOTH corridors
// under pathSailable's own cost law (replicated from sailcheck.js buildTimeCost:
// tf = min(4, max(0.6, 10/bestToward)), loss = TACK_SEC*bestV*15*|sin(delta)|,
// fUp = 1 + loss/W capped 20 on non-icy grids) and reports passability +
// clearance along the human line. Answers: (a) is the human line even in the
// graph, (b) what price ratio does the current law give the two corridors,
// (c) what would it take for the reach continuation to win.
//   node _rr_leg3_cost.js [tree]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeMETER2');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' })));
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.waitForTimeout(3000);
  const out = await p.evaluate(() => {
    const g = state.course.botGrid;
    const res = g.res, N = g.n;
    const clearF = window.SailCheck.clearanceField(g);
    const gts = window.getTargetSpeed;
    const TACK_SEC = 1.0, PAD = 8;
    // per-step cost between two world points, pathSailable's law, non-icy
    const stepCost = (x0, y0, x1, y1) => {
      const d = Math.hypot(x1 - x0, y1 - y0);
      const bearing = Math.atan2(x1 - x0, -(y1 - y0)); // heading convention: sin=x, -cos=y
      const w = getWindAt((x0 + x1) / 2, (y0 + y1) / 2);
      const wd = w.direction, ws = w.speed;
      let best = 0.5, bestV = 0, bestDelta = 0;
      for (let twa = 25; twa <= 180; twa += 5) {
        const tr = twa * Math.PI / 180;
        const v = gts(tr, twa > 95, ws);
        for (const sgn of [1, -1]) {
          const toward = Math.cos((wd + sgn * tr) - bearing) * v;
          if (toward > best) { best = toward; bestV = v; bestDelta = (wd + sgn * tr) - bearing; }
        }
      }
      const tf = Math.min(4, Math.max(0.6, 10 / best));
      const c = g.cell((x0 + x1) / 2, (y0 + y1) / 2);
      const id = c[1] * N + c[0];
      const cl = clearF[id];
      let f = 1, W = null;
      if (cl < PAD) {
        W = Math.max(60, 2 * cl * res);
        const loss = TACK_SEC * bestV * 15 * Math.abs(Math.sin(bestDelta));
        f = Math.min(20, 1 + loss / W);
      }
      const twaHere = Math.abs(((wd - bearing) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      return { d, tf, f, cost: d / res * tf * f, W, cl,
               twaDeg: Math.round((Math.PI - twaHere) * 180 / Math.PI),
               passable: g.at(c[0], c[1]) };
    };
    const walk = (pts, step) => {
      // resample polyline at `step` units and accumulate
      const rows = []; let tot = 0, totBase = 0, blocked = 0;
      for (let s = 0; s < pts.length - 1; s++) {
        const a = pts[s], bb = pts[s + 1];
        const L = Math.hypot(bb.x - a.x, bb.y - a.y);
        const n = Math.max(1, Math.round(L / step));
        for (let k = 0; k < n; k++) {
          const x0 = a.x + (bb.x - a.x) * k / n, y0 = a.y + (bb.y - a.y) * k / n;
          const x1 = a.x + (bb.x - a.x) * (k + 1) / n, y1 = a.y + (bb.y - a.y) * (k + 1) / n;
          const r = stepCost(x0, y0, x1, y1);
          tot += r.cost; totBase += r.d / res * r.tf;
          if (!r.passable) blocked++;
          rows.push([Math.round(x0), Math.round(y0), r.twaDeg,
                     r.W ? Math.round(r.W) : null, +r.f.toFixed(2), +r.cost.toFixed(1), r.passable ? 1 : 0]);
        }
      }
      return { tot: +tot.toFixed(1), totBase: +totBase.toFixed(1), blocked, rows };
    };
    // the actual DMC leg-3 polyline
    const leg3 = state.course.dmc && state.course.dmc.legs && state.course.dmc.legs[3];
    const dmcPts = leg3 ? leg3.pts : null;
    // the human line: continue north along x~-60, arc onto m5 from the north
    const m5 = state.course.marks.reduce((best, m) =>
      (Math.hypot(m.x - (-678), m.y - 1545) < Math.hypot(best.x - (-678), best.y - 1545) ? m : best));
    const human = [{ x: -71, y: 636 }, { x: -60, y: 1000 }, { x: -60, y: 1300 },
                   { x: -350, y: 1480 }, { x: m5.x, y: m5.y }];
    const dmcFrom636 = [];
    if (dmcPts) {
      let started = false;
      for (const pt of dmcPts) {
        if (!started && Math.hypot(pt.x - (-71), pt.y - 636) < 120) started = true;
        if (started) dmcFrom636.push({ x: pt.x, y: pt.y });
      }
    }
    return {
      m5: { x: Math.round(m5.x), y: Math.round(m5.y) },
      wind: (() => { const w = getWindAt(-60, 1000); return { dirDeg: Math.round(w.direction * 180 / Math.PI), spd: w.speed }; })(),
      dmcLeg3: dmcPts ? { n: dmcPts.length, len: Math.round(leg3.length),
        first: { x: Math.round(dmcPts[0].x), y: Math.round(dmcPts[0].y) },
        last: { x: Math.round(dmcPts[dmcPts.length - 1].x), y: Math.round(dmcPts[dmcPts.length - 1].y) } } : null,
      dmcTail: dmcFrom636.length ? walk(dmcFrom636, 60) : null,
      humanTail: walk(human, 60),
      gridRes: res
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();

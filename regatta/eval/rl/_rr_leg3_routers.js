// Which router finds which leg-3 tail, and is the human's north corridor even
// CONNECTED in the bot grid? Runs pathBetween (BFS, the DMC's router) and
// pathSailable (time-cost A*) from the junction (-71,636) to m5, dumps both
// polylines + lengths, and floods the north channel to find where (if anywhere)
// the corridor toward m5 pinches shut at hull clearance.
//   node _rr_leg3_routers.js [tree]
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
    const m5 = state.course.marks.reduce((best, m) =>
      (Math.hypot(m.x - (-635), m.y - 1624) < Math.hypot(best.x - (-635), best.y - 1624) ? m : best));
    const from = [-71, 636], to = [m5.x, m5.y];
    const len = (seg) => { let L = 0; for (let k = 1; k < seg.length; k++) L += Math.hypot(seg[k][0] - seg[k-1][0], seg[k][1] - seg[k-1][1]); return Math.round(L); };
    const thin = (seg) => seg.filter((q, i) => i % 4 === 0 || i === seg.length - 1)
      .map(q => [Math.round(q[0]), Math.round(q[1])]);
    const bfs = window.SailCheck.pathBetween(g, from, to);
    const sail = window.SailCheck.pathSailable(g, from, to);
    // corridor width along x=-60 north channel and westward exits toward m5:
    // scan each y row for the navigable span around x=-60, and each x column
    // (from -700..-60) at a few y bands for the passage toward m5
    const clearF = window.SailCheck.clearanceField(g);
    const rowScan = [];
    for (let y = 650; y <= 1650; y += 50) {
      let x0 = null, x1 = null;
      for (let x = -800; x <= 300; x += 10) {
        const c = g.cell(x, y);
        if (g.at(c[0], c[1])) { if (x0 === null) x0 = x; x1 = x; }
        else if (x0 !== null && x1 !== null && x1 >= -60 && x0 <= -60) break;
        else if (x0 !== null && x1 < -60) { x0 = null; x1 = null; }
      }
      rowScan.push([y, x0, x1]);
    }
    return {
      m5: { x: Math.round(m5.x), y: Math.round(m5.y) },
      bfs: bfs ? { L: len(bfs), pts: thin(bfs) } : null,
      sail: sail ? { L: len(sail), pts: thin(sail) } : null,
      rowScan
    };
  });
  console.log(JSON.stringify(out));
  await b.close();
})();

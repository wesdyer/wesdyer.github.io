// Is the human's north-channel exit to m5 CONNECTED in the bot grid, and what
// is the TRUE clearance (distance between raw land polygons) through the gap
// she sailed? Compares grid passability (hull+inflation view) with raw-polygon
// clearance sampled on a lattice over the arc region x[-450,-40] y[1150,1550].
//   node _rr_northgap.js [tree]
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
    // distance from a point to nearest LAND polygon edge (raw, uninflated)
    const land = (state.course.islands || []).filter(i => !i.isFloe);
    const dSeg = (px, py, ax, ay, bx, by) => {
      const vx = bx - ax, vy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
      return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
    };
    const landDist = (x, y) => {
      let best = 1e9;
      for (const isl of land) {
        if (Math.hypot(x - isl.x, y - isl.y) > isl.radius + 1500) continue;
        const v = isl.vertices;
        for (let k = 0; k < v.length; k++) {
          const a = v[k], bb = v[(k + 1) % v.length];
          const d = dSeg(x, y, a.x, a.y, bb.x, bb.y);
          if (d < best) best = d;
        }
      }
      return best;
    };
    // grid connectivity: BFS from the north channel to m5
    const conn = window.SailCheck.pathBetween(g, [-60, 1250], [m5.x, m5.y]);
    const thin = (seg) => seg ? seg.filter((q, i) => i % 5 === 0 || i === seg.length - 1)
      .map(q => [Math.round(q[0]), Math.round(q[1])]) : null;
    let connL = 0;
    if (conn) for (let k = 1; k < conn.length; k++) connL += Math.hypot(conn[k][0]-conn[k-1][0], conn[k][1]-conn[k-1][1]);
    // lattice over the arc region: true clearance + grid view
    const lattice = [];
    for (let y = 1150; y <= 1550; y += 50) {
      const row = [];
      for (let x = -450; x <= -40; x += 50) {
        const c = g.cell(x, y);
        const nav = g.at(c[0], c[1]) ? 1 : 0;
        row.push([Math.round(landDist(x, y)), nav]);
      }
      lattice.push([y, row]);
    }
    return { m5: { x: Math.round(m5.x), y: Math.round(m5.y) }, res: g.res,
             conn: conn ? { L: Math.round(connL), pts: thin(conn) } : null, lattice };
  });
  console.log(JSON.stringify(out));
  await b.close();
})();

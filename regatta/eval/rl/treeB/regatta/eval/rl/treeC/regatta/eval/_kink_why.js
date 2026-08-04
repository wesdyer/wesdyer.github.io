// For every corner the smoother kept, what blocks the straight line past it?
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(2400);
  console.log(JSON.stringify(await p.evaluate(() => {
    const doc = window.VenueDoc.get('arctic');
    const fixed = window.VenueDoc.shapes(doc).filter(sh => window.VenueDoc.traits(sh).motion === 'fixed');
    const grid = window.SailCheck.buildGrid(fixed, state.course.boundary, null);
    const staticLand = CoursePath.staticLand(state.course.islands || []);
    const out = { gridShapes: fixed.length, staticLandShapes: staticLand.length,
                  gridKinds: {}, corners: [] };
    for (const sh of fixed) out.gridKinds[sh.kind || '?'] = (out.gridKinds[sh.kind || '?'] || 0) + 1;

    const L = state.course.dmc.legs[1];
    for (let i = 1; i < L.pts.length - 1; i++) {
      const a = L.pts[i - 1], c = L.pts[i + 1];
      if (CoursePath._lineClear(grid, a, c)) { out.corners.push({ i, removable: true }); continue; }
      // Find the first blocked sample and what is there.
      const d = Math.hypot(c.x - a.x, c.y - a.y), steps = Math.ceil(d / 12);
      let hit = null;
      for (let k = 0; k <= steps && !hit; k++) {
        const x = a.x + (c.x - a.x) * k / steps, y = a.y + (c.y - a.y) * k / steps;
        const cell = grid.cell(x, y);
        if (!grid.at(cell[0], cell[1])) {
          let inRealLand = false, nearest = null, nd = 1e9;
          for (const l of staticLand) if (pointInPoly(x, y, l.vertices)) inRealLand = true;
          for (const sh of fixed) {
            for (const q of sh.outer) { const dd = Math.hypot(q[0] - x, q[1] - y); if (dd < nd) { nd = dd; nearest = sh; } }
          }
          hit = { x: Math.round(x), y: Math.round(y), insideStaticLand: inRealLand,
                  nearestFixedShape: nearest && (nearest.kind || nearest.id), distToIt: Math.round(nd),
                  outsideArena: !Arena.contains(state.course.boundary, x, y, 0) };
        }
      }
      out.corners.push({ i, removable: false, blockedBy: hit });
    }
    return out;
  }), null, 1));
  await b.close();
})();

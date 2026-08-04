// Is surf on the shore FACING the seas? Measured, not eyeballed: for every shoreline edge,
// compare the drawn-foam test against an independent one — the outward direction found by
// stepping away from the polygon's own interior.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  for (const v of ['arctic', 'lake', 'river']) {
    const p = await b.newPage();
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2300);
    console.log(v, JSON.stringify(await p.evaluate(() => {
      let windward = 0, lee = 0, badNormal = 0, edges = 0;
      for (const isl of state.course.islands) {
        if (isl.hidden || !isl.vertices || isl.vertices.length < 3) continue;
        const sgn = surfOutwardSign(isl), V = isl.vertices;
        for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
          const a = V[j], c = V[i];
          const ex = c.x - a.x, ey = c.y - a.y, L = Math.hypot(ex, ey);
          if (L < 12) continue;
          edges++;
          const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
          const nx = (ey / L) * sgn, ny = (-ex / L) * sgn;
          // Independent check: the normal must point OUT of the shape.
          if (pointInPoly(mx + nx * 5, my + ny * 5, V)) badNormal++;
          const w = regionWindAt(mx, my);
          if (w.speed < 4) continue;
          const face = -(nx * -Math.sin(w.direction) + ny * Math.cos(w.direction));
          if (face > 0.02) windward++; else lee++;
        }
      }
      return { edges, normalsPointingInward: badNormal,
               edgesWithSurf: windward, edgesBare: lee,
               pctWithSurf: Math.round(100 * windward / Math.max(1, windward + lee)) };
    })));
    await p.close();
  }
  await b.close();
})();

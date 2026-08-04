// Does the drawn path actually AVOID land, or does it just look like it? Sample densely
// along every segment — a waypoint test says nothing about the line between two waypoints.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  for (const v of ['arctic', 'river', 'lake', 'redrock', 'swamp']) {
    const p = await b.newPage();
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2400);
    console.log(v, JSON.stringify(await p.evaluate(() => {
      const d = state.course.dmc;
      const land = CoursePath.staticLand(state.course.islands || []);
      const out = [];
      for (let li = 1; li < d.legs.length; li++) {
        const L = d.legs[li];
        let inLand = 0, n = 0;
        for (let i = 1; i < L.pts.length; i++) {
          const a = L.pts[i-1], c = L.pts[i];
          const steps = Math.max(2, Math.ceil(Math.hypot(c.x-a.x, c.y-a.y) / 25));
          for (let k = 0; k <= steps; k++) {
            const x = a.x + (c.x-a.x)*k/steps, y = a.y + (c.y-a.y)*k/steps;
            n++;
            for (const l of land) if (pointInPoly(x, y, l.vertices)) { inLand++; break; }
          }
        }
        const A = L.pts[0], B = L.pts[L.pts.length-1];
        out.push({ leg: li, pts: L.pts.length,
                   len: Math.round(L.length), straight: Math.round(Math.hypot(B.x-A.x, B.y-A.y)),
                   detourRatio: +(L.length / Math.max(1, Math.hypot(B.x-A.x, B.y-A.y))).toFixed(3),
                   samplesInLand: inLand, samples: n });
      }
      return { staticLand: land.length, legs: out };
    })));
    await p.close();
  }
  await b.close();
})();

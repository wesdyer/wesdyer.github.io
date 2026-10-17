// polyGrid's row-scan inside flags equal pointInPoly at every cell centre, on every venue's compiled land.
//   node regatta/eval/_polygrid_check.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.VENUE_DOC && typeof polyGrid === 'function');
  console.log(await p.evaluate(() => {
    let rings = 0, cells = 0, bad = 0;
    for (const [v, d] of Object.entries(window.VENUE_DOC)) {
      if (!d.shapes || !d.shapes.length) continue;
      const c = window.VenueDoc.compile(d, true);
      for (const isl of c.islands) { const vs = isl.vertices; if (!vs || vs.length < 48) continue; rings++;
        const g = polyGrid(vs.map(q => ({ x: q.x, y: q.y })));
        for (let cy = 0; cy < g.ch; cy++) for (let cx = 0; cx < g.cw; cx++) { cells++;
          if (g.inside[cy * g.cw + cx] !== (pointInPoly((g.cx0 + cx + 0.5) * POLY_CELL, (g.cy0 + cy + 0.5) * POLY_CELL, vs) ? 1 : 0)) bad++; } }
    }
    return `${rings} rings, ${cells} cells, ${bad} differ — ${bad ? 'FAIL' : 'PASS'}`;
  }));
  await b.close(); })();

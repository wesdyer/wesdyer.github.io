// shoalMulAt with its edge grid gives the brute-force answer exactly: every venue's awash shapes, sampled on a
// dense lattice over and around each one.   node regatta/eval/_shoal_grid_check.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.VENUE_DOC && window.VenueDoc);
  console.log(await p.evaluate(() => {
    const VD = window.VenueDoc, pir = VD.pointInRing;
    const ref = (isl, x, y) => {
      if (!isl.awash || !isl.shoalRings) return 1;
      const dx = x - isl.x, dy = y - isl.y; if (dx * dx + dy * dy > isl.radius * isl.radius) return 1;
      if (!pir(x, y, isl.shoalRings[0])) return 1; for (let h = 1; h < isl.shoalRings.length; h++) if (pir(x, y, isl.shoalRings[h])) return 1;
      let d = Infinity; for (const ring of isl.shoalRings) for (let i = 0; i < ring.length; i++) { const a = ring[i], c = ring[(i + 1) % ring.length];
        const ex = c[0] - a[0], ey = c[1] - a[1], l2 = ex * ex + ey * ey; let t = l2 ? ((x - a[0]) * ex + (y - a[1]) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = x - (a[0] + t * ex), py = y - (a[1] + t * ey); const dd = px * px + py * py; if (dd < d) d = dd; }
      const f = isl.shoalFeather || 120; const t = Math.min(1, Math.sqrt(d) / f); return 1 - (1 - isl.shoalMul) * (t * t * (3 - 2 * t)); };
    let n = 0, bad = 0, shoals = 0, maxd = 0;
    for (const [v, doc] of Object.entries(window.VENUE_DOC)) {
      if (!doc.shapes || !doc.shapes.length) continue;
      const c = VD.compile(doc, true);
      for (const isl of c.islands) { if (!isl.awash || !isl.shoalRings) continue; shoals++;
        const st = Math.max(4, isl.radius / 40);
        for (let x = isl.x - isl.radius; x <= isl.x + isl.radius; x += st) for (let y = isl.y - isl.radius; y <= isl.y + isl.radius; y += st) {
          n++; const a = VD.shoalMul(isl, x, y), e = ref(isl, x, y); if (a !== e) { bad++; maxd = Math.max(maxd, Math.abs(a - e)); } } }
    }
    return `${shoals} shoals, ${n} points: ${bad} differ (max ${maxd}) — ${bad ? 'FAIL' : 'PASS'}`;
  }));
  await b.close(); })();

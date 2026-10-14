// ringSelfIntersects' gridded path gives the plain loop's answer: every venue's rings (control and flattened),
// plus rings with crossings planted in them.   node regatta/eval/_selfx_check.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.VENUE_DOC && window.VenueDoc);
  console.log(await p.evaluate(() => {
    const plain = (ring) => { const n = ring.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue;
      const a1 = ring[i], a2 = ring[(i + 1) % n], b1 = ring[j], b2 = ring[(j + 1) % n];
      const d = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      if (((d(b1, b2, a1) > 0) !== (d(b1, b2, a2) > 0)) && ((d(a1, a2, b1) > 0) !== (d(a1, a2, b2) > 0))) return [i, j]; } return null; };
    const test = window.VenueDoc.ringSelfIntersects || null;
    if (!test) return 'ringSelfIntersects not exported';
    let n = 0, bad = 0, crossing = 0;
    const rings = [];
    for (const d of Object.values(window.VENUE_DOC)) for (const sh of (d.shapes || [])) { rings.push(sh.outer); if (sh.smooth) rings.push(window.VenueDoc.smoothRing(sh.outer)); }
    // planted crossings: swap two vertices in long rings
    for (const r of rings.slice()) if (r.length > 80) { const q = r.map(x => x.slice()); const t = q[10]; q[10] = q[40]; q[40] = t; rings.push(q); }
    for (const r of rings) { if (r.length <= 64) continue; n++; const a = test(r), e = plain(r); if (e) crossing++; if (JSON.stringify(a) !== JSON.stringify(e)) bad++; }
    return `${n} long rings (${crossing} with a crossing): ${bad} answers differ — ${bad ? 'FAIL' : 'PASS'}`;
  }));
  await b.close(); })();

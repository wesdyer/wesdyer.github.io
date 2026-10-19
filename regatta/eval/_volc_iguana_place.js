// Probe: where Emberfall's basking iguanas lie — every heap member's footprint (snout, the four feet, the tail) tested
// against land, lava, the water and the props; and the props near the heaps.   node regatta/eval/_volc_iguana_place.js
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame();
    const H = Wildlife.debug().igHeaps, K = VenueDoc.PROP_KINDS || {}, props = state.course.props || [];
    const foot = Wildlife.art.igFootprint;
    let n = 0, wet = 0, lava = 0, onProp = 0, bad = [];
    // (the props' traced outlines; boulders count apart — they may lie on those — and the seabed vents are under the sea)
    const rings = props.filter(t => !/vent-underwater/.test(t.kind)).map(t => ({ t, R: VenueDoc.propHitRings(t).rings.map(r => r.map(([x, y]) => ({ x, y }))) }));
    const propHit = (x, y) => (rings.find(q => Math.hypot(q.t.x - x, q.t.y - y) < ((K[q.t.kind] || {}).world || 100) * (q.t.scale || 1) && q.R.some(r => pointInPoly(x, y, r))) || {}).t;
    const byKind = {};
    for (const G of H) for (const m of G.members) { n++;
      const P = foot(m); const w = P.filter(([x, y]) => !pointOnLand(x, y)).length, pr = P.map(([x, y]) => propHit(x, y)).find(Boolean);
      if (w) wet++; if (pr) { onProp++; byKind[pr.kind] = (byKind[pr.kind] || 0) + 1; } if (w || pr) bad.push([Math.round(m.x), Math.round(m.y), w, pr && pr.kind]); }
    const near = {}; for (const G of H) for (const t of props) if (Math.hypot(t.x - G.p0.x, t.y - G.p0.y) < 120) near[t.kind] = (near[t.kind] || 0) + 1;
    return { heaps: H.length, n, wet, onProp, byKind, near, kinds: [...new Set(props.map(t => t.kind))], bad: bad.slice(0, 12) }; });
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();

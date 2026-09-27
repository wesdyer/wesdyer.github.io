// Probe: does any Lighthouse Cove traffic lane run a hull THROUGH a bridge tower?
// Walks every lane (Traffic.compilePath, 4u steps) and tests the hull's footprint — a
// rectangle of the kind's `hull` fractions, or the sprite's world square without one — against
// the tower rings (VenueDoc.propHitRings on each bridge). Reports each clash as lane, arc
// range and the nearest clear offset. Also reports, per lane, where it crosses a bridge deck.
//   node regatta/eval/_bay_bridge_traffic.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.VenueDoc && window.Traffic && VenueDoc.get('bay'));
  const out = await p.evaluate(() => {
    const doc = VenueDoc.get('bay'), K = VenueDoc.PROP_KINDS;
    const bridges = doc.props.filter(q => /cove-bridge/.test(q.kind));
    const rings = [];
    for (const q of bridges) for (const r of VenueDoc.propHitRings(q).rings) rings.push({ id: q.id, r });
    const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
    const hits = (box, ring) => { for (const v of box) if (inPoly(v[0], v[1], ring)) return true;
      for (const v of ring) if (inPoly(v[0], v[1], box)) return true;
      for (let i = 0; i < 4; i++) for (let j = 0; j < ring.length; j++) if (segX(box[i], box[(i + 1) % 4], ring[j], ring[(j + 1) % ring.length])) return true; return false; };
    // the deck line of each bridge: sprite-up axis through the centre, 0.46 of the drawn size each way
    const decks = bridges.map(q => { const w = K[q.kind].world * (q.scale || 1), h = q.heading || 0, ux = Math.sin(h), uy = -Math.cos(h);
      return { id: q.id, a: [q.x - ux * 0.46 * w, q.y - uy * 0.46 * w], b: [q.x + ux * 0.46 * w, q.y + uy * 0.46 * w], c: [q.x, q.y], u: [ux, uy] }; });
    const lanes = [];
    for (const e of doc.traffic || []) {
      const c = Traffic.compilePath(e); if (!c) continue;
      const kind = K[e.kind] || {}; const W = (kind.world || 60) * (e.scale || 1);
      const hl = (kind.hull ? kind.hull[0] : 1) * W / 2, hb = (kind.hull ? kind.hull[1] : 0.4) * W / 2;
      const L = c.knotS[c.knotS.length - 1]; const clash = []; const cross = [];
      let prev = null;
      for (let s = 0; s <= L; s += 4) {
        const pt = c.atArc(s); const hd = pt.heading, fx = Math.sin(hd), fy = -Math.cos(hd), rx = -fy, ry = fx;
        const box = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([f, r]) => [pt.x + fx * hl * f + rx * hb * r, pt.y + fy * hl * f + ry * hb * r]);
        for (const R of rings) if (hits(box, R.r)) clash.push({ s: Math.round(s), bridge: R.id, x: Math.round(pt.x), y: Math.round(pt.y) });
        if (prev) for (const d of decks) if (segX([prev.x, prev.y], [pt.x, pt.y], d.a, d.b)) {
          const along = (pt.x - d.c[0]) * d.u[0] + (pt.y - d.c[1]) * d.u[1];
          cross.push({ bridge: d.id, s: Math.round(s), along: Math.round(along) });
        }
        prev = pt;
      }
      // collapse the clash samples into runs
      const runs = []; for (const h of clash) { const r = runs[runs.length - 1]; if (r && r.bridge === h.bridge && h.s - r.s1 <= 8) r.s1 = h.s; else runs.push({ bridge: h.bridge, s0: h.s, s1: h.s, at: [h.x, h.y] }); }
      lanes.push({ id: e.id, name: e.name, kind: e.kind, hull: [Math.round(hl * 2), Math.round(hb * 2)], length: Math.round(L), crosses: cross, clashes: runs });
    }
    return { towers: rings.length, bridges: bridges.map(q => q.id), lanes };
  });
  console.log(`bridges ${out.bridges.join(', ')}; ${out.towers} tower rings`);
  for (const l of out.lanes) {
    const tag = l.clashes.length ? 'CLASH' : (l.crosses.length ? 'under' : '  -  ');
    console.log(`${tag} ${l.id.padEnd(8)} ${String(l.name || '').padEnd(16)} ${l.kind.padEnd(24)} hull ${l.hull.join('x')}  crosses ${JSON.stringify(l.crosses)}${l.clashes.length ? '  clashes ' + JSON.stringify(l.clashes) : ''}`);
  }
  console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors'); await b.close();
})();

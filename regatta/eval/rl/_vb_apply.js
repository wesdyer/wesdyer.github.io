// ROUTE BALANCE: write a _vb_try.js patch into a venue FILE.   node _vb_apply.js <in.venue.js> <patch.json> <out.venue.js>
// Same ops, same order, as _vb_try.js applies in memory. The output keeps the generated-file header.
const fs = require('fs');
const [IN, PATCH, OUT] = process.argv.slice(2);
const src = fs.readFileSync(IN, 'utf8');
global.window = {}; eval(src);
const V = Object.keys(window.VENUE_DOC)[0], doc = window.VENUE_DOC[V];
const inPoly = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const cen = p => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
const r2 = v => Math.round(v * 10) / 10;
for (const o of JSON.parse(fs.readFileSync(PATCH, 'utf8'))) {
  if (o.op === 'windMul' || o.op === 'windSet') {
    for (const r of doc.wind.regions) {
      const hit = o.ids ? o.ids.includes(r.id) : inPoly(o.poly, ...cen(r.poly));
      if (hit) r.speed = o.op === 'windMul' ? +(r.speed * o.mul).toFixed(2) : o.speed;
    }
  } else if (o.op === 'propsOut') {
    doc.props = doc.props.filter(p => !inPoly(o.poly, p.x, p.y) || (o.kinds && !o.kinds.some(k => p.kind.includes(k))));
  } else if (o.op === 'propsIn') {
    const tpl = doc.props.find(p => p.kind === o.kind);
    o.pts.forEach((q, i) => doc.props.push(Object.assign(JSON.parse(JSON.stringify(tpl)), { id: `vb-${o.kind}-${i}-${q[0] | 0}`, x: q[0], y: q[1] })));
  } else if (o.op === 'shape') {
    doc.shapes.push({ id: o.id || `vb-${doc.shapes.length}`, kind: o.kind, smooth: o.smooth !== false, outer: o.outer.map(p => [r2(p[0]), r2(p[1])]) });
  } else if (o.op === 'shapeOut') {
    doc.shapes = doc.shapes.filter(s => !o.ids.includes(s.id));
  } else if (o.op === 'shapeSet') {
    const s = doc.shapes.find(s => s.id === o.id); s.outer = o.outer;
  }
}
const head = src.slice(0, src.indexOf(`window.VENUE_DOC["${V}"]`));
fs.writeFileSync(OUT, head + `window.VENUE_DOC["${V}"] = ` + JSON.stringify(doc, null, 2) + ';\n');
console.log(`wrote ${OUT}: shapes ${doc.shapes.length}, props ${doc.props.length}`);

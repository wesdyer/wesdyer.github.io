// Wildlife's indexed solidAt / fixedLand give a full scan's answer: every venue's islands (floes included, and
// with noFloes both ways), sampled on a lattice over the course.   node regatta/eval/_solid_index_check.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.Wildlife && window.Wildlife._probe && window.VENUE_DOC);
  console.log(await p.evaluate(() => {
    const W = window.Wildlife._probe; let n = 0, bad = 0; const lines = [];
    const pip = (x, y, s) => (s.smooth && typeof pointInPolyFast === 'function') ? pointInPolyFast(x, y, s.vertices) : pointInPoly(x, y, s.vertices);
    const refSolid = (x, y, ignore, noFloes) => { for (const s of state.course.islands || []) {
      if (s === ignore || (noFloes && s.isFloe) || s.awash || !s.vertices || s.vertices.length < 3) continue;
      const r = (s.radius || 1e9) + (s.isFloe ? 20 : 0), dx = x - s.x, dy = y - s.y; if (dx * dx + dy * dy > r * r) continue;
      if (pip(x, y, s)) return s;
      if (s.isFloe) for (const k of [0.35, 1]) { const tt = 0.9 * k, w = -(s.spinRate || 0) * tt, px = x - (s.driftVx || 0) * tt - s.x, py = y - (s.driftVy || 0) * tt - s.y;
        if (pointInPoly(s.x + px * Math.cos(w) - py * Math.sin(w), s.y + px * Math.sin(w) + py * Math.cos(w), s.vertices)) return s; } } return null; };
    const refFixed = (x, y) => { for (const s of state.course.islands || []) { if (s.isFloe || s.awash || !s.vertices || (s.id || '').endsWith('.hit')) continue; if (Math.hypot(x - s.x, y - s.y) > (s.radius || 1e9)) continue; if (pip(x, y, s)) return true; } return false; };
    for (const v of Object.keys(window.VENUE_DOC)) {
      const d = window.VENUE_DOC[v]; if (!d.shapes || !d.shapes.length || !d.course || !(d.course.route || []).length) continue;
      settings.venue = v; selectVenue(v); resetGame(); startRace(); for (let i = 0; i < 120; i++) update(1 / 60);
      let vb = 0, vn = 0; const xs = state.course.islands.map(i => i.x), ys = state.course.islands.map(i => i.y);
      const x0 = Math.min(...xs) - 500, x1 = Math.max(...xs) + 500, y0 = Math.min(...ys) - 500, y1 = Math.max(...ys) + 500, st = Math.max(15, (x1 - x0) / 220);
      for (let x = x0; x <= x1; x += st) for (let y = y0; y <= y1; y += st) {
        vn += 3; if (W.solidAt(x, y, null, false) !== refSolid(x, y, null, false)) vb++; if (W.solidAt(x, y, null, true) !== refSolid(x, y, null, true)) vb++; if (W.fixedLand(x, y) !== refFixed(x, y)) vb++; }
      n += vn; bad += vb; lines.push(`${v} ${vn} queries, ${vb} differ`);
    }
    return lines.join('\n') + `\n${bad ? 'FAIL' : 'PASS'} — ${bad} of ${n} differ`;
  }));
  await b.close(); })();

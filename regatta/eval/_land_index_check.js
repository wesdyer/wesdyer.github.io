// pointOnLand / crestOnLand through the land cell index (world.js landIndex, Oct 2026 perf pass) give a
// full scan's answer, with the plain vertex test as the reference: every venue, floes included (after
// two minutes of drift), sampled on a lattice over the course.   node regatta/eval/_land_index_check.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.VENUE_DOC && typeof pointOnLand === 'function');
  console.log(await p.evaluate(() => {
    let n = 0, bad = 0; const lines = [];
    const refLand = (x, y) => { for (const isl of state.course.islands || []) {
      if (isl.awash || !isl.vertices || isl.vertices.length < 3) continue;
      const dx = x - isl.x, dy = y - isl.y; if (dx * dx + dy * dy > isl.radius * isl.radius) continue;
      if (!pointInVerts(x, y, isl.vertices)) continue;
      if (!(isl.holes || []).some(h => h && h.length >= 3 && pointInVerts(x, y, h))) return true; } return false; };
    const refCrest = (x, y) => { for (const isl of state.course.islands || []) {
      if (isl.awash || isl.reef || isl.hidden || !isl.vertices || isl.vertices.length < 3) continue;
      const dx = x - isl.x, dy = y - isl.y; if (dx * dx + dy * dy > isl.radius * isl.radius) continue;
      if (!pointInVerts(x, y, isl.vertices)) continue;
      if (!(isl.holes || []).some(h => h && h.length >= 3 && pointInVerts(x, y, h))) return true; } return false; };
    for (const v of Object.keys(window.VENUE_DOC)) {
      const d = window.VENUE_DOC[v]; if (!d.shapes || !d.shapes.length || !d.course || !(d.course.route || []).length || /^pond/.test(v)) continue;   // (the pond is the school's)
      resetGame(); settings.venue = v; selectVenue(v); resetGame(); startRace(); if (state.course.venueKey !== v) { lines.push(`${v} NOT LOADED (${state.course.venueKey})`); bad++; continue; } for (let i = 0; i < 7200; i++) update(1 / 60);
      let vb = 0, vn = 0; const xs = state.course.islands.map(i => i.x), ys = state.course.islands.map(i => i.y);
      const x0 = Math.min(...xs) - 500, x1 = Math.max(...xs) + 500, y0 = Math.min(...ys) - 500, y1 = Math.max(...ys) + 500, st = Math.max(13, (x1 - x0) / 240);
      for (let x = x0; x <= x1; x += st) for (let y = y0; y <= y1; y += st) {
        vn += 2; if (pointOnLand(x, y) !== refLand(x, y)) vb++; if (crestOnLand(x, y) !== refCrest(x, y)) vb++; }
      n += vn; bad += vb; lines.push(`${v} ${vn} queries, ${vb} differ`);
    }
    return lines.join('\n') + `\n${bad ? 'FAIL' : 'PASS'} — ${bad} of ${n} differ`;
  }));
  await b.close(); })();

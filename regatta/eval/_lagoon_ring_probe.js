// Probe: can a boat sail round a Pearl Lagoon cay? For each candidate, rings of growing radius
// round its centre, each sampled at 180 points against every wall (sand, scrub, coral reef —
// VenueDoc.traits hard or reef) and the course boundary: how much is blocked, by what, and the
// longest contiguous open arc. Sep 25 2026: shape-5 and shape-20 back onto the barrier reef
// (open arcs ~250-280 and ~230-250 degrees), shape-12 and shape-13 are clear all round — which
// is why Landfall is reef to reef (200 degrees) on shape-5.
//   node regatta/eval/_lagoon_ring_probe.js      (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.VenueDoc && typeof resetGame === 'function');
  console.log(await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', soundEnabled: false })); resetGame();
    const walls = state.course.islands.filter(s => { const k = VenueDoc.traits(s); return k.hard || k.reef; });
    const out = {};
    for (const id of ['shape-5', 'shape-20', 'shape-12', 'shape-13']) {
      const V = state.course.islands.find(s => s.id === id).vertices; let x = 0, y = 0, rmax = 0; for (const v of V) { x += v.x; y += v.y; } x /= V.length; y /= V.length;
      for (const v of V) rmax = Math.max(rmax, Math.hypot(v.x - x, v.y - y));
      const rows = [];
      for (let R = rmax + 30; R < 1000; R += 60) { const hit = {}; let bad = 0;
        for (let k = 0; k < 180; k++) { const a = k / 180 * Math.PI * 2, px = x + Math.cos(a) * R, py = y + Math.sin(a) * R;
          const w = walls.find(s => s !== undefined && pointInPoly(px, py, s.vertices) && s.id !== id); const ob = !Arena.contains(state.course.boundary, px, py, 0);
          if (w || ob) { bad++; const key = w ? w.id + ':' + w.kind : 'boundary'; hit[key] = (hit[key] || 0) + 1; } }
        // the longest contiguous OPEN arc, in degrees
        let run = 0, best = 0; const open = [];
        for (let k = 0; k < 360; k++) { const a = (k % 180) / 180 * Math.PI * 2, px = x + Math.cos(a) * R, py = y + Math.sin(a) * R;
          const blocked = walls.some(s => s.id !== id && pointInPoly(px, py, s.vertices)) || !Arena.contains(state.course.boundary, px, py, 0);
          run = blocked ? 0 : run + 1; best = Math.max(best, run); }
        rows.push(`R${Math.round(R)} blocked ${bad}/180, longest open arc ${Math.min(360, best * 2)}deg ${JSON.stringify(hit)}`); if (!bad) break; }
      out[id] = rows; }
    return JSON.stringify(out, null, 1); }));
  await b.close(); })();

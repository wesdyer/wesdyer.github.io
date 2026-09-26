// Probe: the inside-the-kelp-line gates at Otter Point — for each kelp bed, the shortest open-water
// line from the bed's edge to the shore (land or rock), its length, and how far the fleet's line runs
// from it (autopilot, seed 100).
//   node regatta/eval/_otter_kelpgates.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
    const solid = (x, y) => state.course.islands.some(s => !s.awash && VenueDoc.traits(s).hard && Math.hypot(x - s.x, y - s.y) < (s.radius || 1e9) && pointInPoly(x, y, s.vertices));
    const out = [];
    for (const s of state.course.islands.filter(s => VenueDoc.traits(s).veg === 'kelp')) {
      // the INSIDE: straight from the bed toward the mainland (south, +y, on the north coast) to the first solid
      let best = null, ex = null;
      for (let d = 0; d < 1500; d += 6) { const x = s.x, y = s.y + d; if (!ex) { if (!pointInPoly(x, y, s.vertices)) ex = { x, y }; continue; } if (solid(x, y)) { best = { d: Math.round(y - ex.y), a: { x: Math.round(ex.x), y: Math.round(ex.y) }, b: { x: Math.round(x), y: Math.round(y) } }; break; } }
      out.push({ id: s.id, c: [Math.round(s.x), Math.round(s.y)], gate: best });
    }
    return out; });
  for (const o of r) console.log(o.id.padEnd(18), o.c.join(','), o.gate ? `gap ${o.gate.d} u  ${o.gate.a.x},${o.gate.a.y} -> ${o.gate.b.x},${o.gate.b.y}` : 'no shore');
  await b.close(); })();

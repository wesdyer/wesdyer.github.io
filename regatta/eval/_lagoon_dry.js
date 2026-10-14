// Probe: do Pearl Lagoon's swimmers keep their bodies off the sand islands? Steps the wildlife for N minutes and counts,
// per kind, frames with an animal's centre ON dry land and within its half-length of it (none of it may be under a beach).
//   node regatta/eval/_lagoon_dry.js [minutes]      (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const mins = +(process.argv[2] || 5); const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon' })); resetGame(); });
  await p.waitForTimeout(1000);
  console.log(await p.evaluate((mins) => { for (const b2 of state.boats) { b2.x = 1e6; b2.y = 1e6; }
    const dry = state.course.islands.filter(s => !/\.hit$/.test(s.id) && VenueDoc.traits(s).hard && !VenueDoc.traits(s).reef).map(s => s.vertices);
    const dist = (x, y) => { let best = 1e9; for (const V of dry) { if (pointInPoly(x, y, V)) return -1; for (let i = 0, j = V.length - 1; i < V.length; j = i++) { const q = getClosestPointOnSegment(x, y, V[j].x, V[j].y, V[i].x, V[i].y); best = Math.min(best, Math.hypot(q.x - x, q.y - y)); } } return best; };
    const HALF = { seaturtle: 16, eagleray: 22, reefshark: 21, fish: 5 }, tally = {};
    const D = Wildlife.debug();
    for (let fr = 0; fr < mins * 60 * 30; fr++) { Wildlife.update(1 / 30); if (fr % 3) continue;
      const list = [...D.cruisers.flatMap(G => G.fish.map(f => [G.cfg.kind, f])), ...(D.shoals || []).flatMap(G => G.fish.map(f => ['fish', f]))];
      for (const [kd, f] of list) { const t = tally[kd] = tally[kd] || { n: 0, on: 0, under: 0, minD: 1e9 }; const d = dist(f.x, f.y); t.n++; if (d < 0) t.on++; else if (d < HALF[kd]) t.under++; if (d >= 0) t.minD = Math.min(t.minD, d); } }
    return Object.entries(tally).map(([k, t]) => `${k}: samples ${t.n}, on sand ${t.on}, body under a beach ${t.under}, closest ${t.minD.toFixed(1)}`).join('\n'); }, mins));
  await b.close(); })();

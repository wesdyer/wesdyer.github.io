// Probe: how much wildlife each venue carries — animals counted (every object with x, y in the debug lists, groups
// opened up: birds, members, crabs, fish), the cost of Wildlife.update per frame, and of a whole frame's draw()
// with the camera parked at the venue's busiest wildlife spot (the most animals within 600 u).
//   node regatta/eval/_wild_load.js [venue ...]
const { chromium } = require('playwright'); const path = require('path');
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay','lake','lagoon','swamp','river','ocean','redrock','glowtide','arctic','otter','flats','volcanic','seatrials'];
(async () => { const b = await chromium.launch(); const rows = [];
  for (const v of VENUES) { const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && typeof selectVenue === 'function');
    await p.evaluate(v => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); settings.venue = v; selectVenue(v); resetGame(); }, v);
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const d = Wildlife.debug(), pts = [], seen = new Set(), kids = ['birds', 'members', 'crabs', 'fish', 'pod', 'boids', 'swimmers', 'otters'];
      const walk = (o, depth) => { if (!o || typeof o !== 'object' || seen.has(o) || depth > 3) return; seen.add(o);
        if (Array.isArray(o)) { for (const q of o) walk(q, depth + 1); return; }
        let group = false; for (const k of kids) if (Array.isArray(o[k])) { group = true; for (const q of o[k]) if (q && typeof q.x === 'number') pts.push(q); }
        if (!group && typeof o.x === 'number' && typeof o.y === 'number') pts.push(o); };
      for (const k in d) if (Array.isArray(d[k])) walk(d[k], 0);
      const by = {}; for (const k in d) if (Array.isArray(d[k]) && d[k].length) { const before = pts.length; } 
      // the busiest spot
      let best = null, bn = -1; for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 400))) { const q = pts[i]; const n = pts.filter(o => Math.abs(o.x - q.x) < 600 && Math.abs(o.y - q.y) < 600).length; if (n > bn) { bn = n; best = q; } }
      let tu = 0; for (let i = 0; i < 300; i++) { const t = performance.now(); Wildlife.update(1 / 60); tu += performance.now() - t; }
      const me = state.boats[0]; if (best) { me.x = best.x + 150; me.y = best.y + 150; }
      for (const o of state.boats.slice(1)) { o.x = 1e6; o.y = 1e6; }
      let td = 0, worst = 0; for (let i = 0; i < 120; i++) { update(1 / 60); me.x = best ? best.x + 150 : me.x; me.y = best ? best.y + 150 : me.y; const t = performance.now(); draw(); const dt = performance.now() - t; if (i > 20) { td += dt; worst = Math.max(worst, dt); } }
      return { animals: pts.length, busiest600: bn, updMs: (tu / 300).toFixed(3), drawMs: (td / 99).toFixed(2), drawWorst: worst.toFixed(1) };
    });
    rows.push([v, r]); console.log(v.padEnd(10), JSON.stringify(r)); await p.close(); }
  await b.close(); })();

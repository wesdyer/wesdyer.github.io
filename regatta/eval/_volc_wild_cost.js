// Probe: what Emberfall's wildlife costs to draw, by kind — at the busiest shore spot (and one over open water), each
// layer timed (drawWater / drawPerched / drawAir), then each kind removed in turn to price it; and the counts.
//   node regatta/eval/_volc_wild_cost.js
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && typeof selectVenue === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); settings.venue = 'volcanic'; selectVenue('volcanic'); resetGame(); });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const d = Wildlife.debug(), W = window.Wildlife, T = {};
    for (const k of ['drawWater', 'drawPerched', 'drawAir']) { const f = W[k]; W[k] = function (...a) { const t = performance.now(); const o = f.apply(this, a); T[k] = (T[k] || 0) + performance.now() - t; return o; }; }
    const count = { iguanas: d.igHeaps.reduce((s, G) => s + G.members.length, 0), crabs: d.crabBeds.reduce((s, B) => s + B.crabs.length, 0), boobies: d.boobyFlocks.reduce((s, F) => s + F.birds.length, 0),
      frigates: d.frigates.length, terns: d.ternFlocks.reduce((s, F) => s + F.birds.length, 0), hammers: d.hammerSchools.reduce((s, S) => s + S.fish.length, 0), heaps: d.igHeaps.length, beds: d.crabBeds.length };
    // the busiest shore spot: the heap with the most crabs within 400 u
    const H = d.igHeaps.map(G => ({ G, n: d.crabBeds.reduce((s, B) => s + B.crabs.filter(c => Math.hypot(c.x - G.p0.x, c.y - G.p0.y) < 400).length, 0) + G.members.length })).sort((a, b) => b.n - a.n)[0];
    const me = state.boats[0]; for (const o of state.boats.slice(1)) { o.x = 1e6; o.y = 1e6; }
    const frame = (x, y, n) => { for (const k in T) T[k] = 0; let tot = 0; for (let i = 0; i < n; i++) { me.x = x; me.y = y; update(1 / 60); me.x = x; me.y = y; const t = performance.now(); draw(); tot += performance.now() - t; } const o = { frame: +(tot / n).toFixed(1) }; for (const k in T) o[k] = +(T[k] / n).toFixed(1); return o; };
    const at = H.G.p0, shore = frame(at.x + 120, at.y + 120, 60);
    // each kind removed in turn (its lists emptied for the measurement, then put back)
    const kinds = { iguanas: [d.igHeaps, 'members'], crabs: [d.crabBeds, 'crabs'], boobies: [d.boobyFlocks, 'birds'], terns: [d.ternFlocks, 'birds'], hammers: [d.hammerSchools, 'fish'] };
    const without = {};
    for (const k in kinds) { const [L, key] = kinds[k], keep = L.map(G => G[key]); L.forEach(G => G[key] = []); without[k] = frame(at.x + 120, at.y + 120, 40).frame; L.forEach((G, i) => G[key] = keep[i]); }
    return { count, shoreSpot: [Math.round(at.x), Math.round(at.y), H.n + ' animals near'], shore, frameWithout: without };
  });
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();

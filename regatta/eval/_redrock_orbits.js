// Probe: do Redrock's land walkers (coyotes, bighorn) circle their targets? Per leg (one target): distance walked vs
// straight-line distance, total turning, and legs that turned more than a full circle. Ten quiet minutes.
//   node regatta/eval/_redrock_orbits.js
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false })); resetGame();
    for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const d = Wildlife.debug(), walkers = [...d.coyotes.map(K => ({ o: K, kind: 'coyote' })), ...d.bands.flatMap(G => G.members.map(s => ({ o: s, kind: 'bighorn' })))];
    const st = { coyote: { legs: 0, orbit: 0, ratio: [] }, bighorn: { legs: 0, orbit: 0, ratio: [] } };
    for (const w of walkers) w.leg = null;
    for (let i = 0; i < 30 * 600; i++) {
      const prev = walkers.map(w => ({ x: w.o.x, y: w.o.y, h: w.o.h }));
      Wildlife.update(1 / 30);
      walkers.forEach((w, k) => { const o = w.o, q = prev[k], moving = Math.hypot(o.x - q.x, o.y - q.y) > 0.05;
        const key = o.tx + ',' + o.ty;
        if (moving) { if (!w.leg || w.leg.key !== key) { if (w.leg) close(w); w.leg = { key, x0: q.x, y0: q.y, path: 0, turn: 0 }; }
          let dh = o.h - q.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
          w.leg.path += Math.hypot(o.x - q.x, o.y - q.y); w.leg.turn += Math.abs(dh); w.leg.x1 = o.x; w.leg.y1 = o.y; }
        else if (w.leg) close(w); });
    }
    function close(w) { const L = w.leg, s = st[w.kind], straight = Math.hypot(L.x1 - L.x0, L.y1 - L.y0); w.leg = null; if (L.path < 5) return;
      s.legs++; if (L.turn > 2 * Math.PI) s.orbit++; s.ratio.push(L.path / Math.max(1, straight)); }
    for (const k in st) { const a = st[k].ratio.sort((x, y) => x - y); st[k].medRatio = +(a[a.length >> 1] || 0).toFixed(2); st[k].p90 = +(a[Math.floor(a.length * 0.9)] || 0).toFixed(2); delete st[k].ratio; }
    return st; });
  console.log(JSON.stringify(r)); await b.close(); })();

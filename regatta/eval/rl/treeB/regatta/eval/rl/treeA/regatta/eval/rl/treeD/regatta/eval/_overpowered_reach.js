// How much of a race does each venue actually spend above the overpowered threshold?
// The flag used to answer this with a hand-kept list; the threshold answers it with wind.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  const rows = await p.evaluate(() => {
    const out = [];
    for (const k of Object.keys(VENUES)) {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: k }));
      let over = 0, n = 0, peak = 0, cost = 0, bmin = 99, bmax = 0;
      for (let race = 0; race < 40; race++) {
        let s = 5000 + race * 7919;
        Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        resetGame();
        const bd = state.course.boundary;
        bmin = Math.min(bmin, state.wind.baseSpeed); bmax = Math.max(bmax, state.wind.baseSpeed);
        // Sample the course over time, as the puffs sweep across it.
        for (let step = 0; step < 40; step++) {
          state.time = step * 6;
          updateGusts(1 / 60);
          for (let i = 0; i < 25; i++) {
            const a = (i / 25) * Math.PI * 2, r = bd.radius * 0.6;
            const w = getWindAt(bd.x + Math.sin(a) * r, bd.y - Math.cos(a) * r);
            n++;
            if (w.speed > 18) { over++; cost += Math.min(0.25, (w.speed - 18) * 0.03); }
            peak = Math.max(peak, w.speed);
          }
        }
      }
      out.push({ k, base: bmin.toFixed(1)+'-'+bmax.toFixed(1), pct: +(100 * over / n).toFixed(1), peak: +peak.toFixed(1),
                 avgCost: over ? +(100 * cost / over).toFixed(1) : 0,
                 wind: VENUES[k].wind ? VENUES[k].wind.join('-') : '8-18 (default)' });
    }
    return out;
  });
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('venue', 11) + pad('cfg wind', 13) + pad('rolled', 12) + pad('% >18kt', 9) + pad('peak', 7) + 'avg cost when over');
  for (const r of rows.sort((a, b2) => b2.pct - a.pct))
    console.log(pad(r.k, 11) + pad(r.wind, 13) + pad(r.base, 12) + pad(r.pct + '%', 9) + pad(r.peak, 7) + (r.pct ? r.avgCost + '%' : '—'));
  await b.close();
})();

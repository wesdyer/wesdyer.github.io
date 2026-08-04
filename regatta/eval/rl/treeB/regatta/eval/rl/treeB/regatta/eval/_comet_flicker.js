// Does the drawn tail tip move SMOOTHLY? The old renderer dropped the oldest track sample
// whole, so the tip jumped a full segment ~10x/second. Sample the spine every frame and
// compare each streak's tip step against its head step: on a smooth tail they match.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: process.env.V || 'arctic' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(2500);
  await p.evaluate(() => {
    if (typeof startRace === 'function') startRace();
    window.__samples = [];
    const prev = new Map();
    const tick = () => {
      for (const q of state.particles) {
        if (q.type !== 'wind') continue;
        const n = streakSpine(q);
        if (n < 2) { prev.delete(q); continue; }
        const tip = _spine[n - 1];
        const raw = q.trail[q.trail.length - 1];   // the pre-fix endpoint: the oldest stored sample
        const pv = prev.get(q);
        if (pv) window.__samples.push({
          tip: Math.hypot(tip.x - pv.tx, tip.y - pv.ty),
          raw: Math.hypot(raw.x - pv.rx, raw.y - pv.ry),
          head: Math.hypot(q.x - pv.hx, q.y - pv.hy)
        });
        prev.set(q, { tx: tip.x, ty: tip.y, rx: raw.x, ry: raw.y, hx: q.x, hy: q.y });
      }
      if (window.__samples.length < 60000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await p.waitForTimeout(12000);
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__samples.filter(x => x.head > 0.05);
    const stat = key => {
      const r = s.map(x => x[key] / x.head).sort((a, b) => a - b);
      const q = f => +r[Math.floor(f * (r.length - 1))].toFixed(3);
      return { p50: q(.5), p90: q(.9), p99: q(.99), max: q(1),
               pctOver3x: +(100 * r.filter(x => x > 3).length / r.length).toFixed(3) };
    };
    return { samples: s.length, interpolatedTip: stat('tip'), oldestStoredSample_preFix: stat('raw') };
  }), null, 1));
  await b.close();
})();

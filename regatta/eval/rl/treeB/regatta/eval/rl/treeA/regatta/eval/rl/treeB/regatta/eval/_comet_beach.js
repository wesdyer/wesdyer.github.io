// Does a streak ever DISAPPEAR while still visible? Watch every wind particle and record
// the drawn envelope on the last frame before it leaves state.particles. A pop shows up
// as a removal at high alpha; a proper fade shows up as removals clustered near zero.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const v of ['arctic', 'river', 'lake']) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2500);
    await p.evaluate(() => {
      if (typeof startRace === 'function') startRace();
      window.__gone = []; window.__peak = 0;
      const lastEnv = new Map();
      const envOf = q => {
        const age = (1 - q.life) * WIND_LIFE, left = q.life * WIND_LIFE;
        return Math.max(0, Math.min(1, age / WIND_FADE_IN, left / WIND_FADE_OUT, q.beach === undefined ? 1 : q.beach));
      };
      const tick = () => {
        const live = new Set();
        let n = 0;
        for (const q of state.particles) if (q.type === 'wind') { live.add(q); lastEnv.set(q, { e: envOf(q), b: !!q.beached }); n++; }
        if (n > window.__peak) window.__peak = n;
        for (const [q, v] of lastEnv) if (!live.has(q)) { window.__gone.push(v); lastEnv.delete(q); }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await p.waitForTimeout(14000);
    rows.push(await p.evaluate(() => {
      const g = window.__gone, beached = g.filter(x => x.b);
      const hi = a => a.filter(x => x.e > 0.05).length;
      const med = a => { const s = a.map(x => x.e).sort((m, n) => m - n); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
      return { venue: settings.venue, peakStreaks: window.__peak, removed: g.length,
               beachedRemovals: beached.length,
               removedAboveEnv005: hi(g), beachedAboveEnv005: hi(beached),
               medEnvAtRemoval: med(g) };
    }));
    await p.close();
  }
  console.table(rows);
  await b.close();
})();

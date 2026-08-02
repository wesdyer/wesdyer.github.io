// Isolate the layer: wrap drawParticles and accumulate only the 'air' calls.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(2500);
  await p.evaluate(() => {
    const orig = window.drawParticles;
    window.__air = [];
    window.drawParticles = function (ctx, layer) {
      if (layer !== 'air') return orig(ctx, layer);
      const t0 = performance.now(); const r = orig(ctx, layer);
      window.__air.push(performance.now() - t0); return r;
    };
    if (typeof startRace === 'function') startRace();
  });
  await p.waitForTimeout(12000);
  console.log(JSON.stringify(await p.evaluate(() => {
    const a = window.__air.slice(120).sort((x, y) => x - y);
    const q = f => +a[(a.length * f) | 0].toFixed(3);
    return { venue: settings.venue, frames: a.length,
             streaks: state.particles.filter(x => x.type === 'wind').length,
             airLayerMs: { p50: q(.5), p90: q(.9), p99: q(.99) } };
  }), null, 1));
  await b.close();
})();

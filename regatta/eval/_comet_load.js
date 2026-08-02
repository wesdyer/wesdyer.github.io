// The BUSIEST frame, not the average. Density and thickness are the two channels that can
// go from informational to overwhelming, and a gust pushes local wind past the ramp's top
// so every channel clamps to max exactly where the fleet is looking.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const v of (process.env.V || 'arctic,ocean,bay,swamp').split(',')) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2500);
    await p.evaluate(() => {
      if (typeof startRace === 'function') startRace();
      window.__peak = { n: 0, alpha: 0, wH: 0, ink: 0, t: 0 };
      const tick = () => {
        const cam = state.camera; let n = 0, ink = 0;
        for (const q of state.particles) {
          if (q.type !== 'wind' || !q.trail || q.trail.length < 2) continue;
          if (Math.abs(q.x - cam.x) > 700 || Math.abs(q.y - cam.y) > 450) continue;
          n++;
          const t = pressureAt(q.spd || 0);
          const age = (1 - q.life) * WIND_LIFE, left = q.life * WIND_LIFE;
          const env = Math.max(0, Math.min(1, age / WIND_FADE_IN, left / WIND_FADE_OUT, q.beach === undefined ? 1 : q.beach));
          const ch = streakChannels(t, q.jit || 0.5, q.spd || 0);
          const a = env * ch.alpha;
          const tail = q.trail[q.trail.length - 1];
          const L = Math.hypot(q.x - tail.x, q.y - tail.y);
          // "ink": alpha-weighted area covered, as a fraction of the viewport
          ink += a * L * ch.halfWidth * 1.2 / (1400 * 900);
          if (a > window.__peak.alpha) window.__peak.alpha = a;
          if (ch.halfWidth > window.__peak.wH) window.__peak.wH = ch.halfWidth;
          if (t > window.__peak.t) window.__peak.t = t;
        }
        if (n > window.__peak.n) window.__peak.n = n;
        if (ink > window.__peak.ink) window.__peak.ink = ink;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await p.waitForTimeout(45000);
    const k = await p.evaluate(() => ({ venue: settings.venue, gustCells: state.gusts.length, ...window.__peak }));
    rows.push({ venue: k.venue, peakOnScreen: k.n, peakAlpha: +k.alpha.toFixed(3),
                peakHalfWidth: +k.wH.toFixed(2), peakT: +k.t.toFixed(2),
                peakInkPctOfScreen: +(k.ink * 100).toFixed(1) });
    await p.close();
  }
  console.table(rows);
  await b.close();
})();

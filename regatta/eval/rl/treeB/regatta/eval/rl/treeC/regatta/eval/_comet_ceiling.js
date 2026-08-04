// Force the whole view to the top of the ramp — the worst case a gust produces — and check
// the guardrails actually bind. Also sweeps the config knobs well past sane values, because
// the point of a clamp is that it holds when a coefficient is later raised.
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d4fb1166-2abc-4e3b-a981-fea7ac01df07/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const cfg of [{ name: 'shipped' }, { name: 'abused', __COMET: { a0: 2, a1: 3, w0: 9, w1: 9, dens0: 1, dens1: 1 } }]) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
    await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2500);
    await p.evaluate(c => {
      if (c) window.__COMET = c;
      window.pressureAt = () => 1;          // the whole view at the top of the ramp
      if (typeof startRace === 'function') startRace();
      window.__peak = { n: 0, alpha: 0, wH: 0, ink: 0 };
      const tick = () => {
        const cam = state.camera; let n = 0, ink = 0;
        for (const q of state.particles) {
          if (q.type !== 'wind' || !q.trail || q.trail.length < 2) continue;
          if (Math.abs(q.x - cam.x) > 700 || Math.abs(q.y - cam.y) > 450) continue;
          n++;
          const age = (1 - q.life) * WIND_LIFE, left = q.life * WIND_LIFE;
          const env = Math.max(0, Math.min(1, age / WIND_FADE_IN, left / WIND_FADE_OUT, q.beach === undefined ? 1 : q.beach));
          const ch = streakChannels(1, q.jit || 0.5, q.spd || 0);
          const a = env * ch.alpha;
          const tail = q.trail[q.trail.length - 1];
          ink += a * Math.hypot(q.x - tail.x, q.y - tail.y) * ch.halfWidth * 1.2 / (1400 * 900);
          if (a > window.__peak.alpha) window.__peak.alpha = a;
          if (ch.halfWidth > window.__peak.wH) window.__peak.wH = ch.halfWidth;
        }
        if (n > window.__peak.n) window.__peak.n = n;
        if (ink > window.__peak.ink) window.__peak.ink = ink;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, cfg.__COMET || null);
    await p.waitForTimeout(30000);
    const k = await p.evaluate(() => window.__peak);
    rows.push({ config: cfg.name, peakOnScreen: k.n, peakAlpha: +k.alpha.toFixed(3),
                peakHalfWidth: +k.wH.toFixed(2), peakInkPctOfScreen: +(k.ink * 100).toFixed(1) });
    await p.screenshot({ path: OUT + 'ceiling_' + cfg.name + '.png' });
    await p.close();
  }
  console.table(rows);
  await b.close();
})();

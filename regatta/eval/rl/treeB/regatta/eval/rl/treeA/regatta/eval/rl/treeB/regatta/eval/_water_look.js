// Nearest-neighbour vs bilinear on the water's upscale blit, same frame, cropped tight.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace();
    for (let i = 0; i < 1800; i++) update(1/60);
    state.paused = true;
    for (const id of ['pre-race-overlay','results-overlay']) {
      const el = document.getElementById(id); if (el) el.classList.add('hidden');
    }
  });
  const shot = async (smooth, rs, name) => {
    await p.evaluate(([sm, r]) => {
      window.WATER_CONFIG.resolutionScale = r;
      window.__forceSmooth = sm;
      draw();
    }, [smooth, rs]);
    await p.screenshot({ path: `regatta/eval/_water_${name}.png`, clip: { x: 420, y: 240, width: 620, height: 420 } });
  };
  // Patch the blit so the flag is honoured without editing water.js yet.
  await p.evaluate(() => {
    const W = window.WaterRenderer, orig = W.draw.bind(W);
    W.draw = function (ctx, st) {
      const real = ctx.drawImage.bind(ctx);
      ctx.drawImage = function (...a) {
        if (a[0] === W.lowCanvas) ctx.imageSmoothingEnabled = window.__forceSmooth !== false;
        return real(...a);
      };
      orig(ctx, st);
      ctx.drawImage = real;
    };
  });
  await shot(true,  0.5,  'smooth_rs50');
  await shot(false, 0.5,  'nearest_rs50');
  await shot(false, 0.75, 'nearest_rs75');
  console.log('shot 3');
  await b.close();
})();

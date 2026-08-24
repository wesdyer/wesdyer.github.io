// TEMPORAL SMOOTHNESS of the water layer: pan the camera a fraction of a unit per
// frame and capture a water-only patch each frame (clip screenshots — getImageData is
// blocked by the file:// taint). Diffed by the companion python in the runner: smooth
// subpixel motion gives a small UNIFORM per-frame delta; nearest-quantized motion gives
// near-zero deltas punctuated by whole-pixel LURCHES — "the water jumps around", numeric.
const { chromium } = require('playwright');
const path = require('path');
const VENUE = process.env.PERF_VENUE || 'seatrials';
const OUT = process.env.WM_OUT || '/tmp/wm';
const fs = require('fs');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1400);
  await page.evaluate((__V) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: __V }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace();
    for (let i = 0; i < 900; i++) update(1 / 60);
    state.paused = true;
    draw();
  }, VENUE);
  // ⚠️ Clear of the HUD: the leaderboard (left), minimap (top right) and edge
  // indicators all land in screenshots, and a panel fading on WALL-clock timing mid-
  // sequence reads as a giant spurious delta (it did — a 60 where water is ~0.1).
  const clip = { x: 60, y: 560, width: 240, height: 240 };
  for (let f = 0; f < 16; f++) {
    await page.evaluate(() => { state.camera.x += 0.3; draw(); });
    await page.screenshot({ path: `${OUT}/${VENUE}_${String(f).padStart(2, '0')}.png`, clip });
  }
  console.log(OUT + '/' + VENUE + '_NN.png written; errors:', errs.length ? errs.slice(0, 3) : 'none');
  await browser.close();
})();

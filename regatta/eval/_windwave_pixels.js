// What does batching drawWindWaves' strokes actually change on screen?
//
// Renders the wind-wave layer ALONE — cleared canvas, one call, nothing else on it — from
// the pre-change tree and the current one, on identical deterministic state, and diffs the
// pixels. Isolating the layer is what makes the comparison meaningful: on a full frame the
// difference would be lost under water, wakes and particles, and the foam blobs are not
// reproducible between runs anyway.
//
// Usage: node eval/_windwave_pixels.js <baseTreeDir> [venue]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.argv[2];
const venue = process.argv[3] || 'ocean';
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad';

async function shot(page, root) {
  await page.goto('file://' + path.resolve(root, 'regatta/index.html'));
  await page.waitForTimeout(1100);
  await page.evaluate((v) => {
    state.paused = true;
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    settings.venue = v; resetGame(); startRace();
    state.time = 0;
    for (let i = 0; i < 1200; i++) update(1 / 60);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-state.camera.rotation);
    ctx.translate(-state.camera.x, -state.camera.y);
    drawWindWaves(ctx);
    ctx.restore();
  }, venue);
  return page.locator('#gameCanvas').screenshot();
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const a = await shot(p, BASE), c = await shot(p, '.');
  fs.writeFileSync(`${OUT}/_ww_base.png`, a);
  fs.writeFileSync(`${OUT}/_ww_new.png`, c);
  console.log('venue', venue, ' wrote _ww_base.png / _ww_new.png');
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();

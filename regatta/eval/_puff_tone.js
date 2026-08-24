// HOW MUCH DOES THE GUST LAYER MOVE THE WATER'S TONE?
//
// Freezes the world, takes the intensity mask and BOTH frames at that one instant, and
// repeats the pair several times so the render's own frame-to-frame jitter (~71k pixels on a
// 1.26M-pixel frame, measured by _drawdet.js) averages out of the answer.
//
// ⚠️ ORDER MATTERS AND THE FIRST VERSION GOT IT WRONG: it measured density for 1800 frames
// between parking the camera and taking the shots, so the cell had drifted and the mask
// described a different world than the pixels did. Nothing advances between mask and frames.
//
// Usage: node eval/_puff_tone.js [venue] [pairs]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const venue = process.argv[2] || 'lake';
const PAIRS = parseInt(process.argv[3] || '4', 10);
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);

  const info = await p.evaluate((v) => {
    state.paused = true;
    settings.venue = v; resetGame(); startRace();
    for (const bt of state.boats) bt.isPlayer = false;
    for (let i = 0; i < 3000; i++) update(1 / 60);
    let best = null;
    for (const g of state.gusts) {
      const s = Math.abs(g.speedDelta) * Math.min(g.radiusX, g.radiusY);
      if (!best || s > best.s) best = { g, s };
    }
    if (!best) return null;
    state.camera.x = best.g.x; state.camera.y = best.g.y; state.camera.rotation = 0;
    // ⚠️ RETURNS THE OVERLAP COUNT AS WELL AS THE INTENSITY, and the count is what makes the
    // measurement attributable. The renderer draws every cell independently, so a pixel the
    // FIELD calls "gust" can have a lull painted over it — and on Stillwater, with eleven
    // lulls to three gusts, that is most of them. Binning without checking reported gusts
    // BRIGHTENING the water, which is the opposite of what the calibration lays down.
    // Pixels touched by more than one cell are dropped by the analysis.
    window.__puffAt = (x, y) => {
      let m = 0, n = 0;
      for (const gg of state.gusts) {
        const dx = x - gg.x, dy = y - gg.y;
        const c = Math.cos(-gg.rotation), s2 = Math.sin(-gg.rotation);
        const rx0 = dx * c - dy * s2, ry = dx * s2 + dy * c;
        const rx = rx0 >= 0 ? rx0 / 0.65 : rx0 / 1.35;
        const d2 = (rx * rx) / (gg.radiusX * gg.radiusX) + (ry * ry) / (gg.radiusY * gg.radiusY);
        if (d2 > 1) continue;
        const t = 1 - Math.sqrt(d2);
        const life = Math.min(gg.age / 5, 1) * Math.min((gg.duration - gg.age) / 5, 1);
        const i2 = Math.max(0, t * t * (3 - 2 * t) * life) * (gg.speedDelta >= 0 ? 1 : -1);
        if (Math.abs(i2) > 0.02) n++;
        if (Math.abs(i2) > Math.abs(m)) m = i2;
      }
      return [m, n];
    };
    const mask = [];
    for (let y = 0; y < canvas.height; y += 3)
      for (let x = 0; x < canvas.width; x += 3) {
        const wx = state.camera.x + (x - canvas.width / 2), wy = state.camera.y + (y - canvas.height / 2);
        const [v, n] = window.__puffAt(wx, wy);
        mask.push([x, y, +v.toFixed(3), n]);
      }
    return { mask, cell: { rx: Math.round(best.g.radiusX), ry: Math.round(best.g.radiusY),
             delta: +best.g.speedDelta.toFixed(2), type: best.g.type },
             base: +state.wind.baseSpeed.toFixed(1), w: canvas.width, h: canvas.height };
  }, venue);
  if (!info) { console.log('no gust cells on', venue); await b.close(); return; }
  fs.writeFileSync(`${OUT}/_puff_mask.json`, JSON.stringify(info.mask));

  // ⚠️ WARM THE RENDER FIRST. Island sprites, gust tints and glow sprites all bake lazily on
  // their first draw, so frame 1 and frame 2 differ by an entire vegetation layer — which
  // lands in the diff as if the gust layer had done it.
  await p.evaluate(() => { for (let i = 0; i < 4; i++) draw(); });

  const shot = async (on) => {
    await p.evaluate((o) => {
      if (!window.__origGusts) window.__origGusts = window.drawGusts;
      window.drawGusts = o ? window.__origGusts : () => {};
      draw();
    }, on);
    return p.locator('#gameCanvas').screenshot();
  };
  for (let i = 0; i < PAIRS; i++) {
    fs.writeFileSync(`${OUT}/_puff_on_${i}.png`, await shot(true));
    fs.writeFileSync(`${OUT}/_puff_off_${i}.png`, await shot(false));
  }
  fs.writeFileSync(`${OUT}/_puff_meta.json`, JSON.stringify({ venue, pairs: PAIRS, ...info, mask: undefined }));
  console.log(`venue ${venue}  base ${info.base} kt  cell ${info.cell.type} ${info.cell.rx}x${info.cell.ry}u delta ${info.cell.delta} kt  (${PAIRS} pairs)`);
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();

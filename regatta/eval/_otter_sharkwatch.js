// Probe: one LIVE great white stepped by Wildlife.update and drawn by the real drawWhiteShark onto an
// overlay centred on it (heading up), every ~0.8 s, at 2x — the painted sprite's real swim and turns.
//   node regatta/eval/_otter_sharkwatch.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 640 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const d = Wildlife.debug(), W = d.whites[0];
    const c = document.createElement('canvas'); c.width = 1500; c.height = 640; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc, water = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a';
    g.fillStyle = water; g.fillRect(0, 0, 1500, 640);
    for (let f = 0; f < 14; f++) {
      for (let i = 0; i < 24; i++) Wildlife.update(1 / 30);
      const col = f % 7, row = Math.floor(f / 7), cx = 107 + col * 214, cy = 160 + row * 320;
      state.camera = { x: W.x, y: W.y, rotation: 0 };
      g.save(); g.beginPath(); g.rect(cx - 106, cy - 158, 212, 316); g.clip(); g.fillStyle = water; g.fillRect(cx - 106, cy - 158, 212, 316);
      g.translate(cx, cy); g.scale(2, 2); g.rotate(-W.h); g.translate(-W.x, -W.y); Wildlife.art.drawWhiteShark(g, W, 'water'); g.restore();
      g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(`${((f + 1) * 0.8).toFixed(1)}s ${W.mode} d${W.depth.toFixed(2)} turn ${(W.turn || 0).toFixed(2)}`, cx - 100, cy - 144);
    } });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();

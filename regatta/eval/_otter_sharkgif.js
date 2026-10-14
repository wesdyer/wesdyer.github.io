// Probe: frames for a GIF of one LIVE great white — game scale (1x, beside a hull) and close up (3x),
// heading up, stepped by Wildlife.update at 15 fps. Writes <dir>/f000.png ...
//   node regatta/eval/_otter_sharkgif.js <dir> [frames] [whiteIndex] [fin]     (from the repo root; fin: held at the surface, finning)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], N = +(process.argv[3] || 90), wi = +(process.argv[4] || 0), fin = process.argv[5] === 'fin'; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 760, height: 420 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate((wi) => { const c = document.createElement('canvas'); c.width = 760; c.height = 420; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    for (let i = 0; i < 60; i++) Wildlife.update(1 / 30); window.__W = Wildlife.debug().whites[wi]; }, wi);
  for (let f = 0; f < N; f++) {
    await p.evaluate((fin) => { const W = window.__W; Wildlife.update(1 / 30); Wildlife.update(1 / 30); if (fin) W.depth = 0.03;
      const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc, water = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a';
      state.camera = { x: W.x, y: W.y, rotation: 0 };
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = water; g.fillRect(0, 0, 760, 420);
      const panel = (cx, cy, s) => { g.save(); g.translate(cx, cy); g.scale(s, s); g.rotate(-W.h); g.translate(-W.x, -W.y);
        for (const B of Wildlife.debug().splashes) Wildlife.art.drawSplash(g, B); Wildlife.art.drawWhiteShark(g, W, 'water'); g.restore(); };
      g.save(); g.beginPath(); g.rect(0, 0, 200, 420); g.clip(); panel(100, 200, 1);
      g.translate(150, 300); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); g.restore();
      g.save(); g.beginPath(); g.rect(200, 0, 560, 420); g.clip(); panel(480, 215, 3.2); g.restore();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(200, 0, 2, 420);
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('game scale (with a hull)', 10, 18); g.fillText(`3.2x — ${W.mode}, depth ${W.depth.toFixed(2)}`, 212, 18); }, fin);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 760, height: 420 } });
  }
  await b.close(); console.log('ok', N); })();

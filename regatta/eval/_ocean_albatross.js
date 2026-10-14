// Probe: the painted albatross through a bank (level, rolled left, rolled right, hard both ways), with its shadow
// at height, beside a hull; then a live bird stepped by Wildlife.update for a GIF (frames to <dir> when given).
//   node regatta/eval/_ocean_albatross.js <out.png> [gifdir]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2], dir = process.argv[3]; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 360 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 360; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#1e5fa6'; g.fillRect(0, 0, 1500, 360); state.camera = { x: 0, y: 0, rotation: 0 };
    [[0, 'level'], [-0.5, 'banking left'], [0.5, 'banking right'], [-1, 'hard left'], [1, 'hard right']].forEach(([bk, lab], i) => { const x = 150 + i * 290; g.save(); g.translate(x, 160); g.scale(3, 3);
      A.drawAlbatross(g, { x: 0, y: 0, h: 0, z: 25, bank: bk }); g.restore(); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(lab + ' (' + bk + ')', x - 50, 340); }); });
  await p.screenshot({ path: out });
  if (dir) { fs.mkdirSync(dir, { recursive: true });
    await p.setViewportSize({ width: 640, height: 480 });
    await p.evaluate(() => { const c = document.getElementById('gifc'); c.width = 640; c.height = 480; const me = state.boats[0]; for (const bt of state.boats.slice(1)) { bt.x = 1e6; bt.y = 1e6; } me.speed = 0; window.__me = me; for (let i = 0; i < 60; i++) Wildlife.update(1 / 30); });
    for (let f = 0; f < 120; f++) {
      await p.evaluate(() => { const me = window.__me; for (let k = 0; k < 2; k++) Wildlife.update(1 / 30); const G = Wildlife.debug().gliders[0];
        const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc; state.camera = { x: G.x, y: G.y, rotation: 0 };
        g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#1e5fa6'; g.fillRect(0, 0, 640, 480);
        g.save(); g.translate(320, 240); g.scale(2.4, 2.4); g.translate(-G.x, -G.y); Wildlife.art.drawAlbatross(g, G); g.restore();
        g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`Laysan albatross soaring, x2.4 — bank ${G.bank.toFixed(2)}`, 10, 18); });
      await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 480 } }); } }
  console.log('ok'); await b.close(); })();

// Probe: frames for a GIF of spinner dolphins BOW-RIDING a live boat — the player's hull driven at 16 kn in a
// straight line (moved by hand: the riders read its motion from its position), Wildlife.update stepping the
// school in from abeam to the bow, its own draw, the camera on the bow, heading up.
//   node regatta/eval/_ocean_bowgif.js <dir> [frames] [scale]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], N = +(process.argv[3] || 120), sc = +(process.argv[4] || 2.5); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 480 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const me = state.boats[0]; for (const bt of state.boats.slice(1)) { bt.x = 1e6; bt.y = 1e6; bt.speed = 0; }
    me.x = 3000; me.y = 6000; me.heading = 0; me.speed = 4; window.__me = me;
    for (let i = 0; i < 150; i++) { me.y -= 4 * 16 / 30 * 2.2; Wildlife.update(1 / 30); } });   // get a school onto the bow first
  for (let f = 0; f < N; f++) {
    await p.evaluate((sc) => { const me = window.__me; for (let k = 0; k < 2; k++) { me.y -= 4 * 16 / 30 * 2.2; Wildlife.update(1 / 30); }
      const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc, water = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#1e5fa6';
      state.camera = { x: me.x, y: me.y - 30, rotation: 0 };
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = water; g.fillRect(0, 0, 640, 480);
      g.save(); g.translate(320, 300); g.scale(sc, sc); g.translate(-me.x, -(me.y - 30));
      Wildlife.drawWater(g);   // the water layer first, then the boat over it — the game's order (script.js)
      // the hull (a plain 55-unit shape, bow at -27.5 from its centre, stem 30 ahead of the hull centre in the riders' frame)
      g.save(); g.translate(me.x, me.y); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); g.restore();
      g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`spinner dolphins on the bow at 16 kn, x${sc} — leaping ${Wildlife.debug().riders.reduce((n, S) => n + S.members.filter(q => q.jump > 0).length, 0)}`, 10, 18); }, sc);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 480 } });
  }
  console.log('ok'); await b.close(); })();

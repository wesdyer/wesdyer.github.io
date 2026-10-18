// Probe: frames of one coyote's mousing pounce (sim at 30 fps), drawn 5x on sand, heading up, camera fixed where it
// started — for a GIF at true speed and slowed. Writes <dir>/f000.png ...
//   node regatta/eval/_redrock_pouncegif.js <dir> [coyoteIndex]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], ci = +(process.argv[3] || 2); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false })); resetGame(); });
  await p.waitForTimeout(1200);
  await p.evaluate((ci) => { for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const K = Wildlife.debug().coyotes[ci];
    for (let tries = 0; tries < 40; tries++) { const q = K.spot(); K.x = q.x; K.y = q.y; K.h = Math.random() * 6.28; if (pointOnLand(K.x + Math.sin(K.h) * 26, K.y - Math.cos(K.h) * 26)) break; }
    K.mode = 'stalk'; K.t = 0.5; K.moving = 0; K.again = false;
    const c = document.createElement('canvas'); c.width = 400; c.height = 400; c.id = 'pc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    window.__P = { K, x0: K.x, y0: K.y, h0: K.h }; }, ci);
  for (let f = 0; f < 60; f++) {
    await p.evaluate(() => { const { K, x0, y0, h0 } = window.__P; Wildlife.update(1 / 30);
      const g = document.getElementById('pc').getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#d9b98c'; g.fillRect(0, 0, 400, 400);
      g.save(); g.translate(200, 250); g.scale(5, 5); g.rotate(-h0); g.translate(-x0, -y0); Wildlife.art.drawCoyote(g, K); g.restore();
      g.fillStyle = '#222'; g.font = '13px sans-serif'; g.fillText(`${K.mode}  height ${Math.round(K.z || 0)}  pitch ${Math.round((K.pitch || 0) * 57)}°`, 10, 20); });
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`) });
  }
  await b.close(); console.log('ok'); })();

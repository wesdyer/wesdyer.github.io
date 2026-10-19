// Probe: one coyote's mousing pounce frame by frame (the sim at 30 fps), drawn big and heading up on sand with its
// shadow: a strip of every other frame from the freeze to the pin. Writes <out>.png.
//   node regatta/eval/_redrock_pounce.js <out.png> [coyoteIndex]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2], ci = +(process.argv[3] || 2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false })); resetGame(); });
  await p.waitForTimeout(1200);
  const n = await p.evaluate((ci) => { for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const K = Wildlife.debug().coyotes[ci];
    for (let tries = 0; tries < 40; tries++) { const q = K.spot(); K.x = q.x; K.y = q.y; K.h = Math.random() * 6.28; if (pointOnLand(K.x + Math.sin(K.h) * 26, K.y - Math.cos(K.h) * 26)) break; }
    K.mode = 'stalk'; K.t = 0.2; K.moving = 0;
    const c = document.createElement('canvas'); c.width = 1600; c.height = 900; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#d9b98c'; g.fillRect(0, 0, 1600, 900);
    const x0 = K.x, y0 = K.y, h0 = K.h; let f = 0, col = 0;
    for (let i = 0; i < 48; i++) { Wildlife.update(1 / 30);
      if (i % 2 === 0 && i >= 4) { const cx = 100 + (col % 8) * 195, cy = 230 + Math.floor(col / 8) * 440;
        g.save(); g.translate(cx, cy); g.scale(4.2, 4.2); g.rotate(-h0); g.translate(-x0, -y0); Wildlife.art.drawCoyote(g, K); g.restore();
        g.fillStyle = '#222'; g.font = '13px sans-serif'; g.fillText(`${K.mode} z${Math.round(K.z || 0)} p${Math.round((K.pitch || 0) * 57)}°`, cx - 80, cy - 200); col++; } }
    return col; }, ci);
  await p.screenshot({ path: out }); await b.close(); console.log('frames', n); })();

// Probe: a humpback SWIMMING — one whale held under the surface, drawn every 0.4 s through a stroke
// cycle (flukes foreshortening, tail stock flexing, flippers sculling), large, into one strip.
//   node regatta/eval/_ocean_swim.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 420 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame();
    const d = Wildlife.debug(), m = d.whalePods.find(w => w.cfg.id === 'B').members[0];
    const c = document.createElement('canvas'); c.width = 1500; c.height = 420; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1b5ea8'; g.fillRect(0, 0, 1500, 420);
    for (let f = 0; f < 8; f++) {
      m.mode = 'under'; m.depth = 0.2; m.t = 30; m.ev = null;
      for (let i = 0; i < 12; i++) Wildlife.update(1 / 30);
      m.mode = 'under'; m.depth = 0.2;
      g.save(); g.translate(95 + f * 187, 210); g.scale(2.3, 2.3); g.rotate(-m.h); g.translate(-m.x, -m.y); Wildlife.art.drawWhale(g, m); g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText((f * 0.4).toFixed(1) + 's', 80 + f * 187, 20);
    } });
  await p.screenshot({ path: process.argv[2] }); await b.close(); })();

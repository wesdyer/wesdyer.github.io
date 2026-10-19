// Film strip: one painted hammerhead through a whole tail beat (eight phases) at 4x on deep water.
//   node regatta/eval/_volc_hammer_stroke.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2]; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1640, height: 560 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1640; c.height = 560; const g = c.getContext('2d');
    g.fillStyle = '#1d4a63'; g.fillRect(0, 0, 1640, 560);
    for (let i = 0; i < 8; i++) { g.setTransform(4, 0, 0, 4, 100 + i * 200, 240); A.drawHammer(g, { x: 0, y: 0, h: 0, ph: i * Math.PI / 4, size: 1, turn: 0, mir: 1, roll: 0, shake: 0, shP: 0 }, 0.1);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText('phase ' + i + '/8', 70 + i * 200, 540); }
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  await p.screenshot({ path: out }); await b.close(); })();

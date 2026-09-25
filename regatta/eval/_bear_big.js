// Probe: the brown bear drawn large (5x) — watching in slack water, in the current, rearing,
// lunging, eating — on the river's water, for a feature-by-feature check against the references.
//   node regatta/eval/_bear_big.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1520, height: 600 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1520; c.height = 600; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
    document.body.appendChild(c); const g = c.getContext('2d');
    g.fillStyle = '#2f6f73'; g.fillRect(0, 0, 1520, 600);
    const B = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, up: 0, hx: 0, hy: 0, mode: 'watch', rear: 0, lunge: 0, look: 0, splash: 0, fish: 0 }, o);
    const at = (x, y, s, e) => { g.save(); g.translate(x, y); g.scale(s, s); A.drawBear(g, e); g.restore(); };
    at(170, 300, 4.5, B({ kn: 0.3 }));                 // slack pool
    at(470, 300, 4.5, B({ kn: 2.5, look: 0.6 }));      // in the current, head turned
    at(770, 300, 4.5, B({ kn: 1.8, rear: 1 }));        // rearing to look
    at(1070, 300, 4.5, B({ kn: 1.8, mode: 'lunge', lunge: 0.5, splash: 0.5 }));
    at(1370, 300, 4.5, B({ kn: 1.8, mode: 'eat', fish: 1 }));
  });
  await p.screenshot({ path: process.argv[2] || '/tmp/bear_big.png' }); await b.close(); })();

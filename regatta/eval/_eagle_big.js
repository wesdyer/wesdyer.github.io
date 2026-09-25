// Probe: the bald eagle drawn large (6x) — soaring, stooping, climbing with a fish — on sky blue
// and on river water, for a feature-by-feature check against the references.
//   node regatta/eval/_eagle_big.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1520, height: 560 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1520; c.height = 560; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
    document.body.appendChild(c); const g = c.getContext('2d');
    g.fillStyle = '#6fa8dc'; g.fillRect(0, 0, 760, 560); g.fillStyle = '#2f6f73'; g.fillRect(760, 0, 760, 560);
    const E = (o) => Object.assign({ i: 0, x: 0, y: 0, h: Math.PI / 2, z: 0, mode: 'soar', flap: 0, fish: 0, splash: 0 }, o);
    const at = (x, y, s, e) => { g.save(); g.translate(x, y); g.scale(s, s); A.drawEagle(g, e); g.restore(); };
    at(380, 150, 5, E({ h: -Math.PI / 2 + Math.PI }));                    // soaring, head down-screen like the underside refs
    at(200, 420, 3.2, E({ h: 0, mode: 'stoop' }));
    at(560, 420, 3.2, E({ h: 0, mode: 'climb', flap: 1.3, fish: 1 }));
    at(1140, 170, 5, E({ h: 0.3, z: 100 }));                              // over the water with its shadow
    at(1000, 440, 3.2, E({ h: -0.4, mode: 'climb', flap: 2.6, fish: 1, z: 50 }));
    at(1330, 440, 3.2, E({ h: 0.5, mode: 'grab', flap: 0.8, z: 2 }));
  });
  await p.screenshot({ path: process.argv[2] || '/tmp/eagle_big.png' }); await b.close(); })();

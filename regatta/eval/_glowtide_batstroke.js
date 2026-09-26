// Probe: a Palau flying fox's wingbeat as a film strip — 12 phases through one beat (top of the
// stroke → downstroke → bottom → upstroke), a glide pose, and the game-scale row.
//   node regatta/eval/_glowtide_batstroke.js <out.png>
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 420 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 420; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1a3f5c'; g.fillRect(0, 0, 1500, 420); const lab = (s, x, y) => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '12px sans-serif'; g.fillText(s, x, y); };
    lab('flying fox — one beat, 12 phases (0 = top of the stroke; downstroke first half, upstroke second)', 10, 18);
    for (let i = 0; i < 12; i++) { g.save(); g.translate(62 + i * 118, 120); g.scale(3, 3); A.drawFlyingFox(g, { x: 0, y: 0, h: 0, z: 0, flap: i / 12 * Math.PI * 2 }); g.restore(); lab(i < 6 ? 'down' : 'up', 50 + i * 118, 200); }
    lab('glide', 20, 260); g.save(); g.translate(90, 330); g.scale(3, 3); A.drawFlyingFox(g, { x: 0, y: 0, h: 0, z: 0, flap: 0, glideT: 1 }); g.restore();
    lab('game scale, one beat', 260, 260); for (let i = 0; i < 12; i++) { g.save(); g.translate(290 + i * 50, 330); A.drawFlyingFox(g, { x: 0, y: 0, h: 0, z: 0, flap: i / 12 * Math.PI * 2 }); g.restore(); } });
  await p.screenshot({ path: process.argv[2] }); await b.close(); })();

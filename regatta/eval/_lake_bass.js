// Probe: the painted lake bass through a leap (leaving in spray, at the top, falling back, the splash and rings), a
// over the whole life of its water (the splash out, the drips, the slap, the jet, the foam and the rings), beside a hull;
// 5x on the venue's water.
//   node regatta/eval/_lake_bass.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 560 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 560; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a5a7a'; g.fillRect(0, 0, 1500, 560); state.camera = { x: 0, y: 0, rotation: 0 };
    const L = (t, i) => ({ kind: 'bass', x: 0, y: 0, h: 0.4, t, dur: 0.7, size: 1, hop: 10, i });
    [[0.04, 0], [0.12, 0], [0.25, 0], [0.4, 0], [0.55, 0], [0.68, 0], [0.74, 0], [0.82, 0], [0.95, 0], [1.2, 0], [1.6, 0], [2.4, 0]].forEach(([t, i], k) => { const col = k % 6, row = Math.floor(k / 6), x = 125 + col * 235, yy = 140 + row * 270; g.save(); g.translate(x, yy); g.scale(5, 5); A.drawLeap(g, L(t, i)); g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('t ' + t, x - 30, yy + 120); });
    g.save(); g.translate(1460, 280); g.scale(2, 2); g.fillStyle = '#f2f2f2'; g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.restore(); g.fillStyle = '#fff'; g.fillText('hull', 1445, 420); });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();

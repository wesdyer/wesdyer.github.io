// Probe: the painted flying fish through a flight (the taxi, the glide, the fold and drop) and the mahi-mahi's swim
// (patrolling, chasing, leaping) — close up on the venue's water.
//   node regatta/eval/_ocean_fishstages.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 520 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1600; c.height = 520; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#1e5fa6'; g.fillRect(0, 0, 1600, 520);
    state.camera = { x: 0, y: 0, rotation: 0 }; A.setT(0.37);
    [0.05, 0.3, 0.6, 0.86, 0.94, 0.99].forEach((pp, i) => { const x = 110 + i * 175, y = 130; g.save(); g.translate(x, y); g.scale(4.5, 4.5);
      A.drawFlyfish(g, { x0: 0, y0: 0, h: 0, len: 0.0001, t: pp, dur: 1, z: 8, size: 1, i: 3 }); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(['taxi', 'glide', 'glide', 'folding', 'folding', 'dropping in'][i] + ' ' + pp, x - 40, 245); });
    [['patrol', { mode: 'patrol', t: 0.3 }], ['patrol', { mode: 'patrol', t: 0.6 }], ['chase', { mode: 'chase', t: 0.1 }], ['chase', { mode: 'chase', t: 0.2 }], ['chase', { mode: 'chase', t: 0.3 }], ['leaping', { mode: 'chase', t: 0.3, leap: 0.5 }]]
      .forEach(([lab, o], i) => { const x = 110 + i * 175, y = 380; g.save(); g.translate(x, y); g.scale(3.2, 3.2); A.drawMahi(g, Object.assign({ x: 0, y: 0, h: 0, size: 1, i: 0, leap: 0, trail: [] }, o)); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('mahi ' + lab, x - 40, 510); }); });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();

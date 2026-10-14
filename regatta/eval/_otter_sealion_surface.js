// Probe: a swimming sea lion BREAKING THE SURFACE to breathe, at five points of the roll (head out first, then
// the back, then under), beside one just under the surface, and the two splashes of a real leap (tearing out,
// slipping back in) — cow and bull, close up on the venue's water.
//   node regatta/eval/_otter_sealion_surface.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1680, height: 560 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1680; c.height = 560; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a'; g.fillRect(0, 0, 1680, 560);
    state.camera = { x: 0, y: 0, rotation: 0 }; A.setT(2);
    const cell = (i, r, draw, lab) => { const x = 105 + i * 210, y = 150 + r * 270; g.save(); g.translate(x, y); g.scale(3.6, 3.6); draw(); g.restore(); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(lab, x - 80, y + 115); };
    [false, true].forEach((bull, r) => {
      const q = (o) => Object.assign({ i: 0, j: 0, x: 0, y: 0, h: 0, bob: 0.4, bull, size: bull ? 1.25 : 1, mode: 'swim' }, o);
      cell(0, r, () => A.drawSeaLion(g, q({}), { swim: true, veil: 0.42, surf: 0 }), (bull ? 'bull' : 'cow') + ' — just under');
      [0.08, 0.25, 0.45, 0.65, 0.85].forEach((sv, i) => cell(i + 1, r, () => A.drawSeaLion(g, q({}), { swim: true, veil: 0.42, surf: sv }), 'breathing ' + sv));
      cell(6, r, () => A.drawSLSplash(g, 0, 0, 0.85, 'out', 3, bull ? 1.25 : 1), 'leap: tearing out');
      cell(7, r, () => A.drawSLSplash(g, 0, 0, 0.85, 'in', 5, bull ? 1.25 : 1), 'leap: slipping in');
    }); });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();

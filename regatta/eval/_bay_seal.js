// Probe: the painted harbour seal — gliding under the water through a scull, rising (the shape fading as the head comes
// up), bottling, sinking — and the Clubhouse Point gull rafts afloat (adults and juveniles); 4x on the venue's water.
//   node regatta/eval/_bay_seal.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 300 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })); resetGame(); });
  await p.waitForTimeout(1000);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 300; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2f7fb0'; g.fillRect(0, 0, 1500, 300); state.camera = { x: 0, y: 0, rotation: 0 }; A.setT(1);
    const se = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, bob: 0.3, spd: 20, mode: 'under', vis: 0, ring: 0, ring2: 0 }, o);
    const cells = [['gliding', se({ bob: 0 })], ['gliding', se({ bob: 0.4 })], ['rising', se({ mode: 'rise', vis: 0.4 })], ['bottling', se({ mode: 'up', vis: 1 })], ['bottling, turned', se({ mode: 'up', vis: 1, h: 0.8 })], ['sinking', se({ mode: 'sink', vis: 0.5 })]];
    cells.forEach(([lab, s2], i) => { const x = 80 + i * 150; g.save(); g.translate(x, 130); g.scale(4, 4); A.drawSeal(g, s2); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(lab, x - 35, 285); });
    [[false, 'gull afloat'], [true, 'juvenile afloat']].forEach(([juv, lab], i) => { const x = 1000 + i * 150; g.save(); g.translate(x, 130); g.scale(4, 4); A.drawGullFloat(g, { x: 0, y: 0, h: 0, bob: 0.2, j: i, juv, splash: 0 }); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(lab, x - 40, 285); });
    g.save(); g.translate(1400, 130); g.scale(2, 2); g.fillStyle = '#f2f2f2'; g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.restore(); g.fillStyle = '#fff'; g.fillText('hull (x2)', 1375, 285); });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();

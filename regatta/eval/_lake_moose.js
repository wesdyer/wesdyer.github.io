// Probe: the painted bull moose — wading, feeding (the head going under, the rack staying on the surface), coming up
// streaming, alert, and ashore walking — 3x on the lake's water beside a hull.
//   node regatta/eval/_lake_moose.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 380 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' })); resetGame(); });
  await p.waitForTimeout(1000);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 380; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a5a7a'; g.fillRect(0, 0, 1500, 380);
    g.fillStyle = '#5b6b3a'; g.fillRect(1180, 0, 320, 380); state.camera = { x: 0, y: 0, rotation: 0 }; A.setT(1);
    const mo = (o) => Object.assign({ x: 0, y: 0, h: 0, alpha: 1, bob: 0.3, sway: 0, dip: 0, drip: 0, mode: 'wade', ashore: false }, o);
    const cells = [['wading', mo({})], ['head going under', mo({ dip: 0.5 })], ['feeding (head under)', mo({ dip: 1 })], ['coming up, streaming', mo({ dip: 0.2, drip: 0.8 })], ['alert', mo({ mode: 'alert' })], ['ashore, walking', mo({ ashore: true, sway: 1.2 })]];
    cells.forEach(([lab, m], i) => { const x = 110 + i * 230 + (i === 5 ? 60 : 0); g.save(); g.translate(x, 200); g.scale(2.4, 2.4); A.drawMoose(g, m); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(lab, x - 50, 370); });
    g.save(); g.translate(1150, 200); g.scale(2.4, 2.4); g.fillStyle = '#f2f2f2'; g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.restore(); });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();

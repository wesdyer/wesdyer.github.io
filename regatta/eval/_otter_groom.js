// Probe: the painted sea otter's paws — resting, grooming through a rub cycle (paws up at the face, one up as
// the other comes down), and holding an urchin with a tap — and swimming on its belly through a tail scull;
// large, on venue water.
//   node regatta/eval/_otter_groom.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2430, height: 420 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 2430; c.height = 420; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a'; g.fillRect(0, 0, 2430, 420);
    state.camera = { x: 0, y: 0, rotation: 0 };
    const o = (x) => Object.assign({ i: 0, x: 0, y: 0, h: 0, size: 1, bob: 0, mode: 'float', head: 0.5, ph: 0 }, x);
    const shots = [['resting', o({})], ...[0, 0.4, 0.8, 1.2].map(ph => ['grooming ph ' + ph, o({ paws: 'groom', ph, _pawLift: 1 })]), ['lifting', o({ paws: 'groom', ph: 0.2, _pawLift: 0.3 })], ['eating', o({ mode: 'eat', food: 'urchin', _pawLift: 0 })], ['eating, tap', o({ mode: 'eat', food: 'urchin', tap: true, _pawLift: 0 })], ['mother + pup', o({ pup: true })], ['pup alone', o({ mode: 'under', pup: true, pupAlone: true, px: 0, py: 0 })], ...[0, 0.5, 1].map(b => ['swimming bob ' + b, o({ mode: 'swim', bob: b, trail: [] })])];
    shots.forEach(([lab, m], i) => { const x = 95 + i * 185; g.save(); g.translate(x, 200); g.scale(5, 5); A.drawSeaOtter(g, m); g.restore(); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(lab, x - 50, 400); }); });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();

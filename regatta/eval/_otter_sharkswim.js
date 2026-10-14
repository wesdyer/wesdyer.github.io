// Probe: the painted white shark SWIMMING — one tail-beat cycle in eight frames, then hard turns both
// ways, finning, and the strike's belly roll; large, on venue water. Checks the strip-bend and the cut tail.
//   node regatta/eval/_otter_sharkswim.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 760 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1600; c.height = 760; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a'; g.fillRect(0, 0, 1600, 760);
    const cam = state.camera; state.camera = null;
    const ws = (o) => Object.assign({ x: 0, y: 0, h: 0, depth: 0.3, mode: 'patrol', ph: 0, trail: [], trailT: 0, z: 0, roll: 0, jaw: 0, slick: 0, turn: 0 }, o);
    const cell = (i, row, W, label) => { const x = 100 + i * 200, y = 190 + row * 370; g.save(); g.translate(x, y); g.scale(3.2, 3.2); A.drawWhiteShark(g, W, 'water'); g.restore(); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(label, x - 40, y + 170); };
    for (let f = 0; f < 8; f++) cell(f, 0, ws({ ph: f / 8 * Math.PI * 2 }), 'beat ' + f + '/8');
    [['turn left', ws({ turn: -0.5, ph: 1 })], ['turn right', ws({ turn: 0.5, ph: 1 })], ['finning', ws({ depth: 0.02, ph: 2 })], ['strike roll', ws({ mode: 'strike', roll: 0.8, depth: 0, ph: 2 })], ['deep 0.8', ws({ depth: 0.8, ph: 3 })]]
      .forEach(([l, W], i) => cell(i, 1, W, l));
    state.camera = cam; });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();

// Probe: the water off raised flukes — a humpback and a blue whale on a fluking dive at four stages
// (rising 0.4, rising 0.9, falling 0.6, falling 0.2), close in on the tail, each in its own cell.
//   node regatta/eval/_fluke_water.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 840 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { const g = document.createElement('canvas').getContext('2d'); state.camera = { x: 0, y: 0, rotation: 0 };
    for (const calf of [false, true]) Wildlife.art.drawWhale(g, { j: 0, calf, len: 50, x: 0, y: 0, h: 0, mode: 'surface', depth: 0, ph: 0 });
    Wildlife.art.drawBlueWhale(g, { j: 0, len: 360, x: 0, y: 0, h: 0, mode: 'under', t: 10, depth: 0.5, ph: 0, fluke: 0, turn: 0, lunge: 0, sd: 1, mott: [] }); });
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1600; c.height = 840; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); state.camera = { x: 0, y: 0, rotation: 0 }; A.setT(3.3);
    const stages = [['rising', 0.4, 2.6, 5.2], ['rising', 0.9, 2.0, 4.0], ['falling', 0.6, 1.2, 1.8], ['falling', 0.2, 0.6, 0.9]];
    const cell = (i, row, col, s, draw, lab) => { const x0 = i * 400, y0 = row * 420; g.save(); g.beginPath(); g.rect(x0 + 2, y0 + 2, 396, 416); g.clip(); g.fillStyle = col; g.fillRect(x0, y0, 400, 420);
      g.translate(x0 + 200, y0 + 170); g.scale(s, s); draw(); g.restore(); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(lab, x0 + 12, y0 + 404); };
    stages.forEach(([lab, fl, tH, tB], i) => {
      // the tail stock at the cell's centre: the whale drawn ahead of it, up the frame
      cell(i, 0, '#1e6aa6', 3.6, () => A.drawWhale(g, { j: 0, calf: false, len: 132, x: 0, y: -132 * 0.32, h: 0, mode: 'dive', t: tH, depth: 0.35, fluke: fl, roll: 0, fin: 0, lift: 0, slick: 0, sd: 1, ev: null, ph: 0, turn: 0 }), `humpback — ${lab}, flukes ${fl}`);
      cell(i, 1, '#2a8f9a', 2.6, () => A.drawBlueWhale(g, { j: 0, len: 360, x: 0, y: -360 * 0.33, h: 0, mode: 'dive', t: tB, depth: 0.4, ph: 0, fluke: fl, turn: 0, lunge: 0, sd: 1, mott: [], rollT: 99 }), `blue whale — ${lab}, flukes ${fl}`);
    }); });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();

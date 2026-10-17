// Probe: the painted tern's wing pose through one stroke, mode by mode (hover, shift = cruising, climb), and the plunge,
// at 4x on the Sound's water. Writes a PNG.   node regatta/eval/_tern_strokes.js <out.png>
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2]; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); resetGame();
    const A = Wildlife.art, cam = state.camera; state.camera = null; const g0 = document.createElement('canvas').getContext('2d');
    for (const k of ['body', 'wing-l', 'wing-r']) A.arcticImg('tern-' + k); A.drawTern(g0, { x: 0, y: 0, h: 0, z: 30, mode: 'shift', flap: 0, splash: 0, a: 0 });
    await new Promise(r => setTimeout(r, 1000));
    const c = document.createElement('canvas'); c.width = 1280; c.height = 860; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1f4466'; g.fillRect(0, 0, 1280, 860); g.font = '12px sans-serif';
    ['hover', 'shift', 'climb'].forEach((mode, r) => { g.fillStyle = '#fff'; g.fillText(mode + ' (stroke phase 0 = top, π = bottom)', 10, 18 + r * 240);
      for (let k = 0; k < 8; k++) { const ph = k / 8 * Math.PI * 2; g.save(); g.translate(80 + k * 155, 125 + r * 240); g.scale(3.5, 3.5);
        A.drawTern(g, { x: 0, y: 0, h: 0, z: 0.01, mode, flap: ph, splash: 0, a: 0 }); g.restore(); g.fillStyle = '#cde'; g.fillText((k / 8 * 2).toFixed(2) + 'π', 60 + k * 155, 220 + r * 240); } });
    g.fillStyle = '#fff'; g.fillText('dive (folded)                     dip (wings part-folded)', 10, 740);
    g.save(); g.translate(80, 700); g.scale(3.5, 3.5); A.drawTern(g, { x: 0, y: 0, h: 0, z: 0.01, mode: 'dive', flap: 0, splash: 0, a: 0 }); g.restore();
    for (let k = 0; k < 3; k++) { g.save(); g.translate(260 + k * 155, 700); g.scale(3.5, 3.5); A.drawTern(g, { x: 0, y: 0, h: 0, z: 0.01, mode: 'dip', flap: k * 2, splash: 0, a: 0 }); g.restore(); }
    state.camera = cam; });
  await p.screenshot({ path: out }); await b.close(); })();

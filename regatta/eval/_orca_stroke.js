// Probe: an orca's tail stroke, 8 phases at 3x (under, at cruising depth), plus the same at game scale. Writes a PNG.
//   node regatta/eval/_orca_stroke.js <out.png> [kind]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2], kind = process.argv[3] || 'orca'; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 420 } });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async (kind) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); resetGame(); const A = Wildlife.art, cam = state.camera; state.camera = null;
    const o = (beat) => ({ kind, x: 0, y: 0, h: 0, z: 0.9, up: -1, beat, turn: 0, trail: [], j: 0, blow: 0 });
    A.drawOrca(document.createElement('canvas').getContext('2d'), o(0)); await new Promise(r => setTimeout(r, 1200));
    const c = document.createElement('canvas'); c.width = 1300; c.height = 420; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1f4466'; g.fillRect(0, 0, 1300, 420);
    for (let k = 0; k < 8; k++) { const bt = k / 8 * Math.PI * 2; g.save(); g.translate(80 + k * 160, 150); g.scale(2.2, 2.2); A.drawOrca(g, o(bt)); g.restore();
      g.save(); g.translate(80 + k * 160, 340); A.drawOrca(g, o(bt)); g.restore(); g.fillStyle = '#cde'; g.font = '12px sans-serif'; g.fillText((k / 4).toFixed(2) + 'π', 70 + k * 160, 410); }
    state.camera = cam; }, kind);
  await p.screenshot({ path: out }); await b.close(); })();

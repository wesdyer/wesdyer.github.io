// Probe: the painted leopard seal's poses at 6x — the parts as painted, hauled out (slumped, head turned), swimming
// through its wave. Writes a PNG.   node regatta/eval/_seal_poses.js <out.png>
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2]; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 520 } });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); resetGame();
    const A = Wildlife.art, cam = state.camera; state.camera = null; for (const k of ['seal-body', 'seal-fore-l', 'seal-fore-r', 'seal']) A.arcticImg(k);
    await new Promise(r => setTimeout(r, 1000));
    const c = document.createElement('canvas'); c.width = 1400; c.height = 520; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#eef4fa'; g.fillRect(0, 0, 700, 520); g.fillStyle = '#1f4466'; g.fillRect(700, 0, 700, 520);
    const put = (x, fn) => { g.save(); g.translate(x, 260); g.scale(6, 6); g.rotate(Math.PI / 2); fn(); g.restore(); };
    put(160, () => A.drawArcticSprite(g, 'seal', 0, 0, 0, 1));
    put(480, () => A.drawLeopardSeal(g, { mode: 'haul', x: 0, y: 0, h: 0, lh: 0, plop: 0, lx: 0, ly: 0, slump: 0.45, look: 0.4 }));
    for (let k = 0; k < 6; k++) { g.save(); g.translate(760 + (k % 3) * 210, 130 + Math.floor(k / 3) * 260); g.scale(3, 3); g.rotate(Math.PI / 2);
        A.drawLeopardSeal(g, { mode: 'swim', x: 0, y: 0, h: 0, sw: k / 6 * 2 * Math.PI / 2.5, up: 1, ring: 0, plop: 0 }); g.restore(); }
    state.camera = cam; });
  await p.screenshot({ path: out }); await b.close(); })();

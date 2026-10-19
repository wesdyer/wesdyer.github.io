// Bench: the painted sooty tern at x4 — through a wingbeat (8 phases), the glide, banked into a turn, the dip (wings up,
// tail open), alighting for a moment — and a booby beside it for size, at x4 and x1.   node regatta/eval/_volc_sooty_bench.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2]; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1700, height: 520 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); });
  await p.waitForTimeout(2500);   // (the painting loads; a screenshot — it taints a file:// canvas)
  await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1700; c.height = 520; const g = c.getContext('2d'); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 1700, 520);
    const oc = state.camera; state.camera = null; const A = Wildlife.art;
    const t = (o) => Object.assign({ sooty: true, x: 0, y: 0, h: 0, z: 30, flap: 0, mode: 'wheel', t: 1, splash: 0, a: 0 }, o);
    const lab = (s, x, y) => { g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(s, x, y); };
    for (let i = 0; i < 8; i++) { g.save(); g.translate(80 + i * 140, 90); g.scale(4, 4); A.drawTern(g, t({ flap: i / 8 * Math.PI * 2 })); g.restore(); lab('phase ' + i + '/8', 50 + i * 140, 200); }
    [['glide', t({ gliding: true, flap: Math.asin(0.95) })], ['banked right', t({ gliding: true, flap: Math.asin(0.95), turn: 0.5 })], ['the dip', t({ mode: 'dip', t: 0.9, z: 4, flap: 0 })], ['alighting', t({ mode: 'alight', z: 0 })]].forEach(([n, o], i) => {
      g.save(); g.translate(120 + i * 200, 320); g.scale(4, 4); A.drawTern(g, o); g.restore(); lab(n, 90 + i * 200, 440); });
    g.save(); g.translate(1050, 320); g.scale(4, 4); A.drawBooby(g, { j: 1, x: 0, y: 0, h: 0, z: 30, flap: 1.3, gliding: true, mode: 'fly', t: 0, dive: 0, splash: 0 }); g.restore(); lab('booby x4', 1020, 440);
    g.save(); g.translate(1350, 320); A.drawTern(g, t({ gliding: true, flap: Math.asin(0.95), h: 0.5 })); g.translate(60, 0); A.drawBooby(g, { j: 1, x: 0, y: 0, h: 0.5, z: 30, flap: 1.3, gliding: true, mode: 'fly', t: 0, dive: 0, splash: 0 }); g.restore(); lab('x1: tern, booby', 1330, 440);
    state.camera = oc; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1700, height: 520 } }); await b.close(); })();

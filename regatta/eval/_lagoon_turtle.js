// Probe: the painted green sea turtle through its stroke (the front flippers sweeping), deep / shallow / up for air,
// 4x on the lagoon's water beside a hull; then (frames to <dir>) a GIF of the LIVE turtles cruising the reef flats.
//   node regatta/eval/_lagoon_turtle.js <out.png> [gifdir]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2], dir = process.argv[3]; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1700, height: 300 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon' })); resetGame(); });
  await p.waitForTimeout(1000);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1700; c.height = 300; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#3bd5e4'; g.fillRect(0, 0, 1700, 300); state.camera = { x: 0, y: 0, rotation: 0 };
    const T = (o) => Object.assign({ kind: 'seaturtle', x: 0, y: 0, h: 0, depth: 0.3, ph: 0, size: 1, ring: 0, mode: 'cruise' }, o);
    const cells = [['stroke: power', T({ ph: 0.6 })], ['glide', T({ ph: 2.2 })], ['recovery', T({ ph: 4.4 })],
      ['mid, 9 m bed', T({ depth: 0.5, ph: 1, bedM: 9 })], ['mid, 3 m grass', T({ depth: 0.5, ph: 1, bedM: 2.8 })], ['low over reef', T({ depth: 0.6, ph: 1, bedM: 1 })],
      ['rising', T({ depth: 0.15, ph: 1, mode: 'rise', t: 0.2, bedM: 3 })], ['breath', T({ depth: 0, ph: 1, mode: 'breathe', t: 2, brT: 0.08, ring: 1, bedM: 3 })]];
    cells.forEach(([lab, f], i) => { const x = 95 + i * 185; g.save(); g.translate(x, 140); g.scale(4, 4); A.drawCruiser(g, f); g.restore(); g.fillStyle = '#123'; g.font = '12px sans-serif'; g.fillText(lab, x - 35, 285); });
    g.save(); g.translate(1630, 140); g.scale(2, 2); g.fillStyle = '#f2f2f2'; g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.restore(); });
  await p.screenshot({ path: out });
  if (dir) { fs.mkdirSync(dir, { recursive: true }); await p.setViewportSize({ width: 640, height: 480 });
    await p.evaluate(() => { const c = document.getElementById('gifc'); c.width = 640; c.height = 480; for (const b2 of state.boats) { b2.x = 1e6; b2.y = 1e6; } for (let i = 0; i < 60; i++) Wildlife.update(1 / 30);
      window.__G = Wildlife.debug().cruisers.find(G => G.cfg.kind === 'seaturtle'); const t0 = window.__G.fish[0]; t0.mode = 'cruise'; t0.t = 0.5; });   // show it coming up for air
    for (let f = 0; f < 150; f++) {
      await p.evaluate(() => { for (let k = 0; k < 2; k++) Wildlife.update(1 / 30); const t0 = window.__G.fish[0];
        window.__c = window.__c ? { x: window.__c.x + (t0.x - window.__c.x) * 0.2, y: window.__c.y + (t0.y - window.__c.y) * 0.2 } : { x: t0.x, y: t0.y }; const v = window.__c; state.camera = { x: v.x, y: v.y, rotation: 0 };
        const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#3bd5e4'; g.fillRect(0, 0, 640, 480);
        g.save(); g.translate(320, 240); g.scale(3, 3); g.translate(-v.x, -v.y); Wildlife.drawWater(g); g.restore(); g.fillStyle = '#123'; g.font = '12px sans-serif'; g.fillText('green sea turtles, x3', 10, 18); });
      await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 480 } }); } }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();

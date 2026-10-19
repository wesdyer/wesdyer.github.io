// Bench: the painted Sally Lightfoot crab (drawCrab) — its poses at x6 and x2.5 (rest, picking, running, clinging,
// leaping, juvenile, a face-off), a real bed at race scale (1.2 px/u) beside a hull, and at x2 and x3.
// (A screenshot: the painting taints a file:// canvas.)   node regatta/eval/_volc_crab_bench.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/crab_bench.png';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1800, height: 1000 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame();
});
  await p.waitForTimeout(2500);
  await p.evaluate(() => { for (let i = 0; i < 30 * 20; i++) Wildlife.update(1 / 30);
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1800; c.height = 1000; const ctx = c.getContext('2d');
    ctx.fillStyle = '#1f2023'; ctx.fillRect(0, 0, 1800, 500); ctx.fillStyle = '#34353a'; ctx.fillRect(0, 500, 1800, 500);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 160; i++) { ctx.beginPath(); ctx.arc((i * 137) % 1800, (i * 71) % 1000, 6 + (i % 5) * 6, 0, 7); ctx.fill(); }
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const cr = (o) => Object.assign({ x: 0, y: 0, h: 0, t: 1, ph: 1, leg: 0, burst: 0, pick: 1, size: 1 }, o);
    // poses x2.5 / x6: at rest, picking, running (two leg phases), clinging under a wave, mid-leap, a juvenile, a face-off
    const poses = [['rest', cr({})], ['picking', cr({ pick: 1.57 })], ['running', cr({ burst: 0.2, leg: 0 })], ['running', cr({ burst: 0.2, leg: Math.PI / 2 })], ['clinging', cr({ cling: 1 })], ['leap', cr({ leap: 0.15, leap0: 0.3, burst: 0.2, leg: 1 })], ['juvenile', cr({ juv: true, size: 0.65 })]];
    poses.forEach(([n, o], i) => { at(70 + i * 120, 110, 6, () => A.drawCrab(ctx, o)); at(70 + i * 120, 230, 2.5, () => A.drawCrab(ctx, o)); lab(n, 40 + i * 120, 290); });
    lab('x6', 900, 115); lab('x2.5', 900, 235);
    const sh = { t: 3, go: 0, dir: 1, step: 1 }; const d1 = cr({ x: -7, h: Math.PI / 2 }), d2 = cr({ x: 7, h: -Math.PI / 2 }); sh.lead = d1; d1.duel = { o: d2, sh }; d2.duel = { o: d1, sh };
    at(1000, 120, 6, () => { A.drawCrab(ctx, d1); A.drawCrab(ctx, d2); }); lab('face-off x6', 960, 230);
    // race scale: a real bed beside a hull, drawn by the game's own drawCrab
    const B = Wildlife.debug().crabBeds.filter(b => !b.cleaners)[0]; let cx = 0, cy = 0; for (const o of B.crabs) { cx += o.x; cy += o.y; } cx /= B.crabs.length; cy /= B.crabs.length;
    at(1450, 200, 1.2, () => { ctx.translate(-cx, -cy); for (const o of B.crabs) A.drawCrab(ctx, o); }); hull(1650, 200, 1.2); lab('a real bed x1.2 + hull', 1380, 470);
    at(500, 760, 3, () => { ctx.translate(-cx, -cy); for (const o of B.crabs) A.drawCrab(ctx, o); }); lab('the bed x3', 450, 980);
    at(1300, 760, 2, () => { ctx.translate(-cx, -cy); for (const o of B.crabs) A.drawCrab(ctx, o); }); lab('x2', 1300, 980);
    state.camera = oc; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1800, height: 1000 } }); console.log(out); await b.close(); })();

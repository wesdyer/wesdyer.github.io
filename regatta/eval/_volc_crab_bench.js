// Bench: Sally Lightfoot crabs — x10 poses (adult, juvenile, running, picking), x3 row with a hull, a real bed at x1 and x3 on basalt.
//   node regatta/eval/_volc_crab_bench.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/crab_bench.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1800; c.height = 1000; const ctx = c.getContext('2d');
    ctx.fillStyle = '#2d2f33'; ctx.fillRect(0, 0, 1800, 1000); ctx.fillStyle = '#26272b'; for (let i = 0; i < 160; i++) { ctx.beginPath(); ctx.arc((i * 137) % 1800, (i * 71) % 1000, 8 + (i % 5) * 5, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#1f3d52'; ctx.fillRect(0, 560, 300, 440);
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const cr = (o) => Object.assign({ i: 1, x: 0, y: 0, h: 0, ph: 1, burst: 0, leg: 0, pick: 1.2, size: 1 }, o);
    [['adult x16', cr({})], ['picking', cr({ pick: 4.6, i: 2 })], ['running', cr({ burst: 0.2, leg: 1.1, i: 3 })], ['juvenile', cr({ juv: true, size: 1, i: 4 })]]
      .forEach(([n, o], i) => { at(200 + i * 400, 230, 16, () => A.drawCrab(ctx, o)); lab(n, 160 + i * 400, 440); });
    hull(1300, 700, 3); lab('hull x3', 1270, 820);
    [cr({}), cr({ h: 1.2, burst: 0.2, leg: 2 }), cr({ juv: true, size: 0.62 }), cr({ h: -0.5 })].forEach((o, i) => at(1440 + i * 80, 700, 3, () => A.drawCrab(ctx, o)));
    const B = Wildlife.debug().crabBeds[3]; let cx = 0, cy = 0; for (const q of B.crabs) { cx += q.x; cy += q.y; } cx /= B.crabs.length; cy /= B.crabs.length;
    at(150, 780, 1, () => { ctx.translate(-cx, -cy); for (const q of B.crabs) A.drawCrab(ctx, q); }); hull(260, 780, 1); lab('bed x1 + hull', 110, 980);
    at(750, 780, 2.2, () => { ctx.translate(-cx, -cy); for (const q of B.crabs) A.drawCrab(ctx, q); }); lab('bed x2.2 (' + B.crabs.length + ')', 700, 980);
    state.camera = oc; return c.toDataURL('image/png'); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out); await b.close(); })();

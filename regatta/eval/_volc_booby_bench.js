// Bench: blue-footed booby poses at x5 (glide, downstroke, upstroke, tipping into the W, closing to the arrow,
// sitting), the plunge splash over time, and a row at x1.5 with a hull.   node regatta/eval/_volc_booby_bench.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/booby_bench.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1800; c.height = 1000; const ctx = c.getContext('2d');
    ctx.fillStyle = '#1d4a63'; ctx.fillRect(0, 0, 1800, 1000);
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const bo = (o) => Object.assign({ j: 1, x: 0, y: 0, h: 0, z: 0, flap: 0, mode: 'fly', t: 0, dive: 0, splash: 0, sit: 0 }, o);
    const poses = [['glide', bo({ gliding: true, flap: 1.3 })], ['downstroke', bo({ flap: 1.5 })], ['upstroke', bo({ flap: 4.7 })], ['tipping: the W', bo({ mode: 'fold', t: 0.2 })], ['plunge', bo({ mode: 'dive', dive: 0.3 })], ['arrow', bo({ mode: 'dive', dive: 0.8 })]];
    poses.forEach(([n, o], i) => { at(150 + (i % 3) * 300, 150 + Math.floor(i / 3) * 300, 5, () => A.drawBooby(ctx, o)); lab(n, 110 + (i % 3) * 300, 290 + Math.floor(i / 3) * 300); });
    at(1000, 170, 5, () => A.drawBooby(ctx, bo({ mode: 'sit', sit: 1 }))); lab('sitting', 970, 290);
    [1, 0.85, 0.7, 0.5, 0.25].forEach((s, i) => { at(1150 + i * 120, 480, 4, () => A.drawBooby(ctx, bo({ mode: 'gone', splash: s, sx: 0, sy: 0 }))); }); lab('splash over time', 1150, 560);
    hull(150, 800, 1.5); lab('hull x1.5', 120, 900);
    poses.concat([['sit', bo({ mode: 'sit', sit: 1 })]]).forEach(([n, o], i) => at(300 + i * 110, 800, 1.5, () => A.drawBooby(ctx, Object.assign(o, { h: 0.4 }))));
    state.camera = oc; return c.toDataURL('image/png'); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out); await b.close(); })();

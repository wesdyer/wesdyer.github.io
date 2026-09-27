// Bench: sooty terns at x6 (glide, downstroke, upstroke, the swoop), a booby beside for size, a row at x1.5 with a hull.
//   node regatta/eval/_volc_tern_bench.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/tern_bench.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1600; c.height = 700; const ctx = c.getContext('2d');
    ctx.fillStyle = '#1d4a63'; ctx.fillRect(0, 0, 1600, 700);
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const tn = (o) => Object.assign({ x: 0, y: 0, h: 0, z: 0, flap: 0, mode: 'wheel', t: 1, sooty: true, splash: 0, a: 0 }, o);
    const poses = [['glide', tn({ gliding: true, flap: 1.4 })], ['downstroke', tn({ flap: 1.2 })], ['upstroke', tn({ flap: 4.6 })], ['swoop', tn({ mode: 'dip', flap: 2 })]];
    poses.forEach(([n, o], i) => { at(130 + i * 230, 170, 6, () => A.drawTern(ctx, o)); lab(n, 100 + i * 230, 320); });
    at(1200, 170, 3, () => A.drawBooby(ctx, { j: 1, x: 0, y: 0, h: 0, z: 0, flap: 1.3, gliding: true, mode: 'fly', t: 0, dive: 0, splash: 0 })); lab('booby x3', 1170, 320);
    at(1440, 170, 3, () => A.drawTern(ctx, tn({ gliding: true, flap: 1.4 }))); lab('sooty x3', 1410, 320);
    hull(120, 540, 1.5); lab('hull x1.5', 90, 640);
    poses.forEach(([n, o], i) => at(260 + i * 90, 540, 1.5, () => A.drawTern(ctx, Object.assign(o, { h: 0.5 }))));
    state.camera = oc; return c.toDataURL('image/png'); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out); await b.close(); })();

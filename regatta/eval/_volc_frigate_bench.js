// Bench: great frigatebirds at x4 (soar, tail snapped open, the chase, the catch swoop, a wingbeat; male, female,
// juvenile), a booby at the same scale, a falling fish, and a row at x1 with a hull.   node regatta/eval/_volc_frigate_bench.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/frigate_bench.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1800; c.height = 900; const ctx = c.getContext('2d');
    ctx.fillStyle = '#1d4a63'; ctx.fillRect(0, 0, 1800, 900);
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const fr = (o) => Object.assign({ j: 0, x: 0, y: 0, h: 0, z: 0, flap: 0, beats: 0, male: true, juv: false, mode: 'soar', fork: 0 }, o);
    const poses = [['soar (male)', fr({})], ['turning: tail open', fr({ fork: 1, male: false })], ['the chase', fr({ mode: 'swoop', fork: 0.4 })], ['the catch', fr({ mode: 'catch', juv: true, male: false })], ['a wingbeat', fr({ beats: 2, flap: 4.6 })], ['juvenile', fr({ juv: true, male: false })]];
    poses.forEach(([n, o], i) => { at(160 + (i % 3) * 330, 140 + Math.floor(i / 3) * 290, 4, () => A.drawFrigate(ctx, o)); lab(n, 110 + (i % 3) * 330, 250 + Math.floor(i / 3) * 290); });
    at(1150, 140, 4, () => A.drawBooby(ctx, { j: 1, x: 0, y: 0, h: 0, z: 0, flap: 1.3, gliding: true, mode: 'fly', t: 0, dive: 0, splash: 0 })); lab('booby x4', 1110, 250);
    at(1450, 140, 5, () => A.drawFrigFish(ctx, { x: 0, y: 0, z: 30, vz: 0, spin: 0.7, h: 0.3 })); lab('dropped fish x5', 1400, 250);
    hull(150, 720, 1); lab('hull x1', 120, 800);
    poses.forEach(([n, o], i) => at(300 + i * 110, 720, 1, () => A.drawFrigate(ctx, Object.assign(o, { h: 0.5 }))));
    state.camera = oc; return c.toDataURL('image/png'); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out); await b.close(); })();

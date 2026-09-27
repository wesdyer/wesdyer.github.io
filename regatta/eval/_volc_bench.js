// Bench: Emberfall's animals in their poses at game scale x3, on black rock (left) and the venue's water
// (right), beside a hull for size.
//   node regatta/eval/_volc_bench.js out.png     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/volc_bench.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1600; c.height = 900; const ctx = c.getContext('2d');
    const doc = state.course.doc; ctx.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#1e3a5a'; ctx.fillRect(0, 0, 1600, 900);
    ctx.fillStyle = '#34363a'; ctx.fillRect(0, 0, 1600, 300); ctx.fillStyle = '#2a2b2f'; for (let i = 0; i < 60; i++) { ctx.beginPath(); ctx.arc((i * 137) % 1600, (i * 71) % 300, 8 + (i % 5) * 4, 0, 7); ctx.fill(); }
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const ig = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, mode: 'bask', t: 5, ph: 1, size: 1, red: false, trail: [], trailT: 0, dive: 0, ring: 0 }, o);
    hull(40, 150, 3);
    [['basking', ig({})], ['basking red', ig({ red: true, h: 0.5 })], ['walking', ig({ mode: 'walk', ph: 0.4 })], ['swimming', ig({ mode: 'swim', ph: 0.7, trail: [{ x: 0, y: 12 }, { x: 0, y: 24 }, { x: 0, y: 36 }] })]]
      .forEach(([n, o], i) => { at(170 + i * 150, 150, 3, () => A.drawIguana(ctx, o, i < 3)); lab(n, 130 + i * 150, 285); });
    for (let i = 0; i < 6; i++) at(800 + i * 60, 150, 3, () => A.drawCrab(ctx, { x: 0, y: 0, h: i * 1.1, ph: i, burst: i % 2 ? 0.3 : 0, leg: i * 2, pick: i * 1.3, size: 1 })); lab('crabs x3', 900, 285);
    const bo = (o) => Object.assign({ j: 0, x: 0, y: 0, h: 0, z: 50, flap: 0, mode: 'fly', t: 0, dive: 0, splash: 0, sit: 0 }, o);
    [['fly up', bo({ flap: 0 })], ['fly mid', bo({ flap: 1.6 })], ['fold', bo({ mode: 'fold', t: 1 })], ['dive', bo({ mode: 'dive', dive: 0.5, z: 40 })], ['sit', bo({ mode: 'sit', sit: 2 })]]
      .forEach(([n, o], i) => { at(120 + i * 160, 450, 3, () => A.drawBooby(ctx, o)); lab('booby ' + n, 80 + i * 160, 560); });
    hull(1000, 450, 1.5); lab('hull x1.5', 970, 560);
    const fr = (o) => Object.assign({ j: 0, x: 0, y: 0, h: 0, z: 0, flap: 0, beats: 0, male: true, mode: 'soar', fork: 0 }, o);
    [['frigate soar', fr({})], ['frigate swoop', fr({ mode: 'swoop', fork: 1 })]].forEach(([n, o], i) => { at(1150 + i * 220, 450, 2, () => A.drawFrigate(ctx, o)); lab(n, 1110 + i * 220, 560); });
    const hm = (o) => Object.assign({ x: 0, y: 0, h: 0, ph: 1, size: 1 }, o);
    [0.2, 0.6, 0.9].forEach((d, i) => { at(160 + i * 200, 750, 2, () => A.drawHammer(ctx, hm({}), d)); lab('hammerhead depth ' + d, 100 + i * 200, 880); });
    hull(760, 750, 2);
    state.camera = oc; return c.toDataURL(); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); await b.close(); })();

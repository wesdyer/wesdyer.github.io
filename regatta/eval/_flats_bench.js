// Bench: Spoonbill Flats' animals — grey seals (hauled: bull, cows; lifting; humping; wet; swimming),
// roseate spoonbills and pied avocets (wading, sweeping; flying, two strokes), shore crabs (on the mud,
// just covered, deeper, buried) at x4, and a row at x1 with a hull.   node regatta/eval/_flats_bench.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/flats_bench.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('flats'); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1800; c.height = 1100; const ctx = c.getContext('2d');
    ctx.fillStyle = '#cdb68a'; ctx.fillRect(0, 0, 1800, 330); ctx.fillStyle = '#6f8f8c'; ctx.fillRect(0, 330, 1800, 440); ctx.fillStyle = '#a58a5c'; ctx.fillRect(0, 770, 1800, 330);
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const sp = () => Array.from({ length: 34 }, (_, i) => [Math.sin(i * 2.3) * 2.4, 0.15 + ((i * 0.37) % 0.68), i < 5 ? 0.6 : 0.15 + (i % 3) * 0.08, i]);
    const seal = (o) => Object.assign({ i: 1, x: 0, y: 0, h: 0, mode: 'haul', bob: 1, size: 1, pal: 2, wet: 0, ring: 0, lift: 0, spots: sp(), vis: 1 }, o);
    [['bull, belly-down', seal({ pal: 0, size: 1.15, side: 0, curl: 0.1 })], ['silver cow, banana', seal({ pal: 2, side: 1, curl: 0.9 })], ['sandy cow, head up', seal({ pal: 4, side: -1, curl: -0.7, lift: 1, bob: 2 })], ['cream cow, flipper', seal({ pal: 3, side: 1, curl: 0.6, flip: 1, bob: 0.3 })], ['white pup', seal({ pal: 5, pup: true, size: 0.5, side: 0, curl: 0.15 })], ['humping, wet', seal({ pal: 1, mode: 'slide', wet: 1, bob: 0.3, side: 0, curl: 0 })]].forEach(([n, o], i) => { at(90 + i * 150, 170, 3, () => A.drawGreySeal(ctx, o)); lab(n, 40 + i * 150, 320); });
    at(800, 500, 3, () => A.drawGreySealSwim(ctx, seal({ mode: 'swim', pal: 2 }))); lab('seal swimming x3', 750, 640);
    hull(1000, 170, 3); lab('hull x3', 980, 320);
    const bird = (o) => Object.assign({ j: 1, x: 0, y: 0, h: 0, sw: 0.8, step: 1, z: 0, flap: 1.2, mode: 'wade', ring: 0 }, o);
    [['spoonbill wading', bird({ sw: 0.2 }), 'S'], ['roosting', bird({ roost: true }), 'S'], ['flying', bird({ mode: 'fly', z: 30, flap: 1.4 }), 'S'], ['upstroke', bird({ mode: 'fly', z: 30, flap: 4.6 }), 'S'],
     ['avocet wading', bird({ sw: 0.3 }), 'A'], ['scything', bird({ sw: 1.6 }), 'A'], ['flying', bird({ mode: 'fly', z: 30, flap: 1.3 }), 'A'], ['upstroke', bird({ mode: 'fly', z: 30, flap: 4.6 }), 'A']]
      .forEach(([n, o, k], i) => { const x = 100 + (i % 4) * 150, y = 420 + Math.floor(i / 4) * 170; at(x, y, 4, () => k === 'S' ? A.drawSpoonbill(ctx, o) : A.drawAvocet(ctx, o)); lab(n, x - 50, y + 80); });
    const cr = (o) => Object.assign({ i: 1, x: 0, y: 0, h: 0.3, burst: 0, leg: 0, pick: 1, ph: 1, size: 1, buried: false }, o);
    [['green phase', cr({ dOv: -0.02, phase: 0 })], ['khaki, barnacles', cr({ dOv: -0.02, phase: 1, crust: true, h: 1.2 })], ['red phase', cr({ dOv: -0.02, phase: 2 })], ['rearing!', cr({ dOv: -0.02, phase: 1, rear: 1 })], ['just covered', cr({ dOv: 0.2 })], ['buried', cr({ dOv: -0.4, buried: true })], ['running', cr({ dOv: 0, burst: 0.2, leg: 1.1, phase: 2 })]]
      .forEach(([n, o], i) => { at(90 + i * 150, 890, 7, () => A.drawShoreCrab(ctx, o)); lab(n, 50 + i * 150, 990); });
    // x1 row with a hull
    hull(1350, 900, 1); lab('x1: hull, seals, spoonbill, avocet, crab', 1300, 1060);
    [seal({ pal: 0, size: 1.15, side: 0, curl: 0 }), seal({ pal: 4, h: 0.6, side: 1, curl: 0.8 })].forEach((o, i) => at(1420 + i * 50, 900, 1, () => A.drawGreySeal(ctx, o)));
    at(1540, 900, 1, () => A.drawSpoonbill(ctx, bird({}))); at(1580, 900, 1, () => A.drawAvocet(ctx, bird({}))); at(1610, 900, 1, () => A.drawShoreCrab(ctx, cr({ dOv: 0 })));
    state.camera = oc; return c.toDataURL('image/png'); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out); await b.close(); })();

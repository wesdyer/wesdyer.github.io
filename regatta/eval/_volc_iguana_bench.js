// Bench: the marine iguana — x8 poses, x3 poses, a heap at x1 and x3 — on black lava, pale sand and water.
//   node regatta/eval/_volc_iguana_bench.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/ig_bench.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1800; c.height = 1000; const ctx = c.getContext('2d');
    ctx.fillStyle = '#2d2f33'; ctx.fillRect(0, 0, 1800, 520); ctx.fillStyle = '#26272b'; for (let i = 0; i < 90; i++) { ctx.beginPath(); ctx.arc((i * 137) % 1800, (i * 71) % 520, 8 + (i % 5) * 5, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#cdbf9f'; ctx.fillRect(0, 520, 1200, 480); ctx.fillStyle = '#2b5a66'; ctx.fillRect(1200, 520, 600, 480);
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const ig = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, mode: 'bask', t: 5, ph: 1, size: 1, red: false, trail: [], trailT: 0, dive: 0, ring: 0 }, o);
    // x8 bask (grey), x8 bask red, x8 walk
    [['bask x8', ig({})], ['red x8', ig({ red: true, i: 3 })], ['walk x8', ig({ mode: 'walk', ph: 0.4, i: 1 })]].forEach(([n, o], i) => { at(200 + i * 330, 240, 8, () => A.drawIguana(ctx, o, true)); lab(n, 150 + i * 330, 500); });
    // x3 row + hull
    hull(1120, 150, 3); lab('hull x3', 1090, 260);
    [ig({}), ig({ red: true, h: 0.5 }), ig({ mode: 'walk', ph: 0.4 })].forEach((o, i) => at(1260 + i * 120, 150, 3, () => A.drawIguana(ctx, o, true)));
    // swim x8 on water
    at(1500, 760, 6, () => A.drawIguana(ctx, ig({ mode: 'swim', ph: 0.7, trail: [{ x: 0, y: 12 }, { x: 0, y: 24 }, { x: 0, y: 36 }, { x: 0, y: 48 }] }), false)); lab('swim x6', 1460, 980);
    // a real heap from the venue, at x1 and x3 on sand
    const H = Wildlife.debug().igHeaps; const G = H.slice().sort((a, b) => b.members.length - a.members.length)[0];
    let cx = 0, cy = 0; for (const m of G.members) { cx += m.x; cy += m.y; } cx /= G.members.length; cy /= G.members.length;
    at(150, 760, 1, () => { ctx.translate(-cx, -cy); for (const m of G.members) A.drawIguana(ctx, m, true); }); hull(260, 760, 1); lab('heap x1 + hull', 110, 980);
    at(700, 760, 3, () => { ctx.translate(-cx, -cy); for (const m of G.members) A.drawIguana(ctx, m, true); }); lab('heap x3 (' + G.members.length + ')', 640, 980);
    state.camera = oc; return c.toDataURL('image/png'); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out); await b.close(); })();

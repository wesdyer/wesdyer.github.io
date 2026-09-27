// Bench: scalloped hammerheads at x5 (shallow over pale sand, swimming, turning) and at depths over the blue,
// a real school at x1 with a hull.   node regatta/eval/_volc_hammer_bench.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/hammer_bench.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
    for (let i = 0; i < 30 * 120; i++) Wildlife.update(1 / 30);
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1800; c.height = 1100; const ctx = c.getContext('2d');
    ctx.fillStyle = '#9cc7c9'; ctx.fillRect(0, 0, 900, 460); ctx.fillStyle = '#1d4a63'; ctx.fillRect(900, 0, 900, 460); ctx.fillStyle = '#17405a'; ctx.fillRect(0, 460, 1800, 640);
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const hm = (o) => Object.assign({ x: 0, y: 0, h: 0, ph: 1, size: 1, turn: 0 }, o);
    [['swimming', hm({ ph: 1 })], ['tail across', hm({ ph: 2.6 })], ['turning', hm({ ph: 1.8, turn: 0.2 })]].forEach(([n, o], i) => { at(150 + i * 270, 220, 5, () => A.drawHammer(ctx, o, 0.1)); lab(n + ' x5 (shallow)', 90 + i * 270, 440); });
    [0.2, 0.5, 0.85].forEach((d, i) => { at(1060 + i * 260, 220, 4, () => A.drawHammer(ctx, hm({ ph: 1 + i }), d)); lab('depth ' + d + ' x4', 1020 + i * 260, 440); });
    const S = Wildlife.debug().hammerSchools[0];
    at(900, 780, 1, () => { ctx.translate(-S.cx, -S.cy); for (const f of S.fish) A.drawHammer(ctx, f, f.depth); }); hull(1300, 780, 1); lab('a school at x1 (' + S.fish.length + ') + hull', 800, 1080);
    state.camera = oc; return c.toDataURL('image/png'); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out); await b.close(); })();

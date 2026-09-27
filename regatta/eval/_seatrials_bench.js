// Bench: Clubhouse Point's animals — cormorants (perched drying, folded, flying), a by-the-wind sailor fleet, a
// mackerel boil, a can with its cormorant at x1 beside a hull.   node regatta/eval/_seatrials_bench.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/club_bench.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('seatrials'); resetGame();
    for (let i = 0; i < 30 * 30; i++) Wildlife.update(1 / 30);
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1600; c.height = 900; const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a5d86'; ctx.fillRect(0, 0, 1600, 900);
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const m = { x: 0, y: 0 };
    const co = (o) => Object.assign({ m, j: 0, x: 0, y: 0, h: 0, z: 0, mode: 'perch', sp: 1, flap: 1.4, ring: 0 }, o);
    [['swimming', co({ mode: 'swim', vis: 1, t: 3, trail: [] })], ['diving', co({ mode: 'under', vis: 0.3, t: 3, trail: [] })], ['flying', co({ mode: 'fly', z: 14, flap: 1.3 })], ['upstroke', co({ mode: 'fly', z: 14, flap: 4.6 })]].forEach(([n, o], i) => { at(130 + i * 230, 170, 4, () => A.drawCormorant(ctx, o)); lab('cormorant ' + n + ' x4', 60 + i * 230, 330); });
    const F = { cx: 0, cy: 0, L: 300, ang: 0.1, items: Array.from({ length: 40 }, (_, i) => ({ u: (i / 40) - 0.5, sp: Math.sin(i * 2.1) * 14, s: 1, h: (i % 2 ? 0.9 : -0.9), bob: i })), sparse: false };
    at(1180, 170, 2, () => A.drawVelellaFleet(ctx, F)); lab('by-the-wind sailors x2', 1100, 330);
    const B = Wildlife.debug().mackBoils.find(q => q.mode === 'boil') || Wildlife.debug().mackBoils[0]; B.k = 1;
    at(350, 620, 3, () => { ctx.translate(-B.x, -B.y); A.drawMackBoil(ctx, B); }); lab('mackerel boil x3', 300, 860);
    // a can at x1.5 with its bird on it, a hull
    const can = new Image(); can.src = 'assets/images/props/mark-can-yellow.png';
    at(900, 620, 1.5, () => { A.drawCormorant(ctx, co({ h: 0.4, mode: 'swim', vis: 1, t: 1, trail: [] })); ctx.translate(60, 0); A.drawCormorant(ctx, co({ mode: 'fly', z: 10, flap: 1.3 })); }); hull(1080, 620, 1.5); lab('swimming, flying + hull x1.5', 860, 860);
    const gl = (o) => Object.assign({ j: 1, x: 0, y: 0, h: 0, bob: 1, preen: 0, splash: 0, juv: false }, o);
    [['gull afloat', gl({})], ['juvenile afloat', gl({ juv: true, j: 2 })], ['preening', gl({ preen: 1, bob: 0.6 })]].forEach(([n, o], i) => { at(1200 + i * 120, 470, 4, () => A.drawGullFloat(ctx, o)); lab(n, 1160 + i * 120, 560); });
    at(1260, 720, 3, () => A.drawGullFlying(ctx, 0, 0, 0, 20, 1.3, true, false)); at(1470, 720, 3, () => A.drawGullFlying(ctx, 0, 0, 0, 20, 4.6, false, true)); lab('gull flying, juvenile flying x3', 1240, 860);
    at(1100, 620, 1, () => { A.drawGullFloat(ctx, gl({})); ctx.translate(25, 8); A.drawGullFloat(ctx, gl({ juv: true, h: 0.5 })); });
    state.camera = oc; return c.toDataURL('image/png'); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out); await b.close(); })();

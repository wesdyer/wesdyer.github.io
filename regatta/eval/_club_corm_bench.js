// Bench: Clubhouse Point's painted great cormorants at x5 — a wingbeat in 8 phases, banked both ways, the labouring
// takeoff through its stroke (the raised-wing painting at the top), swimming with the feet through a kick, diving
// under — and a row at x1 beside a hull.   node regatta/eval/_club_corm_bench.js out.png     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/corm_bench.png';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1800, height: 1000 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' })); selectVenue('seatrials'); resetGame(); });
  await p.waitForTimeout(2500);   // (the paintings load; a screenshot, not toDataURL — they taint a file:// canvas)
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('seatrials'); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1800; c.height = 1000; const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a5f86'; ctx.fillRect(0, 0, 1800, 1000);
    const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const co = (o) => Object.assign({ j: 0, x: 0, y: 0, h: 0, z: 14, mode: 'fly', flap: 0, turn: 0, ring: 0, vis: 1, t: 3, trail: [] }, o);
    const S = 5;
    for (let i = 0; i < 8; i++) { at(110 + i * 165, 110, S, () => A.drawCormorant(ctx, co({ flap: i / 8 * Math.PI * 2 }))); lab('beat ' + i + '/8', 80 + i * 165, 200); }
    at(1460, 110, S, () => A.drawCormorant(ctx, co({ turn: 0.8 }))); lab('banked right', 1420, 200);
    at(1640, 110, S, () => A.drawCormorant(ctx, co({ turn: -0.8 }))); lab('banked left', 1600, 200);
    for (let i = 0; i < 8; i++) { at(110 + i * 165, 330, S, () => A.drawCormorant(ctx, co({ mode: 'takeoff', z: 4, flap: i / 8 * Math.PI * 2 }))); lab('takeoff ' + i + '/8', 75 + i * 165, 420); }
    for (let i = 0; i < 6; i++) { A.setT(10 + i * 0.33); at(110 + i * 165, 560, S, () => A.drawCormorant(ctx, co({ mode: 'swim', z: 0, j: 0 }))); lab('swim t+' + (i * 0.33).toFixed(2), 75 + i * 165, 660); }
    A.setT(10);
    at(1110, 560, S, () => A.drawCormorant(ctx, co({ mode: 'under', z: 0, vis: 0.5 }))); lab('going under', 1075, 660);
    at(1275, 560, S, () => A.drawCormorant(ctx, co({ mode: 'under', z: 0, vis: 0 }))); lab('under', 1255, 660);
    at(1460, 560, S, () => A.drawCormorant(ctx, co({ mode: 'swim', z: 0, ring: 0.5 }))); lab('surfacing', 1430, 660);
    hull(100, 850, 1); lab('hull x1', 75, 935);
    const row = [co({}), co({ flap: Math.PI }), co({ mode: 'takeoff', z: 3 }), co({ mode: 'swim', z: 0 }), co({ mode: 'swim', z: 0, h: 1.2 }), co({ mode: 'under', z: 0, vis: 0 })];
    row.forEach((o, i) => at(200 + i * 70, 850, 1, () => A.drawCormorant(ctx, o)));
    lab('x1: fly, fly, takeoff, swim, swim, under', 180, 935);
    hull(800, 850, 3); lab('hull x3', 780, 960);
    row.forEach((o, i) => at(920 + i * 130, 850, 3, () => A.drawCormorant(ctx, o)));
    state.camera = oc; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1800, height: 1000 } }); console.log(out); await b.close(); })();

// Probe: do Redrock's bighorn keep their room? Over N minutes — a ram clash staged in each band every minute, then a
// boat flush of each band — the frames where two band-mates' shapes overlap by more than 1 u (wildlife.js's own shapes:
// the body capsule, and a ram's horn disc; the 1.5 u margin taken off), by what they were doing, how deep; and each
// clash's head gap at impact and after the recoil (lowered-muzzle tips; < 0 = horns pressed together).
//   node regatta/eval/_redrock_bighorn_room.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
const MINUTES = +(process.argv[2] || 10);
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  console.log(await p.evaluate((MIN) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' })); resetGame();
    for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const d = Wildlife.debug(), W = Wildlife.art, bad = {}, pens = [], when = [], clashes = []; let frames = 0;
    const check = () => { frames++;
      for (const G of d.bands) { const M = G.members;
        for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) { const A = M[i], B = M[j];
          if (A.clash && A.clash.other === B && A.clash.ph !== 'walk' && A.clash.ph !== 'face') continue;
          const pen = W.bhPen(A, A.x, A.y, A.h, B, B.x, B.y, B.h).pen - 1.5;
          if (pen > 1) { const k = [A.mode, B.mode].sort().join('+'); bad[k] = (bad[k] || 0) + 1; pens.push(pen); if (when.length < 40) when.push(frames + ':' + A.mode + '/' + B.mode); } }
        const rams = M.filter(m => m.ram);
        const R0 = rams[0] && rams[0].clash;
        if (rams.length > 1 && R0 && ((R0.ph === 'impact' && R0.t < 0.04) || (R0.ph === 'present' && R0.t < 0.04))) { const [A, B] = rams, rA = W.bhReach(A), rB = W.bhReach(B);
          const gap = Math.hypot(A.x + Math.sin(A.h) * rA - B.x - Math.sin(B.h) * rB, A.y - Math.cos(A.h) * rA - B.y + Math.cos(B.h) * rB) * (Math.hypot(A.x - B.x, A.y - B.y) < rA + rB ? -1 : 1);
          clashes.push((R0.ph === 'impact' ? 'hit ' : 'after recoil ') + gap.toFixed(1)); } } };
    for (let i = 0; i < 30 * 60 * MIN; i++) { if (i % 1800 === 900) for (const G of d.bands) if (G.clashT > 5) G.clashT = 1; Wildlife.update(1 / 30); check(); }
    const me = state.boats[0];
    for (const G of d.bands) { const s = G.members[0]; me.x = s.x + 70; me.y = s.y; for (let i = 0; i < 30 * 6; i++) { Wildlife.update(1 / 30); check(); } me.x = 1e6; me.y = 1e6; for (let i = 0; i < 30 * 10; i++) { Wildlife.update(1 / 30); check(); } }
    pens.sort((a, c) => a - c); const tot = pens.length;
    return `overlap-frames (pairs > 1 u) ${tot} of ${frames} frames: ${JSON.stringify(bad)}\n` +
      (tot ? `depth median ${pens[tot >> 1].toFixed(1)} max ${pens[tot - 1].toFixed(1)}; first: ${when.join(' ')}\n` : '') +
      `clash head gaps at impact: ${clashes.join(', ') || 'none'}`; }, MINUTES));
  await b.close(); })();

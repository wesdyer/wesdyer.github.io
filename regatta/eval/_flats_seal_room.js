// Probe: do the Flats grey seals keep their room? Over N minutes of tide (boats parked away, then each colony flushed by
// a boat once a minute): the frames where two seals' bodies on the sand overlap by more than 1 u (each body a capsule —
// wildlife.js's gsealSeg), by what they were doing, and how deep; and how long movers waited.
//   node regatta/eval/_flats_seal_room.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const MIN = +(process.argv[2] || 10);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); resetGame(); });
  console.log(await p.evaluate((MIN) => { const park = () => { for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; } };
    const D = Wildlife.debug(), bad = {}, pens = []; let frames = 0, moving = 0, waitMax = 0;
    const L = 46, seg = (q) => { const a = L * q.size * 0.36, dx = Math.sin(q.h) * a, dy = -Math.cos(q.h) * a; return [q.x + dx, q.y + dy, q.x - dx, q.y - dy, L * q.size * 0.125]; };
    const d = (px, py, x0, y0, x1, y1) => { const vx = x1 - x0, vy = y1 - y0, t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy || 1))); return Math.hypot(px - x0 - vx * t, py - y0 - vy * t); };
    const sd = (A, B) => Math.min(d(A[0], A[1], B[0], B[1], B[2], B[3]), d(A[2], A[3], B[0], B[1], B[2], B[3]), d(B[0], B[1], A[0], A[1], A[2], A[3]), d(B[2], B[3], A[0], A[1], A[2], A[3]));
    for (let i = 0; i < 30 * 60 * MIN; i++) { park();
      if (i % 1800 > 1650) { const C = D.gsealCols[(i / 1800 | 0) % D.gsealCols.length], me = state.boats[0]; me.x = C.cx + 60; me.y = C.cy; }
      update(1 / 30); frames++;
      for (const C of D.gsealCols) { const S = C.seals.filter(s => s.mode !== 'swim');
        for (const s of S) { if (s.mode === 'slide' || s.mode === 'climb') moving++; waitMax = Math.max(waitMax, s.wait || 0); }
        for (let a = 0; a < S.length; a++) for (let c = a + 1; c < S.length; c++) { const A = seg(S[a]), B = seg(S[c]), pen = A[4] + B[4] - sd(A, B);
          if (pen > 1) { const k = [S[a].mode, S[c].mode].sort().join('+'); bad[k] = (bad[k] || 0) + 1; pens.push(pen); } } } }
    pens.sort((a, c) => a - c);
    return `${MIN} min, ${frames} frames, ${moving} seal-frames on the move; overlapping pair-frames ${pens.length}: ${JSON.stringify(bad)}` + (pens.length ? `; depth median ${pens[pens.length >> 1].toFixed(1)} max ${pens[pens.length - 1].toFixed(1)}` : '') + `; longest wait ${waitMax.toFixed(1)} s`; }, MIN));
  await b.close(); })();

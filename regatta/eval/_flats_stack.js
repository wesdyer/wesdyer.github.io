// Probe: do the Flats waders stack on each other? Over N minutes (a boat through each flock once a minute), the pair-frames
// where two birds of a flock are on top of each other — on the ground their bodies (a capsule along the heading, bill and all) overlapping, in the air closer than half a wingspan — by what they were
// doing (wade / up / fly, landing = a bird within 3 s of touching down), and per bird-frame.
//   node regatta/eval/_flats_stack.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const MIN = +(process.argv[2] || 10);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); resetGame(); });
  console.log(await p.evaluate((MIN) => { const D = Wildlife.debug(), out = [];
    const dd = (px, py, x0, y0, x1, y1) => { const vx = x1 - x0, vy = y1 - y0, t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy || 1))); return Math.hypot(px - x0 - vx * t, py - y0 - vy * t); };
    const sd = (a, b) => Math.min(dd(a[0], a[1], b[0], b[1], b[2], b[3]), dd(a[2], a[3], b[0], b[1], b[2], b[3]), dd(b[0], b[1], a[0], a[1], a[2], a[3]), dd(b[2], b[3], a[0], a[1], a[2], a[3]));
    for (const [k, list, R0] of [['spoonbill', D.spoonFlocks, 13], ['avocet', D.avoFlocks, 10]]) {
      const by = {}; let birdFrames = 0;
      for (let i = 0; i < 30 * 60 * MIN; i++) {
        for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; }
        if (i % 1800 < 60) { const F = list[(i / 1800 | 0) % list.length], me = state.boats[0]; me.x = F.cx + 40; me.y = F.cy; }
        update(1 / 30);
        for (const F of list) { const B = F.birds; birdFrames += B.length;
          for (const q of B) { if (q.mode === 'wade' && q._m !== 'wade') q._land = i; q._m = q.mode; }
          const tag = (q) => q.mode !== 'wade' ? (q.hop ? 'hop' : q.mode) : (i - (q._land || -1e9) < 90 ? 'landing' : (F.roosting ? 'roost' : 'wade'));
          for (let a = 0; a < B.length; a++) for (let c = a + 1; c < B.length; c++) { const A = B[a], C = B[c];
            const L = R0 * 2, cap = (q) => { const hx = Math.sin(q.h) * L * 0.38, hy = -Math.cos(q.h) * L * 0.38; return [q.x + hx, q.y + hy, q.x - hx, q.y - hy]; };
            const ground = A.mode === 'wade' && C.mode === 'wade', hit = ground ? sd(cap(A), cap(C)) < L * 0.22 : Math.hypot(A.x - C.x, A.y - C.y) < (k === 'spoonbill' ? 40 : 34) * 0.5;   // (aloft: closer than half a wingspan)
            if (hit && Math.abs((A.z || 0) - (C.z || 0)) < 8) { const t = [tag(A), tag(C)].sort().join('+'); by[t] = (by[t] || 0) + 1; } } }
      }
      const tot = Object.values(by).reduce((a, c) => a + c, 0);
      out.push(`${k}: stacked pair-frames ${tot} (${(100 * tot / birdFrames).toFixed(2)}% of bird-frames): ${JSON.stringify(by)}`);
    }
    return out.join('\n'); }, MIN));
  await b.close(); })();

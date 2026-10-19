// Probe: are the hammerheads stacked on top of each other? Each shark as a capsule down its body from the hammer to the
// tail stock (radius ~ half the body's width at the size it is drawn), seen from above whatever its depth; over three
// minutes, the share of sharks overlapping another, and the worst moment.   node regatta/eval/_volc_hammer_overlap.js
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const Ss = Wildlife.debug().hammerSchools, L = 35;
    const seg = (f) => { const len = L * f.size, a = { x: f.x + Math.sin(f.h) * len * 0.43, y: f.y - Math.cos(f.h) * len * 0.43 }, c = { x: f.x - Math.sin(f.h) * len * 0.45, y: f.y + Math.cos(f.h) * len * 0.45 }; return [a, c, 3.25 * f.size]; };
    const segD = (p1, q1, p2, q2) => { const d = (P, A, B) => { const vx = B.x - A.x, vy = B.y - A.y, t = Math.max(0, Math.min(1, ((P.x - A.x) * vx + (P.y - A.y) * vy) / (vx * vx + vy * vy))); return Math.hypot(P.x - A.x - vx * t, P.y - A.y - vy * t); };
      return Math.min(d(p1, p2, q2), d(q1, p2, q2), d(p2, p1, q1), d(q2, p1, q1)); };
    let samples = 0, over = 0, worst = 0, n = 0; const pairs = {}, run = new Map(), lasting = []; let frameNo = 0;
    for (let i = 0; i < 30 * 180; i++) { Wildlife.update(1 / 30); if (i % 15) continue; frameNo++; const now = new Set();
      for (const S of Ss) { const G = S.fish.map(seg); const hit = new Set();
        for (let a = 0; a < G.length; a++) for (let c = a + 1; c < G.length; c++) { if (Math.hypot(S.fish[a].x - S.fish[c].x, S.fish[a].y - S.fish[c].y) > L * 1.3) continue;
          if (segD(G[a][0], G[a][1], G[c][0], G[c][1]) < G[a][2] + G[c][2]) { hit.add(a); hit.add(c); const k = [S.fish[a].mode, S.fish[c].mode].sort().join('/'); pairs[k] = (pairs[k] || 0) + 1; const id = S.i + ':' + a + ':' + c; now.add(id); run.set(id, (run.get(id) || 0) + 1); } }
        samples += S.fish.length; over += hit.size; worst = Math.max(worst, hit.size / S.fish.length); }
      for (const [id, n2] of run) if (!now.has(id)) { lasting.push(n2 * 0.5); run.delete(id); } }
    return { sharks: Ss.reduce((s, S) => s + S.fish.length, 0), overlappingShare: (over / samples).toFixed(3), worstSchool: worst.toFixed(2), pairs, contactSeconds: (() => { lasting.sort((a, b) => a - b); return { n: lasting.length, median: lasting[lasting.length >> 1], p90: lasting[Math.floor(lasting.length * 0.9)], over5s: lasting.filter(x => x > 5).length }; })() }; });
  console.log(JSON.stringify(r)); await b.close(); })();

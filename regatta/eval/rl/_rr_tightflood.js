// If cells with TRUE land clearance >= BAR (default 32 = HULL_R+2) were
// admissible, would the human's north-channel exit to m5 connect? Regional
// flood fill over raw polygons at 25u sub-sampling in the box x[-700,150],
// y[600,1750], from (-60,700) toward m5's approach water (-500,1550).
//   node _rr_tightflood.js [tree] [bar]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeMETER2');
const BAR = parseFloat(process.argv[3] || '32');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' })));
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.waitForTimeout(3000);
  const out = await p.evaluate((BAR) => {
    const land = (state.course.islands || []).filter(i => !i.isFloe);
    const dSeg = (px, py, ax, ay, bx, by) => {
      const vx = bx - ax, vy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
      return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
    };
    const inRing = (x, y, ring) => {
      let c = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        if ((ring[i].y > y) !== (ring[j].y > y) &&
            x < (ring[j].x - ring[i].x) * (y - ring[i].y) / (ring[j].y - ring[i].y) + ring[i].x) c = !c;
      }
      return c;
    };
    const clearAt = (x, y) => {
      let best = 1e9;
      for (const isl of land) {
        if (Math.hypot(x - isl.x, y - isl.y) > isl.radius + 2000) continue;
        if (inRing(x, y, isl.vertices)) return -1;
        const v = isl.vertices;
        for (let k = 0; k < v.length; k++) {
          const a = v[k], bb = v[(k + 1) % v.length];
          const d = dSeg(x, y, a.x, a.y, bb.x, bb.y);
          if (d < best) best = d;
        }
      }
      return best;
    };
    const X0 = -700, Y0 = 600, X1 = 150, Y1 = 1750, S = 25;
    const W = Math.round((X1 - X0) / S) + 1, H = Math.round((Y1 - Y0) / S) + 1;
    const ok = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const c = clearAt(X0 + i * S, Y0 + j * S);
      ok[j * W + i] = c >= BAR ? 1 : 0;
    }
    const idx = (x, y) => (Math.round((y - Y0) / S)) * W + Math.round((x - X0) / S);
    const seen = new Uint8Array(W * H);
    const q = [idx(-60, 700)]; seen[q[0]] = 1;
    if (!ok[q[0]]) return { seedBlocked: true };
    let head = 0, reached = null;
    const goal = idx(-500, 1550);
    while (head < q.length) {
      const cur = q[head++];
      if (cur === goal) { reached = true; break; }
      const ci = cur % W, cj = (cur - ci) / W;
      for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const a = ci + di, bj = cj + dj;
        if (a < 0 || bj < 0 || a >= W || bj >= H) continue;
        const nid = bj * W + a;
        if (seen[nid] || !ok[nid]) continue;
        seen[nid] = 1; q.push(nid);
      }
    }
    // trace the narrowest point on a shortest path if reached: rerun BFS with prev
    let minClear = null, path = null;
    if (reached) {
      const prev = new Int32Array(W * H).fill(-1);
      const q2 = [idx(-60, 700)]; prev[q2[0]] = q2[0];
      let h2 = 0;
      while (h2 < q2.length) {
        const cur = q2[h2++];
        if (cur === goal) break;
        const ci = cur % W, cj = (cur - ci) / W;
        for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
          const a = ci + di, bj = cj + dj;
          if (a < 0 || bj < 0 || a >= W || bj >= H) continue;
          const nid = bj * W + a;
          if (prev[nid] !== -1 || !ok[nid]) continue;
          prev[nid] = cur; q2.push(nid);
        }
      }
      if (prev[goal] !== -1) {
        path = []; minClear = 1e9;
        let cur = goal;
        while (cur !== prev[cur]) {
          const ci = cur % W, cj = (cur - ci) / W;
          const x = X0 + ci * S, y = Y0 + cj * S;
          const c = clearAt(x, y);
          if (c < minClear) minClear = c;
          path.push([x, y, Math.round(c)]);
          cur = prev[cur];
        }
        path.reverse();
      }
    }
    return { bar: BAR, reached: !!reached, minClear: minClear && Math.round(minClear),
             pathEvery4: path && path.filter((_, i) => i % 4 === 0 || i === path.length - 1) };
  }, BAR);
  console.log(JSON.stringify(out));
  await b.close();
})();

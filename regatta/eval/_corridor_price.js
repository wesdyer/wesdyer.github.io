// PRICE THE CORRIDOR-AWARE ROUTER BEFORE BUILDING IT.
//
// Phase 0 instrument for the "routing that knows whether it can tack" push: run the
// SHIPPING pathSailable and a corridor-aware variant side by side on every leg of a
// venue, in a probe, with zero shipping-code changes — and report what would change.
//
// The corridor cost is MEASURED, not derived (_vmgeff_probe): short-tacking VMG in a
// corridor of width W is  VMG_free · W/(W+K)  with K = t_c·v·sinθ·15 and t_c ≈ 1.0 s
// against polar speed (fit K≈70u at 13 kt on two venues; the closed form with 3 s was
// 2-3x too harsh, and open water prices near 1.0 with no normalization gymnastics).
// Per A* step the equivalent statement is: time factor  tf' = tf · (1 + L/W)  where
// L = t_c·v_best·|sin(heading_best − bearing)|·15 is zero whenever the step's bearing
// is directly sailable — the penalty scopes itself to the no-go cone by construction.
// W = 2·clear·RES (exact mid-channel, harsh near a wall in open water — which is where
// the existing narrow hint already pushes routes off anyway).
//
// Usage: node regatta/eval/_corridor_price.js [venue=redrock] [tc=1.0]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.SailCheck && window.getTargetSpeed, null, { timeout: 20000 });
  const VENUE = process.argv[2] || 'redrock';
  const TC = parseFloat(process.argv[3]) || 1.0;

  const R = await p.evaluate(({ VENUE, TC }) => {
    selectVenue(VENUE);
    const grid = state.course.botGrid;
    if (!grid) return { err: 'no botGrid' };
    if (!grid._clear) grid._clear = window.SailCheck.clearanceField(grid);
    const clear = grid._clear;
    const N = grid.n, RES = grid.res;
    const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

    // ── the shipping table, rebuilt here with the LOSS column added ──
    const SPDS = [8, 12, 16, 20, 25, 30];
    const tab = new Float32Array(16 * 6 * 8);     // shipping tf (with its cap)
    const loss = new Float32Array(16 * 6 * 8);    // L, units of corridor per t_c
    let tfMin = Infinity;
    for (let d = 0; d < 16; d++) {
      const wd = d * Math.PI * 2 / 16;
      for (let s = 0; s < SPDS.length; s++) {
        const ws = SPDS[s];
        for (let k = 0; k < 8; k++) {
          const bearing = Math.atan2(NB[k][0], -NB[k][1]);
          let best = 0.5, bestV = 0, bestDelta = 0;
          for (let twa = 25; twa <= 180; twa += 5) {
            const tr = twa * Math.PI / 180;
            const v = getTargetSpeed(tr, twa > 95, ws);
            for (const sgn of [1, -1]) {
              const toward = Math.cos((wd + sgn * tr) - bearing) * v;
              if (toward > best) { best = toward; bestV = v; bestDelta = (wd + sgn * tr) - bearing; }
            }
          }
          const tf = Math.min(4, Math.max(0.6, 10 / best));
          tab[(d * 6 + s) * 8 + k] = tf;
          loss[(d * 6 + s) * 8 + k] = TC * bestV * 15 * Math.abs(Math.sin(bestDelta));
          if (tf < tfMin) tfMin = tf;
        }
      }
    }
    const wbin = grid._wbin;
    if (!wbin) return { err: 'no _wbin on botGrid' };

    // ── A*, verbatim shipping shape, with a switchable step cost ──
    function astar(from, to, corridor) {
      const okCell = (i, j) => {
        if (grid.at(i, j)) return true;
        if (!grid._soft || i < 0 || j < 0 || i >= N || j >= N) return false;
        return grid._soft[j * N + i] > 0;
      };
      const snap = (wx, wy) => {
        const [ci, cj] = grid.cell(wx, wy);
        if (okCell(ci, cj)) return [ci, cj];
        for (let r = 1; r <= 18; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (okCell(ci + di, cj + dj)) return [ci + di, cj + dj];
        }
        return null;
      };
      const s = snap(from[0], from[1]), g = snap(to[0], to[1]);
      if (!s || !g) return null;
      const size = N * N;
      const gScore = new Float64Array(size).fill(Infinity);
      const prev = new Int32Array(size).fill(-1);
      const si = s[1] * N + s[0], gi = g[1] * N + g[0];
      const heap = [];
      const push = (f, id) => {
        heap.push([f, id]);
        let k = heap.length - 1;
        while (k > 0) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; const t = heap[q]; heap[q] = heap[k]; heap[k] = t; k = q; }
      };
      const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
          heap[0] = last; let k = 0;
          for (;;) {
            const l = 2 * k + 1, r = l + 1; let m = k;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === k) break; const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m;
          }
        }
        return top;
      };
      const gx = gi % N, gy = (gi - gx) / N;
      const h = (id) => { const ci = id % N, cj = (id - ci) / N; return Math.hypot(ci - gx, cj - gy) * tfMin; };
      gScore[si] = 0; push(h(si), si);
      const PAD = 8;
      while (heap.length) {
        const [f, cur] = pop();
        if (cur === gi) break;
        const ci = cur % N, cj = (cur - ci) / N;
        if (f - h(cur) > gScore[cur] + 1e-6) continue;
        for (let k = 0; k < 8; k++) {
          const di = NB[k][0], dj = NB[k][1];
          const a = ci + di, bq = cj + dj;
          const soft = grid._soft ? (id2) => grid._soft[id2] === 1 : null;
          const passable = (ai, bi) => grid.at(ai, bi) || (soft && ai >= 0 && bi >= 0 && ai < N && bi < N && soft(bi * N + ai));
          if (!passable(a, bq)) continue;
          if (di && dj && (!passable(ci + di, cj) || !passable(ci, cj + dj))) continue;
          const nid = bq * N + a;
          const isSoft = !grid.at(a, bq);
          const c = clear[nid];
          let base = tab[wbin[nid] * 8 + k];
          if (corridor) {
            const W = Math.max(60, 2 * c * RES);
            base = Math.min(20, base * (1 + loss[wbin[nid] * 8 + k] / W));
          }
          const narrow = c >= PAD ? 0 : (PAD - c) / PAD;
          let extra = 1.0 * narrow;
          if (grid._leeW) extra += Math.min(0.7, grid._leeW[nid] * 0.28);
          if (grid._floeRisk && grid._floeRisk[nid]) extra += 0.55;
          let w = base * (1 + Math.min(1.2, extra));
          if (isSoft) w *= (grid._soft[nid] === 1 ? 2.5 : 6);
          const step = (di && dj ? Math.SQRT2 : 1) * w;
          const cand = gScore[cur] + step;
          if (cand < gScore[nid] - 1e-4) { gScore[nid] = cand; prev[nid] = cur; push(cand + h(nid), nid); }
        }
      }
      if (prev[gi] === -1 && gi !== si) return null;
      const out = [];
      let cur = gi;
      while (cur !== si) { const ci = cur % N; out.push([ci, (cur - ci) / N]); cur = prev[cur]; }
      out.push([s[0], s[1]]);
      out.reverse();
      return out;
    }

    // metrics along a cell path
    const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    function metrics(cells) {
      if (!cells) return null;
      let len = 0, upLen = 0, secs = 0, secsCorr = 0;
      const clears = [];
      for (let i = 1; i < cells.length; i++) {
        const [ci, cj] = cells[i], [pi, pj] = cells[i - 1];
        const [wx, wy] = grid.world(ci, cj);
        const [px, py] = grid.world(pi, pj);
        const d = Math.hypot(wx - px, wy - py);
        len += d;
        const id = cj * N + ci;
        clears.push(clear[id]);
        const bearing = Math.atan2(wx - px, -(wy - py));
        const w = getWindAt((wx + px) / 2, (wy + py) / 2);
        const off = Math.abs(norm(bearing - w.direction));
        if (off < Math.PI * 42 / 180) upLen += d;
        // seconds from the same tables the A* priced with
        const di = ci - pi, dj = cj - pj;
        let k = -1;
        for (let q = 0; q < 8; q++) if (NB[q][0] === di && NB[q][1] === dj) { k = q; break; }
        if (k >= 0) {
          const tf = tab[wbin[id] * 8 + k];
          const L = loss[wbin[id] * 8 + k];
          const W = Math.max(60, 2 * clear[id] * RES);
          secs += d * tf / 150;
          secsCorr += d * Math.min(20, tf * (1 + L / W)) / 150;
        }
      }
      clears.sort((a, b) => a - b);
      const q = (p) => clears.length ? clears[Math.floor(p * (clears.length - 1))] * RES : 0;
      return { len: Math.round(len), upPct: Math.round(100 * upLen / (len || 1)),
               freeMed: q(0.5), freeMin: q(0), secs: Math.round(secs), secsCorr: Math.round(secsCorr) };
    }

    // legs from the route
    const marks = state.course.marks, route = state.course.route;
    const legs = [];
    for (let i = 0; i + 1 < route.length; i++) {
      const A = CoursePath.anchor(route[i], marks), B2 = CoursePath.anchor(route[i + 1], marks);
      if (!A || !B2) continue;
      legs.push({ leg: i + 1, from: [A.x, A.y], to: [B2.x, B2.y] });
    }
    const out = [];
    for (const L of legs) {
      const stock = astar(L.from, L.to, false);
      const corr = astar(L.from, L.to, true);
      const ms = metrics(stock), mc = metrics(corr);
      // path overlap: fraction of corr cells that are on the stock path
      let shared = 0;
      if (stock && corr) {
        const set = new Set(stock.map(c => c[1] * N + c[0]));
        for (const c of corr) if (set.has(c[1] * N + c[0])) shared++;
        shared = Math.round(100 * shared / corr.length);
      }
      out.push({ leg: L.leg, stock: ms, corr: mc, sharedPct: shared });
    }
    return { venue: VENUE, legs: out };
  }, { VENUE, TC });

  if (R.err) { console.log('ERR', R.err); await b.close(); return; }
  console.log(`venue=${R.venue} tc=${TC}`);
  console.log('leg | stock: len upW% freeMed freeMin est(s) estCorr(s) | corridor path: len upW% freeMed est(s) | shared%');
  for (const L of R.legs) {
    const s = L.stock, c = L.corr;
    if (!s || !c) { console.log(` ${L.leg}  NO PATH`); continue; }
    console.log(` ${String(L.leg).padStart(2)} | ${String(s.len).padStart(6)}u ${String(s.upPct).padStart(3)}% ${String(s.freeMed).padStart(5)}u ${String(s.freeMin).padStart(4)}u ${String(s.secs).padStart(4)}s -> ${String(s.secsCorr).padStart(4)}s | ${String(c.len).padStart(6)}u ${String(c.upPct).padStart(3)}% ${String(c.freeMed).padStart(5)}u ${String(c.secsCorr).padStart(4)}s | ${String(L.sharedPct).padStart(3)}%`);
  }
  await b.close();
})();

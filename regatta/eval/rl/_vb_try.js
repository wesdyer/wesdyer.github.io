// ROUTE BALANCE (Wes, Oct 18 2026: "3+ routes that are roughly the same cost with different character").
//   node _vb_try.js <venue> <patch.json|-> [seed=9400] [dumpPrefix]
// Applies a patch to the venue doc IN MEMORY (before the race build), then for every leg lists up to three
// candidate routes (R0 stock; R1/R2 with the earlier routes' interior priced out) with their plain polar time
// and their CHARACTER: length, mean wind on the route, share of it sailed upwind (TWA < 60°) / reaching / running,
// narrow water (clearance ≤ 1 cell), drag water (shoal > 1.05), and tight cells.
// Patch ops (array): {op:'windMul', ids:[..]|poly:[[x,y]..], mul} · {op:'windSet', ids:[..], speed}
//   · {op:'propsOut', poly} (removes hard props inside) · {op:'propsIn', kind, pts:[[x,y]..]}
//   · {op:'shape', kind, outer:[[x,y]..]} · {op:'shapeOut', ids:[..]} · {op:'shapeSet', id, outer}
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const V = process.argv[2] || 'swamp', PATCH = process.argv[3] && process.argv[3] !== '-' ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : [];
const SEED = +(process.argv[4] || 9400), DUMP = process.argv[5] || null;
const VIAS = process.env.VIAS ? JSON.parse(process.env.VIAS) : null;
const PASS = process.env.PASS ? JSON.parse(process.env.PASS) : null;   // {name: [[ax,ay],[bx,by]]} gate lines; see PASSAGES below   // {name: [[x,y],..]} named routes by via points (leg 1)
const ROOT = path.join(__dirname, '../../..');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto('file://' + path.join(ROOT, 'regatta/index.html'));
  await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), V);
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../rate_harness.js'), 'utf8') });
  const out = await page.evaluate(({ V, PATCH, SEED, VIAS, PASS }) => {
    const doc = window.VENUE_DOC[V];
    const inPoly = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const cen = p => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
    const log = [];
    for (const o of PATCH) {
      if (o.op === 'windMul' || o.op === 'windSet') {
        let n = 0;
        for (const r of doc.wind.regions) {
          const hit = o.ids ? o.ids.includes(r.id) : inPoly(o.poly, ...cen(r.poly));
          if (!hit) continue; n++;
          r.speed = o.op === 'windMul' ? +(r.speed * o.mul).toFixed(2) : o.speed;
        }
        log.push(`${o.op} ${n} regions`);
      } else if (o.op === 'propsOut') {
        const before = doc.props.length;
        doc.props = doc.props.filter(p => !inPoly(o.poly, p.x, p.y) || (o.kinds && !o.kinds.some(k => p.kind.includes(k))));
        log.push(`propsOut ${before - doc.props.length}`);
      } else if (o.op === 'propsIn') {
        const tpl = doc.props.find(p => p.kind === o.kind);
        o.pts.forEach((q, i) => doc.props.push(Object.assign(JSON.parse(JSON.stringify(tpl)), { id: `vb-${o.kind}-${i}-${q[0] | 0}`, x: q[0], y: q[1] })));
        log.push(`propsIn ${o.pts.length}`);
      } else if (o.op === 'shape') {
        doc.shapes.push({ id: o.id || `vb-${doc.shapes.length}`, kind: o.kind, smooth: o.smooth !== false, outer: o.outer });
        log.push(`shape ${o.kind}`);
      } else if (o.op === 'shapeOut') {
        doc.shapes = doc.shapes.filter(s => !o.ids.includes(s.id)); log.push(`shapeOut ${o.ids.length}`);
      } else if (o.op === 'shapeSet') {
        const s = doc.shapes.find(s => s.id === o.id); s.outer = o.outer; log.push(`shapeSet ${o.id}`);
      }
    }
    window.rateHarness.seed = SEED; resetGame(); startRace();
    const G = state.course.botGrid;
    if (!G._clear) G._clear = SailCheck.clearanceField(G);
    // Leg targets: run the race until each leg's first bot has replanned, as the probe does.
    const P = state.boats.find(b => b.isPlayer), bots = state.boats.filter(b => !b.isPlayer);
    const legs = {}, pend = {};
    for (let it = 0; it < 60 * 600; it++) {
      if (P) { P.x = 1e6; P.y = 1e6; P.speed = 0; }
      update(1 / 60);
      if (state.race.status !== 'racing' || it % 6) continue;
      for (const b of bots) { const L = b.raceState.leg; if (!b.raceState.finished && L >= 1 && !legs[L] && !pend[L]) pend[L] = { b, t: state.race.timer + 3 }; }
      for (const L of Object.keys(pend)) {
        const q = pend[L]; if (state.race.timer < q.t) continue; delete pend[L];
        legs[L] = q.b.controller.gridGoal ? { from: [q.b.x, q.b.y], to: [q.b.controller.gridGoal.x, q.b.controller.gridGoal.y] } : null;
      }
      if (bots.every(b => b.raceState.finished) || state.race.timer > 560) break;
    }
    const prof = (r) => {
      let len = 0, up = 0, reach = 0, run = 0, wsum = 0, narrow = 0, drag = 0, tight = 0;
      for (let i = 1; i < r.length; i++) {
        const [x0, y0] = r[i - 1], [x1, y1] = r[i], d = Math.hypot(x1 - x0, y1 - y0); len += d;
        const w = getWindAt((x0 + x1) / 2, (y0 + y1) / 2); wsum += w.speed * d;
        const brg = Math.atan2(x1 - x0, -(y1 - y0)); const twa = Math.abs(normalizeAngle(brg - w.direction)) * 180 / Math.PI;
        if (twa < 60) up += d; else if (twa < 120) reach += d; else run += d;
        const c = G.cell(x1, y1), id = c[1] * G.n + c[0];
        if (G._clear[id] <= 1) narrow += d; if (G._shoal && G._shoal[id] > 1.05) drag += d; if (!G.at(c[0], c[1])) tight += d;
      }
      return { len: len | 0, wind: +(wsum / len).toFixed(2), up: Math.round(100 * up / len), reach: Math.round(100 * reach / len), run: Math.round(100 * run / len), narrow: narrow | 0, drag: drag | 0, tight: tight | 0 };
    };
    const res = {};
    for (const [L, lg] of Object.entries(legs)) {
      if (!lg) { res[L] = null; continue; }
      if (!G._jam) { G._jam = new Uint8Array(G.n * G.n); G._jamIds = []; }
      const save = G._jam.slice(), routes = [], seen = new Uint8Array(G.n * G.n);
      for (let k = 0; k < 3; k++) {
        const r = SailCheck.pathSailable(G, lg.from, lg.to); if (!r) break;
        const inner = r.filter(q => Math.hypot(q[0] - lg.from[0], q[1] - lg.from[1]) > 300 && Math.hypot(q[0] - lg.to[0], q[1] - lg.to[1]) > 300);
        let sep = 0; for (const q of inner) { let dm = Infinity; for (const R of routes) for (const p of R.pts) dm = Math.min(dm, Math.hypot(p[0] - q[0], p[1] - q[1])); if (routes.length && dm > sep) sep = dm; }
        routes.push({ pts: r.map(q => [q[0] | 0, q[1] | 0]), tsail: +r.tsail.toFixed(1), sep: sep | 0, ...prof(r) });
        for (const q of inner) { const c = G.cell(q[0], q[1]); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = c[0] + dx, y = c[1] + dy; if (x >= 0 && y >= 0 && x < G.n && y < G.n) { seen[y * G.n + x] = 1; G._jam[y * G.n + x] = 3; } } }
      }
      G._jam.set(save);
      res[L] = routes;
    }
    if (VIAS && legs[1]) {
      const named = [];
      for (const [nm, vs] of Object.entries(VIAS)) {
        const pts = [legs[1].from, ...vs, legs[1].to]; let all = [], t = 0, cst = 0, ok = true;
        for (let i = 0; i + 1 < pts.length; i++) { const r = SailCheck.pathSailable(G, pts[i], pts[i + 1]); if (!r) { ok = false; break; } t += r.tsail; cst += r.cost; all = all.concat(i ? r.slice(1) : r); }
        if (ok) named.push({ name: nm, pts: all.map(q => [q[0] | 0, q[1] | 0]), tsail: +t.toFixed(1), cost: Math.round(cst), sep: 0, ...prof(all) });
        else named.push({ name: nm, pts: [], tsail: NaN });
      }
      res.named = named;
    }
    // PASSAGES: {name: [[ax,ay],[bx,by]]} gate lines (swamp: course.js ROUTE_GATES). Each passage is priced with
    // the OTHER gate lines walled off in the grid (a 3-cell-thick line), so the route is forced through its own.
    if (PASS && legs[1]) {
      const named = [], nav0 = G.nav.slice();
      const wall = ([a, b]) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 0; s <= L; s += 10) { const c = G.cell(a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = c[0] + dx, y = c[1] + dy; if (x >= 0 && y >= 0 && x < G.n && y < G.n) G.nav[y * G.n + x] = 0; } } };
      for (const nm of Object.keys(PASS)) {
        for (const [o, g] of Object.entries(PASS)) if (o !== nm) wall(g);
        const r = SailCheck.pathSailable(G, legs[1].from, legs[1].to);
        G.nav.set(nav0);
        named.push(r ? { name: nm, pts: r.map(q => [q[0] | 0, q[1] | 0]), tsail: +r.tsail.toFixed(1), cost: Math.round(r.cost), sep: 0, ...prof(r) } : { name: nm, pts: [], tsail: NaN });
      }
      res.named = named;
    }
    let str = ''; const wsp = [], shoal = [];
    for (let j = 0; j < G.n; j++) for (let i = 0; i < G.n; i++) { const id = j * G.n + i;
      str += G.at(i, j) ? (G._shoal && G._shoal[id] > 1.05 ? '2' : '1') : (G._tight && G._tight[id] ? '3' : '0');
      const [wx, wy] = G.world(i, j); wsp.push(+getWindAt(wx, wy).speed.toFixed(2)); shoal.push(G._shoal ? +G._shoal[id].toFixed(2) : 1); }
    return { log, res, grid: { n: G.n, x0: G.x0, y0: G.y0, res: G.res, cells: str, wsp, shoal, wdir: getWindAt(0, 0).direction }, marks: state.course.marks.map(m => [m.x, m.y]) };
  }, { V, PATCH, SEED, VIAS, PASS });
  console.log(out.log.join(' · ') || 'no patch');
  for (const [L, rs] of Object.entries(out.res)) {
    if (!rs) { console.log(`leg ${L}: open water`); continue; }
    const t0 = rs[0].tsail;
    for (const [i, R] of rs.entries())
      console.log(`${L === 'named' ? R.name.padEnd(7) : 'leg ' + L + ' R' + i} t ${R.tsail}s ×${(R.tsail / t0).toFixed(3)}${R.cost ? ' cost ' + R.cost : ''}  len ${R.len} sep ${R.sep}  wind ${R.wind}  up/reach/run ${R.up}/${R.reach}/${R.run}%  narrow ${R.narrow} drag ${R.drag} tight ${R.tight}`);
  }
  if (DUMP) fs.writeFileSync(DUMP + '.json', JSON.stringify({ routes: Object.fromEntries(Object.entries(out.res).filter(e => e[1]).map(([L, rs]) => [L, rs.map(R => ({ pts: R.pts, tsail: R.tsail }))])), grid: out.grid, marks: out.marks }));
  await browser.close();
})();

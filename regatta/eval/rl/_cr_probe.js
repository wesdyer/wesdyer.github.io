// PT-050 PHASE 1 PROBE: what genuinely different routes does the router have per leg, and at what price?
//   node _cr_probe.js <tree|.> <seed> <venue...>
// For the first bot into each leg (3 s after it starts the leg, so its replan has run): R0 = pathSailable to its
// grid goal; R1 = the same with R0's interior priced out (×6, the jam stamp's cap); R2 = with both priced out.
// Reports cost ratio to R0, interior overlap with the earlier routes, and max lateral separation.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const T = process.argv[2] || '.', TREE = T === '.' ? path.join(__dirname, '../../..') : path.join(__dirname, T);
const SEED = +(process.argv[3] || 9400), VENUES = process.argv.slice(4);
(async () => {
  const browser = await chromium.launch();
  for (const v of VENUES) {
    const page = await browser.newPage();
    await page.goto('file://' + path.join(TREE, 'regatta/index.html'));
    await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), v);
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../rate_harness.js'), 'utf8') });
    const out = await page.evaluate(({ SEED }) => {
      window.rateHarness.seed = SEED; resetGame(); startRace();
      const P = state.boats.find(b => b.isPlayer), bots = state.boats.filter(b => !b.isPlayer);
      const seen = {}, pend = {}, lines = [], dump = {};
      const g = () => state.course.botGrid;
      const cands = (from, to) => {
        const G = g(); if (!G) return null;
        if (!G._jam) { G._jam = new Uint8Array(G.n * G.n); G._jamIds = []; }
        const save = G._jam.slice();
        const routes = [], marks = new Uint8Array(G.n * G.n);
        for (let k = 0; k < 3; k++) {
          const r = SailCheck.pathSailable(G, from, to); if (!r) break;
          const len = r.reduce((a, q, i) => i ? a + Math.hypot(q[0] - r[i - 1][0], q[1] - r[i - 1][1]) : 0, 0);
          // interior = more than 300u from either end
          const interior = r.filter(q => Math.hypot(q[0] - from[0], q[1] - from[1]) > 300 && Math.hypot(q[0] - to[0], q[1] - to[1]) > 300);
          let ov = 0, sep = 0;
          for (const q of interior) {
            const c = G.cell(q[0], q[1]); if (marks[c[1] * G.n + c[0]]) ov++;
            let dmin = Infinity; for (const R of routes) for (const p of R.r) dmin = Math.min(dmin, Math.hypot(p[0] - q[0], p[1] - q[1]));
            if (routes.length && dmin > sep) sep = dmin;
          }
          routes.push({ r, cost: r.cost, len, ov: interior.length ? ov / interior.length : 0, sep });
          for (const q of interior) {
            const c = G.cell(q[0], q[1]);
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
              const x = c[0] + dx, y = c[1] + dy; if (x < 0 || y < 0 || x >= G.n || y >= G.n) continue;
              marks[y * G.n + x] = 1; G._jam[y * G.n + x] = 3;
            }
          }
        }
        G._jam.set(save);
        return routes;
      };
      for (let it = 0; it < 60 * 600; it++) {
        if (P) { P.x = 1e6; P.y = 1e6; P.speed = 0; }
        update(1 / 60);
        if (state.race.status !== 'racing' || it % 6) continue;
        for (const b of bots) {
          const L = b.raceState.leg; if (b.raceState.finished || L < 1) continue;
          if (!seen[L] && !pend[L]) pend[L] = { b, t: state.race.timer + 3 };
        }
        for (const L of Object.keys(pend)) {
          const q = pend[L]; if (state.race.timer < q.t) continue;
          delete pend[L]; seen[L] = 1;
          const c = q.b.controller; if (!c.gridGoal) { lines.push(`leg ${L}: no grid goal (open water)`); continue; }
          const rs = cands([q.b.x, q.b.y], [c.gridGoal.x, c.gridGoal.y]);
          if (!rs) { lines.push(`leg ${L}: no grid`); continue; }
          const c0 = rs[0].cost; dump[L] = rs.map(R => ({ pts: R.r.map(q => [q[0] | 0, q[1] | 0]), tsail: R.r.tsail, cost: R.cost }));
          lines.push(`leg ${L} from (${q.b.x | 0},${q.b.y | 0}) to (${c.gridGoal.x | 0},${c.gridGoal.y | 0}): ` +
            rs.map((R, i) => `R${i} cost×${(R.cost / c0).toFixed(3)} t×${(R.r.tsail / rs[0].r.tsail).toFixed(3)} (${R.r.tsail|0}s) len ${R.len | 0} ov ${(R.ov * 100) | 0}% sep ${R.sep | 0}`).join(' | '));
        }
        if (state.race.timer > 560 || bots.every(b => b.raceState.finished)) break;
      }
      const G = state.course.botGrid; let grid = null;
      if (G) { let str = ''; const wsp = [], drag = [];
        for (let j = 0; j < G.n; j++) for (let i = 0; i < G.n; i++) { const id = j * G.n + i;
          str += G.at(i, j) ? (G._shoal && G._shoal[id] > 1.05 ? '2' : '1') : (G._tight && G._tight[id] ? '3' : '0');
          const [wx, wy] = G.world(i, j); const w = getWindAt(wx, wy); wsp.push(+(w.speed).toFixed(2)); drag.push(G._shoal ? +G._shoal[id].toFixed(2) : 1); }
        grid = { n: G.n, x0: G.x0, y0: G.y0, res: G.res, cells: str, wsp, shoal: drag, wdir: getWindAt(0, 0).direction }; }
      return { text: lines.join('\n'), dump: { routes: dump, grid, marks: state.course.marks.map(m => [m.x, m.y]) } };
    }, { SEED });
    console.log(`== ${v}\n${out.text}`); if (process.env.DUMP) fs.writeFileSync(`${process.env.DUMP}_${v}.json`, JSON.stringify(out.dump));
    await page.close();
  }
  await browser.close();
})();

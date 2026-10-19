// ROUTE BALANCE CENSUS: which named route does each bot sail?   node _vb_census.js <tree> <seed0> <n> <venue> '<json {name:[x,y,r]}>'
// A boat's route on leg 1 is the first named gate its track enters: a circle [x,y,r], or a LINE [[ax,ay],[bx,by]]
// crossed (swamp: course.js ROUTE_GATES — the honest test; circles mislabel where routes run close). Prints the share per route and
// the finish time per route.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TREE = path.join(__dirname, process.argv[2]), S0 = +process.argv[3], N = +process.argv[4], V = process.argv[5];
const GATES = JSON.parse(process.argv[6]);
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto('file://' + path.join(TREE, 'regatta/index.html'));
  await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), V);
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../rate_harness.js'), 'utf8') });
  const rows = await page.evaluate(({ S0, N, GATES }) => {
    const out = [];
    for (let s = S0; s < S0 + N; s++) {
      window.rateHarness.seed = s; resetGame(); startRace();
      const P = state.boats.find(b => b.isPlayer), bots = state.boats.filter(b => !b.isPlayer), route = new Map(), last = new Map();
      const o = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const X = (p, q, a, b) => (o(a, b, p) > 0) !== (o(a, b, q) > 0) && (o(p, q, a) > 0) !== (o(p, q, b) > 0);
      for (let it = 0; it < 60 * 600; it++) {
        if (P) { P.x = 1e6; P.y = 1e6; P.speed = 0; }
        update(1 / 60);
        if (state.race.status !== 'racing' || it % 15) continue;
        for (const b of bots) {
          if (route.has(b.id) || b.raceState.leg !== 1) continue;
          const lp = last.get(b.id); last.set(b.id, [b.x, b.y]);
          for (const [nm, g] of Object.entries(GATES)) {
            if (Array.isArray(g[0])) { if (lp && X(lp, [b.x, b.y], g[0], g[1])) { route.set(b.id, nm); break; } }
            else if (Math.hypot(b.x - g[0], b.y - g[1]) < g[2]) { route.set(b.id, nm); break; }
          }
        }
        if (bots.every(b => b.raceState.finished) || state.race.timer > 600) break;
      }
      for (const b of bots) out.push({ s, name: b.name, route: route.get(b.id) || '-', fin: b.raceState.finished ? b.raceState.finishTime : null });
    }
    return out;
  }, { S0, N, GATES });
  const by = {};
  for (const r of rows) (by[r.route] = by[r.route] || []).push(r.fin);
  console.log(`${V} ${process.argv[2]} ${S0}+${N}: ` + Object.entries(by).map(([k, f]) => {
    const t = f.filter(x => x != null).sort((a, b) => a - b);
    return `${k} ${f.length} (${Math.round(100 * f.length / rows.length)}%) med ${t.length ? t[t.length >> 1].toFixed(0) : '-'} best ${t.length ? t[0].toFixed(0) : '-'}`;
  }).join(' · '));
  await browser.close();
})();

// Load and play performance, every venue, two trees, alternated: page-ready, selectVenue, race build
// (resetGame + startRace), then 30 s of racing with the player on autopilot timing update() and draw().
//   OLD=<old repo root> node regatta/eval/_perf_ab.js [venue ...]
const { chromium } = require('playwright'); const path = require('path');
const roots = { old: process.env.OLD, new: path.resolve('.') };
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay','lake','lagoon','swamp','river','ocean','redrock','glowtide','arctic','otter','flats','volcanic','seatrials'];
(async () => {
  const b = await chromium.launch(); const R = { old: {}, new: {} };
  for (const v of VENUES) for (let rep = 0; rep < 2; rep++) for (const k of (rep ? ['new', 'old'] : ['old', 'new'])) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    const t0 = Date.now(); await p.goto('file://' + path.join(roots[k], 'regatta/index.html')); await p.waitForFunction(() => window.state && typeof selectVenue === 'function'); const ready = Date.now() - t0;
    const m = await p.evaluate(v => { let t = performance.now(); settings.venue = v; selectVenue(v); const sel = performance.now() - t;
      t = performance.now(); resetGame(); startRace(); const build = performance.now() - t;
      const me = state.boats[0]; me.controller = new BotController(me); let tu = 0, td = 0, n = 0, worst = 0;
      for (let i = 0; i < 60 * 35; i++) { me.controller.update(1 / 60); const d = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
        let a = performance.now(); update(1 / 60); const u = performance.now() - a; a = performance.now(); draw(); const dr = performance.now() - a;
        if (i >= 300) { tu += u; td += dr; n++; if (u + dr > worst) worst = u + dr; } }
      return { sel, build, upd: tu / n, draw: td / n, worst }; }, v);
    m.ready = ready; (R[k][v] = R[k][v] || []).push(m); await p.close();
  }
  const av = (a, f) => a.reduce((s, x) => s + x[f], 0) / a.length;
  console.log('venue      page ready      select        race build       update ms/f     draw ms/f       worst frame');
  for (const v of VENUES) { const o = R.old[v], n = R.new[v], f = (k, d = 0) => `${av(o, k).toFixed(d)}->${av(n, k).toFixed(d)}`.padEnd(15);
    console.log(v.padEnd(10), f('ready'), f('sel'), f('build'), f('upd', 2), f('draw', 2), f('worst', 1)); }
  await b.close(); })();

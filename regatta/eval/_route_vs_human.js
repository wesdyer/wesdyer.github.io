// THE FLEET'S ROUTE AGAINST A RECORDED HUMAN ONE, LEG BY LEG.
//
//   node regatta/eval/_route_vs_human.js <traj.json> [races]
//
// Owner, on Redrock: "they are just taking the shortest path not the best path. If they
// head upwind to the first mark then follow the downwind corridors throughout the race,
// it's actually quite easy."
//
// The recorded human run says the same in numbers: leg 1 is 96.6% upwind, and every leg
// after it is 80-100% DOWNWIND on a long loop — 7790 and 8001 units where the rhumb line
// is a fraction of that. So the question is not whether the fleet is slower, it is whether
// it is sailing a DIFFERENT KIND of route.
//
// Per leg, for both: time, distance sailed, median true wind angle, and the share of the
// leg spent upwind and downwind. Plus where the fleet dies, and what it hits.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TRAJ = process.argv[2];
const RACES = +(process.argv[3] || 3);
if (!TRAJ) { console.error('usage: _route_vs_human.js <traj.json> [races]'); process.exit(1); }

const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

(async () => {
  const d = JSON.parse(fs.readFileSync(TRAJ, 'utf8'));
  const F = {}; d.format.forEach((n, i) => F[n] = i);
  const venue = d.venue;
  const hs = d.samples.filter(x => x[F.phase] === 1);
  const H = {};
  let prev = null;
  for (const s of hs) {
    const lg = s[F.leg];
    const L = H[lg] = H[lg] || { twa: [], dist: 0, t0: s[F.t], t1: s[F.t] };
    L.t1 = s[F.t];
    L.twa.push(Math.abs(norm(s[F.hdg] - s[F.windDir])) * 180 / Math.PI);
    if (prev && prev.lg === lg) L.dist += Math.hypot(s[F.x] - prev.x, s[F.y] - prev.y);
    prev = { lg, x: s[F.x], y: s[F.y] };
  }

  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.update, null, { timeout: 20000 });
  await p.addScriptTag({ content: fs.readFileSync(path.resolve('regatta/eval/eval_harness.js'), 'utf8') });

  const A = {};
  let deepest = {}, land = 0, boats = 0;
  for (let i = 0; i < RACES; i++) {
    const r = await p.evaluate(async (seed) => {
      window.evalHarness.seed = seed;
      window.resetGame(); window.startRace();
      state.course.cutoff = 900;
      let land = 0;
      const inner = window.onRaceEvent;
      window.onRaceEvent = (t, dd) => { if (t === 'collision_island' && dd && dd.boat && !dd.boat.isPlayer && !dd.isFloe) land++; return inner && inner(t, dd); };
      const bots = state.boats.filter(x => !x.isPlayer);
      const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const nrm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      const acc = bots.map(() => ({}));
      const last = bots.map(x => ({ x: x.x, y: x.y, lg: x.raceState.leg }));
      const deep = bots.map(() => 0);
      const dt = 1 / 60;
      for (let it = 0; it < 60 * 940; it++) {
        window.update(dt);
        if (state.race.status === 'finished') break;
        if (state.race.status !== 'racing') continue;
        if (state.race.timer > 900) break;
        for (let k = 0; k < bots.length; k++) {
          const bt = bots[k];
          if (bt.raceState.finished) continue;
          const lg = bt.raceState.leg;
          if (lg > deep[k]) deep[k] = lg;
          const w = getWindAt(bt.x, bt.y).direction;
          const L = acc[k][lg] = acc[k][lg] || { twa: [], dist: 0, t0: state.race.timer, t1: 0 };
          L.t1 = state.race.timer;
          if (it % 6 === 0) L.twa.push(Math.abs(nrm(bt.heading - w)) * 180 / Math.PI);
          if (last[k].lg === lg) L.dist += Math.hypot(bt.x - last[k].x, bt.y - last[k].y);
          last[k] = { x: bt.x, y: bt.y, lg };
        }
      }
      return { acc, deep, land, n: bots.length };
    }, 9100 + i);
    for (const per of r.acc) for (const lg in per) {
      const L = A[lg] = A[lg] || { twa: [], dist: [], time: [] };
      L.twa.push(...per[lg].twa); L.dist.push(per[lg].dist); L.time.push(per[lg].t1 - per[lg].t0);
    }
    for (const dd of r.deep) deepest[dd] = (deepest[dd] || 0) + 1;
    land += r.land; boats += r.n;
  }

  const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const pct = (a, f) => a.length ? 100 * a.filter(f).length / a.length : 0;
  console.log(`\n${venue} — HUMAN (${d.finishTime.toFixed(0)}s, finished) vs FLEET (${RACES} races, ${boats} boats)\n`);
  console.log('        |------------------ HUMAN ------------------|  |------------------ FLEET ------------------|');
  console.log(' leg      time    dist   medTWA   up%    down%          time    dist   medTWA   up%    down%');
  for (const lg of Object.keys(H).sort((a, c) => a - c)) {
    const h = H[lg], a = A[lg];
    const hu = pct(h.twa, x => x < 75), hd = pct(h.twa, x => x > 105);
    const row = `  ${String(lg).padStart(2)}    ${(h.t1 - h.t0).toFixed(1).padStart(6)} ${h.dist.toFixed(0).padStart(7)} ` +
                `${med(h.twa).toFixed(0).padStart(7)} ${hu.toFixed(0).padStart(6)} ${hd.toFixed(0).padStart(7)}    `;
    if (!a) { console.log(row + '      (the fleet never got here)'); continue; }
    const au = pct(a.twa, x => x < 75), ad = pct(a.twa, x => x > 105);
    console.log(row + `   ${med(a.time).toFixed(1).padStart(6)} ${med(a.dist).toFixed(0).padStart(7)} ` +
                `${med(a.twa).toFixed(0).padStart(7)} ${au.toFixed(0).padStart(6)} ${ad.toFixed(0).padStart(7)}`);
  }
  console.log(`\n  furthest leg reached by the fleet: ${JSON.stringify(deepest)}`);
  console.log(`  shoreline collisions: ${(land / boats).toFixed(0)} per boat-race`);
  if (errs.length) console.log('\nERRORS: ' + errs.slice(0, 3).join(' | '));
  await b.close();
})();

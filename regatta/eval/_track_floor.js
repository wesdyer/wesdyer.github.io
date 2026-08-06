// WHERE DOES A BOAT-LEG'S TIME GO? — actual vs two model floors, decomposed.
//
// For every bot in a race, per leg:
//   actual   — the engine's clock between leg transitions
//   speedFloor — time to sail the boat's OWN line at polar speed for the TWA each
//                segment was sailed at (local wind). actual − speedFloor = SPEED
//                deficit: below-polar sailing (luffing, drag, rebuild, ice hits).
//   lineFloor  — polar-VMG time for the leg's straight geometry (mark to mark,
//                VMG-toward pricing, same arithmetic the router's table uses).
//                speedFloor − lineFloor = LINE deficit: extra distance (wander,
//                detours, overstanding, avoidance).
//
// The arctic wander (ratio 3.89) is a LINE number; if the deficit turns out to be
// speed, the wander thread is aimed wrong. Sampling 10 Hz.
//
// Usage: node regatta/eval/_track_floor.js [venue=arctic] [seed=9100] [maxT=700]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const VENUE = A[0] || 'arctic';
const SEED = parseInt(A[1]) || 9100, MAXT = parseInt(A[2]) || 700;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ SEED, MAXT }) => {
    window.evalHarness.seed = SEED;
    window.resetGame(); window.startRace();
    state.course.cutoff = 900;
    const pl = state.boats.find(b => b.isPlayer);
    if (pl) { pl.x = 1e6; pl.y = 1e6; }
    const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const bots = state.boats.filter(b => !b.isPlayer);
    const trk = {};
    bots.forEach(b => trk[b.id] = { lastLeg: b.raceState.leg, legT0: null, px: b.x, py: b.y,
                                    legs: {}, cur: null });
    const legRec = () => ({ dist: 0, floorS: 0, t0: null, t1: null, from: null, to: null });
    const dt = 1 / 60; let it = 0;
    while (it < MAXT * 60) {
      if (state.race.status === 'racing') {
        if (bots.every(b => b.raceState.finished)) break;
        const t = state.race.timer;
        if (it % 6 === 0) {
          for (const b of bots) {
            const k = trk[b.id];
            if (b.raceState.finished) continue;
            const lg = b.raceState.leg;
            if (lg !== k.lastLeg) {
              if (k.cur) { k.cur.t1 = t; k.cur.to = [b.x, b.y]; }
              k.legs[lg] = k.cur = legRec();
              k.cur.t0 = t; k.cur.from = [b.x, b.y];
              k.lastLeg = lg; k.px = b.x; k.py = b.y;
            }
            if (k.cur) {
              const d = Math.hypot(b.x - k.px, b.y - k.py);
              if (d < 500) {
                k.cur.dist += d;
                const w = getWindAt(b.x, b.y);
                const twa = Math.abs(norm(b.heading - w.direction));
                const v = getTargetSpeed(twa, twa > Math.PI * 95 / 180, w.speed);
                if (v > 0.5) k.cur.floorS += d / (v * 15);
              }
            }
            k.px = b.x; k.py = b.y;
          }
        }
      }
      window.update(dt); it++;
    }
    const tEnd = state.race.timer;
    // line floors from leg geometry
    const marks = state.course.marks, route = state.course.route;
    const anchors = [];
    for (let i = 0; i < route.length; i++) anchors.push(CoursePath.anchor(route[i], marks));
    const lineFloor = {};
    for (let i = 1; i < route.length; i++) {
      const A0 = anchors[i - 1], B0 = anchors[i];
      if (!A0 || !B0) continue;
      const d = Math.hypot(B0.x - A0.x, B0.y - A0.y);
      const bearing = Math.atan2(B0.x - A0.x, -(B0.y - A0.y));
      const w = getWindAt((A0.x + B0.x) / 2, (A0.y + B0.y) / 2);
      let best = 0.3;
      for (let deg = 25; deg <= 180; deg += 2) {
        const tr = deg * Math.PI / 180;
        const v = getTargetSpeed(tr, deg > 95, w.speed);
        for (const sgn of [1, -1]) {
          const tw = Math.cos((w.direction + sgn * tr) - bearing) * v;
          if (tw > best) best = tw;
        }
      }
      lineFloor[i] = d / (best * 15);
    }
    const boats = bots.map(b => {
      const k = trk[b.id];
      if (k.cur && !k.cur.t1) { k.cur.t1 = tEnd; }
      const legs = {};
      for (const [lg, r] of Object.entries(k.legs)) {
        if (r.t1 == null) continue;
        legs[lg] = { actual: +(r.t1 - r.t0).toFixed(1), dist: Math.round(r.dist),
                     speedFloor: +r.floorS.toFixed(1), lineFloor: +(lineFloor[lg] || 0).toFixed(1) };
      }
      return { name: b.name, fin: b.raceState.finished ? +b.raceState.finishTime.toFixed(1) : null, legs };
    });
    return { boats, lineFloor };
  }, { SEED, MAXT });

  console.log(`venue=${VENUE} seed=${SEED}`);
  const agg = {};
  for (const b of out.boats) {
    for (const [lg, r] of Object.entries(b.legs)) {
      const e = agg[lg] || (agg[lg] = { n: 0, act: 0, spd: 0, line: 0, dist: 0 });
      e.n++; e.act += r.actual; e.spd += r.speedFloor; e.line += r.lineFloor; e.dist += r.dist;
    }
  }
  console.log('leg |  n | actual | speedFloor | lineFloor | => speedDef | lineDef | dist');
  for (const lg of Object.keys(agg).sort((a, b) => +a - +b)) {
    const e = agg[lg];
    console.log(` ${String(lg).padStart(2)} | ${String(e.n).padStart(2)} | ${(e.act / e.n).toFixed(1).padStart(6)} | ${(e.spd / e.n).toFixed(1).padStart(8)} | ${(e.line / e.n).toFixed(1).padStart(7)} | ${((e.act - e.spd) / e.n).toFixed(1).padStart(9)} | ${((e.spd - e.line) / e.n).toFixed(1).padStart(7)} | ${Math.round(e.dist / e.n)}`);
  }
  console.log('(speedDef = sailing below polar on own line; lineDef = extra line vs straight-geometry VMG floor)');
  await browser.close();
})();

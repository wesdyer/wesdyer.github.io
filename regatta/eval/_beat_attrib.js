// WHERE DOES THE FLEET'S EXTRA DISTANCE ON A BEAT GO?
//
//   node regatta/eval/_beat_attrib.js <traj.json> <leg> [races]
//
// On Bluewater the fleet's whole deficit against a recorded human run is one leg: the beat.
// Same true wind angle (38 vs 40 degrees), 21% more distance sailed, 15 seconds. Angle is
// not the problem, so the distance is going somewhere else. There are only three places:
//
//   TACKS        each one costs distance and speed. Count them.
//   OVERSTANDING sailing past the layline and then cracking off to the mark — pure waste,
//                measured as the fraction of the leg spent beyond the layline.
//   CROSS-TRACK  wandering off the direct line between the leg's endpoints, which is what
//                a boat that chases pressure or dodges traffic does.
//
// All three are reported for the human and the fleet side by side, so the deficit is
// attributed rather than guessed at.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TRAJ = process.argv[2];
const LEG = +(process.argv[3] || 1);
const RACES = +(process.argv[4] || 3);
const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// Layline test: with the mark at M and the wind blowing FROM wd, a boat at P is beyond the
// layline when she could fetch the mark on the other tack — i.e. the bearing to the mark is
// further from the wind than close-hauled, on the side she is on.
const overstood = (px, py, mx, my, wd, beatRad) => {
    const brg = Math.atan2(mx - px, -(my - py));
    return Math.abs(norm(brg - wd)) > beatRad;
};

(async () => {
  const d = JSON.parse(fs.readFileSync(TRAJ, 'utf8'));
  const F = {}; d.format.forEach((n, i) => F[n] = i);
  const venue = d.venue;
  const BEAT = 42 * Math.PI / 180;

  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.update, null, { timeout: 20000 });
  await p.addScriptTag({ content: fs.readFileSync(path.resolve('regatta/eval/eval_harness.js'), 'utf8') });

  // Where does this leg end? Ask the course, not the trajectory.
  const anchor = await p.evaluate((lg) => {
    window.resetGame();
    const a = CoursePath.anchor(state.course.route[lg], state.course.marks);
    const a0 = CoursePath.anchor(state.course.route[lg - 1], state.course.marks);
    return { to: a, from: a0 };
  }, LEG);

  // ── human ───────────────────────────────────────────────────────────────
  const hs = d.samples.filter(x => x[F.phase] === 1 && x[F.leg] === LEG);
  let hDist = 0, hTacks = 0, hOver = 0, hCross = 0, prevTack = null, prev = null;
  for (const s of hs) {
    const tw = norm(s[F.hdg] - s[F.windDir]);
    const tk = tw > 0 ? 1 : -1;
    if (prevTack !== null && tk !== prevTack) hTacks++;
    prevTack = tk;
    if (prev) hDist += Math.hypot(s[F.x] - prev[0], s[F.y] - prev[1]);
    prev = [s[F.x], s[F.y]];
    if (anchor.to && overstood(s[F.x], s[F.y], anchor.to.x, anchor.to.y, s[F.windDir], BEAT)) hOver++;
    if (anchor.to && anchor.from) {
      const dx = anchor.to.x - anchor.from.x, dy = anchor.to.y - anchor.from.y, L = Math.hypot(dx, dy) || 1;
      hCross += Math.abs(((s[F.x] - anchor.from.x) * dy - (s[F.y] - anchor.from.y) * dx) / L);
    }
  }

  // ── fleet ───────────────────────────────────────────────────────────────
  const agg = { dist: [], tacks: [], over: [], cross: [], time: [] };
  for (let i = 0; i < RACES; i++) {
    const r = await p.evaluate(async ([seed, lg, beat]) => {
      window.evalHarness.seed = seed;
      window.resetGame(); window.startRace();
      state.course.cutoff = 900;
      const bots = state.boats.filter(x => !x.isPlayer);
      const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const nrm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      const to = CoursePath.anchor(state.course.route[lg], state.course.marks);
      const from = CoursePath.anchor(state.course.route[lg - 1], state.course.marks);
      const st = bots.map(() => ({ dist: 0, tacks: 0, over: 0, n: 0, cross: 0, t0: null, t1: null, tack: null }));
      const last = bots.map(x => ({ x: x.x, y: x.y }));
      const dt = 1 / 60;
      for (let it = 0; it < 60 * 940; it++) {
        window.update(dt);
        if (state.race.status === 'finished') break;
        if (state.race.status !== 'racing') continue;
        if (state.race.timer > 900) break;
        for (let k = 0; k < bots.length; k++) {
          const bt = bots[k], S = st[k];
          if (bt.raceState.leg !== lg || bt.raceState.finished) { last[k] = { x: bt.x, y: bt.y }; continue; }
          if (S.t0 === null) S.t0 = state.race.timer;
          S.t1 = state.race.timer;
          S.dist += Math.hypot(bt.x - last[k].x, bt.y - last[k].y);
          last[k] = { x: bt.x, y: bt.y };
          const w = getWindAt(bt.x, bt.y).direction;
          const tk = nrm(bt.heading - w) > 0 ? 1 : -1;
          if (S.tack !== null && tk !== S.tack) S.tacks++;
          S.tack = tk;
          if (it % 6 === 0) {
            S.n++;
            if (to) {
              const brg = Math.atan2(to.x - bt.x, -(to.y - bt.y));
              if (Math.abs(nrm(brg - w)) > beat) S.over++;
            }
            if (to && from) {
              const dx = to.x - from.x, dy = to.y - from.y, L = Math.hypot(dx, dy) || 1;
              S.cross += Math.abs(((bt.x - from.x) * dy - (bt.y - from.y) * dx) / L);
            }
          }
        }
      }
      return st.filter(S => S.t0 !== null);
    }, [9100 + i, LEG, BEAT]);
    for (const S of r) {
      agg.dist.push(S.dist); agg.tacks.push(S.tacks); agg.time.push(S.t1 - S.t0);
      agg.over.push(S.n ? 100 * S.over / S.n : 0);
      agg.cross.push(S.n ? S.cross / S.n : 0);
    }
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const hN = hs.length, hOverPct = hN ? 100 * hOver / hN : 0, hCrossAvg = hN ? hCross / hN : 0;
  console.log(`\n${venue} leg ${LEG} — HUMAN vs FLEET (${RACES} races, ${agg.dist.length} boat-legs)\n`);
  console.log(`                        human      fleet(median)`);
  console.log(`  time                 ${(hs.length ? hs[hs.length - 1][F.t] - hs[0][F.t] : 0).toFixed(1).padStart(6)}s    ${med(agg.time).toFixed(1).padStart(6)}s`);
  console.log(`  distance sailed      ${hDist.toFixed(0).padStart(6)}u    ${med(agg.dist).toFixed(0).padStart(6)}u`);
  console.log(`  TACKS                ${String(hTacks).padStart(6)}     ${med(agg.tacks).toFixed(0).padStart(6)}`);
  console.log(`  % of leg OVERSTOOD   ${hOverPct.toFixed(1).padStart(6)}%    ${med(agg.over).toFixed(1).padStart(6)}%`);
  console.log(`  mean cross-track     ${hCrossAvg.toFixed(0).padStart(6)}u    ${med(agg.cross).toFixed(0).padStart(6)}u`);
  if (errs.length) console.log('\nERRORS: ' + errs.slice(0, 3).join(' | '));
  await b.close();
})();

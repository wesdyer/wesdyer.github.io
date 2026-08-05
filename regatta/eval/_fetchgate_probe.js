// DOES THE DOWNWIND FETCH GATE EVER FAIL?
//
//   node regatta/eval/_fetchgate_probe.js [races] [seed0] [treeDir]
//
// `getStrategicHeading` sails straight at the target downwind whenever `absTWA < optTWA`.
// With `optTWA = 180` — which is what the rung-wise optimiser returns at every wind over
// 16 kt, because the polar table has no angle between 150 and 180 — that test can never
// fail, so the boats never VMG-sail downwind at all.
//
// This counts it directly: per downwind frame, the angle the optimiser returned, the angle
// to the target, and whether the boat was fetching or gybe-sailing. Run it against a
// candidate tree to check that a change moved the thing it claims to move.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RACES = +(process.argv[2] || 4);
const SEED0 = +(process.argv[3] || 9300);
const ROOT = process.argv[4] ? path.resolve(process.argv[4]) : path.resolve('.');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })));
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.waitForFunction(() => window.state && window.updateBoat, null, { timeout: 20000 });
  await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

  let fetchN = 0, gybeN = 0, optSum = 0, tgtSum = 0, n = 0, gyMans = 0;
  const optHist = {};
  for (let i = 0; i < RACES; i++) {
    const r = await p.evaluate(async (seed) => {
      window.evalHarness.seed = seed;
      window.resetGame(); window.startRace();
      state.course.cutoff = 900;
      const bots = state.boats.filter(x => !x.isPlayer);
      const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      let fetchN = 0, gybeN = 0, optSum = 0, tgtSum = 0, n = 0, gy = 0;
      const optHist = {};
      const dt = 1 / 60;
      for (let it = 0; it < 60 * 940; it++) {
        window.update(dt);
        if (state.race.status === 'finished') break;
        if (state.race.status !== 'racing') continue;
        if (state.race.timer > 900) break;
        if (it % 12) continue;
        for (const bt of bots) {
          if (bt.raceState.finished) continue;
          const c = bt.controller;
          // The controller does not keep its target on the instance — ask it for one,
          // which is what `update` does at 10 Hz. Read-only: `getNavigationTarget` is a
          // pure function of the boat's state and the course.
          let nav = null;
          try { nav = c && c.getNavigationTarget && c.getNavigationTarget(); } catch (e) {}
          if (!nav) continue;
          const w = getWindAt(bt.x, bt.y);
          // The angle to the target, in the same terms getStrategicHeading uses.
          const ang = Math.atan2(nav.x - bt.x, -(nav.y - bt.y));
          const absTWA = Math.abs(norm(ang - w.direction));
          if (absTWA <= Math.PI * 0.7) continue;               // not its downwind branch
          const opt = getCharacterOptimalVMGAngle('downwind', w.speed, bt.stats);
          // What the code under test would actually use, whatever it is.
          const used = (window.getFineOptimalVMGAngle && window.Swell && window.Swell.active())
            ? getFineOptimalVMGAngle('downwind', w.speed, bt.stats) : opt;
          const key = Math.round(used * 180 / Math.PI / 5) * 5;
          optHist[key] = (optHist[key] || 0) + 1;
          optSum += used * 180 / Math.PI; tgtSum += absTWA * 180 / Math.PI; n++;
          if (absTWA < used) fetchN++; else gybeN++;
        }
      }
      for (const bt of bots) gy += (bt.raceState.legManeuvers || []).reduce((a, c) => a + c, 0);
      return { fetchN, gybeN, optSum, tgtSum, n, optHist, gy };
    }, SEED0 + i);
    fetchN += r.fetchN; gybeN += r.gybeN; optSum += r.optSum; tgtSum += r.tgtSum; n += r.n; gyMans += r.gy;
    for (const k in r.optHist) optHist[k] = (optHist[k] || 0) + r.optHist[k];
  }
  console.log(`\ntree ${ROOT}\n${RACES} ocean races from ${SEED0}, ${n} downwind-branch samples\n`);
  console.log(`  FETCHING straight at the mark   ${(100 * fetchN / Math.max(1, n)).toFixed(1)}%`);
  console.log(`  GYBE-SAILING to the VMG angle   ${(100 * gybeN / Math.max(1, n)).toFixed(1)}%`);
  console.log(`  mean optimum angle used         ${(optSum / Math.max(1, n)).toFixed(1)} deg`);
  console.log(`  mean angle to the target        ${(tgtSum / Math.max(1, n)).toFixed(1)} deg`);
  console.log(`  manoeuvres, all boats           ${gyMans}`);
  console.log('  optimum-angle histogram: ' + Object.keys(optHist).sort((a, c) => a - c)
    .map(k => `${k}:${(100 * optHist[k] / n).toFixed(0)}%`).join('  '));
  if (errs.length) console.log('\nERRORS: ' + errs.slice(0, 4).join(' | '));
  await b.close();
})();

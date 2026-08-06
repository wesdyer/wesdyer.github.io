// IS THE LAYLINE TACK CALLED AND THEN NOT TAKEN?
//
//   node regatta/eval/_layline_veto.js [venue] [leg] [races]
//
// The fleet spends 46-49% of Bluewater's beat past the layline against a human's 37.7%.
// The layline call was found to be aimed at the routing carrot rather than the mark — 1717
// units off, measured — but correcting that bought nothing on a 20-seed bench. So the
// overstanding has another cause, and the cheapest candidate to test is that the tack IS
// decided and then does not happen: `getStrategicHeading` returns the other tack, and
// `applyAvoidance` runs afterwards and is free to deflect it.
//
// This counts, per boat per tick on the beat:
//
//   ARMED     the layline condition holds (the other tack lays the mark, by the geometry —
//             not by the engine's own expression, so a bug in that expression cannot hide)
//   TOOK IT   her tack actually flipped within WINDOW seconds of first arming
//   VETOED    it did not, and she was still on the same tack WINDOW seconds later
//
// A high veto rate means the decision is being overridden downstream and the layline logic
// is not the place to fix this. A low one means she genuinely never decides to tack, and
// the fault is in the decision.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VENUE = process.argv[2] || 'ocean';
const LEG = +(process.argv[3] || 1);
const RACES = +(process.argv[4] || 4);
const WINDOW = 4.0;
const ROOT = process.argv[5] ? path.resolve(process.argv[5]) : path.resolve('.');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.waitForFunction(() => window.state && window.update, null, { timeout: 20000 });
  await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

  let armed = 0, took = 0, vetoed = 0, overStill = 0, deflected = 0, deflN = 0;
  for (let i = 0; i < RACES; i++) {
    const r = await p.evaluate(async ([seed, lg, WIN]) => {
      window.evalHarness.seed = seed;
      window.resetGame(); window.startRace();
      state.course.cutoff = 900;
      const bots = state.boats.filter(x => !x.isPlayer);
      const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const nrm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      const st = bots.map(() => ({ armedAt: null, armedTack: null }));
      let armed = 0, took = 0, vetoed = 0, deflSum = 0, deflN = 0;
      const dt = 1 / 60;
      for (let it = 0; it < 60 * 940; it++) {
        window.update(dt);
        if (state.race.status !== 'racing') continue;
        if (state.race.timer > 900) break;
        if (it % 6) continue;
        const t = state.race.timer;
        for (let k = 0; k < bots.length; k++) {
          const bt = bots[k], S = st[k];
          if (bt.raceState.leg !== lg || bt.raceState.finished) { S.armedAt = null; continue; }
          const e = state.course.route[lg];
          const mk = (e && e.kind === 'round' && e.mark) ? e.mark : null;
          if (!mk) continue;
          const w = getWindAt(bt.x, bt.y);
          const curTack = nrm(bt.heading - w.direction) > 0 ? 1 : -1;
          const optTWA = getCharacterOptimalVMGAngle('upwind', w.speed, bt.stats);
          const brgTwa = nrm(Math.atan2(mk.x - bt.x, -(mk.y - bt.y)) - w.direction);
          // the OTHER tack lays the mark: the bearing is on its side of the wind and at
          // least a close-hauled angle off — pure geometry, no engine expression involved
          const lays = (Math.sign(brgTwa) === -curTack) && (Math.abs(brgTwa) >= optTWA);
          // how far avoidance is currently pushing her off the strategic heading
          const c = bt.controller;
          if (c && c.lastAvoidDeviation != null) { deflSum += Math.abs(c.lastAvoidDeviation); deflN++; }
          if (lays) {
            if (S.armedAt === null) { S.armedAt = t; S.armedTack = curTack; armed++; }
            else if (t - S.armedAt >= WIN) {
              if (curTack !== S.armedTack) took++; else vetoed++;
              S.armedAt = null;
            }
          } else if (S.armedAt !== null) {
            // stopped being past the layline before the window closed — she tacked or
            // the geometry moved. Count a tack change as taking it.
            if (curTack !== S.armedTack) took++; else vetoed++;
            S.armedAt = null;
          }
        }
      }
      return { armed, took, vetoed, deflSum, deflN };
    }, [9100 + i, LEG, WINDOW]);
    armed += r.armed; took += r.took; vetoed += r.vetoed;
    deflected += r.deflSum; deflN += r.deflN;
  }
  const res = took + vetoed;
  console.log(`\n${VENUE} leg ${LEG} — ${RACES} races, ${WINDOW}s window\n`);
  console.log(`  layline ARMED (the other tack lays the mark)   ${armed}`);
  console.log(`  ...she TOOK it   (tack flipped)                ${took}  (${res ? (100 * took / res).toFixed(0) : 0}%)`);
  console.log(`  ...she DID NOT   (still the same tack)         ${vetoed}  (${res ? (100 * vetoed / res).toFixed(0) : 0}%)`);
  console.log(`\n  mean avoidance deflection while on this leg   ${deflN ? (deflected / deflN * 180 / Math.PI).toFixed(1) : '?'} deg`);
  console.log(`\n  A high DID-NOT rate means the decision is overridden downstream and the`);
  console.log(`  layline logic is not the place to fix this.`);
  if (errs.length) console.log('\nERRORS: ' + errs.slice(0, 3).join(' | '));
  await b.close();
})();

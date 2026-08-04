// No-contact foul probe: sample stand-on boats' avoidance deviation and the
// detector's guard states to see where claims die.
// Usage: node regatta/eval/_rules.js [trials] [baseSeed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const NUM = parseInt(A[0]) || 3, BASE = parseInt(A[1]) || 100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ NUM, BASE }) => {
    const c = { ticks: 0, standOnHigh: 0, dev20: 0, dev20_stable: 0, dev20_stable_no16: 0, devHist: [0,0,0,0,0,0], fatMax: 0, fatOver02: 0, threatSet: 0, markRoomBlock: 0, penaltyBlock: 0 };
    // devHist buckets: <5°, 5-10, 10-20, 20-30, 30-45, >45
    for (let i = 0; i < NUM; i++) {
      window.evalHarness.seed = BASE + i;
      window.resetGame(); window.startRace();
      const dt = 1 / 60; let it = 0;
      while (it < 600 * 60) {
        if (state.race.status === 'racing') {
          if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
          if (it % 6 === 0) {
            state.boats.forEach(b => {
              if (b.isPlayer || b.raceState.finished || !b.controller) return;
              const ct = b.controller;
              c.ticks++;
              if (ct.avoidanceRole === 'STAND_ON' && (ct.riskState === 'HIGH' || ct.riskState === 'IMMINENT')) {
                c.standOnHigh++;
                const d = (ct.lastAvoidDeviation || 0) * 180 / Math.PI;
                const bi = d < 5 ? 0 : d < 10 ? 1 : d < 20 ? 2 : d < 30 ? 3 : d < 45 ? 4 : 5;
                c.devHist[bi]++;
                if (ct.threatBoat) c.threatSet++;
                if (ct.threatRowRes && ct.threatBoat && ct.threatRowRes.markRoom === ct.threatBoat.id) c.markRoomBlock++;
                if (ct.threatBoat && ct.threatBoat.raceState.penalty) c.penaltyBlock++;
                if ((ct.forcedAvoidTimer || 0) > c.fatMax) c.fatMax = ct.forcedAvoidTimer;
                if ((ct.forcedAvoidTimer || 0) > 0.2) c.fatOver02++;
                const th = ct.threatBoat;
                const okOuter = th && !th.raceState.finished && !th.raceState.penalty && !(ct.threatRowRes && ct.threatRowRes.markRoom === th.id);
                if (okOuter) {
                  c.okOuter = (c.okOuter||0) + 1;
                  if (ct.roleStableTime > 1.0) {
                    c.okStable = (c.okStable||0) + 1;
                    if (!(ct.rule16Grace > 0)) {
                      c.ok16 = (c.ok16||0) + 1;
                      if ((ct.lastAvoidDeviation||0) > 0.35) c.fireTicks = (c.fireTicks||0) + 1;
                    }
                  }
                }
                if (d > 20) {
                  c.dev20++;
                  if (ct.roleStableTime > 1.5) {
                    c.dev20_stable++;
                    if (!(ct.rule16Grace > 0)) c.dev20_stable_no16++;
                  }
                }
              }
            });
          }
        }
        window.update(dt); it++;
      }
    }
    return c;
  }, { NUM, BASE });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();

// Sweep spawn distBack (and optional scatter) -> start/penalty/race metrics.
// Usage: node regatta/eval/_spawnsweep.js [trials] [baseSeed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const NUM = parseInt(A[0]) || 30, BASE = parseInt(A[1]) || 100;
const CONFIGS = [
  { width: 550 },   // current baseline
  { width: 750 },
  { width: 950 },
  { width: 1150 },
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ NUM, BASE, CONFIGS }) => {
    const results = [];
    for (const cfg of CONFIGS) {
      window.__START = Object.assign({}, window.__START, cfg);
      const starts = [], races = [], pens = [], collB = [], collM = [];
      let dns = 0, nb = 0;
      for (let i = 0; i < NUM; i++) {
        window.evalHarness.seed = BASE + i;
        window.resetGame(); window.startRace();
        const startT = {}, cB = {}, cM = {}; const oh = window.onRaceEvent;
        window.onRaceEvent = (t, d) => {
          if (t === 'leg_complete' && d.leg === 0 && startT[d.boat.id] == null) startT[d.boat.id] = state.race.timer;
          if (t === 'collision_boat' && d.boat) cB[d.boat.id] = (cB[d.boat.id] || 0) + 1;
          if (t === 'collision_mark' && d.boat) cM[d.boat.id] = (cM[d.boat.id] || 0) + 1;
          if (oh) oh(t, d);
        };
        // Start-focused: stop once every non-player boat has cleared leg 0 (started),
        // or at 150s. We only measure start + early penalties/collisions here; full
        // race-time is validated separately on the chosen config.
        const dt = 1 / 60; let it = 0;
        while (it < 160 * 60) {
          if (state.race.status === 'racing') {
            if (state.race.timer > 150) break;
            if (state.boats.every(b => b.isPlayer || b.raceState.leg > 0 || b.raceState.finished)) break;
          }
          window.update(dt); it++;
        }
        window.onRaceEvent = oh;
        state.boats.forEach(b => {
          if (b.isPlayer) return;
          nb++;
          const st = startT[b.id];
          if (st == null) { dns++; starts.push(600); } else starts.push(st);
          if (b.raceState.finishTime != null) races.push(b.raceState.finishTime);
          pens.push(b.raceState.totalPenalties || 0);
          collB.push(cB[b.id] || 0);
          collM.push(cM[b.id] || 0);
        });
      }
      const sorted = starts.slice().sort((a, b) => a - b);
      const q = p => sorted[Math.floor(p * (sorted.length - 1))];
      const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      results.push({
        cfg, n: nb,
        sMean: mean(starts), sMed: q(0.5), sP90: q(0.9), sMax: sorted[sorted.length - 1],
        rMean: races.length ? mean(races) : null,
        pen: mean(pens), cB: mean(collB), cM: mean(collM), dns: 100 * dns / nb,
      });
    }
    return results;
  }, { NUM, BASE, CONFIGS });

  const f = (x, d = 2) => x == null ? '-' : x.toFixed(d);
  console.log(`width sweep, ${NUM} trials, seed ${BASE} (start capped 150s)\n`);
  console.log('width | startMean  med   p90    max  | pen   | dns%');
  for (const r of out) {
    console.log(`${String(r.cfg.width).padStart(5)} | ${f(r.sMean).padStart(8)} ${f(r.sMed,1).padStart(5)} ${f(r.sP90,1).padStart(6)} ${f(r.sMax,0).padStart(5)} | ${f(r.pen)} | ${f(r.dns)}`);
  }
  await browser.close();
})();

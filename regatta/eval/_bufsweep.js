// Sweep start-timing tunables (window.__START: buf/stage) -> start metrics.
// Usage: node regatta/eval/_bufsweep.js [trials] [baseSeed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const NUM = parseInt(A[0]) || 25, BASE = parseInt(A[1]) || 100;
const CONFIGS = [
  { label: 'base(buf1)', st: {} },
  { label: 'buf0.5', st: { buf: 0.5 } },
  { label: 'buf0', st: { buf: 0.0 } },
  { label: 'ocsback55', st: { ocsback: 55 } },
  { label: 'buf0.5/ocs55', st: { buf: 0.5, ocsback: 55 } },
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ NUM, BASE, CONFIGS }) => {
    const results = [];
    for (const cfg of CONFIGS) {
      window.__START = Object.assign({}, cfg.st);
      const starts = [], pens = [], collB = [], collM = [];
      let dns = 0, nb = 0, ocsCount = 0;
      for (let i = 0; i < NUM; i++) {
        window.evalHarness.seed = BASE + i;
        window.resetGame(); window.startRace();
        const startT = {}, cB = {}, cM = {}, wasOcs = {};
        const oh = window.onRaceEvent;
        window.onRaceEvent = (t, d) => {
          if (t === 'leg_complete' && d.leg === 0 && startT[d.boat.id] == null) startT[d.boat.id] = state.race.timer;
          if (t === 'collision_boat' && d.boat) cB[d.boat.id] = (cB[d.boat.id] || 0) + 1;
          if (t === 'collision_mark' && d.boat) cM[d.boat.id] = (cM[d.boat.id] || 0) + 1;
          if (oh) oh(t, d);
        };
        const dt = 1 / 60; let it = 0;
        while (it < 160 * 60) {
          if (state.race.status === 'racing') {
            if (state.race.timer > 150) break;
            if (state.boats.every(b => b.isPlayer || b.raceState.leg > 0 || b.raceState.finished)) break;
            state.boats.forEach(b => { if (!b.isPlayer && b.raceState.ocs) wasOcs[b.id] = 1; });
          }
          window.update(dt); it++;
        }
        window.onRaceEvent = oh;
        state.boats.forEach(b => {
          if (b.isPlayer) return;
          nb++;
          const st = startT[b.id];
          if (st == null) { dns++; starts.push(600); } else starts.push(st);
          pens.push(b.raceState.totalPenalties || 0);
          collB.push(cB[b.id] || 0);
          collM.push(cM[b.id] || 0);
          if (wasOcs[b.id]) ocsCount++;
        });
      }
      const sorted = starts.slice().sort((a, b) => a - b);
      const q = p => sorted[Math.floor(p * (sorted.length - 1))];
      const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      results.push({
        label: cfg.label, n: nb,
        sMean: mean(starts), sMed: q(0.5), sP90: q(0.9), sMax: sorted[sorted.length - 1],
        pen: mean(pens), cB: mean(collB), cM: mean(collM),
        ocs: 100 * ocsCount / nb, dns: 100 * dns / nb,
      });
    }
    return results;
  }, { NUM, BASE, CONFIGS });

  const f = (x, d = 2) => x == null ? '-' : x.toFixed(d);
  console.log(`start-timing sweep, ${NUM} trials, seed ${BASE} (capped 150s)\n`);
  console.log('config'.padEnd(14) + '| startMean  med   p90    max  | pen   ocs%  | dns%');
  for (const r of out) {
    console.log(r.label.padEnd(14) + `| ${f(r.sMean).padStart(8)} ${f(r.sMed, 1).padStart(5)} ${f(r.sP90, 1).padStart(6)} ${f(r.sMax, 0).padStart(5)} | ${f(r.pen)} ${f(r.ocs, 1).padStart(5)} | ${f(r.dns)}`);
  }
  await browser.close();
})();

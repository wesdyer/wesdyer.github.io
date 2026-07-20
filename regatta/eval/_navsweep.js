// Sweep gate-approach nav configs over full races.
// Usage: node regatta/eval/_navsweep.js [trials] [baseSeed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const NUM = parseInt(A[0]) || 12, BASE = parseInt(A[1]) || 100;
const CONFIGS = [
  { label: 'turn0(base)', nav: {} },
  { label: 'turn80p', nav: { roundTurn: 80 } },
  { label: 'turn140p', nav: { roundTurn: 140 } },
  { label: 'turn200p', nav: { roundTurn: 200 } },
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  console.log('config'.padEnd(16) + 'race'.padEnd(8) + 'med'.padEnd(8) + 'max'.padEnd(8) + 'start'.padEnd(7) + 'pen'.padEnd(6) + 'cM'.padEnd(6) + 'cB'.padEnd(6) + 'rnd1'.padEnd(6) + 'rnd2'.padEnd(6) + 'rnd3'.padEnd(6) + 'dnf');
  for (const cfg of CONFIGS) {
    const out = await page.evaluate(({ NUM, BASE, nav }) => {
      window.__NAV = nav;
      const finish = [], starts = []; let pen = 0, cM = 0, cB = 0, dnf = 0, n = 0;
      const rounds = { 1: [], 2: [], 3: [] };
      for (let i = 0; i < NUM; i++) {
        window.evalHarness.seed = BASE + i;
        window.resetGame(); window.startRace();
        const trk = {};
        state.boats.forEach(b => { if (!b.isPlayer) trk[b.id] = { crossT: null, wasR: false }; });
        const oh = window.onRaceEvent;
        window.onRaceEvent = (t, d) => {
          if (d && d.boat && !d.boat.isPlayer) {
            if (t === 'penalty') pen++;
            if (t === 'collision_mark') cM++;
            if (t === 'collision_boat') cB++;
            if (t === 'start_cross' || (t === 'leg_complete' && d.leg === 0)) starts.push(state.race.timer);
            if (t === 'leg_complete' && d.leg >= 1 && d.leg <= 3 && trk[d.boat.id]) {
              const k = trk[d.boat.id];
              if (k.crossT != null) rounds[d.leg].push(state.race.timer - k.crossT);
              k.crossT = null; k.wasR = false;
            }
          }
          if (oh) oh(t, d);
        };
        const dt = 1 / 60; let it = 0;
        while (it < 600 * 60) {
          if (state.race.status === 'racing') {
            if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
            state.boats.forEach(b => {
              if (b.isPlayer || !trk[b.id]) return;
              const k = trk[b.id];
              if (b.raceState.isRounding && !k.wasR) { k.wasR = true; if (k.crossT == null) k.crossT = state.race.timer; }
              else if (!b.raceState.isRounding && k.wasR) k.wasR = false;
            });
          }
          window.update(dt); it++;
        }
        window.onRaceEvent = oh;
        state.boats.forEach(b => {
          if (b.isPlayer) return; n++;
          if (b.raceState.finished) finish.push(b.raceState.finishTime); else dnf++;
        });
      }
      return { finish, starts, pen, cM, cB, dnf, n, rounds };
    }, { NUM, BASE, nav: cfg.nav });
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    const med = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const mx = a => a.length ? Math.max(...a) : 0;
    console.log(cfg.label.padEnd(16) + mean(out.finish).toFixed(1).padEnd(8) + med(out.finish).toFixed(1).padEnd(8) + mx(out.finish).toFixed(0).padEnd(8) +
      mean(out.starts).toFixed(1).padEnd(7) + (out.pen / (out.n)).toFixed(2).padEnd(6) + (out.cM / out.n).toFixed(2).padEnd(6) + (out.cB / out.n).toFixed(2).padEnd(6) +
      mean(out.rounds[1]).toFixed(1).padEnd(6) + mean(out.rounds[2]).toFixed(1).padEnd(6) + mean(out.rounds[3]).toFixed(1).padEnd(6) + out.dnf);
  }
  await browser.close();
})();

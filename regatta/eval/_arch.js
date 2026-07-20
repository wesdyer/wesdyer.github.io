// Archetype balance eval: run races, group per-boat outcomes by archetype.
// Reports finish time (mean/med/p90), placement, start, penalties, variance.
// Usage: node regatta/eval/_arch.js [trials] [baseSeed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const NUM = parseInt(A[0]) || 30, BASE = parseInt(A[1]) || 100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ NUM, BASE }) => {
    const rows = []; // {arch, name, finish, place, start, pen, dnf}
    for (let i = 0; i < NUM; i++) {
      window.evalHarness.seed = BASE + i;
      window.resetGame(); window.startRace();
      const startT = {}; let pen = {};
      const oh = window.onRaceEvent;
      window.onRaceEvent = (t, d) => {
        if (d && d.boat && !d.boat.isPlayer) {
          if (t === 'leg_complete' && d.leg === 0 && startT[d.boat.id] == null) startT[d.boat.id] = state.race.timer;
          if (t === 'penalty') pen[d.boat.id] = (pen[d.boat.id] || 0) + 1;
        }
        if (oh) oh(t, d);
      };
      const dt = 1 / 60; let it = 0;
      while (it < 600 * 60) {
        if (state.race.status === 'racing' && state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
        window.update(dt); it++;
      }
      window.onRaceEvent = oh;
      // placement by finish time among AI
      const finishers = state.boats.filter(b => !b.isPlayer && b.raceState.finished)
        .sort((a, b) => a.raceState.finishTime - b.raceState.finishTime);
      const placeOf = {}; finishers.forEach((b, idx) => placeOf[b.id] = idx + 1);
      state.boats.forEach(b => {
        if (b.isPlayer) return;
        rows.push({
          arch: b.archetype || 'none', name: b.name,
          finish: b.raceState.finished ? b.raceState.finishTime : null,
          place: placeOf[b.id] || 10,
          start: startT[b.id] != null ? startT[b.id] : null,
          pen: pen[b.id] || 0,
          dnf: b.raceState.finished ? 0 : 1,
        });
      });
    }
    return rows;
  }, { NUM, BASE });

  const groups = {};
  for (const r of out) (groups[r.arch] = groups[r.arch] || []).push(r);
  const stat = (a) => {
    const s = [...a].sort((x, y) => x - y);
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / a.length);
    return { mean, med: s[Math.floor(s.length / 2)], p90: s[Math.floor(0.9 * (s.length - 1))], sd };
  };
  console.log('archetype'.padEnd(11) + 'n'.padEnd(5) + 'finish'.padEnd(8) + 'med'.padEnd(8) + 'sd'.padEnd(7) + 'place'.padEnd(7) + 'start'.padEnd(7) + 'pen'.padEnd(6) + 'dnf');
  const rowsOut = Object.entries(groups).map(([arch, rs]) => {
    const fin = rs.filter(r => r.finish != null).map(r => r.finish);
    const f = fin.length ? stat(fin) : { mean: 0, med: 0, p90: 0, sd: 0 };
    const starts = rs.filter(r => r.start != null).map(r => r.start);
    const sMean = starts.length ? starts.reduce((a, b) => a + b, 0) / starts.length : 0;
    return { arch, n: rs.length, f, place: rs.reduce((a, r) => a + r.place, 0) / rs.length, sMean, pen: rs.reduce((a, r) => a + r.pen, 0) / rs.length, dnf: rs.reduce((a, r) => a + r.dnf, 0) };
  }).sort((a, b) => a.f.mean - b.f.mean);
  for (const r of rowsOut) {
    console.log(r.arch.padEnd(11) + String(r.n).padEnd(5) + r.f.mean.toFixed(1).padEnd(8) + r.f.med.toFixed(1).padEnd(8) + r.f.sd.toFixed(1).padEnd(7) + r.place.toFixed(2).padEnd(7) + r.sMean.toFixed(1).padEnd(7) + r.pen.toFixed(2).padEnd(6) + r.dnf);
  }
  await browser.close();
})();

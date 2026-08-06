// Where does the seed-9212 lake DNF pin, and is that water supersample-admitted?
// Runs the race, finds the boat with the most land contact, logs its position
// over time + whether its cell / neighbours are centre-admitted or subsample-only.
//   node _pin_9212.js <tree> [seed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeFINAL');
const SEED = parseInt(process.argv[3] || '9212');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' })));
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  const out = await p.evaluate(async (seed) => {
    window.evalHarness.seed = seed;
    window.resetGame(); window.startRace();
    state.course.cutoff = 900;
    const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
    const landC = new Map();
    const inner = window.onRaceEvent;
    window.onRaceEvent = (ty, d) => {
      try { if (ty === 'collision' && d && d.boat && !d.boat.isPlayer && (d.kind === 'land' || d.with === 'land' || d.category === 'land'))
        landC.set(d.boat, (landC.get(d.boat) || 0) + 1); } catch (e) {}
      if (inner) try { inner(ty, d); } catch (e) {}
    };
    const track = new Map();
    const dt = 1 / 60;
    for (let it = 0; it < 60 * 940; it++) {
      window.update(dt);
      if (state.race.status === 'finished') break;
      if (it % 600 === 0 && state.race.status === 'racing') {
        for (const bt of state.boats) {
          if (bt.isPlayer) continue;
          if (!track.has(bt)) track.set(bt, []);
          track.get(bt).push([Math.round(state.race.timer), Math.round(bt.x), Math.round(bt.y),
                              +(bt.speed || 0).toFixed(2), bt.raceState.leg]);
        }
      }
    }
    // the boat with least progress / not finished
    const stuck = state.boats.filter(bb => !bb.isPlayer && !bb.raceState.finished);
    const pick = stuck.length ? stuck : [...landC.entries()].sort((a, bb) => bb[1] - a[1]).map(e => e[0]).slice(0, 1);
    const g = state.course.botGrid;
    const res = [];
    for (const bt of pick) {
      const tr = (track.get(bt) || []).slice(-14);
      const c = g.cell(bt.x, bt.y);
      // centre-admission test at final pin position and neighbours
      const around = [];
      for (let dj = -1; dj <= 1; dj++) { const row = [];
        for (let di = -1; di <= 1; di++) row.push(g.at(c[0] + di, c[1] + dj) ? 1 : 0);
        around.push(row); }
      res.push({ name: bt.name, leg: bt.raceState.leg, x: Math.round(bt.x), y: Math.round(bt.y),
                 speed: +(bt.speed || 0).toFixed(2), land: landC.get(bt) || 0, tail: tr, navAround: around });
    }
    return { unfinished: stuck.length, res };
  }, SEED);
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();

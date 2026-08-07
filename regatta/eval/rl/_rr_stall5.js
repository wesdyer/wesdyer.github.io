// Where do redrock's remaining non-finishers stall? 4 seeds, final positions +
// leg + speed of every unfinished boat at cutoff, plus 60s-interval tracks of
// the slowest.   node _rr_stall5.js [seed0] [trials]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const SEED0 = parseInt(process.argv[2] || '9400');
const TRIALS = parseInt(process.argv[3] || '4');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' })));
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  for (let i = 0; i < TRIALS; i++) {
    const out = await p.evaluate(async (seed) => {
      window.evalHarness.seed = seed;
      window.resetGame(); window.startRace();
      state.course.cutoff = 900;
      const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const track = new Map();
      const dt = 1 / 60;
      for (let it = 0; it < 60 * 905; it++) {
        window.update(dt);
        if (state.race.status === 'finished') break;
        if (it % 3600 === 0 && state.race.status === 'racing') {
          for (const bt of state.boats) {
            if (bt.isPlayer || bt.raceState.finished) continue;
            if (!track.has(bt)) track.set(bt, []);
            track.get(bt).push([Math.round(state.race.timer), bt.raceState.leg,
                                Math.round(bt.x), Math.round(bt.y), +(bt.speed||0).toFixed(1)]);
          }
        }
      }
      return state.boats.filter(bt => !bt.isPlayer && !bt.raceState.finished)
        .map(bt => ({ n: bt.name, leg: bt.raceState.leg, x: Math.round(bt.x), y: Math.round(bt.y),
                      kt: +((bt.speed||0)*4).toFixed(2), pen: bt.raceState.penalty ? 1 : 0,
                      tail: (track.get(bt)||[]).slice(-5) }));
    }, SEED0 + i);
    console.log('seed', SEED0 + i, JSON.stringify(out));
  }
  await b.close();
})();

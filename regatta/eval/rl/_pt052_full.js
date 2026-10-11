// PT-052 — run from the repo root: node regatta/eval/rl/_pt052_full.js [venues] [seed]
// You finish at your median time; the nine bots race on to complete results. Same seed twice: effects
// skipped vs not, so the finish times must match to the frame. Wall time = how long full results take.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const HUMAN = { redrock: 202.1, arctic: 197.8, flats: 172.7, glowtide: 179.3, bay: 229.6, river: 194, volcanic: 198.3, ocean: 201.8, otter: 201.4, lake: 194.8, lagoon: 174.7, swamp: 173.3, seatrials: 185.7 };
const VENUES = (process.argv[2] || Object.keys(HUMAN).join(',')).split(','), SEED = +process.argv[3] || 9400;
const harness = fs.readFileSync(path.resolve('regatta/eval/eval_harness.js'), 'utf8');
(async () => { const b = await chromium.launch();
  const run = async (v, skip) => {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && state.boats.length > 0);
    const r = await p.evaluate(({ v, skip, T, seed }) => { state.paused = true; settings.venue = v; let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; resetGame(); startRace();
      const me = state.boats[0];
      // you sail the race as a bot until your median time, then you are home
      me.controller = new BotController(me);
      while (!(state.race.status === 'racing' && state.race.timer >= T) && !me.raceState.finished) { me.controller.update(1 / 60); const d = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(1 / 60); }
      state.keys.ArrowLeft = state.keys.ArrowRight = false; me.controller = null;
      if (!me.raceState.finished) { me.raceState.finished = true; me.raceState.finishTime = state.race.timer; }
      const T0 = state.race.timer, out0 = state.boats.filter(b => !b.raceState.finished).length;
      simFxSkip = skip; const w0 = performance.now();
      while (state.boats.some(b => !b.raceState.finished) && state.race.status !== 'finished') update(1 / 60);
      const wall = (performance.now() - w0) / 1000; simFxSkip = false;
      return { out0, wall, raced: state.race.timer - T0, res: state.boats.map(b => b.name + ':' + (b.raceState.resultStatus || b.raceState.finishTime.toFixed(3))).join(' ') };
    }, { v, skip, T: HUMAN[v], seed: SEED });
    await p.close(); return r;
  };
  for (const v of VENUES) {
    const A = await run(v, true), B = await run(v, false);
    console.log(`${v.padEnd(9)} you home at ${HUMAN[v]}s, ${A.out0} still out, last home +${A.raced.toFixed(0)}s | full results in ${A.wall.toFixed(1)} s wall skipped vs ${B.wall.toFixed(1)} s unskipped (${(A.raced / A.wall).toFixed(0)}x / ${(B.raced / B.wall).toFixed(0)}x) | results ${A.res === B.res ? 'IDENTICAL' : 'DIFFER'}`);
    if (A.res !== B.res) console.log('   A ' + A.res + '\n   B ' + B.res);
  }
  await b.close(); })();

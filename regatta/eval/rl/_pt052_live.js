// PT-052 — the live loop: node regatta/eval/rl/_pt052_live.js [venues] (run from the repo root)
// The live loop: you home at your median, results overlay up, rAF running. Wall time until the status says
// everyone is in, the frame rate meanwhile, the overlay's own text, and whether the replay log reaches every finish.
const { chromium } = require('playwright'); const path = require('path');
const HUMAN = { redrock: 202.1, arctic: 197.8, flats: 172.7, glowtide: 179.3, bay: 229.6, river: 194, volcanic: 198.3, ocean: 201.8, otter: 201.4, lake: 194.8, lagoon: 174.7, swamp: 173.3, seatrials: 185.7 };
const VENUES = (process.argv[2] || Object.keys(HUMAN).join(',')).split(',');
(async () => { const b = await chromium.launch();
  for (const v of VENUES) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, musicEnabled: false, soundEnabled: false })); }, v);
    await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && state.boats.length > 0);
    const r0 = await p.evaluate((T) => { state.paused = true; resetGame(); startRace(); const me = state.boats[0]; me.controller = new BotController(me);
      while (!(state.race.status === 'racing' && state.race.timer >= T) && !me.raceState.finished) { me.controller.update(1 / 60); const d = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(1 / 60); }
      state.keys.ArrowLeft = state.keys.ArrowRight = false; me.controller = null;
      if (!me.raceState.finished) { me.raceState.finished = true; me.raceState.finishTime = state.race.timer; }
      const out = state.boats.filter(b => !b.raceState.finished).length;
      showResults(); state.paused = false; window.__fr = 0; window.__t0 = performance.now(); window.__done = null;
      const f = () => { window.__fr++; if (!window.__done && !state.boats.some(b => !b.raceState.finished)) window.__done = performance.now(); requestAnimationFrame(f); }; f();
      return { out, T0: state.race.timer }; }, HUMAN[v]);
    await p.waitForFunction(() => window.__done, null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({ wall: window.__done ? (window.__done - window.__t0) / 1000 : null, fps: window.__fr / ((performance.now() - window.__t0) / 1000),
      status: (document.getElementById('res-status') || {}).textContent, raced: state.race.timer,
      logEnd: (window._raceMap && _raceMap.L && _raceMap.L.boats) ? 'boats ' + _raceMap.L.boats.length : (window.RaceLog ? 'racelog' : '?') }));
    console.log(`${v.padEnd(9)} ${r0.out} out at ${HUMAN[v]}s -> all home in ${r.wall == null ? 'TIMEOUT' : r.wall.toFixed(1) + ' s'} wall (${r.fps.toFixed(0)} fps) | race clock ${r.raced.toFixed(0)}s | "${r.status}" | ${r.logEnd} | errors ${errs.length ? errs[0] : 0}`);
    await p.close();
  }
  await b.close(); })();

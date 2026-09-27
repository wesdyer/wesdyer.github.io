// Probe: how wide the fleet sails at Clubhouse Point — each bot's furthest left and right (x) in a race.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') }); await p.waitForTimeout(400);
  const all = [];
  for (let seed = 1; seed <= 3; seed++) {
    const r = await p.evaluate((seed) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' })); window.evalHarness.seed = seed; resetGame(); startRace();
      const bots = state.boats.filter(x => !x.isPlayer), pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6; const lo = bots.map(() => 1e9), hi = bots.map(() => -1e9);
      for (let it = 0; it < 60 * 400; it++) { update(1 / 60); if (state.race.status !== 'racing') continue; bots.forEach((bt, k) => { if (bt.raceState.finished) return; lo[k] = Math.min(lo[k], bt.x); hi[k] = Math.max(hi[k], bt.x); }); if (bots.every(x => x.raceState.finished)) break; }
      return bots.map((bt, k) => [Math.round(lo[k]), Math.round(hi[k]), bt.raceState.finished ? Math.round(bt.raceState.finishTime) : null]); }, seed);
    all.push(...r);
  }
  const both = (d) => all.filter(([l, h]) => l < -d && h > d).length;
  console.log('boats', all.length, 'min x range', Math.min(...all.map(a => a[0])), 'max', Math.max(...all.map(a => a[1])));
  for (const d of [2000, 2500, 3000, 3500]) console.log(`reached both sides beyond ±${d}: ${both(d)} of ${all.length}`);
  await b.close(); })();

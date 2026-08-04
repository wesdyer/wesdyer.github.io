// How wide is a fleet, actually? The results ruler has to pick a scale, and the choice is
// only defensible against real finish gaps: too narrow and half the fleet pins at the end,
// too wide and the boats that raced each other pile up in the first few pixels.
//
//   node regatta/eval/_gapspread.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);

  const all = [];
  for (const venue of ['lagoon', 'seatrials', 'bay', 'arctic']) {
    for (const seed of [100, 200, 300]) {
      const gaps = await p.evaluate(([venue, seed]) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue, character: 'Muninn', musicEnabled: false, soundEnabled: false }));
        let s = seed;
        Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        resetGame(); startRace();
        const me = state.boats[0]; me.controller = new BotController(me);
        let t = 0;
        while (t < 900 && state.race.status !== 'finished') {
          me.controller.update(1 / 30);
          const d = normalizeAngle(me.controller.targetHeading - me.heading);
          state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
          update(1 / 30); t += 1 / 30;
        }
        const fin = state.boats.filter(b => b.raceState.finished && !b.raceState.resultStatus)
          .map(b => b.raceState.finishTime).sort((a, b) => a - b);
        return fin.map(t => +(t - fin[0]).toFixed(1));
      }, [venue, seed]);
      all.push(gaps);
      console.log(`${venue.padEnd(10)} seed ${seed}  ${gaps.join('  ')}`);
    }
  }
  // What each candidate scale would cost: how many boats pin at the end of the ruler.
  console.log('\nboats pinned (of all finishers, %d races):' % 0 === 0 ? '' : '');
  for (const scale of [20, 30, 45, 60, 90]) {
    const pinned = all.flat().filter(g => g > scale).length;
    const total = all.flat().length;
    const p8 = all.map(g => g[Math.min(7, g.length - 1)] || 0);
    console.log(`  ${String(scale).padStart(3)}s: ${pinned}/${total} pinned (${(100 * pinned / total).toFixed(0)}%)`);
  }
  const eighth = all.map(g => g[Math.min(7, g.length - 1)] || 0).sort((a, b) => a - b);
  const last = all.map(g => g[g.length - 1] || 0).sort((a, b) => a - b);
  console.log(`\n8th-place gap across races: ${eighth.join(' ')}`);
  console.log(`last-place gap across races: ${last.join(' ')}`);
  console.log(errs.length ? 'ERRORS ' + errs.slice(0, 3) : 'no page errors');
  await b.close();
})();

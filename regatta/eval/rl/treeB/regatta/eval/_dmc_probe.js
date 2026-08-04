const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  for (const v of ['arctic', 'bay']) {
    const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2500);
    console.log(v, JSON.stringify(await p.evaluate(() => {
      startRace();
      while (state.race.status === 'prestart') update(1 / 60);
      const boat = state.boats[1];
      const samples = []; let last = null, regressions = 0, n = 0;
      for (let i = 0; i < 240 * 60; i++) {
        update(1 / 60);
        if (i % 60 === 0) {
          const g = getBoatProgress(boat);
          if (last !== null) { n++; if (g < last - 1) regressions++; }
          if (i % 1800 === 0) samples.push({ s: Math.round(i / 60), leg: boat.raceState.leg, prog: Math.round(g) });
          last = g;
        }
        if (boat.raceState.finished) break;
      }
      return { roles: (state.course.route || []).map(e => e.role || e.kind),
               samplesEvery30s: samples, secondsChecked: n,
               secondsBackwards: regressions, pctBackwards: +(100 * regressions / Math.max(1, n)).toFixed(1) };
    })));
    await p.close();
  }
  await b.close();
})();

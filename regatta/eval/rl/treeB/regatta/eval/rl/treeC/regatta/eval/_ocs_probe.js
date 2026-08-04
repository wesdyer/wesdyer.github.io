// Does the hull-based line change how many boats are OCS at the gun? RRS says any part of
// the hull over the line is OCS, but the AI's start approach was tuned against a centre.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(2500);
  console.log(JSON.stringify(await p.evaluate(async () => {
    let ocsTotal = 0, races = 0, lateStart = 0, boats = 0;
    for (let seed = 0; seed < 12; seed++) {
      let s = 1000 + seed * 7919;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame(); startRace();
      while (state.race.status === 'prestart') update(1 / 60);
      // 20 s after the gun: who is still OCS, and who has not started?
      for (let i = 0; i < 20 * 60; i++) update(1 / 60);
      races++;
      for (const bt of state.boats) {
        boats++;
        if (bt.raceState.ocs) ocsTotal++;
        if (bt.raceState.leg === 0) lateStart++;
      }
    }
    return { races, boats, stillOCSat20s: ocsTotal, notStartedAt20s: lateStart };
  }), null, 1));
  await b.close();
})();

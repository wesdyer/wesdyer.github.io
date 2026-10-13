// PT-001 end to end: a Time Trial at Lighthouse Cove, parked in a ship for 3 s (one grind = 1 hit), sailed
// clear, then back in (2). Run from the repo: node regatta/eval/rl/_tt_ship_hits.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///Users/wesdyer/Desktop/wesdyer.github.io/regatta/index.html'); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    TimeTrial.active = true; selectVenue('bay'); resetGame(); state.boats.length = 1; startRace();
    while (state.race.status === 'prestart') update(1 / 30);
    for (let i = 0; i < 30; i++) update(1 / 30);
    const v = (state.traffic || []).find(x => x.active !== false && x.x != null) || state.traffic[0];
    const me = state.boats[0], log = [];
    // park in the ship for 3 s (one grind), sail clear 5 s, park again (a second hit)
    const park = (s) => { for (let i = 0; i < s * 30; i++) { me.x = v.x; me.y = v.y; update(1 / 30); } };
    park(3); const a = Object.values(TimeTrial.hitsByLeg()).reduce((x, y) => x + y, 0);
    for (let i = 0; i < 150; i++) { me.x = v.x + 3000; me.y = v.y + 3000; update(1 / 30); }
    park(1); const b2 = Object.values(TimeTrial.hitsByLeg()).reduce((x, y) => x + y, 0);
    return { vessel: v && v.id, afterFirst: a, afterSecond: b2, solo: TimeTrial.solo() };
  });
  console.log(JSON.stringify(r)); await b.close();
})();

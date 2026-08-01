// How often does overpoweredFactor actually bite during real racing, and how hard?
// Instruments the function itself rather than sampling the wind field, because
// effectiveWind AMPLIFIES gusts for a high-pressure boat and raw wind understates it.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  const r = await p.evaluate(async () => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
    const real = window.overpoweredFactor;
    let calls = 0, hits = 0, sum = 0, worst = 1, peakWind = 0;
    window.overpoweredFactor = (stats, wind) => {
      const f = real(stats, wind);
      calls++; peakWind = Math.max(peakWind, wind);
      if (f < 1) { hits++; sum += (1 - f); worst = Math.min(worst, f); }
      return f;
    };
    const bases = [];
    for (let race = 0; race < 12; race++) {
      let s = 100 + race * 6151;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame();
      bases.push(+state.wind.baseSpeed.toFixed(1));
      state.race.status = 'racing';
      for (let f = 0; f < 900; f++) update(1 / 60);
    }
    return { calls, hits, pct: +(100 * hits / calls).toFixed(2),
             avgCost: hits ? +(100 * sum / hits).toFixed(1) : 0,
             worst: +(100 * (1 - worst)).toFixed(1), peakWind: +peakWind.toFixed(1),
             bases };
  });
  console.log(`seatrials, 12 races x 15s of sim, boat-frames sampled: ${r.calls}`);
  console.log(`base winds rolled: ${r.bases.join(', ')}`);
  console.log(`\noverpowered bit on ${r.pct}% of boat-frames (${r.hits})`);
  console.log(`peak effectiveWind seen: ${r.peakWind} kt`);
  console.log(`average speed cost when it bit: ${r.avgCost}%   worst single: ${r.worst}%`);
  await b.close();
})();

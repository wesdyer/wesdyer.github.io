// The water must look identical after the palettes moved into the documents.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  const out = await p.evaluate(() => {
    const r = {};
    for (const k of Object.keys(VENUES)) {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: k }));
      let s = 90210;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame();
      r[k] = { base: WATER_CONFIG.baseColor, deep: WATER_CONFIG.deepColor,
               gustDark: JSON.stringify(activeGustColors.gustDark),
               snow: !!activeGustColors.snow,
               src: (window.VenueDoc.get(k)||{}).palette ? 'doc' : (VENUES[k].palette ? 'venue' : 'default') };
    }
    return r;
  });
  for (const k of Object.keys(out)) {
    const v = out[k];
    console.log(`${k.padEnd(10)} ${v.src.padEnd(8)} base ${v.base}  deep ${v.deep}  gustDark ${v.gustDark}${v.snow?'  snow':''}`);
  }
  await b.close();
})();

// Which venue subsystems actually come alive on any of the ten venues?
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  const out = await p.evaluate(() => {
    const probes = {
      riverShore:   () => !!state.course.riverShore,
      riverCorridor:() => !!state.course.riverCorridor,
      ambientCurrent:() => !!(state.race.conditions && state.race.conditions.current),
      brash:        () => !!(state.course.brash && state.course.brash.length),
      weeds:        () => !!(state.course.weeds && state.course.weeds.length),
      penguins:     () => (state.course.islands||[]).some(i => i.penguins),
      roundMark:    () => !!state.course.roundMark,
      currentRegions: () => !!(state.course.currentRegions||[]).length,
      gustRegions:  () => !!(state.course.gustRegions||[]).length,
      docPalette:   () => !!((window.VenueDoc.get(settings.venue)||{}).palette),
      docConditions:() => !!((window.VenueDoc.get(settings.venue)||{}).conditions)
    };
    const live = {}; for (const k in probes) live[k] = [];
    for (const key of Object.keys(VENUES)) {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: key }));
      let s = 90210;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame();
      for (const k in probes) { try { if (probes[k]()) live[k].push(key); } catch (e) {} }
    }
    return live;
  });
  const pad = (s,n)=>String(s).padEnd(n);
  console.log(pad('subsystem',16) + 'venues where it is LIVE');
  for (const k of Object.keys(out))
    console.log(pad(k,16) + (out[k].length ? out[k].join(',') : '—  DEAD on all ten'));
  await b.close();
})();

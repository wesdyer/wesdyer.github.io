// The puff tone calibration, per venue: what colour is actually laid down, which way it
// moves the water, and at what alpha. Direction is the thing to read — a gust must darken
// and a lull must brighten on every venue, whatever its palette says.
const { chromium } = require('playwright');
const path = require('path');
const VENUES = ['bay','lake','lagoon','swamp','river','ocean','redrock','glowtide','arctic','seatrials'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1300);
  console.log('  venue      water luma   gust tint  luma   dir   alpha    lull tint  luma   dir   alpha');
  for (const v of VENUES) {
    const r = await p.evaluate((vv) => {
      state.paused = true; settings.venue = vv; resetGame(); startRace();
      for (let i = 0; i < 60; i++) update(1/60);
      const cal = puffToneCal();
      const luma = (c) => 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
      return { water: +cal.water.toFixed(1),
               gustC: cal.gustC, gustL: +luma(cal.gustC).toFixed(1), gustA: +cal.gust.toFixed(3),
               lullC: cal.lullC, lullL: +luma(cal.lullC).toFixed(1), lullA: +cal.lull.toFixed(3) };
    }, v);
    const gd = r.gustL < r.water ? 'dark' : 'LIGHT';
    const ld = r.lullL > r.water ? 'brt ' : 'DARK';
    const gDelta = (r.gustL - r.water) * r.gustA, lDelta = (r.lullL - r.water) * r.lullA;
    console.log(`  ${v.padEnd(10)} ${String(r.water).padStart(6)}     ` +
      `${JSON.stringify(r.gustC).padEnd(16)} ${String(r.gustL).padStart(5)}  ${gd}  ${String(r.gustA).padStart(5)}  ` +
      `${JSON.stringify(r.lullC).padEnd(16)} ${String(r.lullL).padStart(5)}  ${ld}  ${String(r.lullA).padStart(5)}` +
      `   => ${gDelta.toFixed(1)} / +${lDelta.toFixed(1)} luma`);
  }
  console.log('errors', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();

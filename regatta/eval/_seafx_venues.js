// LEAK TEST for the sea effects: every venue but Bluewater Bonanza must be untouched.
//
// seafx.js is gated on `Swell.active()` rather than on a venue name, which is the right way
// round but is only worth anything if it is checked — the failure mode is silent, and it
// would land on Clubhouse Point, the eval anchor. Races 30 s of each of the ten venues and
// asserts that a venue with no `swell` block ends with zero whitecaps and zero spray.
//
// Usage: node eval/_seafx_venues.js
const { chromium } = require('playwright');
const path = require('path');
const VENUES = ['bay','lake','lagoon','swamp','river','ocean','redrock','glowtide','arctic','seatrials'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  for (const v of VENUES) {
    const r = await p.evaluate((vv) => {
      settings.venue = vv; resetGame(); startRace();
      for (let i = 0; i < 1800; i++) update(1/60);
      draw();
      return { swell: window.Swell.active(), ...window.SeaFX.debug() };
    }, v);
    const bad = !r.swell && (r.caps || r.spray);
    console.log(`${v.padEnd(10)} swell=${String(r.swell).padEnd(5)} caps=${String(r.caps).padEnd(5)} spray=${String(r.spray).padEnd(5)} ${bad ? 'LEAK!' : 'ok'}`);
  }
  console.log('errors', errs.length ? errs.slice(0,4) : 'none');
  await b.close();
})();

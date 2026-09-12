// THE WHOLE COLOUR SCALE ON SCREEN, ON REAL VENUE WATER.
//
// A ramp cannot be judged on white or at full strength: the eye gets the stop composited
// over the venue's water at the streak's alpha, and that is where the retired ramp went
// khaki. With `window.__KT_SWEEP` every comet reads its knots off its screen x (0 at the
// left edge, 35 at the right), so one frame shows the entire scale — density is still real.
// Shoots a sweep frame and a real-wind frame per venue and palette.
//
//   V=ocean,lagoon,arctic PAL=wind,mint OUT=/tmp/x node regatta/eval/_comet_sweep.js
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '.';
const VENUES = (process.env.V || 'ocean,lagoon,arctic,swamp,glowtide,redrock').split(',');
const PALS = (process.env.PAL || 'wind').split(',');
(async () => {
  const b = await chromium.launch();
  for (const v of VENUES) for (const pal of PALS) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2500);
    await p.evaluate(pp => { window.__streakPalette(pp); if (typeof startRace === 'function') startRace(); }, pal);
    await p.waitForTimeout(8500);
    await p.evaluate(() => { window.__KT_SWEEP = true; }); await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/sweep_${v}_${pal}.png` });
    await p.evaluate(() => { window.__KT_SWEEP = false; }); await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/real_${v}_${pal}.png` });
    const n = await p.evaluate(() => state.particles.filter(q => q.type === 'wind').length);
    console.log(`${v}/${pal}  comets=${n}  ${errs.length ? 'ERR ' + errs[0].slice(0, 100) : ''}`);
    await p.close();
  }
  await b.close();
})();

// Visual smoke-test: load the game, start a race, let it run, capture screenshots.
// Usage: node regatta/eval/_shot.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(800);
  await page.evaluate(() => { try { window.resetGame && resetGame(); window.startRace && startRace(); } catch (e) {} });
  // Let the real-time loop run so gusts move, boats sail, prestart -> racing.
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'regatta/eval/_shot_prestart.png' });
  await page.waitForTimeout(20000);
  await page.screenshot({ path: 'regatta/eval/_shot_racing.png' });
  // Report some live state for sanity.
  const snap = await page.evaluate(() => {
    const b = state.boats.find(x => !x.isPlayer) || state.boats[0];
    return {
      status: state.race.status,
      timer: +state.race.timer.toFixed(1),
      gusts: state.gusts.length,
      windDir: +(state.wind.direction).toFixed(2),
      persistentShift: +(state.wind.persistentShift || 0).toFixed(1),
      sampleBoat: b ? { name: b.name, spd: +b.speed.toFixed(2), leeway: +((b.leeway||0)*180/Math.PI).toFixed(1), aw: b.apparentWind ? +b.apparentWind.speed.toFixed(1) : null } : null,
    };
  });
  console.log('STATE', JSON.stringify(snap));
  console.log('ERRORS', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await browser.close();
})();

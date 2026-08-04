// Look at Glacier Sound in the GAME: hand-placed ice, the no-buoy rounding indicator, and
// the marks that used to be skipped. Usage: node regatta/eval/_arctic_shot.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    resetGame(); startRace();
  });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'regatta/eval/_arctic_prestart.png' });
  // Fly the camera to the rounding mark, which is the thing to check.
  await page.evaluate(() => {
    const rm = state.course.roundMark;
    if (rm) { state.camera.x = rm.x; state.camera.y = rm.y; state.camera.zoom = 0.55; state.cameraMode = 'free'; }
    state.showNavAids = true;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'regatta/eval/_arctic_rounding.png' });
  const snap = await page.evaluate(() => ({
    floes: (state.course.islands || []).filter(i => i.isFloe).length,
    authored: (state.course.islands || []).filter(i => i.authored).length,
    marks: state.course.marks.map(m => `${m.id}:${m.kind || 'inflatable'}`),
    zone: state.course.roundMark && Math.round(state.course.roundMark.zone),
    cutoff: state.course.cutoff && Math.round(state.course.cutoff)
  }));
  console.log('STATE', JSON.stringify(snap));
  console.log('ERRORS', errors.length ? errors.slice(0, 5).join('\n') : 'none');
  await browser.close();
})();

// In-game A/B of the race mark: same frame, same water, old sprite vs new.
//   node regatta/art/_markab.js [venue]
// Loads once, parks the camera on a mark, screenshots, hot-swaps markImg.src to the
// old asset, screenshots again. Scratch tool; not part of the pipeline.
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'bay';
const OUT = path.join(__dirname, 'sheets');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((v) => { settings.venue = v; resetGame(); startRace(); }, venue);
  // Far enough in that the fleet has rounded and both active and inactive marks exist.
  await page.waitForTimeout(75000);

  await page.evaluate(() => {
    const m = state.course.marks[0];
    Object.defineProperty(state.camera, 'x', { get: () => m.x, set: () => {} });
    Object.defineProperty(state.camera, 'y', { get: () => m.y, set: () => {} });
    for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
  });
  await page.waitForTimeout(500);
  console.log('STATE', JSON.stringify(await page.evaluate(() => ({
    status: state.race.status, leg: state.boats[0].raceState.leg, marks: state.course.marks.length,
  }))));

  await page.screenshot({ path: path.join(OUT, 'mark-ab-new.png') });

  // Hot-swap to the previous asset and clear the cached grey bake.
  await page.evaluate(() => new Promise(res => {
    markImgGray = null;
    markImg.onload = () => res();
    markImg.src = 'assets/images/misc/mark.png';
  }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'mark-ab-old.png') });

  console.log('ERRORS', errors.length ? errors.slice(0, 5).join('\n') : 'none');
  await browser.close();
})();

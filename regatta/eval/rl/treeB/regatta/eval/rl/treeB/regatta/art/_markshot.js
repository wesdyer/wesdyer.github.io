// Capture the race marks in situ, close up, with both active and inactive on screen.
//   node regatta/art/_markshot.js [venue]
// Scratch tool for judging the mark swap; not part of the pipeline.
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'bay';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  page.on('requestfailed', r => errors.push('404? ' + r.url().split('/').slice(-2).join('/')));

  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((v) => { settings.venue = v; resetGame(); startRace(); }, venue);
  await page.waitForTimeout(52000);

  const snap = await page.evaluate(() => ({
    markSrc: markImg.getAttribute('src'),
    loaded: markImg.complete && markImg.naturalWidth > 0,
    natural: markImg.naturalWidth + 'x' + markImg.naturalHeight,
    marks: state.course.marks.length,
    leg: state.boats[0].raceState.leg,
  }));
  console.log('MARK', JSON.stringify(snap));

  // Park the camera on the first mark so it is large in frame, and hide the shell.
  await page.evaluate(() => {
    const m = state.course.marks[0];
    Object.defineProperty(state.camera, 'x', { get: () => m.x, set: () => {} });
    Object.defineProperty(state.camera, 'y', { get: () => m.y, set: () => {} });
    for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, 'sheets', 'mark-ingame.png') });
  console.log('ERRORS', errors.length ? errors.slice(0, 6).join('\n') : 'none');
  await browser.close();
})();

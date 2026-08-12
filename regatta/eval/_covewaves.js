// Which pass is painting white marks ON the land at Lighthouse Cove?
// Draws the same frozen frame with one function no-op'd at a time and reports how many
// pixels changed INSIDE the land, so the culprit names itself.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOT_OUT || require('os').tmpdir();

const X = +(process.argv[2] || 2126), Y = +(process.argv[3] || 1970);
const FNS = ['drawWindWaves', 'drawSurf', 'drawGusts', 'drawParticles', 'drawWakes',
             'drawIslands', 'drawProps', 'drawVegetation', 'drawTrafficWakes'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { settings.venue = 'bay'; resetGame(); startRace(); });
  await page.waitForTimeout(2500);
  await page.evaluate(([x, y]) => {
    state.paused = true;
    state.camera.target = 'none';
    state.camera.mode = 'north';
    state.camera.rotation = 0;
    state.camera.x = x; state.camera.y = y;
    window.__orig = {};
    document.querySelectorAll('.hud, #hud, .leaderboard, #leaderboard, .overlay')
      .forEach(el => (el.style.display = 'none'));
    draw();
  }, [X, Y]);

  const shot = async (tag) => {
    await page.evaluate(() => draw());
    await page.waitForTimeout(80);
    await page.screenshot({ path: `${OUT}/waves-${tag}.png` });
  };
  await shot('base');
  await shot('base2');   // noise floor: two identical draws

  for (const fn of FNS) {
    const ok = await page.evaluate((f) => {
      if (typeof window[f] !== 'function') return false;
      window.__orig[f] = window[f];
      window[f] = () => {};
      return true;
    }, fn);
    if (!ok) { console.log(`  ${fn.padEnd(18)} not a global — skipped`); continue; }
    await shot(`no-${fn}`);
    await page.evaluate((f) => { window[f] = window.__orig[f]; }, fn);
    console.log(`  ${fn.padEnd(18)} captured`);
  }
  console.log('ERRORS', errs.length ? errs.slice(0, 4).join(' | ') : 'none');
  console.log('OUT', OUT);
  await browser.close();
})();

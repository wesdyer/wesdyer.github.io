const { chromium } = require('playwright');
const path = require('path');
const [root, tag, OUT] = process.argv.slice(2);
const SPOTS = [['harbour', -750, -2134], ['town', -1547, -1800], ['east-pier', 3870, -288], ['south-cottages', 1738, 1800], ['south-quay', 850, 4600]];
(async () => {
  const browser = await chromium.launch(); const errors = [];
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(root, 'regatta/index.html'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { settings.venue = 'bay'; resetGame(); startRace(); });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { state.paused = true; state.camera.target = 'none'; state.camera.mode = 'north'; state.camera.rotation = 0;
    document.querySelectorAll('.hud, #hud, .leaderboard, #leaderboard, .overlay').forEach(el => (el.style.display = 'none')); });
  for (const [name, x, y] of SPOTS) {
    await page.evaluate(([x, y]) => { state.camera.x = x; state.camera.y = y; state.camera.rotation = 0; draw(); }, [x, y]);
    await page.waitForTimeout(400);
    await page.evaluate(() => draw()); await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png` });
  }
  console.log(tag, 'errors:', errors.slice(0, 4).join(' | ') || 'none');
  await browser.close();
})();

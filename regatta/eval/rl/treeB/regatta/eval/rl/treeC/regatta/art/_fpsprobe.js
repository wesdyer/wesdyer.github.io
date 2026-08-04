// FPS ablation: arctic with floe colonies vs with them stripped.
const { chromium } = require('playwright');
const path = require('path');
const REPO = '/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta';
const measure = async (page, label) => {
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; performance.now() - t0 < 6000 ? requestAnimationFrame(tick) : res(n / ((performance.now() - t0) / 1000)); };
    requestAnimationFrame(tick);
  }));
  console.log(`${label}: ${fps.toFixed(1)} fps`);
  return fps;
};
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(REPO, 'index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { settings.venue = 'arctic'; resetGame(); startRace(); });
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => {
    const c = state.course.islands.filter(i => i.penguins);
    return { colonies: c.length, birds: c.reduce((s, i) => s + i.penguins.birds.length, 0) };
  });
  console.log('COLONIES', JSON.stringify(info));
  const withP = await measure(page, 'with colonies   ');
  await page.evaluate(() => { for (const i of state.course.islands) delete i.penguins; });
  const without = await measure(page, 'colonies stripped');
  console.log(`delta ${(withP - without).toFixed(1)} fps (${((withP / without - 1) * 100).toFixed(1)}%)`);
  await browser.close();
})();

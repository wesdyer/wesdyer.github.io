// Sample getWindAt along leg 1 of seatrials in a given tree.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = process.argv[2];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  const r = await page.evaluate(() => {
    window.evalHarness.seed = 100;
    window.resetGame();
    const leg = state.course.dmc.legs[1];
    const out = [];
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const k = Math.floor((leg.pts.length - 1) * f);
      const p = leg.pts[k];
      const w = getWindAt(p.x, p.y);
      out.push([Math.round(p.x), Math.round(p.y), +(w.direction * 180 / Math.PI).toFixed(0), +w.speed.toFixed(1)]);
    }
    return { base: +state.wind.baseSpeed.toFixed(1), baseDir: +(state.wind.baseDirection * 180 / Math.PI).toFixed(0), leg1: out };
  });
  console.log(JSON.stringify(r));
  await browser.close();
})();

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
    return {
      marks: (state.course.marks || []).map(m => ({ x: Math.round(m.x), y: Math.round(m.y), kind: m.kind, role: m.role, bodyR: m.bodyR })),
      route: (state.course.route || []).map(e => ({ kind: e.kind, role: e.role, dir: e.dir, markIdx: e.markIdx, lineIdx: e.lineIdx, finish: e.finish })),
      type: state.course.type, totalLegs: state.race.totalLegs,
    };
  });
  console.log(JSON.stringify(r, null, 0));
  await browser.close();
})();

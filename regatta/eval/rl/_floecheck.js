const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, 'treeCP1');
const VENUES = ['arctic','bay','ocean','lake','river','redrock','seatrials','lagoon','swamp','glowtide'];
(async () => {
  const browser = await chromium.launch();
  for (const v of VENUES) {
    const page = await browser.newPage();
    await page.addInitScript((vv)=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:vv}));}, v);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8') });
    const r = await page.evaluate(async () => {
      window.evalHarness.seed = 9100; window.resetGame(); window.startRace(); window.update(1/60);
      const f = state.course._floeObjs || [];
      return { floes: f.length, islands: (state.course.islands||[]).length };
    });
    console.log(`${v.padEnd(11)} _floeObjs ${String(r.floes).padStart(3)}   islands ${r.islands}   ${r.floes? '<= FAN UNGATE APPLIES HERE':''}`);
    await page.close();
  }
  await browser.close();
})();

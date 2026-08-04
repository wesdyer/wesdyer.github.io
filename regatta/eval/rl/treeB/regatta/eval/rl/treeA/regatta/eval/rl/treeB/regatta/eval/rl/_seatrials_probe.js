const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = process.argv[2];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0,150)));
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  const r = await page.evaluate(async () => {
    window.evalHarness.seed = 100;
    window.resetGame(); window.startRace();
    const dt = 1/60; const bots = state.boats.filter(b=>!b.isPlayer);
    const leg2At = {};
    let finT = [];
    for (let i = 0; i < 60*400; i++) {
      window.update(dt);
      if (state.race.status !== 'racing') continue;
      const t = state.race.timer;
      if (t > 370) break;
      for (const b of bots) {
        if (leg2At[b.name] === undefined && b.raceState.leg >= 2) leg2At[b.name] = Math.round(t);
        if (b.raceState.finished && !b._ft) { b._ft = 1; finT.push(Math.round(t)); }
      }
    }
    const a = Object.values(leg2At).sort((x,y)=>x-y);
    return { leg1med: a[Math.floor(a.length/2)] || null, nLeg2: a.length, fins: finT.length, finT: finT.slice(0,5) };
  });
  console.log(ROOT.split('/').slice(-2)[0], JSON.stringify(r));
  await browser.close();
})();

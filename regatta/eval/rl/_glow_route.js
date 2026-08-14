const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = '/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/eval/rl/treeGLB';
(async () => {
  const br = await chromium.launch(); const p = await br.newPage();
  await p.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide' })); });
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  const r = await p.evaluate(() => {
    window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
    for (let i = 0; i < 60; i++) window.update(1/60);
    return (state.course.route || []).map((L, i) => ({
      i, kind: L.kind,
      mark: L.mark ? {id: L.mark.id, x: Math.round(L.mark.x), y: Math.round(L.mark.y), zone: Math.round(L.mark.zone||0), side: L.mark.side} : null,
      keys: Object.keys(L)
    }));
  });
  console.log(JSON.stringify(r, null, 1));
  await br.close();
})();

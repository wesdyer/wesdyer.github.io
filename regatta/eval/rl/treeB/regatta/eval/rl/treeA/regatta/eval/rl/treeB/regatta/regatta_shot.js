const { chromium } = require('playwright');
const path = require('path');
const OUT='/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/ad7c3b78-48a6-46dc-808d-57702b239eb3/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/competitor.html'));
  await p.waitForTimeout(2500);
  for (const n of ['Pebble','Skitter','Glide','Frenzy','Regal','Drift']) {
    const el = await p.$(`section:has(canvas[data-boat="${n}"])`);
    if (el) await el.screenshot({ path: OUT+`v_${n}.png` });
  }
  console.log('errors:', errs.slice(0,2));
  await b.close();
})();

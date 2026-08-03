// Shoot the venue-weather panel on both layers that own part of it.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1800);
  // Lighthouse Cove states no weather of its own — pick one that does. The editor
  // boots blank now, so load it directly.
  await p.evaluate(() => window.EditorApp.loadVenue('lake'));
  await p.waitForTimeout(1200);
  for (const L of ['wind', 'gust']) {
    await p.evaluate((l) => { const A = window.EditorApp; A._setMode(l); A._setOsel([]); A.fitView(); }, L);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `regatta/eval/_ed_cond_${L}.png` });
  }
  const st = await p.evaluate(() => ({ conditions: window.EditorApp._state().doc.conditions || null }));
  console.log(JSON.stringify(st), 'errors:', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();

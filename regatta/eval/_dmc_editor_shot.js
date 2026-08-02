// Select each leg in the editor's route layer and screenshot the path it draws.
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d4fb1166-2abc-4e3b-a981-fea7ac01df07/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(3500);
  const info = await p.evaluate(() => {
    const A = window.EditorApp, s = A._state();
    return { venue: s.doc && s.doc.venue, legs: s.doc ? s.doc.course.route.length : 0,
             hasDmc: !!(window.state && state.course && state.course.dmc) };
  });
  console.log(JSON.stringify(info), errs.slice(0, 2));
  for (const leg of [1, 2]) {
    await p.evaluate(L => { window.EditorApp._selectLeg(L); window.EditorApp._fitView && window.EditorApp._fitView(); }, leg);
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + 'dmc_editor_leg' + leg + '.png' });
  }
  console.log('errors:', errs.slice(0, 3));
  await b.close();
})();

// One mark of each kind, so the four choices can be told apart.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.evaluate(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' })));
  await p.reload(); await p.waitForTimeout(1600);
  const out = await p.evaluate(() => {
    const A = window.EditorApp;
    const d = A._state().doc;
    const kinds = ['inflatable', 'can', 'committee', 'none'];
    d.course.marks.forEach((m, i) => { m.kind = kinds[i % 4]; });
    A._setMode('marks');
    A._selectMark(-1);
    A.fitView(); A.draw();
    return { kinds: d.course.marks.map(m => `${m.id}:${m.kind}`) };
  });
  await p.screenshot({ path: 'regatta/eval/_markkinds.png' });
  console.log(out.kinds.join('  '), '| errors:', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();

// The inspector with something selected — the state the design is really about.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1600);
  await p.evaluate(() => {
    document.querySelector('[data-layer="land"]').click();
    const A = window.EditorApp;
    A._selectShape('granite-isle');
    A._afterEdit(false);
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'regatta/eval/_ed_selected.png' });
  const insp = await p.evaluate(() => ({
    kicker: document.getElementById('in-kicker').textContent,
    name: document.getElementById('in-name').textContent,
    meta: document.getElementById('in-meta').textContent,
    sections: [...document.querySelectorAll('#insp-obj .in-sect .k')].map(e => e.textContent),
    fields: [...document.querySelectorAll('#insp-obj [data-num]')].map(e => e.dataset.num + '=' + e.value)
  }));
  console.log(JSON.stringify(insp, null, 1));
  console.log('errors:', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();

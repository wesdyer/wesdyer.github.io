// Screenshot the editor in a given layer. Usage: node regatta/eval/_shot_editor.js [layer]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1600);
  const layers = process.argv[2] ? [process.argv[2]] : ['level','land','marks','course','wind','water','venue','arena'];
  for (const L of layers) {
    await p.evaluate((id) => {
      const row = document.querySelector(`[data-layer="${id}"]`);
      if (row) row.click();
    }, L);
    await p.waitForTimeout(350);
    await p.screenshot({ path: `regatta/eval/_ed_${L}.png` });
  }
  console.log('errors:', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();

// The panels must FIT the column they live in.
//
//   node regatta/eval/test_fit.js
//
// A button sized `width:100%` inside a panel whose gutter is a 16px margin comes out 32px
// wider than the column, and the column answers with a horizontal scrollbar — one you only
// notice when you go looking, because nothing looks broken until you try to scroll. Every
// layer is checked, and every child of an open panel, so a long label or a new control cannot
// quietly reintroduce it.
const { chromium } = require('playwright');
const path = require('path');
const LAYERS = ['course','water','land','arena','wind','current','marks','route'];
console.log('panels fit the column they live in\n');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });   // a narrow-ish window
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(900);
  // The editor boots blank; give the measurements a document to measure.
  await p.evaluate(() => window.EditorApp.loadVenue('arctic'));
  await p.waitForTimeout(600);
  // Give the region layers something to show, so their inspector rows are measured too.
  // Wind's "+ Whole course" is an object-column ACTION now — its panel button is gone, so
  // the layer has to be active for the action to exist.
  await p.evaluate(() => {
    const wholeCourse = (layer) => {
      document.querySelector(`#layer-list [data-layer="${layer}"]`).click();
      const act = [...document.querySelectorAll('#objs-actions .btn')]
          .find(b => /whole course/i.test(b.textContent));
      if (act) act.click();
    };
    wholeCourse('current');
    wholeCourse('wind');
    // ...and select one, so the inspector's fields are measured as well.
    const row = document.querySelector('#obj-list .ob');
    if (row) row.click();
  });
  let bad = 0;
  for (const L of LAYERS) {
    const r = await p.evaluate((id) => {
      document.querySelector(`#layer-list [data-layer="${id}"]`).click();
      const out = [];
      const left = document.querySelector('.ed-left');
      const boxes = [left, ...document.querySelectorAll('.ed-left .mode-panel:not([hidden])'),
                     document.getElementById('layer-settings'),
                     document.getElementById('obj-list'), document.getElementById('layer-list')];
      for (const el of boxes) {
        if (!el) continue;
        if (el.scrollWidth > el.clientWidth + 1)
          out.push(`${el.className || el.id}: scrollWidth ${el.scrollWidth} > client ${el.clientWidth}`);
      }
      // And no single child may stick out past the column, scrollbar or not.
      const lw = left.getBoundingClientRect();
      for (const el of document.querySelectorAll('.ed-left .mode-panel:not([hidden]) *')) {
        const b = el.getBoundingClientRect();
        if (b.width && b.right > lw.right + 1)
          out.push(`${el.tagName}.${el.id || el.className}: right ${Math.round(b.right)} > ${Math.round(lw.right)}`);
      }
      return out;
    }, L);
    if (r.length) { bad++; console.log(`  FAIL  ${L} overflows\n    ` + r.join('\n    ')); }
    else console.log(`  ok    ${L}: fits the column`);
  }
  if (errs.length) { bad++; console.log('  FAIL  page errors: ' + errs.slice(0, 2).join(' | ')); }
  else console.log('  ok    no page errors');
  console.log(`\n${bad ? 'FAIL' : 'PASS'} — ${bad} failure(s)`);
  await b.close();
  process.exitCode = bad ? 1 : 0;
})();

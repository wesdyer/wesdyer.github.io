// What is the editor throwing right now? Usage: node regatta/eval/_err.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.stack || e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1600);
  const fatal = await p.evaluate(() => {
    const f = document.getElementById('fatal');
    return (f && !f.hidden) ? f.textContent.slice(0, 1200) : null;
  });
  console.log('FATAL:', fatal || '(none)');
  console.log('ERRS:', errs.slice(0, 3).join('\n---\n') || '(none)');
  await b.close();
})();

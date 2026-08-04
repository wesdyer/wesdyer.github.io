// Capture frames from a standalone preview page. Scratch tool.
const { chromium } = require('playwright');
const path = require('path');
const page_ = process.argv[2] || '_orcapreview.html';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1420, height: 780 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('requestfailed', r => errs.push('MISSING ' + r.url().split('/').slice(-3).join('/')));
  await p.goto('file://' + path.resolve(__dirname, page_));
  await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    await p.screenshot({ path: path.join(__dirname, 'sheets', `_orcaprev-${i}.png`) });
    await p.waitForTimeout(140);
  }
  console.log('ERRORS', errs.length ? errs.slice(0, 5).join(' | ') : 'none');
  await b.close();
})();

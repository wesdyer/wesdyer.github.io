// Screenshot the waddle bench. Optional 2nd arg = global scale to apply first.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1120, height: 800 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '_waddletest.html'));
  await p.waitForTimeout(1500);
  const sc = parseFloat(process.argv[3] || '0');
  if (sc) {
    await p.evaluate(v => { const el = document.getElementById('scale'); el.value = v; el.oninput(); }, sc);
    await p.waitForTimeout(900);
  }
  console.log('WORLDS', JSON.stringify(await p.evaluate(() =>
    Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.world])))),
    'scale', await p.evaluate(() => scale));
  console.log('PASTE\n' + await p.evaluate(() => document.getElementById('out').textContent));
  await p.screenshot({ path: process.argv[2] });
  console.log('ERRORS', errs.length ? errs.slice(0, 4).join(' | ') : 'none');
  await b.close();
})();

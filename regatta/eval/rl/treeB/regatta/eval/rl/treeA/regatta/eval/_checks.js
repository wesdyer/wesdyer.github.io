const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  p.on('pageerror', e => console.error('PAGEERROR', e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1800);
  const out = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#checks .find')].map(el => ({
      level: el.className.match(/find-(\w+)/)[1],
      title: el.querySelector('.find-t').textContent,
      detail: el.querySelector('.find-d').textContent
    }));
    return { tally: document.getElementById('check-tally').innerText, rows };
  });
  console.log('TALLY:', out.tally, '\n');
  for (const r of out.rows) console.log(`[${r.level.toUpperCase().padEnd(5)}] ${r.title}\n         ${r.detail}`);
  await p.screenshot({ path: 'regatta/eval/_editor_checks.png' });
  await b.close();
})();

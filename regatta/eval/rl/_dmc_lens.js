// DMC leg lengths for a venue on a tree — for diffing route changes across trees.
//   node _dmc_lens.js <tree> <venue>
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeMETER2');
const VENUE = process.argv[3] || 'bay';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
  await p.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.waitForTimeout(3000);
  const out = await p.evaluate(() => {
    const d = state.course.dmc;
    return d ? { total: Math.round(d.total), legs: d.legs.map(l => Math.round(l.length)) } : null;
  });
  console.log(VENUE, JSON.stringify(out));
  await b.close();
})();

// Which marks qualify for the tight orbit under a given tree's orbitTightR?
//   node _orbit_class.js <tree> <venue>
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeORBIT2');
const VENUE = process.argv[3] || 'bay';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
  await p.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.waitForTimeout(3000);
  const out = await p.evaluate(() => {
    if (typeof orbitTightR !== 'function') return 'no orbitTightR in this tree';
    return (state.course.route || []).filter(e => e && e.kind === 'round' && e.mark)
      .map(e => ({ x: Math.round(e.mark.x), y: Math.round(e.mark.y),
                   zone: Math.round(e.mark.zone), orb: orbitTightR(e.mark) }));
  });
  console.log(VENUE, JSON.stringify(out));
  await b.close();
})();

// Redrock legs 4-5 DMC polylines on the current HEAD — does the departure from
// m5 reuse the leg-3 north thread (head-on traffic in a one-lane channel)?
//   node _rr_leg5.js [tree]   (default: the repo itself)
const { chromium } = require('playwright');
const path = require('path');
const ROOT = process.argv[2] ? path.join(__dirname, process.argv[2]) : path.resolve(__dirname, '../../..');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' })));
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.waitForTimeout(3000);
  const out = await p.evaluate(() => {
    const d = state.course.dmc;
    const thin = (pts) => pts.filter((q, i) => i % 3 === 0 || i === pts.length - 1)
      .map(q => [Math.round(q.x), Math.round(q.y)]);
    return d ? d.legs.map((l, i) => ({ leg: i, len: Math.round(l.length), pts: l.pts ? thin(l.pts) : [] })) : null;
  });
  for (const l of out) console.log('leg', l.leg, 'len', l.len, JSON.stringify(l.pts));
  await b.close();
})();

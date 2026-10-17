// Which venues' saved course paths match their land, as the game computes it?   node regatta/eval/_paths_fresh.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.VenueDoc && window.VENUE_DOC);
  console.log(await p.evaluate(() => Object.entries(window.VENUE_DOC).filter(([, d]) => d.course && d.course.route && d.course.route.length).map(([v, d]) => {
    const sig = window.VenueDoc.courseSig(d), saved = d.course.paths && d.course.paths.sig;
    return `${v.padEnd(10)} ${sig === saved ? 'fresh' : 'STALE'}  (${saved || 'none'} vs ${sig})`;
  }).join('\n')));
  await b.close(); })();

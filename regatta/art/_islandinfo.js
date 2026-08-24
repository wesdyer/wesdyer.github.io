// Dump the runtime shape of a course's island objects. Scratch tool.
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'lake';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(1500);
  await p.evaluate(v => { settings.venue = v; resetGame(); startRace(); }, venue);
  await p.waitForTimeout(9000);
  const out = await p.evaluate(() => {
    const isl = state.course.islands || [];
    const i = isl[0] || {};
    return {
      count: isl.length,
      keys: Object.keys(i),
      nverts: (i.vertices || []).length,
      hasHoles: isl.filter(z => (z.holes || []).length).length,
      awashCount: isl.filter(z => z.awash).length,
      venueDocExports: Object.keys(window.VenueDoc || {}).length,
      vert0: (i.vertices||[])[0], vert1: (i.vertices||[])[1],
      hole0: ((isl.find(z=>(z.holes||[]).length)||{}).holes||[[]])[0][0],
    };
  });
  console.log(JSON.stringify(out, null, 2));
  console.log('errors', errs.slice(0, 3));
  await b.close();
})();

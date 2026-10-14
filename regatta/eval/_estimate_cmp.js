// Each venue's routed course estimate (sailed distance, estimated best time, cutoff).   ROOT=<repo root> node regatta/eval/_estimate_cmp.js
const { chromium } = require('playwright'); const path = require('path');
const ROOT = process.env.ROOT || path.resolve('.');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(ROOT, 'regatta/index.html')); await p.waitForFunction(() => window.VenueDoc && window.VENUE_DOC);
  console.log(JSON.stringify(await p.evaluate(() => { const o = {}; for (const [v, d] of Object.entries(window.VENUE_DOC)) { if (!d.course || !(d.course.route || []).length) continue; try { const c = window.VenueDoc.compile(d); o[v] = { dist: Math.round(c.sailedDist), est: Math.round(c.estSecs), measured: c.pathMeasured }; } catch (e) { o[v] = { err: e.message }; } } return o; })));
  await b.close(); })();

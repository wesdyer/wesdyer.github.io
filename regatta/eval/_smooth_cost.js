// Curved shapes' cost per venue: race-start build, sim ms/frame and shoal drag, flags stripped (before) vs on.
//   node regatta/eval/_smooth_cost.js [venue ...]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay','flats','glowtide','lagoon','lake','ocean','otter','pond','redrock','river','swamp','volcanic'];
(async () => {
  const browser = await chromium.launch(); const HARNESS = fs.readFileSync('regatta/eval/trace_harness.js', 'utf8');
  console.log('venue      verts            start ms        sim ms/frame     shoal µs/call   fin/pen');
  for (const v of VENUES) {
    const r = {};
    for (const mode of ['before', 'after']) {
      const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.goto('file://' + path.resolve('regatta/index.html'));
      await page.addScriptTag({ content: HARNESS });
      await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), v);
      r[mode] = await page.evaluate(async ([v, mode]) => {
        if (mode === 'before') for (const sh of window.VENUE_DOC[v].shapes || []) delete sh.smooth;
        let t = performance.now(); resetGame(); const start = performance.now() - t;
        const isl = state.course.islands, verts = isl.reduce((a, i) => a + (i.vertices ? i.vertices.length : 0), 0);
        let n = 0; t = performance.now();
        for (let x = -3000; x <= 3000; x += 200) for (let y = -3000; y <= 3000; y += 200) { window.VenueDoc.shoalField(isl, x, y); n++; }
        const shoal = (performance.now() - t) * 1000 / n;
        t = performance.now(); const tr = await window.traceHarness.runTrace(90210, { timeLimit: 120, legs: 4 }); const sim = (performance.now() - t) / tr.frames;
        return { verts, start, shoal, sim, fin: tr.summary.finished, pen: tr.summary.penalties };
      }, [v, mode]);
      r[mode].errs = errs.length;
      await page.close();
    }
    const a = r.before, b = r.after, f = (x, d = 0) => x.toFixed(d);
    console.log(`${v.padEnd(10)} ${String(a.verts).padStart(5)}->${String(b.verts).padEnd(6)}  ${f(a.start).padStart(5)}->${f(b.start).padEnd(6)}  ${f(a.sim, 2)}->${f(b.sim, 2)}       ${f(a.shoal, 1)}->${f(b.shoal, 1)}       ${a.fin}/${a.pen}->${b.fin}/${b.pen}${b.errs ? '  ERRORS ' + b.errs : ''}`);
  }
  await browser.close(); })();

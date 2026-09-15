// VENUE BAKE — open editor.html headless over http, load a venue, run the editor's checks,
// bake course.paths and price the course, then write the document back exactly as Save does.
//   VENUE=otter NODE_PATH=node_modules node regatta/eval/_venue_bake.js [--no-write]
// Pairs with art/build_otter.py: the script lays the geometry, this bakes the paths.
// Headless bake for the Otter venue: open editor.html over http, load the venue from disk,
// run the editor's own checks, bake the course paths, price the course, and write the
// document back with its paths — the same text editor.html's Save writes.
//   NODE_PATH=<repo>/node_modules node otter_bake.js [--no-write]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve('.');
const NOWRITE = process.argv.includes('--no-write');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data); }); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(`http://127.0.0.1:${server.address().port}/regatta/editor.html`);
  await page.waitForFunction(() => window.EditorApp && typeof EditorApp.loadVenue === 'function', null, { timeout: 30000 });
  const VENUE = process.env.VENUE || 'otter';
  await page.evaluate((v) => EditorApp.loadVenue(v), VENUE);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const st = EditorApp._state();
    const doc = st.doc;
    const findings = (st.findings || []).filter(f => f.level !== "ok").map(f => JSON.stringify(f).slice(0, 220));
    EditorApp._bakeCoursePaths();
    const d2 = window.VenueDoc.compile(doc);
    const legs = (doc.course.paths && doc.course.paths.legs || []).map(L => L.pts.length);
    return {
      findings, estSecs: d2.estSecs, sailedDist: d2.sailedDist, courseDist: d2.courseDist,
      pathMeasured: d2.pathMeasured, cutoffAuto: d2.cutoffAuto, legs, sig: doc.course.paths && doc.course.paths.sig,
      islands: d2.islands.length, windRegions: (d2.windRegions || []).length,
      text: '// GENERATED ONCE by art/export_venue_doc.js — now the SOURCE OF TRUTH.\n'
        + '// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.\n'
        + '// Edited in editor.html.\n'
        + 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
        + `window.VENUE_DOC[${JSON.stringify(doc.venue)}] = ${JSON.stringify(doc, null, 2)};\n`
    };
  });
  const { text, ...summary } = out;
  const mmss = s => s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  console.log(JSON.stringify({ ...summary, best: mmss(summary.estSecs), km: summary.sailedDist ? (summary.sailedDist / 5 / 1000).toFixed(2) : null }, null, 1));
  if (!NOWRITE && summary.pathMeasured) { fs.writeFileSync(`regatta/assets/venues/${VENUE}.venue.js`, text); console.log('wrote venue with baked paths'); }
  console.log('ERRORS', errors.length ? errors.slice(0, 6).join('\n') : 'none');
  await browser.close(); server.close();
})();

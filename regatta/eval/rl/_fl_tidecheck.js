// IS THE TIDE LIVE OFF THE FLATS? (flats push): on a venue, after startRace, print state.tide,
// the field's ground under each boat, and — over 60 s of racing — how many frames any bot
// reads aground or tideMul < 1.   node _fl_tidecheck.js <venue> [tree]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'lake'; const ROOT = path.join(__dirname, process.argv[3] || 'treeFLPOST');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message.slice(0, 200)));
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  const r = await page.evaluate(async (v) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
    window.evalHarness.seed = 6107; resetGame(); startRace();
    const T = state.tide; const out = { venue: settings.venue, tide: T ? { period: T.period, hasField: !!T.field, passages: T.passages.length } : null };
    if (T) out.grounds = state.boats.slice(0, 3).map(b => +Tide.groundAt(b.x, b.y).toFixed(2));
    let agr = 0, slow = 0, n = 0; const dt = 1 / 60;
    for (let it = 0; it < 60 * 90; it++) { update(dt); if (state.race.status !== 'racing') continue; n++; for (const b of state.boats) { if (b.aground) agr++; if (b.tideMul != null && b.tideMul < 1) slow++; } }
    out.frames = n; out.agroundFrames = agr; out.slowFrames = slow; out.docKeys = Object.keys(state.course.doc || {}).join(',');
    return out;
  }, VENUE);
  console.log(JSON.stringify(r));
  await browser.close();
})();

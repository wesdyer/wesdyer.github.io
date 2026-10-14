// Before/after curved shapes for every venue: the camera parked near curved shorelines by each venue's marks.
//   SHOT_OUT=dir node regatta/eval/_smooth_venue_shots.js [venue ...]
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.SHOT_OUT || require('os').tmpdir();
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['flats','glowtide','lagoon','lake','ocean','otter','pond','redrock','river','swamp','volcanic'];
(async () => {
  const browser = await chromium.launch();
  for (const v of VENUES) {
    // the spot: a curved shape's vertex nearest the first rounding mark
    let spot = null;
    for (const mode of ['before', 'after']) {
      const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
      await page.goto('file://' + path.resolve('regatta/index.html')); await page.waitForTimeout(800);
      spot = await page.evaluate(([v, mode, spot]) => {
        const doc = window.VENUE_DOC[v];
        if (!spot) {
          const ms = doc.course.marks || []; const m = ms[Math.min(2, ms.length - 1)] || { x: 0, y: 0 };
          let best = null;
          for (const sh of doc.shapes) if (sh.smooth && !window.VenueDoc.traits(sh).awash && !window.VenueDoc.traits(sh).hidden) for (const p of sh.outer) { const d = Math.hypot(p[0] - m.x, p[1] - m.y); if (!best || d < best.d) best = { d, x: p[0], y: p[1] }; }
          spot = best ? [best.x, best.y] : [m.x, m.y];
        }
        if (mode === 'before') for (const sh of doc.shapes) delete sh.smooth;
        settings.venue = v; resetGame(); startRace();
        return spot;
      }, [v, mode, spot]);
      await page.waitForTimeout(2500);
      await page.evaluate(([x, y]) => { state.paused = true; state.camera.target = 'none'; state.camera.mode = 'north'; state.camera.rotation = 0; state.camera.x = x; state.camera.y = y;
        document.querySelectorAll('.hud, #hud, .leaderboard, #leaderboard, .overlay').forEach(el => (el.style.display = 'none')); draw(); }, spot);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/vs-${v}-${mode}.png` });
      await page.close();
    }
    console.log(v, 'at', spot.map(Math.round).join(','));
  }
  await browser.close(); })();

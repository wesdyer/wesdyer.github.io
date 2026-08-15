// Is the offshore white line the BAR breaking, or just the shore surf standing off?
// Draws the same frame twice, once with the bar layer silenced, and reports the pixel
// difference plus a side-by-side. An A/B is the only way to attribute a mark on a busy
// frame — reasoning about stand-off distances from a screenshot is how you talk yourself
// into the wrong answer.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  const info = await p.evaluate(() => {
    settings.venue = 'ocean'; resetGame(); startRace();
    for (let i = 0; i < 900; i++) update(1/60);
    state.paused = true;
    const sites = window.SeaFX.debugSites() || [];
    // ⚠️ CENTRE ON A BAR IN OPEN WATER, not on the densest cluster of sites. The ocean's
    // mainland is a 20 km sand shape with bars all along it, so "most neighbours" put the
    // camera inland and framed a beach with no sea in it.
    let bar = null;
    for (const isl of (state.course.islands || [])) {
      if (!isl.awash || isl.paint || !(isl.shoalMul < 1)) continue;
      if (isl.radius > 900) continue;                    // has to fit the frame
      const n = sites.filter(s => Math.hypot(s.x - isl.x, s.y - isl.y) < isl.radius * 1.4).length;
      if (n < 4) continue;
      if (!bar || n > bar.n) bar = { x: isl.x, y: isl.y, n, r: Math.round(isl.radius) };
    }
    if (!bar) bar = { x: sites[0].x, y: sites[0].y, n: 0, r: 0 };
    state.camera.x = bar.x; state.camera.y = bar.y; state.camera.rotation = 0;
    const best = bar;
    return { sites: sites.length, cluster: best.n, r: best.r, x: Math.round(best.x), y: Math.round(best.y),
             venue: settings.venue, card: (window.VENUE_DOC && window.VENUE_DOC[settings.venue] ? window.VENUE_DOC[settings.venue].card.name : '?'), swell: !!window.Swell.active() };
  });
  console.log('venue', info.venue, info.card, 'swell=' + info.swell, '| break sites', info.sites, '| on this bar', info.cluster, 'r', info.r, 'at', info.x, info.y);
  await p.evaluate(() => draw());
  await p.screenshot({ path: `${OUT}/_bar_on.png` });
  await p.evaluate(() => { window.__d = window.SeaFX.draw; window.SeaFX.draw = () => {}; draw(); });
  await p.screenshot({ path: `${OUT}/_bar_off.png` });
  await p.evaluate(() => { window.SeaFX.draw = window.__d; });
  console.log('errors', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();

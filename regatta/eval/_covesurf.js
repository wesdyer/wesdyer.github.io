// Does surf paint on land at Lighthouse Cove? Isolates drawSurf's CRESTS by freezing the
// world and clearing the particle pool first — leftover foam blobs drawn by drawParticles
// are what made an earlier ablation unreadable.
//
//   node regatta/eval/_covesurf.js [x] [y]
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOT_OUT || require('os').tmpdir();
const X = +(process.argv[2] || 2126), Y = +(process.argv[3] || 1970);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { settings.venue = 'bay'; resetGame(); startRace(); });
  await page.waitForTimeout(2500);

  const freeze = ([x, y]) => {
    state.paused = true;
    state.camera.target = 'none';
    state.camera.mode = 'north';
    state.camera.rotation = 0;
    state.camera.x = x; state.camera.y = y;
    // The pool is the noise: blobs spawned while the race ran, redrawn with jitter.
    if (state.particles) state.particles.length = 0;
    state.waveStates.clear();          // wind waves too — this test is about surf only
    document.querySelectorAll('.hud, #hud, .leaderboard, #leaderboard, .overlay')
      .forEach(el => (el.style.display = 'none'));
    draw();
  };
  await page.evaluate(freeze, [X, Y]);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/surf-on.png` });

  await page.evaluate(() => { window.__s = drawSurf; drawSurf = () => {}; draw(); });
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/surf-off.png` });
  await page.evaluate(() => { drawSurf = window.__s; });

  // How many islands does this venue give surf, and how many edges got skipped as inland?
  console.log(JSON.stringify(await page.evaluate(() => {
    let shapes = 0, edges = 0, dryEdges = 0;
    for (const isl of state.course.islands) {
      if (isl.hidden || isl.isFloe || isl.awash || !isl.vertices || isl.vertices.length < 3) continue;
      shapes++;
      const d = (typeof surfDryEdges === 'function') ? surfDryEdges(isl) : null;
      edges += isl.vertices.length;
      if (d) dryEdges += d.filter(Boolean).length;
    }
    return { shapes, edges, dryEdges, pctInland: +(100 * dryEdges / edges).toFixed(1) };
  })));
  console.log('ERRORS', errs.length ? errs.slice(0, 4).join(' | ') : 'none');
  await browser.close();
})();

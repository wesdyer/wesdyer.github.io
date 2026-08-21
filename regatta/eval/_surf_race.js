// One frame of a real race with everything on: swell, whitecaps, shore surf, bar breaks and
// the fleet. Everything above this was measured a layer at a time; this is the only check of
// whether they read as ONE sea when they are all on screen together.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  const info = await p.evaluate(() => {
    state.paused = true;
    settings.venue = 'ocean'; resetGame(); startRace();
    state.boats[0].isPlayer = false;
    for (let i = 0; i < 5400; i++) update(1 / 60);
    let isle = null;
    for (const isl of (state.course.islands || [])) {
      if (isl.hidden || isl.awash || !isl.vertices || isl.vertices.length < 3) continue;
      if (isl.radius > 900) continue;
      const wet = surfDryEdges(isl).filter(d => !d).length;
      if (!isle || wet > isle.wet) isle = { x: isl.x, y: isl.y, wet, r: Math.round(isl.radius) };
    }
    const sw = window.Swell.primary();
    for (let i = 0; i < state.boats.length; i++) {
      const bt = state.boats[i];
      bt.x = isle.x - sw.sx * (isle.r + 380) + (i % 5) * 90;
      bt.y = isle.y - sw.sy * (isle.r + 380) + Math.floor(i / 5) * 110;
    }
    state.camera.x = isle.x - sw.sx * 200; state.camera.y = isle.y - sw.sy * 200;
    state.camera.rotation = 0;
    draw();
    const d = window.SeaFX.debug();
    return { isle, caps: d.caps, sites: d.shoalSites, parts: state.particles.length };
  });
  console.log('framed', JSON.stringify(info));
  await p.screenshot({ path: `${OUT}/_surf_race.png` });
  console.log('errors', errs.length ? errs.slice(0, 4) : 'none');
  await b.close();
})();

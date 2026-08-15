// What the new camera framing looks like, with the game's OWN camera driving — no manual
// state.camera pokes, because the thing under test is the follow logic itself.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad';
const venue = process.argv[2] || 'ocean';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  for (const mode of ['heading', 'north']) {
    const info = await p.evaluate(({ v, m }) => {
      state.paused = true;
      settings.venue = v; settings.cameraMode = m;
      resetGame(); startRace();
      for (const bt of state.boats) bt.isPlayer = false;
      state.camera.mode = m;
      for (let i = 0; i < 4200; i++) update(1 / 60);
      draw();
      const bt = state.boats[0];
      const rot = -state.camera.rotation;
      const dx = bt.x - state.camera.x, dy = bt.y - state.camera.y;
      const sy = (canvas.height / 2 + dx * Math.sin(rot) + dy * Math.cos(rot)) / canvas.height;
      return { mode: m, kn: +(bt.speed * 4).toFixed(1), leg: bt.raceState.leg, screenY: +sy.toFixed(3) };
    }, { v: venue, m: mode });
    console.log(JSON.stringify(info));
    await p.screenshot({ path: `${OUT}/_cam_${mode}.png` });
  }
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();

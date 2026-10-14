// Play every venue with the player on autopilot and photograph the game's own view at a few race times.
//   SHOT_OUT=dir node regatta/eval/_play_shots.js [venue ...]
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.SHOT_OUT || require('os').tmpdir();
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay','lake','lagoon','swamp','river','ocean','redrock','glowtide','arctic','otter','flats','volcanic'];
const TIMES = [45, 100];
(async () => {
  const browser = await chromium.launch();
  for (const v of VENUES) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.resolve('regatta/index.html')); await page.waitForTimeout(800);
    await page.evaluate(v => { settings.venue = v; selectVenue(v); resetGame(); startRace(); const me = state.boats[0]; me.controller = new BotController(me); window.__me = me; }, v);
    let t = 0;
    for (const T of TIMES) {
      const info = await page.evaluate((T) => { const me = window.__me; let n = 0;
        while ((state.race.timer || 0) < T && state.race.status !== 'finished' && n < 60 * 400) { me.controller.update(1 / 60); const d = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(1 / 60); n++; }
        draw(); return { t: Math.round(state.race.timer || 0), leg: me.raceState.leg, kt: (me.speed / 0.25).toFixed(1) }; }, T);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${OUT}/play-${v}-${T}.png` });
      process.stdout.write(`${v} t${info.t} leg ${info.leg} ${info.kt}kt; `);
    }
    console.log(errs.length ? 'ERRORS ' + errs.slice(0, 2).join(' | ') : 'ok');
    await page.close();
  }
  await browser.close(); })();

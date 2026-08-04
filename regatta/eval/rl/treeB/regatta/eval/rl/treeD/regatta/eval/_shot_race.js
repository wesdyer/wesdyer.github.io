// Race-view visual check: skip the prestart, get into racing, capture at both
// the guideline minimum viewport (1280x720) and a normal one.
// Usage: node <this> [venue]
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/03f4ecd2-bc68-4ff2-8b54-14a9c84688c4/scratchpad';
const venue = process.argv[2] || 'bay';

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  for (const vp of [{ w: 1600, h: 1000, tag: 'wide' }, { w: 1280, h: 720, tag: 'min' }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    page.on('pageerror', e => errors.push(`PAGEERROR[${vp.tag}] ` + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE[${vp.tag}] ` + m.text()); });
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForTimeout(1200);
    // Fonts must be in before anything paints text to canvas.
    await page.evaluate(() => document.fonts.ready);

    await page.evaluate((v) => {
      settings.venue = v;
      window.resetGame && resetGame();
      window.startRace && startRace();
    }, venue);

    // Sit through the real prestart, then race long enough for standings to
    // settle and the venue caption to fade.
    await page.waitForTimeout(52000);

    const snap = await page.evaluate(() => ({
      status: state.race.status,
      timer: +state.race.timer.toFixed(1),
      leg: state.boats[0].raceState.leg,
      ranked: state.boats.filter(b => b.lbRank !== undefined).length,
    }));
    console.log(`STATE[${vp.tag}]`, JSON.stringify(snap));
    await page.screenshot({ path: `${OUT}/race-${venue}-${vp.tag}.png` });
    await page.close();
  }

  console.log('ERRORS', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await browser.close();
})();

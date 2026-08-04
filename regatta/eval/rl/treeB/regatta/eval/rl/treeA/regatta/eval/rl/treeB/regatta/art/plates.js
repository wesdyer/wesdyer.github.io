// Capture real race-view backdrops for the art contact sheet.
//
//   node regatta/art/plates.js                  # lagoon + arctic (the contrast extremes)
//   node regatta/art/plates.js swamp lagoon arctic
//
// Plates are real frames from the running game: real water texture, real wind
// waves, real boats for scale. Compositing candidate art onto these is the only
// honest way to judge "does it read at race scale" — the 1024px master always
// looks fine.
//
// deviceScaleFactor MUST stay 1. The camera is translate-only with no zoom, so
// at dsf 1 one world unit is exactly one image pixel and the contact sheet can
// place a prop at its declared `world` size directly. dsf 2 silently doubles it.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, 'plates');
const venues = process.argv.slice(2);
const targets = venues.length ? venues : ['lagoon', 'arctic'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];

  for (const venue of targets) {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
      deviceScaleFactor: 1,
    });
    page.on('pageerror', e => errors.push(`PAGEERROR[${venue}] ` + e.message));

    await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.fonts.ready);

    await page.evaluate((v) => {
      settings.venue = v;
      window.resetGame && resetGame();
      window.startRace && startRace();
    }, venue);

    // Through the prestart and far enough into the race that the fleet has
    // spread and the venue caption has faded.
    await page.waitForTimeout(52000);

    // Hide the product shell so the plate is water, not chrome. Canvas only.
    await page.evaluate(() => {
      for (const el of document.body.children) {
        if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
      }
    });
    await page.waitForTimeout(300);

    const snap = await page.evaluate(() => ({
      status: state.race.status,
      venue: settings.venue,
      wind: +state.wind.speed.toFixed(1),
    }));

    await page.screenshot({ path: path.join(OUT, `${venue}.png`) });
    console.log(`${venue}: ${JSON.stringify(snap)} -> art/plates/${venue}.png`);
    await page.close();
  }

  console.log('ERRORS', errors.length ? errors.slice(0, 5).join('\n') : 'none');
  await browser.close();
})();

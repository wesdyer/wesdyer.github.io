// Screenshot a venue at chosen world positions by parking the player there.
//   node regatta/art/_islandshot.js ocean out/ "11099,6399,motu" "-3546,-5504,cay" ...
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const venue = process.argv[2] || 'ocean';
const OUT = process.argv[3] || '/tmp/';
const SPOTS = process.argv.slice(4).map(s => {
  const [x, y, name] = s.split(',');
  return { x: +x, y: +y, name: name || `${x}_${y}` };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate((v) => { settings.venue = v; resetGame(); startRace(); }, venue);
  await page.waitForTimeout(9000);
  await page.evaluate(() => {
    for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
  });

  for (const s of SPOTS) {
    // Park the player and freeze it: the camera follows the boat, so this IS the camera.
    await page.evaluate(({ x, y }) => {
      const me = state.boats.find(b => b.isPlayer) || state.boats[0];
      me.x = x; me.y = y; me.speed = 0;
      state.camera.x = x; state.camera.y = y;
    }, s);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${venue}-${s.name}.png`) });
    console.log(`${s.name}: (${s.x},${s.y})`);
  }
  console.log('ERRORS', errors.length ? errors.slice(0, 4) : 'none');
  await browser.close();
})();

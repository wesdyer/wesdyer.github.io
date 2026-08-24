// Aerial screenshots of a venue: park the player and shoot at a huge viewport, so the
// camera's 1:1 world-to-pixel mapping covers a wide slice of map. Scratch tool.
//   node regatta/art/_aerial.js lake out/ 5200x4400 "0,700,whole" "-1800,900,west"
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const venue = process.argv[2] || 'lake';
const OUT = process.argv[3] || '/tmp/';
const [VW, VH] = (process.argv[4] || '5200x4400').split('x').map(Number);
const SPOTS = process.argv.slice(5).map(s => {
  const [x, y, name] = s.split(',');
  return { x: +x, y: +y, name: name || `${x}_${y}` };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('requestfailed', r => errors.push('MISSING ' + r.url().split('/').slice(-3).join('/')));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1500);
  await page.evaluate((v) => { settings.venue = v; resetGame(); startRace(); }, venue);
  await page.waitForTimeout(11000);
  await page.evaluate(() => {
    for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
  });

  for (const s of SPOTS) {
    await page.evaluate(({ x, y }) => {
      const me = state.boats.find(b => b.isPlayer) || state.boats[0];
      me.x = x; me.y = y; me.speed = 0;
      state.camera.x = x; state.camera.y = y;
      // hide the fleet: this is a landscape shot, not a race shot
      for (const b of state.boats) if (b !== me) { b.x = 1e6; b.y = 1e6; }
      me.hidden = true;
    }, s);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(OUT, `${venue}-${s.name}.png`) });
    console.log(`${s.name}: (${s.x},${s.y})  ${VW}x${VH}`);
  }
  console.log('ERRORS', errors.length ? errors.slice(0, 4) : 'none');
  await browser.close();
})();

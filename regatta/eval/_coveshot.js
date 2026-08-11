// Park the camera at chosen world points in Lighthouse Cove and photograph the planting.
// Usage: node coveshot.js
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOT_OUT || require('os').tmpdir();

// Places worth checking, each naming what it is supposed to prove.
const SPOTS = [
  ['gradient-west', -1900, -900, 'beach -> scrub -> pine/oak, west shore of the cove'],
  ['zoneA-inland', -2080, -2540, 'Zone A: sheltered interior, oak woodland'],
  ['wooded-islet', 2126, 1970, 'the islet that owes the course a wind shadow'],
  ['lighthouse-headland', 3740, -1337, 'NE peninsula: exposed, cedar, the lighthouse'],
  ['zoneC-exposed', -1820, -800, 'Zone C: exposed outer shore'],
  ['gradient-south', 200, 3400, 'south shore gradient'],
  ['mid-island', -586, -8, 'small soil-capped island inside the course'],
  ['outer-rocks', 3019, -4431, 'bare rock islets: should be nearly empty'],
];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    settings.venue = 'bay';
    resetGame();
    startRace();
  });
  await page.waitForTimeout(3000);

  console.log('props compiled:', await page.evaluate(() => (state.course.props || []).length));

  // Freeze the world, hide the UI overlays, and drive draw() by hand so every frame
  // paints the identical scene at the point asked for.
  await page.evaluate(() => {
    state.paused = true;
    state.camera.target = 'none';
    state.camera.mode = 'north';
    state.camera.rotation = 0;
    document.querySelectorAll('.hud, #hud, .leaderboard, #leaderboard, .overlay')
      .forEach(el => (el.style.display = 'none'));
  });

  for (const [name, x, y, why] of SPOTS) {
    await page.evaluate(([x, y]) => {
      state.camera.x = x; state.camera.y = y;
      state.camera.rotation = 0;
      draw();
    }, [x, y]);
    await page.waitForTimeout(160);
    await page.screenshot({ path: `${OUT}/cove-${name}.png` });
    console.log(`  ${name.padEnd(20)} (${x},${y})  ${why}`);
  }

  console.log('ERRORS', errors.length ? errors.slice(0, 6).join(' | ') : 'none');
  await browser.close();
})();

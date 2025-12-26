
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Load the game
  const filePath = path.resolve('regatta/index.html');
  await page.goto(`file://${filePath}`);

  // Wait for game to initialize
  await page.waitForTimeout(1000);

  // Check race status
  const status = await page.evaluate(() => window.state.race.status);
  console.log(`Race status: ${status}`);

  // Check particles count (specifically wakes)
  const particles = await page.evaluate(() => window.state.particles.filter(p => p.type === 'wake' || p.type === 'wake-wave'));
  console.log(`Wake particles count: ${particles.length}`);

  if (status === 'waiting' && particles.length > 0) {
      console.log("FAIL: Wakes are being generated in waiting state.");
  } else if (status === 'waiting' && particles.length === 0) {
      console.log("PASS: No wakes in waiting state.");
  } else {
      console.log("Unknown state.");
  }

  await browser.close();
})();

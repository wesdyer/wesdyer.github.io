// Shoot spots in a venue from a repo root, north-up at play scale (1 u = 1 px), HUD hidden.
// Usage: node eval/_propshot.js <repoRoot> <venue> <tag> <outdir> name:x:y [name:x:y ...]
// Compare a change by shooting the same spots from a `git worktree` of HEAD and from the tree.
const { chromium } = require('playwright');
const path = require('path');
const [root, venue, tag, OUT, ...spots] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch(); const errors = [];
  const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(root, 'regatta/index.html'));
  await page.waitForTimeout(1500);
  // The pond is the Sailing School's water and only loads through School.start.
  await page.evaluate((v) => { if (v === 'pond') School.start(4); else { settings.venue = v; resetGame(); startRace(); } }, venue);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { state.paused = true; state.camera.target = 'none'; state.camera.mode = 'north'; state.camera.rotation = 0;
    for (const b of state.boats || []) { b.x = 1e7; b.y = 1e7; }
    document.querySelectorAll('.hud, #hud, .leaderboard, #leaderboard, .overlay').forEach(el => (el.style.display = 'none')); });
  for (const s of spots) {
    const [name, x, y] = s.split(':');
    await page.evaluate(([x, y]) => { state.camera.x = x; state.camera.y = y; state.camera.rotation = 0; draw(); }, [+x, +y]);
    await page.waitForTimeout(300);
    await page.evaluate(() => draw()); await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/${venue}-${name}-${tag}.png` });
  }
  console.log(venue, tag, 'errors:', errors.slice(0, 4).join(' | ') || 'none');
  await browser.close();
})();

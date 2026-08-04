// Capture a floe colony over time so the waddle can actually be seen.
// Frames are cropped around a penguin-bearing floe, computed from the live
// camera transform (translate + rotation) rather than by moving the camera.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const REPO = '/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta';
const OUT = process.argv[2];
const FRAMES = 8, GAP = 130, BOX = 260;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  await page.goto('file://' + path.resolve(REPO, 'index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { settings.venue = 'arctic'; window.resetGame && resetGame(); window.startRace && startRace(); });
  await page.waitForTimeout(6000);

  const stats = await page.evaluate(() => {
    const fl = state.course.islands.filter(i => i.isFloe);
    const withP = fl.filter(i => i.penguins);
    return {
      floes: fl.length,
      colonies: withP.length,
      birds: withP.reduce((s, i) => s + i.penguins.birds.length, 0),
      species: withP.reduce((m, i) => (m[i.penguins.species] = (m[i.penguins.species] || 0) + 1, m), {}),
      spriteLoaded: Object.fromEntries(Object.entries(penguinImgs).map(([k, v]) => [k, v.complete && v.naturalWidth > 0])),
    };
  });
  console.log('STATS', JSON.stringify(stats));

  await page.evaluate((want) => {
    for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
    // Park the player (and therefore the camera, which lerps to it) beside the
    // biggest colony. Fighting the camera loop frame-by-frame is racy; moving
    // what it follows is stable.
    const pool = state.course.islands.filter(i => i.penguins);
    const target = (pool.filter(i => i.penguins.species === want).length ? pool.filter(i => i.penguins.species === want) : pool)
        .sort((a, b) => b.penguins.birds.length - a.penguins.birds.length)[0];
    const p = state.boats[0];
    p.x = target.x + 150; p.y = target.y + 150; p.speed = 0;
    state.camera.x = p.x; state.camera.y = p.y;
    window.__target = target;
  }, process.argv[3] || '');
  await page.waitForTimeout(700);

  fs.mkdirSync(OUT, { recursive: true });
  for (let f = 0; f < FRAMES; f++) {
    const loc = await page.evaluate(() => {
      const cam = state.camera, cv = document.querySelector('canvas');
      const best = window.__target;
      if (!best) return null;
      const rot = cam.rotation || 0, c = Math.cos(rot), s = Math.sin(rot);
      const dx = best.x - cam.x, dy = best.y - cam.y;
      return {
        sx: cv.width / 2 + dx * c + dy * s,
        sy: cv.height / 2 - dx * s + dy * c,
        species: best.penguins.species, n: best.penguins.birds.length, r: Math.round(best.radius),
      };
    });
    if (!loc) { console.log('no colony found'); break; }
    const x = Math.round(loc.sx - BOX / 2), y = Math.round(loc.sy - BOX / 2);
    if (x >= 0 && y >= 0 && x + BOX <= 1400 && y + BOX <= 900) {
      await page.screenshot({ path: path.join(OUT, `f${f}.png`), clip: { x, y, width: BOX, height: BOX } });
      if (f === 0) console.log('TARGET', JSON.stringify(loc));
    } else if (f === 0) {
      console.log('offscreen, using full frame', JSON.stringify(loc));
      await page.screenshot({ path: path.join(OUT, `f${f}.png`) });
    }
    await page.waitForTimeout(GAP);
  }
  console.log('ERRORS', errors.length ? errors.slice(0, 4).join(' | ') : 'none');
  await browser.close();
})();

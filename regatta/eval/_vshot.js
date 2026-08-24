// Deterministic scene screenshot for render-change verification.
//   PERF_VENUE=river VSHOT_OUT=/tmp/a.png node regatta/eval/_vshot.js
// Boots the venue with the seeded RNG the perf instrument uses, settles the same 3600
// frames, freezes the sim, waits for every sprite image to land, draws, and screenshots
// the canvas. Two trees run with the same venue produce pixel-comparable scenes.
const { chromium } = require('playwright');
const path = require('path');

const VENUE = process.env.PERF_VENUE || 'seatrials';
const OUT = process.env.VSHOT_OUT || ('/tmp/vshot_' + VENUE + '.png');
const ROOT = process.env.VSHOT_ROOT || '.';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.waitForTimeout(1400);
  await page.evaluate((__V) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: __V }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace();
    // ⚠️ 900 frames, NOT 3600: river/lagoon/swamp carry a per-process two-outcome
    // bifurcation (standing rule 30 — river t=20.5s, lagoon t=96s) and a settle that
    // crosses it produces two DIFFERENT RACES in two processes, which reads as a giant
    // spurious pixel diff. 15s stays inside every venue's window while still putting
    // wakes, particles and the spread fleet on screen. (Swamp diverges at t=1 — its
    // fleet may differ; judge its static layers by eye, not by diff count.)
    for (let i = 0; i < 900; i++) { update(1 / 60); if (i % 10 === 0) updateLeaderboard(); }
    state.paused = true;
  }, VENUE);
  // Let lazy sprite art land, then draw a settled frame. state.time is frozen with the
  // sim, so animated layers (foam scroll, glints) paint identically across trees.
  await page.waitForTimeout(3000);
  // 25 draws: past the adaptive strata's ~14 calibration frames, so the capture
  // exercises whichever path (live or tile blit) the chooser locked.
  await page.evaluate(() => { for (let i = 0; i < 25; i++) draw(); });
  const canvas = await page.$('#gameCanvas') || await page.$('canvas');
  await canvas.screenshot({ path: OUT });
  console.log(OUT, 'errors:', errs.length ? errs.slice(0, 3) : 'none');
  await browser.close();
})();

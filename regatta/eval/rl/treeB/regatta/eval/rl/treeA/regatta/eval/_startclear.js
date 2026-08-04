// Does any ice land on the starting grid? Measures, over many seeds, the gap
// between each boat's spawn position and the nearest floe EDGE (centre distance
// minus the floe's radius). Ten boat lengths is 560 units; the hull is ~56.
const { chromium } = require('playwright');
const path = require('path');
const REPO = path.resolve(__dirname, '../..');
const N = parseInt(process.argv[2]) || 40;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
  await page.goto('file://' + path.resolve(REPO, 'regatta/index.html'));
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async (N) => {
    const gaps = []; let worst = Infinity, worstSeed = null, under = 0, boats = 0;
    for (let k = 0; k < N; k++) {
      let s = 900 + k * 7717;
      Math.random = () => { s += 0x6D2B79F5; let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame();
      const fl = state.course.islands.filter(i => i.isFloe);
      for (const b of state.boats) {
        boats++;
        let g = Infinity;
        for (const f of fl) g = Math.min(g, Math.hypot(f.x - b.x, f.y - b.y) - f.radius);
        gaps.push(g);
        if (g < 560) under++;
        if (g < worst) { worst = g; worstSeed = k; }
      }
    }
    gaps.sort((a, b) => a - b);
    return { races: N, boats, worstGap: Math.round(worst), worstSeed,
             p1: Math.round(gaps[Math.floor(gaps.length * 0.01)]),
             median: Math.round(gaps[gaps.length >> 1]),
             boatsUnder560: under };
  }, N);
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();

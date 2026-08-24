const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1400);
  for (const v of ['bay','lake','lagoon','swamp','river','ocean','redrock','glowtide','arctic','seatrials']) {
    const out = await page.evaluate((__V) => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: __V }));
      resetGame();
      const isl = state.course.islands || [];
      const S = 1500 * 950;
      let paint = 0, shoal = 0, vegB = 0, vegS = 0, reef = 0;
      let aPaint = 0, aShoal = 0, aVegB = 0, aVegS = 0, aReef = 0;
      for (const i of isl) {
        if (i.hidden) continue;
        const a = Math.PI * i.radius * i.radius / S;   // screens
        const spec = i.veg && window.VEG_STYLES ? VEG_STYLES[i.veg] : null;
        if (i.veg && spec) { if (spec.plane === 'bottom') { vegB++; aVegB += a; } else { vegS++; aVegS += a; } }
        else if (i.paint) { paint++; aPaint += a; }
        else if (i.awash && !i.reef) { shoal++; aShoal += a; }
        if (i.reef) { reef++; aReef += a; }
      }
      const f = (n) => +n.toFixed(1);
      let big2 = 0, big4 = 0, sizes = [];
      for (const i of isl) {
        if (i.hidden) continue;
        const zone = i.paint || i.awash || i.reef || i.veg;
        if (!zone) continue;
        const a = Math.PI * i.radius * i.radius / S;
        sizes.push(+a.toFixed(1));
        if (a >= 2) big2++;
        if (a >= 4) big4++;
      }
      sizes.sort((x, y) => y - x);
      return { zones: sizes.length, big2, big4, top8: sizes.slice(0, 8),
               paint, shoal, reef, vegB, vegS };
    }, v);
    console.log(v.padEnd(9), JSON.stringify(out));
  }
  await browser.close();
})();

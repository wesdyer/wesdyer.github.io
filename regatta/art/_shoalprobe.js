// What the ENGINE actually paints each shoal look, per venue. Calls shoalTintFor itself
// rather than reimplementing it, so it cannot drift from the thing it is measuring.
//   node regatta/art/_shoalprobe.js [venue...]
const { chromium } = require('playwright');
const path = require('path');

const ALL = ['lake', 'bay', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'seatrials'];
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1200);

  console.log('venue      hero      shallow   | look          painted   present?');
  for (const v of targets) {
    const out = await page.evaluate((venue) => {
      settings.venue = venue; resetGame();
      const W = window.WATER_CONFIG || {};
      const hex = a => '#' + a.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
      const awash = {};
      for (const i of (state.course.islands || [])) if (i.awash) awash[i.style] = (awash[i.style] || 0) + 1;
      return {
        hero: W.heroColor || '-', shallow: W.shallowColor || '-',
        looks: ['shoal', 'coralshoal', 'mudflat'].map(l => ({
          l, painted: hex(shoalTintFor({ style: l })), n: awash[l] || 0 })),
      };
    }, v);
    for (const r of out.looks) {
      if (r.l === 'mudflat' && !r.n) continue;
      console.log(`${v.padEnd(10)} ${out.hero.padEnd(9)} ${out.shallow.padEnd(9)} | ${r.l.padEnd(12)} ${r.painted}`
                  + (r.n ? `   ${r.n} shape(s)` : ''));
    }
  }
  console.log('\nERRORS', errors.length ? errors.slice(0, 4) : 'none');
  await browser.close();
})();

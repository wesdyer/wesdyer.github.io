// THE COLOUR RAMP, BOTH CANDIDATES, OVER REAL VENUE WATER.
//
// `wind` is what ships; `heat` is the literal white -> green -> yellow -> orange -> red
// proposal, kept in STREAK_PALETTES for exactly this comparison. Draws each as swatches
// across the knot scale, over each venue's own water, because the two objections recorded
// against the literal ramp are both about what it sits ON: the fleet's orange at 26 kt, and
// Gatorgrass's olive water at 7-14 kt. A ramp cannot be judged on white.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1300);
  const data = await p.evaluate(() => {
    const out = { palettes: {}, waters: {}, ktMax: STREAK_KT_MAX };
    for (const name of Object.keys(STREAK_PALETTES)) {
      const lut = buildStreakLut(name);
      out.palettes[name] = lut;
    }
    for (const v of ['lake', 'swamp', 'ocean', 'glowtide', 'redrock']) {
      const d = window.VENUE_DOC && window.VENUE_DOC[v];
      out.waters[v] = (d && d.palette && d.palette.baseColor) || '#0ea5e9';
    }
    return out;
  });
  fs.writeFileSync(`${OUT}/_ramp.json`, JSON.stringify(data));
  console.log('  palettes:', Object.keys(data.palettes).join(', '), ' scale 0 -', data.ktMax, 'kt');
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();

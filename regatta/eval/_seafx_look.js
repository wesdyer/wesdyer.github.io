// Contact sheet off the sea-effects bench: N frames of one mode, tiled, so a cycle of
// slams or a whole ride can be judged in one image.
// Usage: node eval/_seafx_look.js <mode> [stepSecs] [cols] [rows]
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad';
const mode = process.argv[2] || 'surf';
const STEP = parseFloat(process.argv[3] || '0.30');
const COLS = parseInt(process.argv[4] || '3', 10);
const ROWS = parseInt(process.argv[5] || '2', 10);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  // Anything after the mode is passed through as bench query params, e.g. `surf=0.8`.
  const extra = process.argv.slice(6).join('&');
  await p.goto('file://' + path.resolve('regatta/eval/_seafx_bench.html') + '?m=' + mode + (extra ? '&' + extra : ''));
  await p.waitForFunction(() => !!window.__advance);

  for (let i = 0; i < COLS * ROWS; i++) {
    const st = await p.evaluate((s) => { window.__advance(s); return window.__stats(); }, STEP);
    if (i === 0 || i === COLS * ROWS - 1) console.log('  ', JSON.stringify(st));
    await p.screenshot({ path: `${OUT}/_sfx_${mode}_${i}.png` });
  }
  console.log('ERRORS', errs.length ? errs.slice(0, 6).join('\n') : 'none');
  await b.close();
})();

// PT-045: the character picker with every character open (?unlocks=off), shot for a look at the new portraits.
//   OUT=dir node eval/rl/_pt045_picker.js
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('requestfailed', r => errs.push('failed ' + r.url().split('/').pop()));
  await p.goto('file://' + path.resolve('index.html') + '?unlocks=off');
  await p.waitForFunction(() => window.state && typeof openCharacterPicker === 'function');
  await p.evaluate(() => openCharacterPicker()); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/pt045_picker.png` });
  const broken = await p.evaluate(() => [...document.images].filter(i => /competitors/.test(i.src) && i.complete && i.naturalWidth === 0).map(i => i.src.split('/').pop()));
  console.log('broken portraits:', broken.length, broken.slice(0, 5).join(' '));
  console.log(errs.length ? 'errors: ' + errs.slice(0, 5).join(' | ') : 'no page errors'); await b.close(); })();

// The Time Trial board's records block in its three cases: no time yet, your best slower than the
// course's target, your best faster (then it IS the time to beat).   OUT=dir node eval/rl/_tobeat_shot.js
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT, V = process.env.VENUE || 'lagoon';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc);
  const prov = await p.evaluate((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: 'Muninn' })); resetGame(); return provisionalRecord(v); }, V);
  console.log('target', prov);
  for (const [tag, t] of [['none', null], ['slower', prov + 9.4], ['faster', prov - 3.27]]) {
    const txt = await p.evaluate(({ v, t }) => {
      localStorage.setItem('regatta_bests', JSON.stringify(t == null ? {} : { [venueBestKey(v)]: { t } }));
      renderVenueDetail(v); return document.querySelector('.vs-record').innerText.replace(/\s+/g, ' ');
    }, { v: V, t });
    console.log(tag.padEnd(7), txt);
    const el = await p.$('.vs-record'); await el.screenshot({ path: `${OUT}/tobeat_${tag}.png` });
  }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close(); })();

// World-tile rebake diagnostics: counts bakes across 300 frozen draws.
const { chromium } = require('playwright');
const path = require('path');
const VENUE = process.env.PERF_VENUE || 'lake';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1400);
  const out = await page.evaluate((__V) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: __V }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace();
    for (let i = 0; i < 1200; i++) update(1 / 60);
    state.paused = true;
    for (let i = 0; i < 20; i++) draw();
    window.__wtBakes = 0;
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) draw();
    const ms = (performance.now() - t0) / 300;
    const tiles = {};
    for (const [n, t] of [['seabed', _seabedTile], ['float', _floatTile]]) {
      tiles[n] = { mode: t.mode, fill: t.fillAvg == null ? null : +t.fillAvg.toFixed(2) };
    }
    return { bakes: window.__wtBakes, ms: ms.toFixed(2), tiles,
             modes: window.__wtModes || {},
             anyFloe: state.course._anyFloe,
             camera: [state.camera.x | 0, state.camera.y | 0] };
  }, VENUE);
  console.log(VENUE, JSON.stringify(out, null, 1));
  console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
  await browser.close();
})();

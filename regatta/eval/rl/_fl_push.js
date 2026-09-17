// PUSH-OFF PROBE: at a grounding point, the two terms of Tide.afterMove's shove — the
// channel-ward pull (−F.gx/gy) and the downhill unit vector — and their sum's length.
//   node _fl_push.js x,y [x,y ...]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '../../..'); const PTS = process.argv.slice(2).map(s => s.split(',').map(Number));
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); window.evalHarness.seed = 1; resetGame(); startRace(); });
  const r = await page.evaluate((PTS) => {
    const T = state.tide, F = T.field; const g = state.course.botGrid;
    const fieldAt = (arr, x, y) => { const i = Math.round((x - F.x0) / F.res), j = Math.round((y - F.y0) / F.res); if (i < 0 || j < 0 || i >= F.W || j >= F.H) return 0; return arr[j * F.W + i]; };
    return PTS.map(([x, y]) => {
      const eps = F.res; const zx = Tide.groundAt(x + eps, y) - Tide.groundAt(x - eps, y), zy = Tide.groundAt(x, y + eps) - Tide.groundAt(x, y - eps); const gl = Math.hypot(zx, zy);
      const cgx = fieldAt(F.gx, x, y), cgy = fieldAt(F.gy, x, y);
      let dx = -cgx, dy = -cgy; if (gl > 1e-6) { dx += -zx / gl; dy += -zy / gl; }
      const neckN = state.course.doc.shapes.find(s => s.id === 'neck-n');
      return { x, y, res: F.res, gridRes: g.res, chanPull: [+(-cgx).toFixed(2), +(-cgy).toFixed(2)], downhill: [+(-zx / gl).toFixed(2), +(-zy / gl).toFixed(2)], slope: +gl.toFixed(3), sumLen: +Math.hypot(dx, dy).toFixed(3), neckN: neckN && JSON.stringify(neckN.outer) };
    });
  }, PTS);
  for (const o of r) console.log(JSON.stringify(o));
  await browser.close();
})();

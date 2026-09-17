// GROUND PROBE (flats push): the tide field's ground height and the depth at HW/LW at
// given points, plus a small raster around each (res 40 u) — is the boat on a lip that
// never wets?   node _fl_ground.js x,y [x,y ...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const PTS = process.argv.slice(2).map(s => s.split(',').map(Number));
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message.slice(0, 200)));
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); window.evalHarness.seed = 1; resetGame(); startRace(); });
  const r = await page.evaluate((PTS) => {
    const out = [];
    const T = state.tide; const g = state.course.botGrid;
    for (const [x, y] of PTS) {
      const z = Tide.groundAt(x, y);
      const land = state.course.islands.filter(i => !i.awash && !i.hidden).some(i => { const v = i.vertices; let ins = false; for (let a = 0, b = v.length - 1; a < v.length; b = a++) { if ((v[a].y > y) !== (v[b].y > y) && x < (v[b].x - v[a].x) * (y - v[a].y) / (v[b].y - v[a].y) + v[a].x) ins = !ins; } return ins; });
      const c = g.cell(x, y); const k = c[1] * g.n + c[0];
      let ras = '';
      for (let dy = -160; dy <= 160; dy += 40) { let row = ''; for (let dx = -160; dx <= 160; dx += 40) { const zz = Tide.groundAt(x + dx, y + dy); row += (zz > 0.5 ? '#' : zz > -0.5 ? '+' : zz > -1.6 ? '.' : ' '); } ras += row + '\n'; }
      out.push({ x, y, z: +z.toFixed(2), depthHW: +(T.mid + T.amp - z).toFixed(2), depthLW: +(T.mid - T.amp - z).toFixed(2), landPoly: land, nav: g.nav[k], risk: g._risk ? g._risk[k] : null, elevCell: g._elev ? +g._elev[k].toFixed(2) : null, ras });
    }
    return out;
  }, PTS);
  for (const o of r) { console.log(`(${o.x},${o.y}) ground ${o.z} m  depth@HW ${o.depthHW}  @LW ${o.depthLW}  inLandPoly ${o.landPoly}  nav ${o.nav} risk ${o.risk} cellElev ${o.elevCell}`); console.log(o.ras.split('\n').map(l => '    ' + l).join('\n')); }
  await browser.close();
})();

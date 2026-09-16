// FLATS CHART — the whole estuary at chosen states of the tide, drawn by the game's own tide
// layer (Tide.drawWet / drawDry) into a big canvas, plus the marsh, the channels, the marks
// and the chart path. Scratch tool for the Spoonbill Flats build.
//   NODE_PATH=node_modules node regatta/eval/_flats_chart.js out/ [race-seconds ...]
// Default states: 0 (HW at the gun), 15 (mean, falling), 30 (LW), 45 (mean, rising).
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve('.');
const OUT = process.argv[2] || '/tmp/';
const TIMES = process.argv.slice(3).map(Number);
if (!TIMES.length) TIMES.push(0, 15, 30, 45);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data); }); });
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${server.address().port}/regatta/index.html`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { settings.venue = 'flats'; resetGame(); startRace(); });
  await page.waitForFunction(() => state.course && state.course.loadState === 'full' && state.tide, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const F = state.tide.field;
    return { cells: F.cells, W: F.W, H: F.H, ms: Math.round(F.ms), period: state.tide.period, phase0: state.tide.phase0,
             dmc: state.course.dmc ? Math.round(state.course.dmc.total) : null, est: state.course.estSecs || null,
             grid: state.course.botGrid ? state.course.botGrid.n : null, boats: state.boats.length };
  });
  console.log('field', JSON.stringify(info));
  for (const t of TIMES) {
    const dataUrl = await page.evaluate((t) => {
      const doc = state.course.doc;
      const bb = doc.world.boundary.poly;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of bb) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      const k = 0.16;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil((x1 - x0) * k); cv.height = Math.ceil((y1 - y0) * k);
      const g = cv.getContext('2d');
      g.fillStyle = (window.WATER_CONFIG && WATER_CONFIG.baseColor) || '#3a6394';
      g.fillRect(0, 0, cv.width, cv.height);
      g.save(); g.scale(k, k); g.translate(-x0, -y0);
      state.race.status = 'racing'; state.race.timer = t;
      // the tide's own picture, over the whole world: force a fresh window at chart scale
      const P = Tide._pic; P.cvWet = null; P.cvDry = null; P.level = NaN;
      const old = TIDE.pxU; window.__TIDE = { pxU: 12 };
      Tide.drawWet(g);
      // marsh
      for (const isl of state.course.islands) {
        if (isl.kind !== 'flats-marsh' || isl.hidden) continue;
        g.beginPath();
        const v = isl.vertices; g.moveTo(v[0].x, v[0].y); for (let i = 1; i < v.length; i++) g.lineTo(v[i].x, v[i].y); g.closePath();
        g.fillStyle = '#8f8f52'; g.fill('evenodd');
      }
      Tide.drawDry(g);
      window.__TIDE = null;
      // the chart path
      const dmc = state.course.dmc;
      if (dmc) { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 12; g.setLineDash([60, 40]); g.beginPath();
        for (const L of dmc.legs) for (let i = 0; i < L.pts.length; i++) { const p = L.pts[i]; if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); }
        g.stroke(); g.setLineDash([]); }
      // marks
      for (const m of state.course.marks) { g.beginPath(); g.arc(m.x, m.y, 60, 0, 6.283); g.fillStyle = m.type === 'start' ? '#f59e0b' : '#ef4444'; g.fill(); }
      // boats
      for (const b of state.boats) { g.beginPath(); g.arc(b.x, b.y, 40, 0, 6.283); g.fillStyle = b.isPlayer ? '#fff' : '#111'; g.fill(); }
      g.restore();
      g.fillStyle = '#fff'; g.font = 'bold 28px sans-serif';
      const L = Tide.levelAt(t);
      g.fillText(`t=${t}s  level ${L.toFixed(2)} m  ${Tide.flow() >= 0 ? 'flooding' : 'ebbing'}`, 20, 40);
      return cv.toDataURL('image/png');
    }, t);
    const file = path.join(OUT, `flats-chart-t${t}.png`);
    fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('wrote', file);
  }
  console.log('ERRORS', errors.length ? errors.slice(0, 8).join('\n') : 'none');
  await browser.close(); server.close();
})();

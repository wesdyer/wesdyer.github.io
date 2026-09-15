// OTTER WIND PROBE — sample the MEAN wind field (oscillator off, lees in) on a grid over the arena and
// report seam leaks (region weights summing under 1 = calm nobody authored) and the validator's verdict.
//   cd <repo root>; CAND=<venue doc to inject, optional> VENUE=otter STEP=100 NODE_PATH=node_modules node regatta/eval/_otter_wind_probe.js out.json
// Pairs with art/otter_wind.js (--out writes a candidate document) and _otter_wind_map.py (renders out.json).
// Sample the MEAN wind field (oscillator off) of a venue on a grid over the boundary, plus the casters.
//   VENUE=otter STEP=100 NODE_PATH=node_modules node probe_field.js out.json
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve('.'); const OUT = process.argv[2]; const STEP = +(process.env.STEP || 100);
const CAND = process.env.CAND ? (() => { const t = fs.readFileSync(process.env.CAND, 'utf8'); const k = 'window.VENUE_DOC["otter"] = '; return JSON.parse(t.slice(t.indexOf(k) + k.length).trim().slice(0, -1)).wind; })() : null;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data); }); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
  await page.goto(`http://127.0.0.1:${server.address().port}/regatta/index.html`);
  await page.waitForFunction(() => typeof state !== 'undefined' && state.boats && state.boats.length > 0, null, { timeout: 30000 });
  const VENUE = process.env.VENUE || 'otter';
  const res = await page.evaluate(([venue, step, cand]) => {
    if (cand) window.VENUE_DOC[venue].wind = cand;
    let s = 7; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    selectVenue(venue); resetGame(); startRace();
    for (let i = 0; i < 30; i++) update(1 / 30);
    WIND_MEAN_FIELD = true;
    const bnd = state.course.boundary;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const pt of bnd.poly) { x0 = Math.min(x0, pt[0]); y0 = Math.min(y0, pt[1]); x1 = Math.max(x1, pt[0]); y1 = Math.max(y1, pt[1]); }
    const cols = Math.ceil((x1 - x0) / step) + 1, rows = Math.ceil((y1 - y0) / step) + 1;
    const spd = new Array(rows * cols).fill(-1), dir = new Array(rows * cols).fill(0), sh = new Array(rows * cols).fill(1), ws = new Array(rows * cols).fill(0);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = x0 + i * step, y = y0 + j * step;
      if (!Arena.contains(bnd, x, y, 0) || !inMaskWater(x, y)) continue;
      const w = getWindAt(x, y); const m = regionWindAt(x, y);
      spd[j * cols + i] = +w.speed.toFixed(2); dir[j * cols + i] = +(w.direction * 180 / Math.PI).toFixed(1);
      sh[j * cols + i] = +(m.speed > 0 ? w.speed / m.speed : 1).toFixed(3);
      let wsum = 0; for (const r of state.course.windRegions) { const bb = r.bb, pad = (r.falloff || 0) / 2 + 1; if (x < bb.minX - pad || x > bb.maxX + pad || y < bb.minY - pad || y > bb.maxY + pad) continue; wsum += VenueDoc.regionWeight(Arena.signedDist(r, x, y), r.falloff); }
      ws[j * cols + i] = +wsum.toFixed(3);
    }
    const list = state.course.navIslands || state.course.islands;
    const casters = list.filter(isl => shadowLengthOf(isl, 'wind') > 0).map(isl => ({ id: isl.id, kind: isl.kind, x: Math.round(isl.x), y: Math.round(isl.y), r: Math.round(isl.radius), len: Math.round(shadowLengthOf(isl, 'wind')), h: isl.height, prop: !!isl.propId || !!isl.fromProp }));
    let val = null; try { const v = VenueDoc.validate(window.VENUE_DOC[venue]); val = JSON.stringify(v).slice(0, 1500); } catch (e) { val = 'validate threw: ' + e.message; }
    return { val, x0, y0, step, cols, rows, spd, dir, sh, ws, casters, base: { dir: +(state.wind.direction * 180 / Math.PI).toFixed(1), spd: +state.wind.speed.toFixed(2), baseDir: +(state.wind.baseDirection * 180 / Math.PI).toFixed(1) }, nIslands: list.length,
      marks: state.course.marks.map(m => ({ id: m.id, x: Math.round(m.x), y: Math.round(m.y) })) };
  }, [VENUE, STEP, CAND]);
  fs.writeFileSync(OUT, JSON.stringify(res));
  const leak = res.ws.filter((w, i) => res.spd[i] >= 0 && w < 0.98).length, over = res.ws.filter((w, i) => res.spd[i] >= 0 && w > 1.6).length, water = res.spd.filter(v => v >= 0).length;
  console.log('grid', res.cols, 'x', res.rows, 'base', JSON.stringify(res.base), 'casters', res.casters.length, 'of', res.nIslands, 'water cells', water, 'cells with weight<0.98:', leak, 'weight>1.6:', over, `(${(100 * over / water).toFixed(1)}%)`);
  const weak = []; res.ws.forEach((w, i) => { if (res.spd[i] >= 0 && w < 0.98) weak.push([res.x0 + (i % res.cols) * res.step, res.y0 + Math.floor(i / res.cols) * res.step, w]); });
  console.log('weak cells:', JSON.stringify(weak.slice(0, 12)));
  console.log('validate:', res.val);
  console.log('ERRORS', errors.length ? errors.slice(0, 6).join('\n') : 'none');
  await browser.close(); server.close();
})();

// The editor with curved shapes: Bay's mid-island drawn as its curve over a dashed control polygon, the
// Curved toggle, and K turning a hovered point into a corner (square handle) and back.
//   SHOT_OUT=dir NODE_PATH=node_modules node regatta/eval/_editor_curve_shot.js
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve('.'); const OUT = process.env.SHOT_OUT || require('os').tmpdir();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data); }); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/regatta/editor.html`);
  await page.waitForFunction(() => window.EditorApp && typeof EditorApp.loadVenue === 'function', null, { timeout: 30000 });
  await page.evaluate(() => EditorApp.loadVenue('bay')); await page.waitForTimeout(2500);
  // the smooth shape under the mid-island point
  const info = await page.evaluate(() => {
    const A = EditorApp, doc = A._state().doc;
    const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const l = doc.shapes.find(s => s.smooth && inRing(-586, -8, s.outer)) || doc.shapes.find(s => s.smooth);
    A._setMode('shape'); A._pickTool('direct'); A._selectShape(l.id);
    const xs = l.outer.map(p => p[0]), ys = l.outer.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const cv = document.getElementById('schematic'), w = cv.clientWidth, h = cv.clientHeight;
    const sc = 0.85 * Math.min(w / (Math.max(...xs) - Math.min(...xs)), h / (Math.max(...ys) - Math.min(...ys)));
    A._setView(cx, cy, sc);
    return { id: l.id, kind: l.kind, n: l.outer.length, cx, cy, sc, w, h, v0: l.outer[3] };
  });
  console.log('shape', info.id, info.kind, info.n, 'pts');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/editor-curve.png` });
  // hover point 3 and press C
  const box = await page.locator('#schematic').boundingBox();
  const sx = box.x + (info.v0[0] - info.cx) * info.sc + info.w / 2, sy = box.y + (info.v0[1] - info.cy) * info.sc + info.h / 2;
  await page.mouse.move(sx - 3, sy - 3); await page.mouse.move(sx, sy); await page.waitForTimeout(100); console.log('hover', JSON.stringify(await page.evaluate(() => { const h = EditorApp._hover(); return { shape: h.shape, vert: h.vert }; }))); await page.keyboard.press('k'); await page.waitForTimeout(200);
  const after = await page.evaluate((id) => { const l = EditorApp._state().doc.shapes.find(s => s.id === id); const hv = EditorApp._hover().vert; return { cornerAtHover: !!l.outer[hv][2], corners: l.outer.filter(p => p[2]).length, dirty: EditorApp._state().dirty, insp: document.getElementById('insp-obj').innerText.match(/A curve through[^.]*\./)?.[0] }; }, info.id);
  console.log('after K:', JSON.stringify(after));
  await page.screenshot({ path: `${OUT}/editor-curve-corner.png` });
  // Curved off via the inspector checkbox, then undo
  await page.evaluate(() => { const c = document.getElementById('in-smooth'); c.checked = false; c.dispatchEvent(new Event('change')); });
  const off = await page.evaluate((id) => !!EditorApp._state().doc.shapes.find(s => s.id === id).smooth, info.id);
  await page.screenshot({ path: `${OUT}/editor-curve-off.png` });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
  const undone = await page.evaluate((id) => !!EditorApp._state().doc.shapes.find(s => s.id === id).smooth, info.id);
  console.log('checkbox off -> smooth', off, '; after undo -> smooth', undone);
  console.log('ERRORS', errors.length ? errors.slice(0, 5).join(' | ') : 'none');
  await browser.close(); server.close(); })();

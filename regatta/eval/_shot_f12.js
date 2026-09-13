// F12 screenshot check: press the real key on a live race and diff the download
// against a true screenshot of the same frozen frame, at 1x and 2x.
// Serves the repo over http itself: over file:// every image is cross-origin, the
// game canvas is tainted, and no capture path can read it back.
// Usage: node regatta/eval/_shot_f12.js   (from the repo root). Writes eval/_f12_*.png.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve('.');
const OUT = path.resolve('regatta/eval');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
  });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/regatta/index.html`;
  const browser = await chromium.launch();
  let fail = 0;
  for (const dpr of [1, 2]) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: dpr, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/tailwindcss|AudioContext/.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.evaluate(() => { resetGame(); startRace(); });
    await page.waitForTimeout(9000);
    await page.evaluate(() => { state.paused = true; });   // freeze draw() without the pause menu
    await page.waitForTimeout(300);
    const realPath = `${OUT}/_f12_real_${dpr}x.png`, shotPath = `${OUT}/_f12_shot_${dpr}x.png`;
    await page.screenshot({ path: realPath });
    const t0 = Date.now();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.keyboard.press('F12')]);
    const ms = Date.now() - t0;
    await dl.saveAs(shotPath);
    const toast = await page.evaluate(() => document.getElementById('toast-message').textContent);
    // Diff in the browser: no PNG decoder in node_modules, and a canvas is one anyway.
    const [a, b] = [realPath, shotPath].map(p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64'));
    const d = await page.evaluate(async ([a, b]) => {
      const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
      const px = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const pa = px(ia), pb = px(ib); let same = 0, big = 0; const n = pa.length / 4;
      for (let i = 0; i < pa.length; i += 4) {
        const m = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
        if (m === 0) same++; else if (m > 32) big++;
      }
      return { size: `${ia.width}x${ia.height}`, same: +(100 * same / n).toFixed(2), big: +(100 * big / n).toFixed(3) };
    }, [a, b]);
    const ok = d.same !== undefined && d.same > 97 && d.big < 0.5 && errors.length === 0 && toast === 'Screenshot Saved';
    if (!ok) fail++;
    console.log(`${dpr}x  ${ok ? 'PASS' : 'FAIL'}  file=${dl.suggestedFilename()}  ${d.size}  identical=${d.same}%  >32=${d.big}%  ${ms}ms  toast="${toast}"`);
    if (errors.length) console.log('   errors:', errors.slice(0, 5).join('\n   '));
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(fail ? `FAIL — ${fail} run(s)` : 'PASS');
  process.exit(fail ? 1 : 0);
})();

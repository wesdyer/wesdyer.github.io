// Raw cost of a full-screen drawImage under the camera transform, by source size and
// sampling mode. Uses its own untainted destination canvas (the game one is tainted
// under file://) and forces rasterization with a 1px getImageData per batch.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1200);
  const out = await page.evaluate(() => {
    const res = {};
    const dst = document.createElement('canvas');
    dst.width = 1500; dst.height = 950;
    const dctx = dst.getContext('2d');
    const mk = (size) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      for (let i = 0; i < 400; i++) {
        g.fillStyle = `hsla(${i},60%,50%,0.7)`;
        g.beginPath(); g.arc((i * 631) % size, (i * 271) % size, 40, 0, 7); g.fill();
      }
      g.getImageData(0, 0, 1, 1);
      return c;
    };
    const big = mk(2576), half = mk(1288);
    const rot = 0.6;
    const N = 60;
    const run = (label, fn) => {
      fn(); dctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now();
      for (let i = 0; i < N; i++) fn();
      dctx.getImageData(0, 0, 1, 1);
      res[label] = ((performance.now() - t0) / N).toFixed(2);
    };
    const setup = (smooth) => {
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.imageSmoothingEnabled = smooth;
      dctx.translate(750, 475); dctx.rotate(rot); dctx.translate(-750, -475);
    };
    run('full_bilinear', () => { dctx.save(); setup(true);  dctx.drawImage(big, -538, -813); dctx.restore(); });
    run('full_nearest',  () => { dctx.save(); setup(false); dctx.drawImage(big, -538, -813); dctx.restore(); });
    run('half_bilinear', () => { dctx.save(); setup(true);  dctx.drawImage(half, -538, -813, 2576, 2576); dctx.restore(); });
    run('half_nearest',  () => { dctx.save(); setup(false); dctx.drawImage(half, -538, -813, 2576, 2576); dctx.restore(); });
    run('norot_full_bilinear', () => { dctx.save(); dctx.setTransform(1,0,0,1,0,0); dctx.imageSmoothingEnabled=true; dctx.drawImage(big, -538, -813); dctx.restore(); });
    run('norot_half_nearest', () => { dctx.save(); dctx.setTransform(1,0,0,1,0,0); dctx.imageSmoothingEnabled=false; dctx.drawImage(half, -538, -813, 2576, 2576); dctx.restore(); });
    run('norot_frac_bilinear', () => { dctx.save(); dctx.setTransform(1,0,0,1,0,0); dctx.imageSmoothingEnabled=true; dctx.drawImage(big, -538.37, -813.61); dctx.restore(); });
    run('norot_frac_nearest',  () => { dctx.save(); dctx.setTransform(1,0,0,1,0,0); dctx.imageSmoothingEnabled=false; dctx.drawImage(big, -538.37, -813.61); dctx.restore(); });
    const rect = document.createElement('canvas'); rect.width = 1756; rect.height = 1206;
    { const g = rect.getContext('2d'); g.fillStyle='#345'; g.fillRect(0,0,1756,1206); g.getImageData(0,0,1,1); }
    run('rect_frac_bilinear', () => { dctx.save(); dctx.setTransform(1,0,0,1,0,0); dctx.imageSmoothingEnabled=true; dctx.drawImage(rect, -128.4, -128.7); dctx.restore(); });
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();

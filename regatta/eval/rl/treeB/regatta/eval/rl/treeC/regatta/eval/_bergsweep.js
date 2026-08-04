// What does denser Arctic ice actually cost to PAINT?
//
// FPS in headless is too noisy to answer this — samples swing ~15 FPS run to run
// and the ordering comes out backwards. Two things fix it:
//
//  1. Force a flush. drawImage() returns before rasterising, so timing draw calls
//     alone under-reports paint badly. Reading one pixel forces the raster.
//  2. Alternate ablation. Measure a full frame with the floe pass ON and OFF,
//     interleaved in the same page, and take the median delta. Interleaving
//     cancels the JIT/GC drift that ruins sequential comparisons.
//
// The delta IS the ice's paint cost, which is the number the density question
// actually turns on.
const { chromium } = require('playwright');
const path = require('path');
const REPO = path.resolve(__dirname, '../..');
// http, not file:// — getImageData (the raster flush) throws on a file:// page's
// tainted canvas. Start: python3 -m http.server 8788
const BASE = process.env.BASE || 'http://localhost:8788';

const SEEDS = [101, 202, 303];
const CFGS = [
  { label: '1x baseline (ship)', d: 1 },
  { label: '2x, bergs 4',        d: 2 },
  { label: '3x, bergs 6',        d: 3 },
  { label: '3x, bergs 3',        d: 3, bergs: 3, mid: 12 },
  { label: '3x, bergs 2',        d: 3, bergs: 2, mid: 10 },
];
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));

  console.log(`seeds ${SEEDS.join(',')} — median of ${SEEDS.length}\n`);
  console.log('config                floes bergs  spriteMB   frame ms   ice ms   ice %');
  for (const c of CFGS) {
    const rows = [];
    for (const seed of SEEDS) {
      await page.goto(BASE + '/regatta/index.html');
      await page.waitForTimeout(1400);
      rows.push(await page.evaluate(async ({ c, seed }) => {
        let s = seed;
        Math.random = () => { s += 0x6D2B79F5; let t = s;
          t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        window.__FLOES = { density: c.d, bergs: c.bergs, mid: c.mid };
        selectVenue('arctic'); await new Promise(r => setTimeout(r, 400));
        document.getElementById('start-race-btn').click(); await new Promise(r => setTimeout(r, 600));
        state.race.timer = 2; await new Promise(r => setTimeout(r, 2500));

        const fl = state.course.islands.filter(i => i.isFloe);
        for (const f of fl) if (!f._sprite) bakeIslandSprite(f);
        const bytes = fl.reduce((a, f) => a + f._sprite.canvas.width * f._sprite.canvas.height * 4, 0);

        // park the camera on the thick of the pack — the worst case, and the
        // only place the answer matters
        let best = null;
        for (const f of fl) {
          let near = 0;
          for (const o of fl) if (Math.hypot(o.x - f.x, o.y - f.y) < 900) near++;
          if (!best || near > best.n) best = { n: near, f };
        }
        state.camera.x = best.f.x; state.camera.y = best.f.y;

        const real = window.drawIslands;
        const flush = () => ctx.getImageData(0, 0, 1, 1).data[0];
        const timeFrame = (iceOn) => {
          window.drawIslands = iceOn ? real : (c2, which) => { if (which !== 'floe') real(c2, which); };
          const t0 = performance.now(); draw(); flush(); return performance.now() - t0;
        };
        for (let i = 0; i < 12; i++) { timeFrame(true); timeFrame(false); }   // warm up
        const on = [], off = [];
        for (let i = 0; i < 40; i++) { on.push(timeFrame(true)); off.push(timeFrame(false)); }
        window.drawIslands = real;
        const m = a => { const q = [...a].sort((x, y) => x - y); return q[q.length >> 1]; };
        return { n: fl.length, bergs: fl.filter(f => f.radius > 240).length,
                 mb: bytes / 1048576, frame: m(on), ice: m(on) - m(off) };
      }, { c, seed }));
    }
    const frame = med(rows.map(r => r.frame)), ice = med(rows.map(r => r.ice));
    console.log(c.label.padEnd(22) + String(med(rows.map(r => r.n))).padStart(4) +
      String(med(rows.map(r => r.bergs))).padStart(6) +
      med(rows.map(r => r.mb)).toFixed(1).padStart(10) +
      frame.toFixed(2).padStart(11) + ice.toFixed(2).padStart(9) +
      ((ice / frame) * 100).toFixed(0).padStart(7) + '%');
  }
  await browser.close();
})();

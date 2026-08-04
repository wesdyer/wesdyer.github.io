// Does denser Arctic ice cost more to paint?
//
// Hypothesis: no, or barely — drawIslands viewport-culls, so you only ever pay
// for the floes actually on screen, and the screen is a fixed size. Tripling the
// count fills the same viewport with more, smaller sprites rather than adding
// draw area. What DOES scale linearly is baked-sprite texture memory.
//
// Method: fixed seed per density; sample the ice paint cost at many camera
// positions across the arena (one spot is not representative — parking on a berg
// vs on open water swings it more than the density does); ablate the floe pass
// with alternating on/off frames and force a raster flush each time, because
// drawImage returns before rasterising.
//
// Needs http (not file://) — the flush uses getImageData, which throws on a
// file:// page's tainted canvas.  python3 -m http.server 8788
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8788';
const DENSITIES = (process.argv[2] || '1,3,6').split(',').map(Number);
const SEED = 20260728;
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));

  console.log('density  floes  bergs   spriteMB   frame ms   ice ms   ice %   worst-cam ice ms');
  for (const d of DENSITIES) {
    await page.goto(BASE + '/regatta/index.html');
    await page.waitForTimeout(1400);
    const r = await page.evaluate(async ({ d, SEED }) => {
      let s = SEED;
      Math.random = () => { s += 0x6D2B79F5; let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      window.__FLOES = { density: d };
      selectVenue('arctic'); await new Promise(r => setTimeout(r, 400));
      document.getElementById('start-race-btn').click(); await new Promise(r => setTimeout(r, 600));
      state.race.timer = 2; await new Promise(r => setTimeout(r, 2200));

      const fl = state.course.islands.filter(i => i.isFloe);
      for (const f of fl) if (!f._sprite) bakeIslandSprite(f);
      const bytes = fl.reduce((a, f) => a + f._sprite.canvas.width * f._sprite.canvas.height * 4, 0);

      const real = window.drawIslands;
      const flush = () => ctx.getImageData(0, 0, 1, 1).data[0];
      const frameMs = (iceOn) => {
        window.drawIslands = iceOn ? real : (c2, w) => { if (w !== 'floe') real(c2, w); };
        const t0 = performance.now(); draw(); flush(); return performance.now() - t0;
      };

      // sample the arena on a grid rather than one hand-picked spot
      const b = state.course.boundary, R = b.radius * 0.72, cams = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, rr = R * (i % 2 ? 0.45 : 0.9);
        cams.push({ x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr });
      }
      cams.push({ x: b.x, y: b.y });

      for (let i = 0; i < 10; i++) { frameMs(true); frameMs(false); }   // warm up

      const frames = [], ices = [];
      for (const cam of cams) {
        state.camera.x = cam.x; state.camera.y = cam.y;
        const on = [], off = [];
        for (let i = 0; i < 14; i++) { on.push(frameMs(true)); off.push(frameMs(false)); }
        frames.push(med(on)); ices.push(med(on) - med(off));
      }
      window.drawIslands = real;
      function med(a) { const q = [...a].sort((x, y) => x - y); return q[q.length >> 1]; }
      return { n: fl.length, bergs: fl.filter(f => f.radius > 240).length, mb: bytes / 1048576,
               frame: med(frames), ice: med(ices), worst: Math.max(...ices) };
    }, { d, SEED });

    console.log(String(d).padEnd(8) + String(r.n).padStart(5) + String(r.bergs).padStart(7) +
      r.mb.toFixed(1).padStart(11) + r.frame.toFixed(2).padStart(11) + r.ice.toFixed(2).padStart(9) +
      ((r.ice / r.frame) * 100).toFixed(0).padStart(7) + '%' + r.worst.toFixed(2).padStart(16));
  }
  await browser.close();
})();

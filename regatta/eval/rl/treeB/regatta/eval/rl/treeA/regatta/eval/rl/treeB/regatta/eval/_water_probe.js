// The water's cost splits into a part that scales with resolutionScale (the two offscreen
// fills) and a FIXED part (the full-screen upscale blit). Fitting the sweep gives
// ~5.5 ms fixed + ~11.3*rs^2. This asks what the fixed part is actually spending it on.
const { chromium } = require('playwright');
const path = require('path');
const SECS = 3;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace();
    for (let i = 0; i < 1800; i++) update(1/60);
    state.paused = true;
  });
  const timeIt = (fn) => p.evaluate(([body, secs]) => {
    const f = new Function(body);
    for (let i = 0; i < 20; i++) f();
    let n = 0; const t0 = performance.now();
    while (performance.now() - t0 < secs * 1000) { f(); n++; }
    return (performance.now() - t0) / n;
  }, [fn, SECS]);

  const W = 'const W = window.WaterRenderer, c = document.getElementById("gameCanvas").getContext("2d");';
  const rows = [
    ['full draw()',                      `${W} W.draw(c, window.state);`],
    ['blit only (smoothing ON)',         `${W} c.setTransform(1,0,0,1,0,0); c.imageSmoothingEnabled = true; c.drawImage(W.lowCanvas,0,0,c.canvas.width,c.canvas.height);`],
    ['blit only (smoothing OFF)',        `${W} c.setTransform(1,0,0,1,0,0); c.imageSmoothingEnabled = false; c.drawImage(W.lowCanvas,0,0,c.canvas.width,c.canvas.height);`],
    ['blit only (quality low)',          `${W} c.setTransform(1,0,0,1,0,0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "low"; c.drawImage(W.lowCanvas,0,0,c.canvas.width,c.canvas.height);`],
    ['1:1 blit (no upscale)',            `${W} c.setTransform(1,0,0,1,0,0); c.drawImage(W.lowCanvas,0,0);`],
    ['gradient fill only (low-res)',     `${W} const l=W.lowCtx; l.setTransform(1,0,0,1,0,0); l.fillStyle=W._grad; l.fillRect(0,0,W.lowCanvas.width,W.lowCanvas.height);`],
    ['contour pattern fill (low-res)',   `${W} const l=W.lowCtx; l.setTransform(1,0,0,1,0,0); l.fillStyle=W.contourPattern; l.fillRect(0,0,W.lowCanvas.width,W.lowCanvas.height);`]
  ];
  console.log(`viewport 1500x950, resolutionScale ${await p.evaluate(() => window.WATER_CONFIG.resolutionScale)}\n`);
  for (const [label, body] of rows) {
    const ms = await timeIt(body);
    console.log(`  ${label.padEnd(32)}${ms.toFixed(2).padStart(7)} ms`);
  }
  await b.close();
})();

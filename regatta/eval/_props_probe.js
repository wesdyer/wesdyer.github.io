// Per-plane drawProps attribution + ceiling, on the frozen mid-race scene.
const { chromium } = require('playwright');
const path = require('path');
const VENUE = process.env.PERF_VENUE || 'river';
const SECS = 3;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1400);
  await page.evaluate((__V) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: __V }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace();
    for (let i = 0; i < 3600; i++) { update(1 / 60); if (i % 10 === 0) updateLeaderboard(); }
    state.paused = true;
  }, VENUE);

  const measure = () => page.evaluate((secs) => {
    for (let i = 0; i < 15; i++) draw();
    let n = 0; const t0 = performance.now();
    while (performance.now() - t0 < secs * 1000) { draw(); n++; }
    return (performance.now() - t0) / n;
  }, SECS);

  // ⚠️ Wait for sprite images: drawProps skips a prop whose image has not loaded, so a
  // baseline taken too early measures a scene with no trees in it (30.8 vs 46 ms the
  // first time this ran).
  await page.waitForFunction(() => window.palmImg && palmImg.complete, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const base = await measure();
  console.log(`venue ${VENUE}  baseline ${base.toFixed(2)} ms`);

  for (const plane of ['seabed', 'float', 'surface', 'canopy']) {
    await page.evaluate((pl) => {
      if (!window.__origProps) window.__origProps = window.drawProps;
      window.drawProps = (c, p) => { if (p !== pl) window.__origProps(c, p); };
    }, plane);
    const m = await measure();
    console.log(`  skip ${plane.padEnd(8)} ${m.toFixed(2)} ms  costs ${(base - m).toFixed(2)}`);
    await page.evaluate(() => { window.drawProps = window.__origProps; });
  }

  // How many props of each plane draw in this scene, and their fill area
  const stats = await page.evaluate(() => {
    const out = {};
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const props = state.course.props || [];
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(canvas.width ** 2 + canvas.height ** 2) * 0.5;
    for (const p of props) {
      const k = reg[p.kind] || {};
      const w = (k.world || 40) * (p.scale || 1);
      if ((p.x - camX) ** 2 + (p.y - camY) ** 2 > (viewR + w * 0.5) ** 2) continue;
      const pl = k.plane || 'surface';
      out[pl] = out[pl] || { n: 0, px: 0 };
      out[pl].n++; out[pl].px += w * w;
    }
    return out;
  });
  console.log('visible props by plane:', JSON.stringify(stats));
  const base2 = await measure();
  console.log(`baseline again ${base2.toFixed(2)} ms  (drift ${(base2 - base).toFixed(2)})`);

  // Ceiling: everything ablated
  await page.evaluate(() => {
    const noop = () => {};
    for (const f of ['drawWakes','drawParticles','drawGusts','drawWindWaves','drawBoundary',
      'drawActiveGateLine','drawLadderLines','drawLayLines','drawMarkZones','drawRoundingArrows',
      'drawDisturbedAir','drawIslands','drawMarkShadows','drawMarkBodies','drawRulesOverlay',
      'drawBoat','drawBoatIndicator','drawMinimap','updateLeaderboard','drawNightWater',
      'drawShallows','drawShoals','drawVegetation','drawReefs','drawProps','drawJellyDrifts',
      'drawRapidsFoam','drawTrafficWakes','drawPropWash','drawSurf','drawTraffic',
      'drawSquallShadows','drawSquallRain','drawNightWash','drawJellyGlow','drawNightGlow',
      'drawSnowOverlay','drawSeabedUnderlay']) if (typeof window[f] === 'function') window[f] = noop;
    if (window.WaterRenderer) window.WaterRenderer.draw = noop;
    if (window.Swell) window.Swell.draw = noop;
    if (window.SeaFX) window.SeaFX.draw = noop;
    if (window.IceFX) window.IceFX.draw = noop;
  });
  const ceil = await measure();
  console.log(`ceiling (all ablated) ${ceil.toFixed(2)} ms`);
  console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
  await browser.close();
})();

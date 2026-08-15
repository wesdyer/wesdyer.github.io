// Direct cost of the sea-effects layer, timed around the call itself rather than inferred
// from an ablation delta — the ablation sweep's noise floor on this machine is about a
// millisecond, which is the same size as the answer.
// Usage: node eval/_seafx_cost.js [venue]
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'ocean';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  const r = await p.evaluate((v) => {
    settings.venue = v; resetGame(); startRace();
    // Warm the layer to a steady state WITH a canvas in hand, so viewR and the cap
    // population are what a real frame sees rather than the cold defaults.
    for (let i = 0; i < 2400; i++) { update(1 / 60); if (i % 4 === 0) draw(); }
    // ⚠️ PARK ON THE COAST. Measured from wherever the fleet happens to be, the shore surf
    // and the bar breaks are both off screen and both measure zero — a benchmark of the
    // cull, not of the layer. Centre on the island with the most coastline, which on a
    // swell venue also puts a bar or two in frame.
    state.paused = true;
    let best = null;
    for (const isl of (state.course.islands || [])) {
      if (isl.hidden || isl.awash || !isl.vertices || isl.vertices.length < 3) continue;
      if (isl.radius > 2000) continue;
      const wet = surfDryEdges(isl).filter(d => !d).length;
      if (!best || wet > best.wet) best = { x: isl.x, y: isl.y, wet };
    }
    if (best) { state.camera.x = best.x; state.camera.y = best.y; state.camera.rotation = 0; }
    draw();
    const ctx = canvas.getContext('2d');
    const time = (fn, n) => {
      for (let i = 0; i < 30; i++) fn();               // JIT
      const t0 = performance.now();
      for (let i = 0; i < n; i++) fn();
      return (performance.now() - t0) / n;
    };
    const N = 400;
    return {
      caps: window.SeaFX.debug().caps,
      spray: window.SeaFX.debug().spray,
      seafx: time(() => window.SeaFX.draw(ctx, state), N),
      surf: time(() => drawSurf(ctx), N),
      swell: time(() => window.Swell.draw(ctx, state), N),
      water: time(() => window.WaterRenderer.draw(ctx, state), N),
      frame: time(() => draw(), 120)
    };
  }, venue);
  console.log(`venue ${venue}   caps=${r.caps} spray=${r.spray}`);
  for (const k of ['seafx', 'surf', 'swell', 'water', 'frame'])
    console.log(`  ${k.padEnd(7)} ${r[k].toFixed(3)} ms` +
                (k === 'frame' ? '' : `  (${(100 * r[k] / r.frame).toFixed(1)}% of a frame)`));
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();

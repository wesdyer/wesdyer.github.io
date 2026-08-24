// RENDER BENCHMARK + ABLATION, Sea Trials.
//
//   node regatta/eval/_perf.js                 baseline + per-function ablation
//   node regatta/eval/_perf.js baseline        just the number
//   node regatta/eval/_perf.js fn drawGusts    no-op one function and compare
//
// ⚠️ HEADLESS IS SOFTWARE RASTER. The absolute FPS is far below what a GPU gives, so treat
// this as a RELATIVE instrument: it ranks costs and measures deltas honestly, and the real
// machine will be a multiple of it. What it is good at is saying which draw call is
// expensive, which a CPU profile cannot — paint shows up as one opaque "(program)" bar.
const { chromium } = require('playwright');
const path = require('path');

const SECS = 4;

// Everything the world pass calls, in draw order. Ablating one at a time attributes cost.
const FNS = [
  'drawWakes', 'drawParticles', 'drawGusts', 'drawWindWaves', 'drawBoundary',
  'drawActiveGateLine', 'drawLadderLines', 'drawLayLines', 'drawMarkZones',
  'drawRoundingArrows', 'drawDisturbedAir', 'drawIslands', 'drawMarkShadows',
  'drawMarkBodies', 'drawRulesOverlay', 'drawBoat', 'drawBoatIndicator',
  'drawMinimap', 'updateLeaderboard', 'WaterRenderer.draw', 'Swell.draw', 'SeaFX.draw',
  // Layers added since the Aug 1 pass — venue-specific strata.
  'drawNightWater', 'drawShallows', 'drawShoals', 'drawVegetation', 'drawReefs',
  'drawProps', 'drawJellyDrifts', 'drawRapidsFoam', 'drawTrafficWakes', 'drawPropWash',
  'drawSurf', 'drawTraffic', 'drawSquallShadows', 'drawSquallRain', 'drawNightWash',
  'drawJellyGlow', 'drawNightGlow', 'drawSnowOverlay', 'IceFX.draw',
  // Cached world-tile wrappers (ablating the underlying layer fns only affects tile
  // bakes; ablate THESE to attribute the per-frame cost).
  'drawSeabedUnderlay', 'drawIslandsCached', 'drawCanopyCached', 'drawFloatStratumCached'
];

const VENUE = process.env.PERF_VENUE || 'seatrials';

async function bootstrap(page) {
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1400);
  await page.evaluate((__V) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: __V }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame();
    startRace();
    // Settle into mid-race: the fleet spread out, wakes and particles at steady state.
    for (let i = 0; i < 3600; i++) { update(1 / 60); if (i % 10 === 0) updateLeaderboard(); }
    window.__origs = {};
  }, VENUE);
}

// RENDER ONLY, on a FROZEN world. The game's own loop is paused and `draw()` is driven
// directly, so every measurement paints the identical scene.
//
// Without this the number drifted 9 fps DOWNWARD across one ablation sweep — the race keeps
// running for the ~3 minutes a sweep takes, boats finish, the fleet spreads — and that drift
// was larger than every per-function delta except one. A benchmark whose noise exceeds its
// signal measures nothing.
// MILLISECONDS PER DRAW, measured in a tight loop rather than through requestAnimationFrame.
//
// ⚠️ rAF IS CAPPED AT 120Hz HERE — an empty callback that paints nothing measures 120.3 fps.
// So anything at or near 120 is the instrument talking, not the code: "all draws ablated"
// and "water ablated" both returned 120.1, which looked like the water being the only cost
// and was really just two results pinned to the same ceiling.
//
// Frame TIME does not saturate, so it is what optimisation is steered by. The fps figure
// stays alongside as the experience proxy: 8.33 ms is the 120 fps budget.
const measure = (page) => page.evaluate((secs) => {
  const wasPaused = state.paused;
  state.paused = true;                     // the game loop still ticks; it just stops updating
  for (let i = 0; i < 20; i++) draw();     // warm the JIT and the sprite bakes
  let n = 0; const t0 = performance.now();
  while (performance.now() - t0 < secs * 1000) { draw(); n++; }
  const ms = (performance.now() - t0) / n;
  state.paused = wasPaused;
  return ms;
}, SECS);

// `Obj.method` as well as a bare global: the water renderer, the swell and the sea effects
// are all modules that hang a draw call off their own object, and a list that can only reach
// globals silently skips exactly the layers most worth attributing.
const ablate = (page, fn) => page.evaluate((f) => {
  const dot = f.indexOf('.');
  if (dot > 0) {
    const obj = window[f.slice(0, dot)], key = f.slice(dot + 1);
    if (!obj || typeof obj[key] !== 'function') return false;
    window.__origs[f] = obj[key];
    obj[key] = () => {};
    return true;
  }
  if (typeof window[f] !== 'function') return false;
  window.__origs[f] = window[f];
  window[f] = () => {};
  return true;
}, fn);
const restore = (page, fn) => page.evaluate((f) => {
  if (!window.__origs[f]) return;
  const dot = f.indexOf('.');
  if (dot > 0) window[f.slice(0, dot)][f.slice(dot + 1)] = window.__origs[f];
  else window[f] = window.__origs[f];
  delete window.__origs[f];
}, fn);

(async () => {
  const mode = process.argv[2] || 'all';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await bootstrap(page);

  const fmt = (ms) => `${ms.toFixed(2)} ms/frame  (${(1000 / ms).toFixed(0)} fps uncapped)`;
  const base = await measure(page);
  console.log(`venue              ${VENUE}`);
  console.log(`baseline           ${fmt(base)}`);
  console.log(`120 fps budget     8.33 ms/frame  -> need ${(base - 8.33).toFixed(2)} ms off`);
  if (mode === 'baseline') { console.log('errors:', errs.length ? errs.slice(0,3) : 'none'); await browser.close(); return; }

  // The CEILING: everything in the list no-op'd at once. Says what the frame costs before
  // any of these run, which is the number that decides whether tuning them can reach a target
  // at all.
  // The INSTRUMENT's ceiling: rAF with no painting at all. If a result equals this, the
  // measurement is capped and the real headroom is unknown — which is exactly what happened
  // the first time "all ablated" and "water ablated" both returned 120.1.
  // The number you actually SEE: the game's own loop, running normally, measured through
  // requestAnimationFrame. Capped at ~120 here, which is the target.
  if (mode === 'live') {
    const f = await page.evaluate((secs) => new Promise(res => {
      state.paused = false;
      let n = 0; const t0 = performance.now();
      const tick = () => { n++; performance.now() - t0 < secs * 1000 ? requestAnimationFrame(tick)
                                                                     : res(n / ((performance.now() - t0) / 1000)); };
      requestAnimationFrame(tick);
    }), SECS);
    console.log(`live game loop     ${f.toFixed(1)} fps  (rAF caps at ~120 here)`);
    await browser.close(); return;
  }

  if (mode === 'cap') {
    const c = await page.evaluate((secs) => new Promise(res => {
      state.paused = true;
      let n = 0; const t0 = performance.now();
      const tick = () => { n++; performance.now() - t0 < secs * 1000 ? requestAnimationFrame(tick)
                                                                     : res(n / ((performance.now() - t0) / 1000)); };
      requestAnimationFrame(tick);
    }), SECS);
    console.log(`empty rAF (no draw) ${c.toFixed(1)} fps  <- the instrument's ceiling`);
    await browser.close(); return;
  }

  // WATER SWEEP: frame time against resolutionScale. The water rasterises two full-screen
  // passes into an offscreen at this scale and blits once, so if it is fill-rate bound the
  // curve is steep; if it is bound by something per-call, it is flat.
  if (mode === 'water') {
    console.log('\nresolutionScale   ms/frame   water ms   fps uncapped');
    for (const rs of [1.0, 0.75, 0.5, 0.35, 0.25]) {
      await page.evaluate((v) => { window.WATER_CONFIG.resolutionScale = v; }, rs);
      const withW = await measure(page);
      await ablate(page, 'WaterRenderer.draw');
      const without = await measure(page);
      await restore(page, 'WaterRenderer.draw');
      console.log(`  ${String(rs).padEnd(16)}${withW.toFixed(2).padStart(8)}   ${(withW - without).toFixed(2).padStart(8)}   ${(1000 / withW).toFixed(0).padStart(6)}`);
    }
    await page.evaluate(() => { window.WATER_CONFIG.resolutionScale = 0.5; });
    await browser.close(); return;
  }

  if (mode === 'ceiling') {
    for (const fn of FNS) await ablate(page, fn);
    const c = await measure(page);
    console.log(`all draws ablated  ${fmt(c)}   (that is the floor these overlays sit on)`);
    console.log('errors:', errs.length ? errs.slice(0,3) : 'none');
    await browser.close(); return;
  }

  const only = mode === 'fn' ? [process.argv[3]] : FNS;
  const rows = [];
  for (const fn of only) {
    if (!await ablate(page, fn)) { rows.push([fn, null, null]); continue; }
    const f = await measure(page);
    await restore(page, fn);
    rows.push([fn, f, f - base]);
  }
  // Re-measure the baseline at the end: sequential runs drift, and a delta worth acting on
  // has to be bigger than that drift.
  const base2 = await measure(page);

  console.log('\nablated              ms/frame   costs   share');
  rows.filter(r => r[1] !== null).sort((a, b) => a[2] - b[2]).forEach(([fn, f, d]) => {
    const cost = -d;                                   // ablating REMOVES this much time
    console.log(`  ${fn.padEnd(20)}${f.toFixed(2).padStart(8)}  ${cost.toFixed(2).padStart(6)}  `
                + (cost > 0.02 ? (cost / base * 100).toFixed(1) + '%' : '-'));
  });
  const missing = rows.filter(r => r[1] === null).map(r => r[0]);
  if (missing.length) console.log('  (not global, skipped: ' + missing.join(', ') + ')');
  console.log(`\nbaseline again     ${fmt(base2)}   (drift ${(base2 - base >= 0 ? '+' : '') + (base2 - base).toFixed(2)} ms)`);
  console.log('errors:', errs.length ? errs.slice(0,3) : 'none');
  await browser.close();
})();

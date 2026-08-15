// Is the frame-time tail real work, or an artifact of headless software raster?
//
// Three runs: the normal loop, update-only (no paint at all), and paint-only on a frozen
// world. If the tail survives with NO painting, it is not the renderer. If it only appears
// when painting, it still might be the headless rasteriser rather than the game.
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'ocean';
const N = 700;
const q = (a, f) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * f))];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  const r = await p.evaluate(({ v, n }) => {
    state.paused = true;
    settings.venue = v; resetGame(); startRace();
    state.boats[0].isPlayer = false;
    for (let i = 0; i < 1800; i++) update(1 / 60);
    const run = (fn) => { const a = []; for (let i = 0; i < n; i++) { const t = performance.now(); fn(); a.push(performance.now() - t); } return a; };
    return {
      both: run(() => { update(1 / 60); draw(); }),
      updOnly: run(() => { update(1 / 60); }),
      drawOnly: run(() => { draw(); })
    };
  }, { v: venue, n: N });
  for (const k of ['both', 'updOnly', 'drawOnly']) {
    const a = r[k];
    console.log(`  ${k.padEnd(9)} p50 ${q(a,.5).toFixed(2)}  p95 ${q(a,.95).toFixed(2)}  p99 ${q(a,.99).toFixed(2)}  max ${Math.max(...a).toFixed(2)}` +
                `   over-100ms frames: ${a.filter(x => x > 100).length}/${a.length}`);
  }
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();

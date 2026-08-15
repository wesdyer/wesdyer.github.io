// DOES THE SURFING STATE COST MORE TO DRAW?
//
// Waiting for a bot to reach a downwind leg costs ten minutes of headless wall clock, so the
// state is FORCED instead: the whole fleet is held on a broad reach at planing speed, which
// is what turns on the spray sheets, the droplets and the planing wake. Then the cost of
// drawing that is compared against the same fleet held upwind.
//
// ⚠️ MEDIANS. Headless is a software rasteriser that stalls ~250 ms on about one paint in
// twelve, on a frozen world with the game paused — it is the rasteriser, not the game, and
// it swamps any mean. p50/p90 are immune to it.
const { chromium } = require('playwright');
const path = require('path');
const N = parseInt(process.argv[2] || '600', 10);
const q = (a, f) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * f))];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);

  const res = await p.evaluate(({ n }) => {
    state.paused = true;
    settings.venue = 'ocean'; resetGame(); startRace();
    for (const bt of state.boats) bt.isPlayer = false;
    for (let i = 0; i < 1500; i++) update(1 / 60);
    state.race.status = 'racing';

    const run = (twa, label) => {
      // Hold the fleet on the point of sail under test. Heading is re-pinned every frame so
      // the bots cannot steer off it; speed is left to the physics, which is what decides
      // whether planing and surfing actually engage.
      const drw = [];
      let peakSpray = 0, peakParts = 0, surfFrames = 0, planeFrames = 0, kn = 0;
      for (let i = 0; i < n; i++) {
        for (const bt of state.boats) {
          const w = getWindAt(bt.x, bt.y);
          bt.heading = w.direction + twa * Math.PI / 180;
        }
        update(1 / 60);
        const t = performance.now(); draw(); drw.push(performance.now() - t);
        const b0 = state.boats[0];
        kn = b0.speed * 4;
        if (b0.raceState.isPlaning) planeFrames++;
        if (b0.swell && b0.swell.surf01 > 0.35 && b0.swell.cosPsi > 0.3) surfFrames++;
        const d = window.SeaFX.debug();
        peakSpray = Math.max(peakSpray, d.spray);
        peakParts = Math.max(peakParts, state.particles.length);
      }
      return { label, drw, peakSpray, peakParts, surfFrames, planeFrames, kn: +kn.toFixed(1),
               caps: window.SeaFX.debug().caps };
    };
    return [run(150, 'downwind 150'), run(40, 'upwind 40'), run(95, 'reach 95')];
  }, { n: N });

  console.log(`frames per state: ${N}`);
  for (const r of res) {
    console.log(`  ${r.label.padEnd(14)} draw p50 ${q(r.drw,.5).toFixed(2)}  p90 ${q(r.drw,.9).toFixed(2)}  p99 ${q(r.drw,.99).toFixed(2)}` +
      `   kn ${String(r.kn).padEnd(5)} planing ${String(r.planeFrames).padEnd(5)} surfing ${String(r.surfFrames).padEnd(5)}` +
      ` peakSpray ${String(r.peakSpray).padEnd(5)} peakParts ${r.peakParts}`);
  }
  console.log('errors', errs.length ? errs.slice(0, 4) : 'none');
  await b.close();
})();

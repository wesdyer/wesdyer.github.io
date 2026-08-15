// THE ONE TEST THAT MATTERS FOR seafx.js: can the sea effects reach the simulation?
//
// They must not. A visual layer that spawns particles inside update() is exactly the trap
// script.js's `fxRand` note describes — draw from the seeded stream and the race depends on
// the camera, so race 2 in a session differs from race 1 and a 100-trial eval carries each
// trial's final camera into the next. seafx.js has its own PRNG, its own arrays and a
// WeakMap instead of fields on the boats, and this asserts all of that at once:
//
//   A  same seed, layer ON, twice        -> identical (the layer is deterministic)
//   B  same seed, layer ON vs OFF        -> identical (the layer is invisible to the sim)
//   C  layer ON with the camera moved    -> identical (no camera-dependence, the old bug)
//
// C is the one that would have caught the original defect, and it is why the third run
// shoves the camera somewhere else before stepping: the spawn tests are camera-relative, so
// a different camera means a different NUMBER of rnd() calls. If that count could reach the
// sim, this run diverges and nothing else here would notice.
//
// Usage: node eval/_seafx_isolation.js [venue] [steps]
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'ocean';
const STEPS = parseInt(process.argv[3] || '5400', 10);   // 90 s at 60 Hz

async function run(page, { disable, moveCamera }) {
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1200);
  return page.evaluate(({ v, n, off, cam }) => {
    // The same seeding the perf harness uses, so the fleet sails an identical race.
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    settings.venue = v;
    resetGame();
    startRace();
    if (off) { window.SeaFX.update = () => {}; window.SeaFX.draw = () => {}; }
    for (let i = 0; i < n; i++) {
      if (cam) { state.camera.x = 4000 + i * 3; state.camera.y = -7000 - i * 2; }
      update(1 / 60);
    }
    // The whole fleet's state, to 4 decimals — anything the sea could have nudged.
    return state.boats.map(b => [
      +b.x.toFixed(4), +b.y.toFixed(4), +b.heading.toFixed(6), +b.speed.toFixed(6),
      b.raceState.leg, +(b.raceState.finishTime || 0).toFixed(3)
    ]);
  }, { v: venue, n: STEPS, off: disable, cam: moveCamera });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));

  const base = await run(page, {});
  const again = await run(page, {});
  const off = await run(page, { disable: true });
  const cam = await run(page, { moveCamera: true });
  await browser.close();

  const cmp = (name, a, b) => {
    const j1 = JSON.stringify(a), j2 = JSON.stringify(b);
    if (j1 === j2) { console.log(`  ${name.padEnd(26)} IDENTICAL  (${a.length} boats)`); return true; }
    let first = -1;
    for (let i = 0; i < a.length; i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) { first = i; break; }
    console.log(`  ${name.padEnd(26)} DIVERGED   first at boat ${first}`);
    console.log(`      ${JSON.stringify(a[first])}\n      ${JSON.stringify(b[first])}`);
    return false;
  };

  console.log(`venue ${venue}, ${STEPS} steps`);
  const ok = [
    cmp('A  ON vs ON (rerun)', base, again),
    cmp('B  ON vs OFF', base, off),
    cmp('C  ON vs ON (camera moved)', base, cam)
  ].every(Boolean);
  console.log('ERRORS', errs.length ? errs.slice(0, 5).join('\n') : 'none');
  console.log(ok ? 'PASS — the sea effects cannot reach the simulation'
                 : 'FAIL — the sea effects are visible to the simulation');
  process.exit(ok ? 0 : 1);
})();

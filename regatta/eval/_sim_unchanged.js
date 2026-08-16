// DID A VISUAL CHANGE MOVE THE SIMULATION?
//
// The comet spawner and the puff renderer both live near the frame path, and the comet
// spawner runs inside update(). It draws from `fxRand` — the visuals-only stream — precisely
// so that changing how many comets exist cannot change a race. This asserts that end to end:
// the same seeded race, stepped identically on the pre-change tree and the current one, must
// leave every boat in the same place.
//
// Usage: node eval/_sim_unchanged.js <baseTreeDir> [venue] [steps]
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.argv[2];
const VENUES = ['bay', 'lake', 'redrock', 'ocean'];
const STEPS = parseInt(process.argv[4] || '5400', 10);

async function run(page, root, venue, steps) {
  await page.goto('file://' + path.resolve(root, 'regatta/index.html'));
  await page.waitForTimeout(1100);
  return page.evaluate(({ v, n }) => {
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    state.paused = true;
    settings.venue = v; resetGame(); startRace();
    for (let i = 0; i < n; i++) update(1 / 60);
    return state.boats.map(b => [
      +b.x.toFixed(4), +b.y.toFixed(4), +b.heading.toFixed(6), +b.speed.toFixed(6),
      b.raceState.leg, +(b.raceState.finishTime || 0).toFixed(3)
    ]);
  }, { v: venue, n: steps });
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let bad = 0;
  for (const v of VENUES) {
    const a = JSON.stringify(await run(p, BASE, v, STEPS));
    const c = JSON.stringify(await run(p, '.', v, STEPS));
    const same = a === c;
    if (!same) bad++;
    console.log(`  ${v.padEnd(9)} ${same ? 'IDENTICAL' : 'DIVERGED'}   (${STEPS} steps, 10 boats)`);
    if (!same) {
      const A = JSON.parse(a), C = JSON.parse(c);
      for (let i = 0; i < A.length; i++)
        if (JSON.stringify(A[i]) !== JSON.stringify(C[i])) { console.log(`      boat ${i}\n      base ${JSON.stringify(A[i])}\n      now  ${JSON.stringify(C[i])}`); break; }
    }
  }
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  console.log(bad === 0 ? 'PASS — the simulation is untouched' : `FAIL — ${bad} venue(s) moved`);
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();

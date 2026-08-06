// WHERE does the arctic fleet's below-polar time go? — speed by ice-proximity class.
//
// _track_floor says ~half of arctic leg 1's deficit is SPEED (sailing below polar on
// the very line the boat chose), not extra line. This classes every 10 Hz sample by
// where the boat is standing:
//     ICE     within GRAZE units of a floe hull point (or inside one)
//     NEAR    within 2*GRAZE
//     OPEN    everything else
// and reports, per class: time share, mean fraction-of-polar, and the share of
// below-half-polar time. If the grind concentrates in ICE cells, the router's soft
// multipliers (2.5x lead / 6x plug) should be checked against the MEASURED ratio.
//
// Usage: node regatta/eval/_ice_slow.js [seed=9100] [maxT=700] [graze=120]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const SEED = parseInt(A[0]) || 9100, MAXT = parseInt(A[1]) || 700, GRAZE = parseInt(A[2]) || 120;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ SEED, MAXT, GRAZE }) => {
    window.evalHarness.seed = SEED;
    window.resetGame(); window.startRace();
    state.course.cutoff = 900;
    const pl = state.boats.find(b => b.isPlayer);
    if (pl) { pl.x = 1e6; pl.y = 1e6; }
    const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const bots = state.boats.filter(b => !b.isPlayer);
    const cls = { ICE: { t: 0, fp: 0, slow: 0 }, NEAR: { t: 0, fp: 0, slow: 0 }, OPEN: { t: 0, fp: 0, slow: 0 } };
    // Distance to the nearest ICE EDGE by center-minus-radius. Hull formats vary
    // (the first cut assumed [x,y] arrays, got NaN on every floe, and classed 100%
    // of the race OPEN — zero-at-every-percentile again); the circle bound is
    // format-proof and good to a hull's lobe depth, which is fine at a 120u graze.
    const floeDist = (x, y) => {
      let best = Infinity;
      for (const isl of state.course.islands || []) {
        if (!isl.isFloe) continue;
        const d = Math.hypot(x - isl.x, y - isl.y) - (isl.radius || 0);
        if (d < best) best = d;
      }
      return best;
    };
    const dt = 1 / 60; let it = 0;
    while (it < MAXT * 60) {
      if (state.race.status === 'racing') {
        if (bots.every(b => b.raceState.finished)) break;
        if (it % 6 === 0) {
          for (const b of bots) {
            if (b.raceState.finished || b.raceState.leg < 1) continue;
            const w = getWindAt(b.x, b.y);
            const twa = Math.abs(norm(b.heading - w.direction));
            const pol = getTargetSpeed(twa, twa > Math.PI * 95 / 180, w.speed);
            if (pol < 0.5) continue;
            const frac = (b.speed * 4) / pol;
            const d = floeDist(b.x, b.y);
            const k = d < GRAZE ? 'ICE' : d < GRAZE * 2 ? 'NEAR' : 'OPEN';
            cls[k].t += 0.1; cls[k].fp += frac * 0.1;
            if (frac < 0.5) cls[k].slow += 0.1;
          }
        }
      }
      window.update(dt); it++;
    }
    return cls;
  }, { SEED, MAXT, GRAZE });
  const tot = out.ICE.t + out.NEAR.t + out.OPEN.t;
  const slowTot = out.ICE.slow + out.NEAR.slow + out.OPEN.slow;
  console.log(`arctic seed=${SEED} graze=${GRAZE}u  (boat-seconds racing: ${Math.round(tot)}, below-half-polar: ${Math.round(slowTot)})`);
  for (const k of ['ICE', 'NEAR', 'OPEN']) {
    const c = out[k];
    console.log(`${k.padEnd(5)} time ${Math.round(100 * c.t / tot)}%  mean frac-of-polar ${(c.fp / (c.t || 1)).toFixed(2)}  slow-time share ${Math.round(100 * c.slow / (slowTot || 1))}%  (slow within class ${Math.round(100 * c.slow / (c.t || 1))}%)`);
  }
  await browser.close();
})();

// DOES THE AI'S VMG OPTIMISER AGREE WITH THE BOAT IT IS DRIVING?
//
//   node regatta/eval/_vmgangle_check.js
//
// `getCharacterOptimalVMGAngle` is where every strategic angle comes from. It reads the
// J111 polar table, applies the point-of-sail stat modifiers, and — above the overpowered
// threshold — a heel tax. The PHYSICS is `updateBoat`, which is not the same function.
//
// This prints, per wind speed, the angle the optimiser returns and the angle the polar
// table alone would return, upwind and down, so a disagreement can be attributed to the
// table or to the tax rather than guessed at.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGE ERROR', String(e).slice(0, 200)));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.getCharacterOptimalVMGAngle, null, { timeout: 20000 });

  const R = await p.evaluate(() => {
    const zero = { acceleration: 0, momentum: 0, handling: 0, upwind: 0, reach: 0,
                   downwind: 0, pressure: 0, lightAir: 0, heavyAir: 0, memory: 0 };
    const rows = [];
    // The polar table on its own, no stats and no tax — `getOptimalVMGAngle`.
    for (const ws of [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 30]) {
      const r = { ws };
      r.upChar = getCharacterOptimalVMGAngle('upwind', ws, zero) * 180 / Math.PI;
      r.dnChar = getCharacterOptimalVMGAngle('downwind', ws, zero) * 180 / Math.PI;
      r.upPolar = getOptimalVMGAngle('upwind', ws) * 180 / Math.PI;
      r.dnPolar = getOptimalVMGAngle('downwind', ws) * 180 / Math.PI;
      // The table's own downwind VMG curve, so the shape is visible and not inferred.
      const curve = [];
      for (const a of [140, 150, 155, 160, 165, 170, 175, 180]) {
        const s = getTargetSpeed(a * Math.PI / 180, true, ws);
        curve.push([a, +(s * Math.cos(Math.PI - a * Math.PI / 180)).toFixed(2)]);
      }
      r.curve = curve;
      rows.push(r);
    }
    return { rows, threshold: (typeof OVERPOWERED !== 'undefined' ? OVERPOWERED.threshold : null),
             venueWinds: Object.keys(window.VENUE_DOC || {}).map(v => {
               try {
                 localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
                 window.resetGame();
                 return [v, +state.wind.baseSpeed.toFixed(1)];
               } catch (e) { return [v, null]; }
             }) };
  });

  console.log(`overpowered threshold ${R.threshold} kt — the heel tax applies above ${R.threshold - 2}\n`);
  console.log(' wind   upwind: polar / optimiser    downwind: polar / optimiser');
  for (const r of R.rows)
    console.log(`${String(r.ws).padStart(4)}       ${r.upPolar.toFixed(0).padStart(4)} / ${r.upChar.toFixed(0).padStart(4)}` +
                `                  ${r.dnPolar.toFixed(0).padStart(4)} / ${r.dnChar.toFixed(0).padStart(4)}`);
  console.log('\nthe POLAR TABLE\'s own downwind VMG (kt) by angle — where its peak really is');
  console.log(' wind   ' + [140, 150, 155, 160, 165, 170, 175, 180].map(a => String(a).padStart(6)).join(''));
  for (const r of R.rows)
    console.log(`${String(r.ws).padStart(4)}   ` + r.curve.map(c => String(c[1]).padStart(6)).join(''));
  console.log('\nauthored base wind by venue: ' + R.venueWinds.map(([v, w]) => `${v} ${w}`).join(', '));
  await b.close();
})();

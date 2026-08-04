// Independent check of which way a comet points: the drawn track vs (a) getWindAt's
// stated direction and (b) the bearing to the first mark, which on a beat must be
// roughly where the wind is coming FROM.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(2500);
  await p.evaluate(() => { if (typeof startRace === 'function') startRace(); });
  await p.waitForTimeout(8000);
  console.log(JSON.stringify(await p.evaluate(() => {
    const deg = r => +(((r * 180 / Math.PI) % 360 + 360) % 360).toFixed(1);
    const boat = state.boats[0];
    const w = getWindAt(boat.x, boat.y);
    // Where is the boat trying to go?
    const tgt = state.course.marks && (Array.isArray(state.course.marks) ? state.course.marks : Object.values(state.course.marks)).filter(m => m && m.x !== undefined);
    const up = tgt[tgt.length - 1];
    const bearingToMark = deg(Math.atan2(up.x - boat.x, -(up.y - boat.y)));

    // A streak near the boat: where has it been, where is it now?
    let best = null, bd = 1e18;
    for (const q of state.particles) {
      if (q.type !== 'wind' || !q.trail || q.trail.length < 3) continue;
      const d = (q.x - boat.x) ** 2 + (q.y - boat.y) ** 2;
      if (d < bd) { bd = d; best = q; }
    }
    const tail = best.trail[best.trail.length - 1];
    return {
      windAtBoat_fromDeg: deg(w.direction), windKt: +w.speed.toFixed(1),
      bearingBoatToUpwindMark_deg: bearingToMark,
      boatHeading_deg: deg(boat.heading),
      streak: {
        head: { x: +best.x.toFixed(0), y: +best.y.toFixed(0) },
        tail: { x: +tail.x.toFixed(0), y: +tail.y.toFixed(0) },
        // Screen-space: +y is DOWN. Travel = head - tail.
        travel: { dx: +(best.x - tail.x).toFixed(1), dy: +(best.y - tail.y).toFixed(1) },
        travelTowardDeg: deg(Math.atan2(best.x - tail.x, -(best.y - tail.y))),
        // The wind FROM direction implied by that travel = toward + 180
        impliedFromDeg: deg(Math.atan2(best.x - tail.x, -(best.y - tail.y)) + Math.PI)
      }
    };
  }), null, 1));
  await b.close();
})();

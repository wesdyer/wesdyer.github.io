// Sail the ocean at held true wind angles, with the swell on and off, and measure what
// actually changes. Drives the game's own updateBoat — no reimplementation of the physics.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Swell && window.updateBoat, null, { timeout: 20000 });

  const R = await p.evaluate(async () => {
    selectVenue('ocean');
    const doc = window.VenueDoc.get('ocean');
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

    const proto = state.boats[0];
    // One boat, mid-course, stats all zero so the numbers are about the sea and not a hull.
    function freshBoat() {
      const c = JSON.parse(JSON.stringify({ x: -1200, y: -3400 }));
      const bt = Object.assign(Object.create(Object.getPrototypeOf(proto)), proto);
      bt.x = c.x; bt.y = c.y;
      bt.speed = 1.6; bt.heading = 0; bt.prevHeading = 0; bt.heel = 0;
      // PLAYER branch on purpose: it reads the (all-false) key state and nothing else,
      // which keeps the measurement entirely clear of the AI controller.
      bt.isPlayer = true; bt.ai = null; bt.controller = null;
      bt.stats = { acceleration: 0, momentum: 0, handling: 0, upwind: 0, reach: 0, downwind: 0, pressure: 0, lightAir: 0, heavyAir: 0, memory: 0 };
      bt.raceState = Object.assign({}, proto.raceState, {
        finished: false, isPlaning: false, planingTimer: 0, planingFactor: 0, penalty: null,
        lastPos: { x: c.x, y: c.y }, leg: 1, windObsMin: 99, windObsMax: 0, windObsSum: 0, windObsN: 0
      });
      bt.velocity = { x: 0, y: 0 };
      bt.spinnaker = false; bt.spinnakerDeployProgress = 0; bt.manualTrim = false;
      bt.manualSailAngle = 0; bt.sailAngle = 0; bt.boomSide = 1; bt.targetBoomSide = 1;
      bt.turbulence = []; bt.badAirIntensity = 0; bt.luffing = false; bt.swell = null; bt._surfHold = 0;
      return bt;
    }

    // Sail a HELD true wind angle: every frame the helm re-aims at (local wind + twa), which
    // is what a sailor holding a groove does — and it isolates the sea's speed/set effects
    // from its steering disturbance. `freeHelm` skips that and measures the disturbance.
    function run(twaDeg, seconds, freeHelm) {
      const bt = freshBoat();
      const kite = twaDeg > 95;
      bt.spinnaker = kite; bt.spinnakerDeployProgress = kite ? 1 : 0;
      state.boats = [bt];
      state.race.status = 'racing';
      const twa = twaDeg * Math.PI / 180;
      const dt = 1 / 60;
      let vmg = 0, along = 0, cross = 0, dist = 0, spdSum = 0, n = 0, plane = 0, surf = 0;
      let yawSum = 0, yawMax = 0, spdMax = 0, spdMin = 99;
      // settle first so acceleration transients are not measured
      for (let i = 0; i < Math.round(6 / dt); i++) {
        state.gusts = [];
        bt.spinnaker = kite;
        const w = getWindAt(bt.x, bt.y).direction;
        bt.heading = w + twa;
        window.Swell && window.Swell.update(dt);
        window.updateBoat(bt, dt);
      }
      for (let i = 0; i < Math.round(seconds / dt); i++) {
        state.gusts = [];
        bt.spinnaker = kite;
        const w0 = getWindAt(bt.x, bt.y).direction;
        const want = w0 + twa;
        if (!freeHelm) bt.heading = want;
        const px = bt.x, py = bt.y;
        window.Swell && window.Swell.update(dt);
        window.updateBoat(bt, dt);
        const dx = bt.x - px, dy = bt.y - py;
        // upwind unit vector at this instant
        const ux = Math.sin(w0), uy = -Math.cos(w0);
        vmg += dx * ux + dy * uy;                       // + = gained to windward
        // along/cross relative to the course the helm wanted
        const fx = Math.sin(want), fy = -Math.cos(want);
        along += dx * fx + dy * fy;
        cross += dx * (-fy) + dy * fx;                  // + = to the RIGHT of the wanted course
        dist += Math.hypot(dx, dy);
        const kn = bt.speed * 4;
        spdSum += kn; spdMax = Math.max(spdMax, kn); spdMin = Math.min(spdMin, kn); n++;
        if (bt.raceState.isPlaning) plane++;
        if (bt.swell && bt.swell.surf01 > 0.34 && bt.swell.withWave) surf++;
        const dev = Math.abs(norm(bt.heading - want)) * 180 / Math.PI;
        yawSum += dev; yawMax = Math.max(yawMax, dev);
      }
      const secs = n / 60;
      return {
        vmgKt: (vmg / secs) / 15, meanKt: spdSum / n, maxKt: spdMax, minKt: spdMin,
        // leeward set: cross-track drift per second, signed so + is to leeward
        crossKt: (cross / secs) / 15,
        planePct: 100 * plane / n, surfPct: 100 * surf / n,
        yawMeanDeg: yawSum / n, yawMaxDeg: yawMax
      };
    }

    const out = { up: [], down: [], free: [] };
    const withSwell = (on) => window.Swell.configure(on ? doc : null, state.wind.baseDirection);

    for (const twa of [34, 38, 42, 46, 50, 55, 60]) {
      withSwell(false); const a = run(twa, 30, false);
      withSwell(true);  const c = run(twa, 30, false);
      out.up.push({ twa, flat: a, sea: c });
    }
    for (const twa of [125, 140, 150, 160, 170, 180]) {
      withSwell(false); const a = run(twa, 30, false);
      withSwell(true);  const c = run(twa, 30, false);
      out.down.push({ twa, flat: a, sea: c });
    }
    for (const twa of [45, 90, 150]) {
      withSwell(true); out.free.push({ twa, r: run(twa, 30, true) });
    }
    withSwell(true);
    return out;
  });

  const f2 = (x) => (x >= 0 ? ' ' : '') + x.toFixed(2);
  console.log('──── UPWIND: VMG to windward, knots (held TWA) ────');
  console.log('TWA   flat    sea    delta   | leeward set kt   | mean kt flat/sea');
  let bestFlat = null, bestSea = null;
  for (const r of R.up) {
    const d = r.sea.vmgKt - r.flat.vmgKt;
    if (!bestFlat || r.flat.vmgKt > bestFlat.v) bestFlat = { twa: r.twa, v: r.flat.vmgKt };
    if (!bestSea || r.sea.vmgKt > bestSea.v) bestSea = { twa: r.twa, v: r.sea.vmgKt };
    console.log(`${String(r.twa).padStart(3)}  ${f2(r.flat.vmgKt)}  ${f2(r.sea.vmgKt)}  ${f2(d)}   | ${f2(r.sea.crossKt)} vs ${f2(r.flat.crossKt)} | ${r.flat.meanKt.toFixed(1)} / ${r.sea.meanKt.toFixed(1)}`);
  }
  console.log(`best TWA — flat water ${bestFlat.twa}° (${bestFlat.v.toFixed(2)} kt), in the sea ${bestSea.twa}° (${bestSea.v.toFixed(2)} kt)`);

  console.log('\n──── DOWNWIND: VMG downwind, knots ────');
  console.log('TWA   flat    sea    delta  | mean kt  | peak kt  | planing%   | surfing%');
  for (const r of R.down) {
    const d = (-r.sea.vmgKt) - (-r.flat.vmgKt);
    console.log(`${String(r.twa).padStart(3)}  ${f2(-r.flat.vmgKt)}  ${f2(-r.sea.vmgKt)}  ${f2(d)}  | ${r.flat.meanKt.toFixed(1)}/${r.sea.meanKt.toFixed(1)} | ${r.flat.maxKt.toFixed(1)}/${r.sea.maxKt.toFixed(1)} | ${r.flat.planePct.toFixed(0)}/${r.sea.planePct.toFixed(0)}   | ${r.sea.surfPct.toFixed(0)}`);
  }
  console.log('\n──── STEERING DISTURBANCE (helm not correcting) ────');
  for (const r of R.free) console.log(`TWA ${r.twa}: mean heading error ${r.r.yawMeanDeg.toFixed(1)}°, peak ${r.r.yawMaxDeg.toFixed(1)}°`);
  if (errs.length) console.log('\nERRORS:\n' + errs.slice(0, 6).join('\n'));
  await b.close();
})();

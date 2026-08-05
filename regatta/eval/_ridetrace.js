// Trace one boat running with the swell: where on the wave is it, and what is it doing?
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Swell && window.updateBoat);
  const R = await p.evaluate(() => {
    selectVenue('ocean');
    const proto = state.boats[0];
    const bt = Object.assign(Object.create(Object.getPrototypeOf(proto)), proto);
    bt.x = -1200; bt.y = -3400; bt.speed = 2.5; bt.heading = 0; bt.prevHeading = 0; bt.heel = 0;
    bt.isPlayer = true; bt.ai = null; bt.controller = null;
    bt.stats = { acceleration: 0, momentum: 0, handling: 0, upwind: 0, reach: 0, downwind: 0, pressure: 0, lightAir: 0, heavyAir: 0, memory: 0 };
    bt.raceState = Object.assign({}, proto.raceState, { finished: false, isPlaning: false, planingTimer: 0, planingFactor: 0, penalty: null, lastPos: { x: bt.x, y: bt.y }, leg: 1, windObsMin: 99, windObsMax: 0, windObsSum: 0, windObsN: 0 });
    bt.velocity = { x: 0, y: 0 }; bt.spinnaker = true; bt.spinnakerDeployProgress = 1;
    bt.manualTrim = false; bt.manualSailAngle = 0; bt.sailAngle = 0; bt.boomSide = 1; bt.targetBoomSide = 1;
    bt.turbulence = []; bt.badAirIntensity = 0; bt.luffing = false; bt.swell = null; bt._surfHold = 0;
    state.boats = [bt]; state.race.status = 'racing';
    const dt = 1 / 60, twa = 160 * Math.PI / 180;
    const T = window.Swell.debug().trains[0];
    // bins by where on the wave: 0 = crest, 0.25 = mid face, 0.5 = trough, 0.75 = back of the
    // wave ahead (climbing out).  phase runs 0..1 forward in the wave's travel direction.
    const bins = Array.from({ length: 8 }, () => ({ n: 0, kt: 0, acc: 0 }));
    let prevKt = 0;
    for (let i = 0; i < Math.round(70 / dt); i++) {
      state.gusts = [];
      const w = getWindAt(bt.x, bt.y).direction;
      bt.heading = w + twa;
      window.Swell.update(dt);
      window.updateBoat(bt, dt);
      if (i < 600) { prevKt = bt.speed * 4; continue; }         // settle
      const s = window.Swell.debug();
      // recover phase from the field: elevation and slope give position on the cycle
      const f = window.Swell.sampleAt(bt.x, bt.y);
      const th = (T.dirDeg) * Math.PI / 180;
      const sx = Math.sin(th), sy = -Math.cos(th);
      const along = f.gx * sx + f.gy * sy;                       // slope along travel dir
      const el = f.elev;
      // phase 0 at crest, increasing in the travel direction (down the face first)
      let ph = Math.atan2(-along, el * (2 * Math.PI / T.lengthU) * 1) / (2 * Math.PI);
      if (ph < 0) ph += 1;
      const k = Math.min(7, Math.floor(ph * 8));
      const kt = bt.speed * 4;
      bins[k].n++; bins[k].kt += kt; bins[k].acc += (kt - prevKt) * 60;
      prevKt = kt;
    }
    return bins.map((b2, i) => ({ zone: i, kt: b2.n ? b2.kt / b2.n : 0, acc: b2.n ? b2.acc / b2.n : 0, n: b2.n }));
  });
  const names = ['crest', 'crest→face', 'mid face', 'face→trough', 'trough', 'trough→back', 'climbing', 'back→crest'];
  console.log('where on the wave     mean kt   accel kt/s');
  for (const r of R) console.log(`${names[r.zone].padEnd(20)} ${r.kt.toFixed(1).padStart(7)}   ${(r.acc >= 0 ? '+' : '') + r.acc.toFixed(2)}`);
  if (errs.length) console.log('ERRORS', errs.slice(0, 3));
  await b.close();
})();

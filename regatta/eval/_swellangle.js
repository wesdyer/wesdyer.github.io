// HOW FAR IS THE AI'S ANGLE FROM THE FASTEST ANGLE IN THE SEA?
//
//   node regatta/eval/_swellangle.js
//
// The strategic layer picks its upwind and downwind angles from the POLAR
// (`getCharacterOptimalVMGAngle`), and in a seaway the polar is no longer the boat's
// speed: it is wrong upwind by `poundMul` and wrong downwind by `surfKt`, and neither
// error is uniform across angle — which is precisely what moves the correct angle.
//
// This measures the gap three ways, all on the game's own `updateBoat`:
//
//   A  the fastest HELD angle with the sea on, against the fastest with it off, on a
//      2-degree grid — and against the angle the AI's own optimiser returns. The VMG
//      left on the table at the AI's angle is the size of the static prize.
//   B  what the fleet actually sails on Bluewater, sampled from a real race, against A.
//   C  what fraction of a downwind leg is spent on a face and what fraction climbing —
//      the headroom for steering to the wave rather than to a fixed angle.
//
// ⚠️ Held helm, not free helm: a helmsman holds a groove, and holding it isolates the
// sea's SPEED effect from its steering disturbance (`_swellmeasure.js` measures the
// disturbance with `freeHelm`). The wave-phase prize in C is deliberately not folded
// into A — they are different mechanisms and mixing them would hide both.
const { chromium } = require('playwright');
const path = require('path');

const SECONDS = +(process.argv[2] || 30);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Swell && window.updateBoat, null, { timeout: 20000 });

  const R = await p.evaluate(async (SECONDS) => {
    selectVenue('ocean');
    const doc = window.VenueDoc.get('ocean');
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const proto = state.boats[0];

    function freshBoat(stats) {
      const bt = Object.assign(Object.create(Object.getPrototypeOf(proto)), proto);
      bt.x = -1200; bt.y = -3400;
      bt.speed = 1.6; bt.heading = 0; bt.prevHeading = 0; bt.heel = 0;
      bt.isPlayer = true; bt.ai = null; bt.controller = null;
      bt.stats = stats || { acceleration: 0, momentum: 0, handling: 0, upwind: 0, reach: 0,
                            downwind: 0, pressure: 0, lightAir: 0, heavyAir: 0, memory: 0 };
      bt.raceState = Object.assign({}, proto.raceState, {
        finished: false, isPlaning: false, planingTimer: 0, planingFactor: 0, penalty: null,
        lastPos: { x: bt.x, y: bt.y }, leg: 1, windObsMin: 99, windObsMax: 0, windObsSum: 0, windObsN: 0
      });
      bt.velocity = { x: 0, y: 0 };
      bt.spinnaker = false; bt.spinnakerDeployProgress = 0; bt.manualTrim = false;
      bt.manualSailAngle = 0; bt.sailAngle = 0; bt.boomSide = 1; bt.targetBoomSide = 1;
      bt.turbulence = []; bt.badAirIntensity = 0; bt.luffing = false; bt.swell = null; bt._surfHold = 0;
      return bt;
    }

    // VMG at a held true wind angle, plus the face/climb split while doing it.
    function run(twaDeg, seconds) {
      const bt = freshBoat();
      const kite = twaDeg > 95;
      bt.spinnaker = kite; bt.spinnakerDeployProgress = kite ? 1 : 0;
      state.boats = [bt];
      state.race.status = 'racing';
      const twa = twaDeg * Math.PI / 180;
      const dt = 1 / 60;
      let vmg = 0, spdSum = 0, n = 0, face = 0, climb = 0, surfSum = 0, poundSum = 0;
      for (let i = 0; i < Math.round(6 / dt); i++) {          // settle
        state.gusts = []; bt.spinnaker = kite;
        bt.heading = getWindAt(bt.x, bt.y).direction + twa;
        window.Swell && window.Swell.update(dt);
        window.updateBoat(bt, dt);
      }
      for (let i = 0; i < Math.round(seconds / dt); i++) {
        state.gusts = []; bt.spinnaker = kite;
        const w0 = getWindAt(bt.x, bt.y).direction;
        bt.heading = w0 + twa;
        const px = bt.x, py = bt.y;
        window.Swell && window.Swell.update(dt);
        window.updateBoat(bt, dt);
        const ux = Math.sin(w0), uy = -Math.cos(w0);          // unit vector to windward
        vmg += (bt.x - px) * ux + (bt.y - py) * uy;
        spdSum += bt.speed * 4; n++;
        if (bt.swell) {
          if (bt.swell.surfKt > 0) face++; else climb++;
          surfSum += bt.swell.surfKt;
          poundSum += bt.swell.poundMul;
        }
      }
      const secs = n / 60;
      return { vmgKt: (vmg / secs) / 15, meanKt: spdSum / n,
               facePct: (face + climb) ? 100 * face / (face + climb) : null,
               surfKt: n ? surfSum / n : 0, poundMul: n ? poundSum / n : 1 };
    }

    const withSwell = (on) => window.Swell.configure(on ? doc : null, state.wind.baseDirection);
    const wind = state.wind.baseSpeed;
    const zero = { acceleration: 0, momentum: 0, handling: 0, upwind: 0, reach: 0,
                   downwind: 0, pressure: 0, lightAir: 0, heavyAir: 0, memory: 0 };

    // ── A: the grids ────────────────────────────────────────────────────────
    const up = [], down = [];
    for (let t = 32; t <= 64; t += 2) {
      withSwell(false); const flat = run(t, SECONDS);
      withSwell(true);  const sea = run(t, SECONDS);
      up.push({ twa: t, flat, sea });
    }
    for (let t = 118; t <= 180; t += 2) {
      withSwell(false); const flat = run(t, SECONDS);
      withSwell(true);  const sea = run(t, SECONDS);
      down.push({ twa: t, flat, sea });
    }

    // What the AI's own optimiser returns for this wind, stat-free and for the fleet.
    const aiUp = getCharacterOptimalVMGAngle('upwind', wind, zero) * 180 / Math.PI;
    const aiDn = getCharacterOptimalVMGAngle('downwind', wind, zero) * 180 / Math.PI;

    return { wind, up, down, aiUp, aiDn,
             swellCfg: (window.Swell.trains ? window.Swell.trains() : null) };
  }, SECONDS);

  const f2 = (x) => (x >= 0 ? ' ' : '') + x.toFixed(3);
  const peak = (rows, key, sign) => {
    // Parabolic peak through the best sample and its two neighbours: a 2-degree grid
    // reports a 2-degree resolution otherwise, and the differences here are smaller.
    let bi = 0;
    for (let i = 0; i < rows.length; i++) if (sign * rows[i][key].vmgKt > sign * rows[bi][key].vmgKt) bi = i;
    const v = (i) => sign * rows[i][key].vmgKt;
    if (bi === 0 || bi === rows.length - 1) return { twa: rows[bi].twa, v: v(bi) };
    const y0 = v(bi - 1), y1 = v(bi), y2 = v(bi + 1);
    const den = (y0 - 2 * y1 + y2);
    const off = den === 0 ? 0 : 0.5 * (y0 - y2) / den;
    const step = rows[bi + 1].twa - rows[bi].twa;
    return { twa: rows[bi].twa + off * step, v: y1 - 0.25 * (y0 - y2) * off };
  };
  const at = (rows, twa, key, sign) => {
    // linear interpolation of the measured curve at an arbitrary angle
    for (let i = 0; i + 1 < rows.length; i++) {
      if (twa >= rows[i].twa && twa <= rows[i + 1].twa) {
        const f = (twa - rows[i].twa) / (rows[i + 1].twa - rows[i].twa);
        return sign * (rows[i][key].vmgKt * (1 - f) + rows[i + 1][key].vmgKt * f);
      }
    }
    return null;
  };

  console.log(`Bluewater Bonanza — wind ${R.wind.toFixed(1)} kt, ${SECONDS}s per held angle\n`);
  console.log('──── A. UPWIND — VMG to windward, knots ────');
  console.log(' TWA    flat     sea    delta   poundMul   mean kt sea');
  for (const r of R.up)
    console.log(`${String(r.twa).padStart(4)}  ${f2(r.flat.vmgKt)}  ${f2(r.sea.vmgKt)}  ${f2(r.sea.vmgKt - r.flat.vmgKt)}     ${r.sea.poundMul.toFixed(3)}     ${r.sea.meanKt.toFixed(2)}`);
  const upFlat = peak(R.up, 'flat', 1), upSea = peak(R.up, 'sea', 1);
  const upAtAI = at(R.up, R.aiUp, 'sea', 1);
  console.log(`\n  fastest in FLAT water   ${upFlat.twa.toFixed(1)}°   (${upFlat.v.toFixed(3)} kt VMG)`);
  console.log(`  fastest in THE SEA      ${upSea.twa.toFixed(1)}°   (${upSea.v.toFixed(3)} kt VMG)`);
  console.log(`  the AI's optimiser says ${R.aiUp.toFixed(1)}°   (${upAtAI == null ? 'off grid' : upAtAI.toFixed(3) + ' kt in the sea'})`);
  console.log(`  ⇒ ANGLE ERROR ${(upSea.twa - R.aiUp).toFixed(1)}°, costing ${upAtAI == null ? '?' : (upSea.v - upAtAI).toFixed(3)} kt VMG` +
              (upAtAI == null ? '' : ` = ${(100 * (upSea.v - upAtAI) / upSea.v).toFixed(1)}% of the leg`));

  console.log('\n──── B. DOWNWIND — VMG downwind, knots ────');
  console.log(' TWA    flat     sea    delta   surf kt   on a face %   mean kt sea');
  for (const r of R.down)
    console.log(`${String(r.twa).padStart(4)}  ${f2(-r.flat.vmgKt)}  ${f2(-r.sea.vmgKt)}  ${f2(-r.sea.vmgKt + r.flat.vmgKt)}    ${f2(r.sea.surfKt)}      ${r.sea.facePct == null ? ' n/a' : r.sea.facePct.toFixed(1)}       ${r.sea.meanKt.toFixed(2)}`);
  const dnFlat = peak(R.down, 'flat', -1), dnSea = peak(R.down, 'sea', -1);
  const dnAtAI = at(R.down, R.aiDn, 'sea', -1);
  console.log(`\n  fastest in FLAT water   ${dnFlat.twa.toFixed(1)}°   (${dnFlat.v.toFixed(3)} kt VMG)`);
  console.log(`  fastest in THE SEA      ${dnSea.twa.toFixed(1)}°   (${dnSea.v.toFixed(3)} kt VMG)`);
  console.log(`  the AI's optimiser says ${R.aiDn.toFixed(1)}°   (${dnAtAI == null ? 'off grid' : dnAtAI.toFixed(3) + ' kt in the sea'})`);
  console.log(`  ⇒ ANGLE ERROR ${(dnSea.twa - R.aiDn).toFixed(1)}°, costing ${dnAtAI == null ? '?' : (dnSea.v - dnAtAI).toFixed(3)} kt VMG` +
              (dnAtAI == null ? '' : ` = ${(100 * (dnSea.v - dnAtAI) / dnSea.v).toFixed(1)}% of the leg`));

  // ── THE CONTROL THAT SPLITS THE TWO ERRORS ──────────────────────────────
  // The AI can be wrong about the angle for two quite different reasons, and only one
  // of them is the sea's doing. Price them separately or a swell fix gets credit for
  // an error that was there in flat water.
  const upFlatAtAI = at(R.up, R.aiUp, 'flat', 1), dnFlatAtAI = at(R.down, R.aiDn, 'flat', -1);
  console.log('\n──── C. WHOSE ERROR IS IT? ────');
  console.log(`  upwind:   the sea moves the best angle ${(upSea.twa - upFlat.twa >= 0 ? '+' : '')}${(upSea.twa - upFlat.twa).toFixed(1)}° ` +
              `(${upFlat.twa.toFixed(1)} -> ${upSea.twa.toFixed(1)}); the AI is ${(R.aiUp - upFlat.twa).toFixed(1)}° off in FLAT water ` +
              `costing ${upFlatAtAI == null ? '?' : (upFlat.v - upFlatAtAI).toFixed(3)} kt, and ${(R.aiUp - upSea.twa).toFixed(1)}° off in the sea`);
  console.log(`  downwind: the sea moves the best angle ${(dnSea.twa - dnFlat.twa >= 0 ? '+' : '')}${(dnSea.twa - dnFlat.twa).toFixed(1)}° ` +
              `(${dnFlat.twa.toFixed(1)} -> ${dnSea.twa.toFixed(1)}); the AI is ${(R.aiDn - dnFlat.twa).toFixed(1)}° off in FLAT water ` +
              `costing ${dnFlatAtAI == null ? '?' : (dnFlat.v - dnFlatAtAI).toFixed(3)} kt, and ${(R.aiDn - dnSea.twa).toFixed(1)}° off in the sea`);

  const faceAt = R.down.find(r => Math.abs(r.twa - Math.round(R.aiDn / 2) * 2) < 1.5);
  if (faceAt) console.log(`\n  at the AI's own downwind angle the boat is on a FACE ${faceAt.sea.facePct.toFixed(1)}% of the time and climbing ${(100 - faceAt.sea.facePct).toFixed(1)}%`);
  if (errs.length) console.log('\nERRORS:\n' + errs.slice(0, 6).join('\n'));
  await b.close();
})();

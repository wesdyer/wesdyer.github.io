// RANKS the reasons the player can't plane at Clubhouse Point.
//
// One designated boat (fleet index 1) is stat-zeroed to the player's line, then ONE
// factor at a time is handed back to it. Same seeds, same course, same fleet, so the
// only difference between treatments is the factor under test. Reports planing time
// as a share of the boat's own TWA-100-170 time.
//
// ⚠️ Use 10+ seeds. Changing a stat changes the boat's navigation, so it takes a
// different path through the fleet and its own dirty-air exposure varies; at 1 seed
// that chaos is larger than every effect except the reach/downwind one.
//
// Run: node regatta/eval/_plane_ablate.js [seeds]
const { chromium } = require('playwright');
const path = require('path');

const SEEDS = Number(process.argv[2] || 10);

const TREATMENTS = [
  { key: 'player (all stats 0)',      stats: {} },
  { key: '+4 reach only',             stats: { reach: 4 } },
  { key: '+4 downwind only',          stats: { downwind: 4 } },
  { key: '+4 reach & downwind',       stats: { reach: 4, downwind: 4 } },
  { key: '+4 acceleration',           stats: { acceleration: 4 } },
  { key: '+4 momentum',               stats: { momentum: 4 } },
  { key: '+4 handling',               stats: { handling: 4 } },
  { key: '+4 pressure',               stats: { pressure: 4 } },
  { key: '+4 ALL SEVEN (a real AI)',  stats: { acceleration: 4, momentum: 4, handling: 4,
                                               upwind: 4, reach: 4, downwind: 4, pressure: 4 } },
  { key: 'zero + 1 deg trim error',   stats: {}, trimErrDeg: 1 },
  { key: 'zero + 2 deg trim error',   stats: {}, trimErrDeg: 2 },
  { key: 'zero + 5 deg trim error',   stats: {}, trimErrDeg: 5 },
  { key: 'zero + kite 8 s late',      stats: {}, kiteDelay: 8 },
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  const t0 = Date.now();
  const out = await p.evaluate(async ({ TREATMENTS, SEEDS }) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
    const realTrim = window.updateAITrim;
    const acc = TREATMENTS.map(() => ({ dw: 0, plane: 0, peak: 0, dirty: 0, nokite: 0, over85: 0 }));
    for (let ti = 0; ti < TREATMENTS.length; ti++) {
      const T = TREATMENTS[ti];
      for (let race = 0; race < SEEDS; race++) {
        let s = 100 + race * 6151;
        Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        resetGame();

        const subject = state.boats.filter(x => !x.isPlayer)[1];
        for (const k of Object.keys(subject.stats)) subject.stats[k] = 0;
        for (const k of Object.keys(T.stats)) subject.stats[k] = T.stats[k];

        // Hand-trim error: the AI trims exactly; a human sits a degree or two off.
        // Held as a CONSTANT offset from optimal — `shadow` carries the clean angle
        // across frames, because feeding the erred angle back into the real trim
        // routine lets the error ratchet to full-eased in a couple of seconds.
        const errRad = (T.trimErrDeg || 0) * Math.PI / 180;
        let shadow = 0;
        if (errRad) window.updateAITrim = (boat, optimal, dt) => {
          if (boat !== subject) return realTrim(boat, optimal, dt);
          boat.manualSailAngle = shadow;
          realTrim(boat, optimal, dt);
          shadow = boat.manualSailAngle;
          boat.manualSailAngle = Math.max(0, Math.min(Math.PI / 2, shadow + errRad));
          boat.sailAngle = boat.manualSailAngle * boat.boomSide;
        };

        state.race.status = 'racing';
        const dt = 1 / 60;
        const r = acc[ti];
        let kiteTimer = 0;
        for (let f = 0; f < 60 * 260; f++) {
          update(dt);
          if (subject.raceState.finished) break;
          // Lazy hoist. Pinning deployProgress is what bites: clearing `spinnaker`
          // post-update does nothing, updateAI just sets it true again next frame.
          if (T.kiteDelay) {
            if (subject.spinnaker) {
              kiteTimer += dt;
              if (kiteTimer < T.kiteDelay) subject.spinnakerDeployProgress = 0;
            } else kiteTimer = 0;
          }
          const wind = (typeof getWindAt === 'function') ? getWindAt(subject.x, subject.y) : state.wind;
          const twa = Math.abs(((subject.heading - wind.direction + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const twaDeg = twa * 180 / Math.PI;
          if (twaDeg > 100 && twaDeg < 170) {
            r.dw += dt;
            r.peak = Math.max(r.peak, subject.speed * 4);
            if (subject.raceState.isPlaning) r.plane += dt;
            // Diagnostics: which half of the gate was shut this frame.
            if (subject.effectiveWindNow != null && subject.effectiveWindNow <= 12) r.dirty += dt;
            if (subject.spinnakerDeployProgress < 0.95) r.nokite += dt;
            if (subject.speed * 4 > 8.5) r.over85 += dt;
          }
        }
        window.updateAITrim = realTrim;
      }
    }
    return acc;
  }, { TREATMENTS, SEEDS });

  console.log(`Clubhouse Point (13 kt steady), ${SEEDS} seeds x 260 s, one boat, one factor at a time.`);
  console.log(`Planing gate: TWA 100-170, effective wind > 12 kt, speed > 8.5 kt held 1.5 s.\n`);
  const base = out[0];
  const basePct = 100 * base.plane / base.dw;
  console.log('treatment                        planing %   delta   peak kt   >8.5kt %   dirty-air %   no kite %');
  out.forEach((r, i) => {
    const pct = 100 * r.plane / r.dw;
    const d = i === 0 ? '  -  ' : (pct - basePct >= 0 ? '+' : '') + (pct - basePct).toFixed(1);
    console.log(
      TREATMENTS[i].key.padEnd(32),
      pct.toFixed(1).padStart(8), d.padStart(8),
      r.peak.toFixed(2).padStart(9),
      (100 * r.over85 / r.dw).toFixed(1).padStart(10),
      (100 * r.dirty / r.dw).toFixed(1).padStart(13),
      (100 * r.nokite / r.dw).toFixed(1).padStart(11));
  });
  console.log(`\nelapsed ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await b.close();
})();

// VMG_eff(B) MEASURED IN THE ENGINE — the achievable upwind VMG of a boat
// short-tacking up a corridor of width B, against the same boat in open water.
//
// The corridor-routing model needs this curve. The closed form
// VMG_eff(B) = B·V·cosθ/(B + t_c·V·sinθ) assumes instant speed recovery between
// tacks; the literature (and the game's own speed-rebuild time) says that is
// OPTIMISTIC below a minimum board time. So measure, don't derive: an ideal helm
// (rate-limited exactly like the player's rudder — getTurnSpeed · steerageFactor,
// no key mush) holds the polar's best beat angle and flips whenever the boat
// reaches the corridor edge. Everything the physics charges — the turn, the
// in-irons decay, the rebuild, leeway — lands in the measured number.
//
// The corridor is VIRTUAL (cross-track bookkeeping, open seatrials water), so the
// measurement is about tacking arithmetic and not about any venue's actual walls.
// Overshoot past the trigger line is REPORTED (B_real = 2·max|cross|): a real
// boat must begin its tack before the wall, so the honest width label for each
// run is what the boat actually used, not what the trigger asked for.
//
// Usage: node regatta/eval/_vmgeff_probe.js [venue=seatrials] [secs=240]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.updateBoat && window.getTargetSpeed, null, { timeout: 20000 });
  const VENUE = process.argv[2] || 'seatrials';
  const SECS = parseInt(process.argv[3]) || 240;

  const R = await p.evaluate(async ({ VENUE, SECS }) => {
    selectVenue(VENUE);
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const proto = state.boats[0];

    function freshBoat(x, y) {
      const bt = Object.assign(Object.create(Object.getPrototypeOf(proto)), proto);
      bt.x = x; bt.y = y;
      bt.speed = 1.6; bt.heading = 0; bt.prevHeading = 0; bt.heel = 0;
      bt.isPlayer = true; bt.ai = null; bt.controller = null;
      bt.stats = { acceleration: 0, momentum: 0, handling: 0, upwind: 0, reach: 0, downwind: 0, pressure: 0, lightAir: 0, heavyAir: 0, memory: 0 };
      bt.raceState = Object.assign({}, proto.raceState, {
        finished: false, isPlaning: false, planingTimer: 0, planingFactor: 0, penalty: null,
        lastPos: { x, y }, leg: 1, windObsMin: 99, windObsMax: 0, windObsSum: 0, windObsN: 0
      });
      bt.velocity = { x: 0, y: 0 };
      bt.spinnaker = false; bt.spinnakerDeployProgress = 0; bt.manualTrim = false;
      bt.manualSailAngle = 0; bt.sailAngle = 0; bt.boomSide = 1; bt.targetBoomSide = 1;
      bt.turbulence = []; bt.badAirIntensity = 0; bt.luffing = false; bt.swell = null; bt._surfHold = 0;
      return bt;
    }

    // ⚠️ Bounded climb, not bounded time: at ~110 u/s a 240 s run crosses the whole
    // arena, pins on the boundary, and every width "measures" start-to-wall distance
    // over the clock — the first cut of this probe reported byte-identical VMG for
    // every B that way. Start near the downwind edge and time a fixed climb that
    // ends well clear of the upwind wall.
    const ext = window.Arena.extent(state.course.boundary);
    const cx = (ext.minX + ext.maxX) / 2, cy = (ext.minY + ext.maxY) / 2;
    const wDir = getWindAt(cx, cy).direction;
    const upx = Math.sin(wDir), upy = -Math.cos(wDir);
    const half = Math.min(ext.maxX - ext.minX, ext.maxY - ext.minY) / 2;
    const X0 = cx - upx * half * 0.75, Y0 = cy - upy * half * 0.75;
    const CLIMB = half * 1.1;
    const ws = getWindAt(X0, Y0).speed;

    // Polar's best beat angle at this wind speed.
    let optTWA = 0.7, bestVmg = 0;
    for (let d = 25; d <= 70; d += 1) {
      const tr = d * Math.PI / 180;
      const v = getTargetSpeed(tr, false, ws) * Math.cos(tr);
      if (v > bestVmg) { bestVmg = v; optTWA = tr; }
    }

    function run(B) {
      const bt = freshBoat(X0, Y0);
      state.boats = [bt];
      state.race.status = 'racing';
      const dt = 1 / 60;
      let side = 1;
      // settle on one board first
      for (let i = 0; i < Math.round(8 / dt); i++) {
        state.gusts = [];
        const w = getWindAt(bt.x, bt.y).direction;
        const want = w + side * optTWA;
        const err = norm(want - bt.heading);
        const r = getTurnSpeed() * steerageFactor(bt);
        bt.heading += Math.max(-r, Math.min(r, err));
        window.updateBoat(bt, dt);
      }
      // corridor axis = dead upwind at the start point, fixed.
      const w0 = getWindAt(bt.x, bt.y).direction;
      const ux = Math.sin(w0), uy = -Math.cos(w0);      // upwind unit
      const rx = -uy, ry = ux;                           // right of axis
      const sx = bt.x, sy = bt.y;
      let vmg = 0, dist = 0, flips = 0, maxCross = 0, minKn = 99, knSum = 0, n = 0;
      let turning = 0, secs = 0;
      for (let i = 0; i < Math.round(SECS / dt) && vmg < CLIMB; i++) {
        secs += dt;
        state.gusts = [];
        const w = getWindAt(bt.x, bt.y).direction;
        const cross = (bt.x - sx) * rx + (bt.y - sy) * ry;
        if (Math.abs(cross) > maxCross) maxCross = Math.abs(cross);
        // flip when past the edge and sailing outward
        const want0 = w + side * optTWA;
        const headedOut = Math.sign(Math.sin(bt.heading - w0)) === Math.sign(cross);
        if (Math.abs(cross) >= B / 2 && headedOut && turning <= 0) {
          side = -side; flips++; turning = 60;   // 1s lockout so one edge = one flip
        }
        if (turning > 0) turning--;
        const want = w + side * optTWA;
        const err = norm(want - bt.heading);
        const r = getTurnSpeed() * steerageFactor(bt);
        bt.heading += Math.max(-r, Math.min(r, err));
        const px = bt.x, py = bt.y;
        window.updateBoat(bt, dt);
        const dx = bt.x - px, dy = bt.y - py;
        vmg += dx * ux + dy * uy;
        dist += Math.hypot(dx, dy);
        const kn = bt.speed * 4;
        if (kn < minKn) minKn = kn;
        knSum += kn; n++;
      }
      return { B, vmgKn: (vmg / secs) / 15, flips, usedB: Math.round(maxCross * 2),
               avgKn: knSum / n, minKn, distU: Math.round(dist), climbed: Math.round(vmg), secs: Math.round(secs) };
    }

    const out = { venue: VENUE, ws, optTWAdeg: Math.round(optTWA * 180 / Math.PI), polarVmgKn: bestVmg, runs: [] };
    for (const B of [75, 100, 150, 200, 300, 400, 600, 800, 1200, 1e9]) out.runs.push(run(B));
    return out;
  }, { VENUE, SECS });

  console.log(`venue=${R.venue} ws=${R.ws.toFixed(1)}kt optTWA=${R.optTWAdeg}deg polarVMG=${R.polarVmgKn.toFixed(2)}kn`);
  const free = R.runs[R.runs.length - 1];
  for (const r of R.runs) {
    const lbl = r.B > 1e8 ? 'free' : String(r.B).padStart(5);
    console.log(`B=${lbl}u  usedB=${String(r.usedB).padStart(5)}u  VMG=${r.vmgKn.toFixed(2)}kn  frac=${(r.vmgKn / free.vmgKn).toFixed(3)}  tacks=${r.flips}  avg=${r.avgKn.toFixed(1)}kn min=${r.minKn.toFixed(1)}kn  climbed=${r.climbed}u in ${r.secs}s`);
  }
  await b.close();
})();

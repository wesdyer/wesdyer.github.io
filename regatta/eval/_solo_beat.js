// TRAFFIC, PRICED DIRECTLY: the same boat, the same seed, beat leg alone vs in the fleet.
//
// The ocean-beat thread closed on "what is left is traffic — the human sailed alone".
// This is the direct counterfactual: run the race normally, then run the SAME seed with
// every other bot parked off-map at the first prestart frame, and compare the kept
// boat's leg times. The fleet composition, wind, course and RNG init are identical up
// to the parking moment (init draws all happen before prestart).
//
// The kept boat is the first non-player boat (deterministic per seed). Parked boats
// are marked finished and moved to 1e6 so rules, avoidance and bad-air never see them.
//
// Usage: node regatta/eval/_solo_beat.js [venue=ocean] [seed0=9300] [n=5]
// Prints per-seed paired rows and a summary of leg-1 (and whole-race) deltas.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const VENUE = A[0] || 'ocean';
const SEED0 = parseInt(A[1]) || 9300, NUM = parseInt(A[2]) || 5;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });

  const runOne = (seed, solo) => page.evaluate(({ seed, solo }) => {
    window.evalHarness.seed = seed;
    window.resetGame(); window.startRace();
    state.course.cutoff = 900;
    const pl = state.boats.find(b => b.isPlayer);
    if (pl) { pl.x = 1e6; pl.y = 1e6; }
    const bots = state.boats.filter(b => !b.isPlayer);
    const kept = bots[0];
    if (solo) {
      for (const b of bots.slice(1)) {
        b.x = 1e6 + b.id * 4000; b.y = 1.2e6;
        b.raceState.finished = true; b.raceState.resultStatus = 'DNF';
      }
    }
    const dt = 1 / 60; let it = 0;
    const legAt = {};       // leg -> race timer at entry
    let lastLeg = kept.raceState.leg, dist = 0, px = kept.x, py = kept.y;
    const legDist = {}, legTacks = {};
    const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    let lastSide = 0;
    while (it < 700 * 60) {
      if (state.race.status === 'racing') {
        if (kept.raceState.finished) break;
        const lg = kept.raceState.leg;
        if (lg !== lastLeg) { legAt[lg] = state.race.timer; lastLeg = lg; }
        const d = Math.hypot(kept.x - px, kept.y - py);
        if (d < 500) { legDist[lg] = (legDist[lg] || 0) + d; }
        px = kept.x; py = kept.y;
        if (it % 6 === 0) {
          const w = getWindAt(kept.x, kept.y);
          const twa = norm(kept.heading - w.direction);
          const side = Math.sign(twa);
          if (Math.abs(twa) < Math.PI / 2 && lastSide !== 0 && side !== 0 && side !== lastSide) {
            legTacks[lg] = (legTacks[lg] || 0) + 1;
          }
          if (side !== 0) lastSide = side;
        }
      }
      window.update(dt); it++;
    }
    return { name: kept.name, fin: kept.raceState.finished ? kept.raceState.finishTime : null,
             legAt, legDist, legTacks, pen: kept.raceState.totalPenalties || 0 };
  }, { seed, solo });

  const rows = [];
  for (let i = 0; i < NUM; i++) {
    const seed = SEED0 + i;
    const fleet = await runOne(seed, false);
    const solo = await runOne(seed, true);
    const l1 = r => (r.legAt[2] != null && r.legAt[1] != null) ? r.legAt[2] - r.legAt[1] : null;
    rows.push({ seed, name: fleet.name,
      fleetL1: l1(fleet), soloL1: l1(solo),
      fleetL1d: fleet.legDist[1] || null, soloL1d: solo.legDist[1] || null,
      fleetL1t: fleet.legTacks[1] || 0, soloL1t: solo.legTacks[1] || 0,
      fleetFin: fleet.fin, soloFin: solo.fin });
    const r = rows[rows.length - 1];
    console.log(`seed ${seed} ${r.name}: L1 fleet ${r.fleetL1?.toFixed(1)}s/${Math.round(r.fleetL1d)}u/${r.fleetL1t}tk  solo ${r.soloL1?.toFixed(1)}s/${Math.round(r.soloL1d)}u/${r.soloL1t}tk  fin ${r.fleetFin?.toFixed(1)} vs ${r.soloFin?.toFixed(1)}`);
  }
  const ok = rows.filter(r => r.fleetL1 != null && r.soloL1 != null);
  if (ok.length) {
    const ds = ok.map(r => r.fleetL1 - r.soloL1).sort((a, b) => a - b);
    const dd = ok.map(r => r.fleetL1d - r.soloL1d).sort((a, b) => a - b);
    const q = (s, p) => s[Math.floor(p * (s.length - 1))];
    console.log(`PAIRED L1 (fleet - solo): n=${ok.length} med ${q(ds, 0.5).toFixed(1)}s mean ${(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(1)}s  dist med ${Math.round(q(dd, 0.5))}u`);
  }
  await browser.close();
})();

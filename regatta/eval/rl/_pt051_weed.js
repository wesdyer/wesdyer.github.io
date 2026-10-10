// PT-051 class 2 — WHAT THE FLEET DOES IN THE WEED (Gatorgrass). Per boat, every 0.5 s while racing:
// in a drag band (shoalMul < 0.7)? which layer owns the helm (wiggle / escape / clearance / liveness
// recovery or force / normal)? speed, and VMC — speed made good toward the boat's own nav target.
// Reports boat-seconds per owner IN WEED with the mean VMC and speed of each, so we can see whether the
// escapes buy ground or burn it. Same ten-bot construction as ocean_bench (late venue write).
//   node _pt051_weed.js <trials> <seed0> [venue]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TRIALS = +process.argv[2] || 2, SEED0 = +process.argv[3] || 9400, venue = process.argv[4] || 'swamp';
const ROOT = path.resolve(__dirname, '../../..');
(async () => { const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), venue);
  const agg = {};
  for (let i = 0; i < TRIALS; i++) {
    const r = await page.evaluate((seed) => {
      window.evalHarness.seed = seed; window.resetGame(); window.startRace(); state.course.cutoff = 900;
      const pl = state.boats.find(b => b.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
      const nine = state.boats.filter(b => b !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300;
      const A = {}; const add = (k, vmc, sp) => { const a = A[k] || (A[k] = { n: 0, vmc: 0, sp: 0 }); a.n++; a.vmc += vmc; a.sp += sp; };
      for (let it = 0; it < 60 * 940; it++) {
        window.update(1 / 60);
        if (state.race.status === 'finished') break; if (state.race.status !== 'racing') continue; if (state.race.timer > 900) break;
        if (it % 30) continue;
        for (const bt of state.boats) {
          const rs = bt.raceState; if (rs.finished || rs.leg < 1) continue;
          const c = bt.controller || {}, nt = c._lastNav;
          const v = bt.velocity || { x: 0, y: 0 }, sp = Math.hypot(v.x, v.y) * 4;   // knots over the ground
          let vmc = 0; if (nt) { const dx = nt.x - bt.x, dy = nt.y - bt.y, d = Math.hypot(dx, dy) || 1; vmc = (v.x * dx + v.y * dy) / d * 4; }
          const weed = bt.shoalMul != null && bt.shoalMul < 0.7;
          const owner = c.escActive ? 'escape' : c.wiggleActive ? 'wiggle' : (c.clearanceTimer > 0) ? 'clearance'
                      : c.livenessState !== 'normal' ? 'liveness-' + c.livenessState : (c.lastAvoidDeviation > 0.5 ? 'avoid>30deg' : 'normal');
          add((weed ? 'WEED ' : 'clear ') + owner, vmc, sp);
        }
      }
      return A; }, SEED0 + i);
    for (const [k, a] of Object.entries(r)) { const g = agg[k] || (agg[k] = { n: 0, vmc: 0, sp: 0 }); g.n += a.n; g.vmc += a.vmc; g.sp += a.sp; }
    console.log('seed', SEED0 + i, 'done');
  }
  const rows = Object.entries(agg).sort((a, b) => b[1].n - a[1].n);
  const tot = rows.reduce((s, [, a]) => s + a.n, 0);
  for (const [k, a] of rows) console.log(`${k.padEnd(28)} ${(a.n * 0.5 / TRIALS).toFixed(0).padStart(6)} boat-s/race  ${(100 * a.n / tot).toFixed(1).padStart(5)}%  VMC ${(a.vmc / a.n).toFixed(2)} kt  SOG ${(a.sp / a.n).toFixed(2)} kt`);
  await b.close(); })();

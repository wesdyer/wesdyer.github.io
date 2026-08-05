// DID THE TRACK ACTUALLY WRAP THE MARK? — the string rule on the REALISED track.
//
//   node regatta/eval/_string_realised_probe.js [venue] [races] [seed0] [treeDir]
//
// The engine's own winding test has to PREDICT the rest of the leg at the moment the
// rounding completes (`roundSweep` plus the short-way sweep still to come). This does not
// predict anything: it keeps accumulating the boat's winding about the mark AFTER the leg
// completes, all the way to the next anchor, and then asks the rule.
//
//   required = the signed angle from (mark -> where she began the leg) to
//              (mark -> the next anchor), taken the required way round, in (0, 2pi]
//   realised = the winding her track actually made about the mark over that whole span
//   WRAPPED iff realised >= required - pi
//
// Over a leg the realised winding takes one of exactly two values 2*pi apart, so this is a
// two-class decision with a full pi of margin and no tolerance of its own.
//
// ⚠️ A HAIRPIN IS DEGENERATE FOR THE REQUIREMENT, NOT FOR THE ANSWER. When the previous
// and next anchors lie in the same direction from the mark the required value is 0-or-2pi
// on sign noise — so hairpin legs are reported SEPARATELY and classified on the realised
// winding alone (|realised| > pi means she went round), which is unambiguous.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VENUE = process.argv[2] || 'bay';
const RACES = +(process.argv[3] || 8);
const SEED0 = +(process.argv[4] || 9100);
const ROOT = process.argv[5] ? path.resolve(process.argv[5]) : path.resolve('.');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.waitForFunction(() => window.state && window.updateBoat, null, { timeout: 20000 });
  await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

  const all = [];
  for (let i = 0; i < RACES; i++) {
    const r = await p.evaluate(async (seed) => {
      window.evalHarness.seed = seed;
      window.resetGame(); window.startRace();
      state.course.cutoff = 900;
      const bots = state.boats.filter(x => !x.isPlayer);
      const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const rt = state.course.route, mk = state.course.marks;
      const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      // One record per (boat, rounding leg): opened when the boat enters that leg, kept
      // open — still accumulating — until she reaches the NEXT anchor.
      const open = bots.map(() => null);
      const done = [];
      const lastLeg = bots.map(x => x.raceState.leg);
      const lastB = bots.map(() => null);
      const dt = 1 / 60;
      for (let it = 0; it < 60 * 940; it++) {
        window.update(dt);
        if (state.race.status === 'finished') break;
        if (state.race.status !== 'racing') continue;
        if (state.race.timer > 900) break;
        for (let k = 0; k < bots.length; k++) {
          const bt = bots[k], rs = bt.raceState;
          // keep winding the OPEN record, whatever leg she is on now
          const rec = open[k];
          if (rec) {
            const bNow = Math.atan2(bt.y - rec.my, bt.x - rec.mx);
            if (lastB[k] != null) rec.wind += norm(bNow - lastB[k]) * rec.sgn;
            lastB[k] = bNow;
            const dn = Math.hypot(bt.x - rec.nx, bt.y - rec.ny);
            if (dn < rec.closeAt || rs.finished) { done.push(rec); open[k] = null; lastB[k] = null; }
          }
          if (rs.leg !== lastLeg[k]) {
            lastLeg[k] = rs.leg;
            const e = rt[rs.leg];
            if (e && e.kind === 'round' && e.mark && !open[k]) {
              const m = e.mark;
              const nA = CoursePath.anchor(rt[rs.leg + 1], mk);
              if (nA) {
                const sgn = m.side === 'port' ? -1 : 1;
                const bP = Math.atan2(bt.y - m.y, bt.x - m.x);
                const bQ = Math.atan2(nA.y - m.y, nA.x - m.x);
                let need = (bQ - bP) * sgn;
                while (need <= 0) need += Math.PI * 2;
                while (need > Math.PI * 2) need -= Math.PI * 2;
                // subtend at the mark between where she started and the next anchor
                const sub = Math.abs(norm(bQ - bP));
                open[k] = { leg: rs.leg, name: bt.name, mx: m.x, my: m.y, sgn,
                            nx: nA.x, ny: nA.y, need, sub, wind: 0,
                            closeAt: Math.max(200, m.zone * 0.9) };
                lastB[k] = bP;
              }
            }
          }
        }
      }
      for (const r of open) if (r) done.push(r);
      return { seed, done };
    }, SEED0 + i);
    all.push(...r.done.map(x => ({ ...x, seed: r.seed })));
    process.stdout.write('.');
  }
  console.log('');

  const D = 180 / Math.PI;
  const hair = all.filter(x => x.sub < 0.25 || x.sub > Math.PI - 0.25);   // ~14 degrees
  const norml = all.filter(x => !(x.sub < 0.25 || x.sub > Math.PI - 0.25));
  const bad = norml.filter(x => x.wind < x.need - Math.PI);
  const hbad = hair.filter(x => Math.abs(x.wind) <= Math.PI);
  const byLeg = {};
  for (const x of all) {
    const isHair = x.sub < 0.25 || x.sub > Math.PI - 0.25;
    const failed = isHair ? Math.abs(x.wind) <= Math.PI : x.wind < x.need - Math.PI;
    const q = byLeg[x.leg] = byLeg[x.leg] || { n: 0, bad: 0, hair: isHair, wind: [] };
    q.n++; if (failed) q.bad++; q.wind.push(x.wind * D);
  }
  console.log(`\n${VENUE} — ${RACES} races from ${SEED0}, ${all.length} roundings observed\n`);
  console.log(`  ORDINARY legs   ${norml.length} roundings, ${bad.length} whose track never wrapped the mark  (${(100 * bad.length / Math.max(1, norml.length)).toFixed(1)}%)`);
  console.log(`  HAIRPIN legs    ${hair.length} roundings, ${hbad.length} that never went round  (${(100 * hbad.length / Math.max(1, hair.length)).toFixed(1)}%)`);
  console.log('\n   leg   kind      n   never wrapped     realised winding p10 / median / p90 (deg)');
  for (const [lg, q] of Object.entries(byLeg).sort((a, c) => a[0] - c[0])) {
    const s = q.wind.sort((a, c) => a - c);
    const pick = (f) => s[Math.floor(f * (s.length - 1))].toFixed(0);
    console.log(`   ${String(lg).padStart(3)}   ${(q.hair ? 'hairpin' : 'ordinary').padEnd(9)}${String(q.n).padStart(4)}   ${String(q.bad).padStart(4)} (${(100 * q.bad / q.n).toFixed(0)}%)` +
                `        ${pick(0.1).padStart(6)} / ${pick(0.5).padStart(6)} / ${pick(0.9).padStart(6)}`);
  }
  if (errs.length) console.log('\nERRORS: ' + errs.slice(0, 4).join(' | '));
  await b.close();
})();

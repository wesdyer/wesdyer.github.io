// HOW OFTEN WOULD RULES 18.3, 18.4 AND 20 ACTUALLY FIRE?
//
//   node regatta/eval/_rule18_incidence.js [venue] [races] [seed0]
//
// Three Part 2 rules are absent from the engine. Before implementing any of them, count
// how often their PREDICATE is met in real races — the campaign has already spent four
// implementations on rule 22, whose predicate turned out to be wrong (see the rule-22
// closure). Verbatim from the 2025-2028 RRS:
//
//   18.3  "If a boat passes head to wind from port to starboard tack in the zone of a
//          mark to be left to port, rule 18.2 does not apply between her and another
//          boat on starboard tack that is fetching the mark."
//   18.4  "When an inside overlapped right-of-way boat must gybe at a mark to sail her
//          proper course, until she gybes she shall sail no farther from the mark than
//          needed to sail that course. Rule 18.4 does not apply at a gate mark."
//   20.1  "A boat may hail for room to tack ... (a) she is approaching an obstruction and
//          will soon need to make a substantial course change to avoid it safely, and
//          (b) she is sailing close-hauled or above."
//
// Fetching (definition): "in a position to pass to windward of it and leave it on the
// required side without changing tack."
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VENUE = process.argv[2] || 'bay';
const RACES = +(process.argv[3] || 6);
const SEED0 = +(process.argv[4] || 9100);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Rules, null, { timeout: 20000 });
  await p.addScriptTag({ content: fs.readFileSync(path.resolve('regatta/eval/eval_harness.js'), 'utf8') });

  const tot = { r183: 0, r183pair: 0, r184: 0, r20: 0, zoneTacks: 0, boatRaces: 0, gybeAtMark: 0 };
  for (let i = 0; i < RACES; i++) {
    const r = await p.evaluate(async (seed) => {
      window.evalHarness.seed = seed;
      window.resetGame(); window.startRace();
      state.course.cutoff = 900;
      const bots = state.boats.filter(x => !x.isPlayer);
      const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const R = window.Rules;
      const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      const c = { r183: 0, r183pair: 0, r184: 0, r20: 0, zoneTacks: 0, gybeAtMark: 0 };
      const prevTack = new Map(), fired = new Set();
      const dt = 1 / 60;
      for (let it = 0; it < 60 * 940; it++) {
        window.update(dt);
        if (state.race.status === 'finished') break;
        if (state.race.status !== 'racing') continue;
        if (state.race.timer > 900) break;
        const e = state.course.route[state.boats[0] ? 0 : 0];
        for (const bt of bots) {
          if (bt.raceState.finished) continue;
          const ent = state.course.route[bt.raceState.leg];
          if (!ent || ent.kind !== 'round' || !ent.mark) { prevTack.set(bt.id, R.getTack(bt)); continue; }
          const m = ent.mark;
          const d = Math.hypot(bt.x - m.x, bt.y - m.y);
          const inZone = d < R.zoneOf(m);
          const tk = R.getTack(bt);
          const was = prevTack.get(bt.id);
          prevTack.set(bt.id, tk);
          if (!inZone) continue;
          // 18.3's predicate: head to wind from PORT to STARBOARD, in the zone of a mark
          // to be left to PORT.
          if (was != null && was !== tk && m.side === 'port' && tk === 1 /* STARBOARD */) {
            c.zoneTacks++;
            // ...and is there another boat on starboard FETCHING the mark?
            let any = false;
            for (const o of bots) {
              if (o === bt || o.raceState.finished) continue;
              if (R.getTack(o) !== 1) continue;
              if (o.raceState.leg !== bt.raceState.leg) continue;
              const od = Math.hypot(o.x - m.x, o.y - m.y);
              if (od > R.zoneOf(m) * 2.5) continue;
              // "in a position to pass to windward of it and leave it on the required
              // side without changing tack": her current heading, extended, passes the
              // mark on the required side.
              const hx = Math.sin(o.heading), hy = -Math.cos(o.heading);
              const rx = m.x - o.x, ry = m.y - o.y;
              const cross = hx * ry - hy * rx;               // >0 => mark to starboard
              const ahead = hx * rx + hy * ry > 0;
              if (ahead && ((m.side === 'port' && cross < 0) || (m.side !== 'port' && cross > 0))) { any = true; break; }
            }
            if (any) c.r183pair++;
            c.r183++;
          }
        }
        // 18.4's predicate: an inside overlapped ROW boat at a non-gate mark whose proper
        // course requires a gybe. Approximated as: she is inside, overlapped, has ROW, and
        // her boom is on the side that the next leg's bearing requires her to change.
        if (it % 6 === 0) {
          for (const bt of bots) {
            if (bt.raceState.finished) continue;
            const ent = state.course.route[bt.raceState.leg];
            if (!ent || ent.kind !== 'round' || !ent.mark) continue;
            const m = ent.mark;
            if (Math.hypot(bt.x - m.x, bt.y - m.y) > R.zoneOf(m)) continue;
            const w = getWindAt(bt.x, bt.y).direction;
            const nA = CoursePath.anchor(state.course.route[bt.raceState.leg + 1], state.course.marks);
            if (!nA) continue;
            const nextBearing = Math.atan2(nA.x - bt.x, -(nA.y - bt.y));
            const twaNow = norm(bt.heading - w), twaNext = norm(nextBearing - w);
            // Proper course on the next leg is on the other gybe, and both are downwind.
            if (Math.abs(twaNow) > Math.PI * 0.55 && Math.abs(twaNext) > Math.PI * 0.55
                && Math.sign(twaNow) !== Math.sign(twaNext)) {
              let inside = false;
              for (const o of bots) {
                if (o === bt || o.raceState.finished) continue;
                if (Math.hypot(o.x - bt.x, o.y - bt.y) > 250) continue;
                if (Math.hypot(o.x - m.x, o.y - m.y) > Math.hypot(bt.x - m.x, bt.y - m.y)) { inside = true; break; }
              }
              if (inside) c.gybeAtMark++;
            }
          }
        }
      }
      return { c, n: bots.length };
    }, SEED0 + i);
    for (const k of Object.keys(r.c)) tot[k] += r.c[k];
    tot.boatRaces += r.n;
    process.stdout.write('.');
  }
  console.log(`\n\n${VENUE} — ${RACES} races, ${tot.boatRaces} boat-races\n`);
  console.log(`  18.3 predicate: head to wind port->starboard inside a PORT mark's zone`);
  console.log(`      ${tot.r183} events   (${(tot.r183 / tot.boatRaces).toFixed(2)} per boat-race)`);
  console.log(`      of which with a starboard boat FETCHING the mark: ${tot.r183pair}` +
              `   (${(tot.r183pair / tot.boatRaces).toFixed(2)} per boat-race)  <- the rule`);
  console.log(`  18.4 predicate: inside boat at a mark whose proper course needs a gybe`);
  console.log(`      ${tot.gybeAtMark} frames at 10 Hz  (${(tot.gybeAtMark / tot.boatRaces / 10).toFixed(1)} s per boat-race)`);
  if (errs.length) console.log('\nERRORS: ' + errs.slice(0, 4).join(' | '));
  await b.close();
})();

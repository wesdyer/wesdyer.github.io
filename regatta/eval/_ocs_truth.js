// IS "OVER EARLY" JUDGED CORRECTLY? — the flag against the boat's actual position.
//
//   node regatta/eval/_ocs_truth.js [races]
//
// RRS 29.1 / A5: a boat is OCS when, at her starting signal, any part of her hull is on the
// COURSE SIDE of the starting line. That is a fact about POSITION AT THE GUN. The engine
// instead sets the flag from CROSSING EVENTS during the prestart, and the prestart branch
// hardcodes the crossing direction:
//
//     if (crossingDir === 1) ocs = true; else ocs = false;
//
// while the racing branch below it correctly compares `crossingDir === requiredDirection`.
// The direction a start line is crossed is authored per route entry (`dir`), and two of the
// ten venues author -1 — so on those the prestart test is INVERTED.
//
// This measures the flag against the truth at the gun, per venue:
//
//   FALSE POSITIVE   flagged OCS while behind the line
//   FALSE NEGATIVE   on the course side and not flagged
//
// Truth uses the same normal the engine's own `startCrossNormal()` uses — the route entry's
// dir applied to the mark order — and the hull, not the centre.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RACES = +(process.argv[2] || 3);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.resetGame, null, { timeout: 20000 });
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });

  const venues = await p.evaluate(() => Object.keys(window.VENUE_DOC || {}));
  console.log(' venue        dir   boats   over(between)  past an end   flagged   FALSE POS   FALSE NEG   FN depth');
  let anyBad = 0;
  for (const v of venues) {
    const acc = { n: 0, over: 0, flag: 0, fp: 0, fn: 0, dir: null };
    for (let i = 0; i < RACES; i++) {
      const r = await p.evaluate(async ([v, seed]) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        const e0 = state.course.route[0];
        const li = (e0 && e0.marks) ? e0.marks : [0, 1];
        const m0 = state.course.marks[li[0]], m1 = state.course.marks[li[1]];
        const dx = m1.x - m0.x, dy = m1.y - m0.y, L = Math.hypot(dx, dy) || 1;
        const s = (e0 && e0.dir < 0) ? -1 : 1;
        const nx = s * dy / L, ny = -s * dx / L;          // + = course side, per the route
        const dt = 1 / 60;
        // Step to the gun and read every boat's hull against the line THERE.
        while (state.race.status === 'prestart') window.update(dt);
        const bots = state.boats.filter(x => !x.isPlayer);
        // ⚠️ THE LINE HAS ENDS. A boat beyond the pin is not on the course side of the
        // STARTING LINE, she is past its end — so "over" must also test the along-line
        // coordinate, or the probe invents violations the rule does not have.
        const out = bots.map(bt => {
          let best = -Infinity, bestAlong = 0;
          for (const q of hullPolygonAt(bt.x, bt.y, bt.heading)) {
            const d = (q.x - m0.x) * nx + (q.y - m0.y) * ny;
            if (d > best) { best = d; bestAlong = ((q.x - m0.x) * dx + (q.y - m0.y) * dy) / L; }
          }
          const between = bestAlong >= 0 && bestAlong <= L;
          return { over: best > 0 && between, beyondEnd: best > 0 && !between,
                   dist: best, flag: !!bt.raceState.ocs };
        });
        return { dir: (e0 && e0.dir < 0) ? -1 : 1, out };
      }, [v, 9100 + i]);
      acc.dir = r.dir;
      for (const o of r.out) {
        acc.n++;
        if (o.over) acc.over++;
        if (o.beyondEnd) acc.beyond = (acc.beyond || 0) + 1;
        if (o.flag) acc.flag++;
        if (o.flag && !o.over) acc.fp++;
        if (o.over && !o.flag) { acc.fn++; acc.fnDist = (acc.fnDist || []).concat(Math.round(o.dist)); }
      }
    }
    const bad = acc.fp + acc.fn;
    if (bad) anyBad += bad;
    console.log(`${v.padEnd(12)} ${String(acc.dir).padStart(4)} ${String(acc.n).padStart(7)} ` +
                `${String(acc.over).padStart(14)} ${String(acc.beyond || 0).padStart(13)} ${String(acc.flag).padStart(9)} ` +
                `${String(acc.fp).padStart(11)} ${String(acc.fn).padStart(11)}   ${(acc.fnDist || []).join(',')}${bad ? '   <<<' : ''}`);
  }
  console.log(`\n  ${anyBad} misjudgements over ${RACES} race(s) a venue.`);
  if (errs.length) console.log('ERRORS: ' + errs.slice(0, 3).join(' | '));
  await b.close();
})();

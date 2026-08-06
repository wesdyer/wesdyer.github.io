// WHICH WAY IS "BEHIND THE START LINE"? — the prestart's answer against the engine's.
//
//   node regatta/eval/_prestart_side.js
//
// `getStartCommand` builds every prestart vector off the WIND:
//
//     stage = target - (sin wd, -cos wd) * STAGE     "in lane, just behind the line"
//     aim   = target + (sin wd, -cos wd) * PAST      "up through our lane"
//
// That is a windward-leeward assumption — it only means "behind" if the first leg goes
// upwind. The engine has a separate, route-derived answer, `startCrossNormal()`, whose own
// comment says it is "deliberately NOT derived from the wind... asking the global mean is
// what put the fleet alongside the line instead of behind it".
//
// So this prints the angle between the two per venue. Where they agree the prestart works;
// where they disagree by more than a right angle, "staging behind the line" is staging on
// the COURSE side or sailing away from it altogether.
//
// Also reports what the fleet actually does: the median signed distance to the line
// through the prestart, and whether it is opening or closing.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.resetGame, null, { timeout: 20000 });
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });

  const venues = await p.evaluate(() => Object.keys(window.VENUE_DOC || {}));
  console.log('venue        route[0]      wind-up vs route-normal    fleet: dist to line at T-30 -> T-0 (median)');
  for (const v of venues) {
    const r = await p.evaluate(async (v) => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
      window.evalHarness.seed = 9100;
      window.resetGame();
      // startLinePts/startCrossNormal are module-level in script.js, not on window, so
      // rebuild both here from the route — the same two expressions, verbatim.
      const e0r = state.course.route[0];
      const li = (e0r && e0r.marks) ? e0r.marks : [0, 1];
      const m0 = state.course.marks[li[0]], m1 = state.course.marks[li[1]];
      const mid = { x: (m0.x + m1.x) / 2, y: (m0.y + m1.y) / 2 };
      const wd = getWindAt(mid.x, mid.y).direction;
      // what getStartCommand calls "up through the line"
      const up = { x: Math.sin(wd), y: -Math.cos(wd) };
      // what the engine calls the crossing direction
      const ddx = m1.x - m0.x, ddy = m1.y - m0.y, dl = Math.hypot(ddx, ddy) || 1;
      const sgn = (e0r && e0r.dir < 0) ? -1 : 1;
      const n = { x: sgn * ddy / dl, y: -sgn * ddx / dl };
      const dot = up.x * n.x + up.y * n.y;
      const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
      const e0 = state.course.route[0];

      // Now race the prestart and watch the fleet.
      window.startRace();
      const bots = state.boats.filter(x => !x.isPlayer);
      const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const sample = [];
      const signed = (bt) => {
        // + = course side of the line, per the engine's own normal
        const rx = bt.x - mid.x, ry = bt.y - mid.y;
        return rx * n.x + ry * n.y;
      };
      const dt = 1 / 60;
      let first = null, last = null, worst = 0;
      for (let it = 0; it < 60 * 200; it++) {
        window.update(dt);
        if (state.race.status !== 'prestart') break;
        if (it % 30 === 0) {
          const ds = bots.map(signed).sort((a, c) => a - c);
          const med = ds[Math.floor(ds.length / 2)];
          if (first === null) first = med;
          last = med;
          if (med < worst) worst = med;
          sample.push([Math.round(state.race.timer), Math.round(med)]);
        }
      }
      return { v, kind: (e0 ? e0.kind + (e0.role === 'start' ? '/start' : '') : '?'),
               ang: +ang.toFixed(0), first: Math.round(first), last: Math.round(last),
               worst: Math.round(worst), sample: sample.filter((_, i) => i % 4 === 0) };
    }, v);
    const flag = r.ang > 90 ? '  <<< WRONG SIDE' : r.ang > 45 ? '  <<< adrift' : '';
    console.log(`${r.v.padEnd(12)} ${r.kind.padEnd(13)} ${String(r.ang).padStart(3)} deg` +
                `${flag.padEnd(18)}   ${String(r.first).padStart(6)} -> ${String(r.last).padStart(6)}   (furthest ${r.worst})`);
  }
  if (errs.length) console.log('\nERRORS: ' + errs.slice(0, 3).join(' | '));
  await b.close();
})();

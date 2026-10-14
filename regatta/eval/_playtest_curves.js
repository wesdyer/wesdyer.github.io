// Play every venue: full races (to the 10:00 limit) on several seeds, and tally what happened — finishers, the
// winner's and the median finisher's time, penalties, groundings (aground events), boats stuck still for 20 s+,
// page errors, and the sim's cost per frame. Run it on two trees to compare.
//   ROOT=<repo root> SEEDS=4 node regatta/eval/_playtest_curves.js [venue ...] > out.json
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = process.env.ROOT || path.resolve('.'); const SEEDS = +(process.env.SEEDS || 4);
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay','lake','lagoon','swamp','river','ocean','redrock','glowtide','arctic','otter','flats','volcanic','seatrials'];
(async () => {
  const browser = await chromium.launch(); const HARNESS = fs.readFileSync(path.join(ROOT, 'regatta/eval/trace_harness.js'), 'utf8');
  const res = {};
  for (const v of VENUES) {
    res[v] = [];
    for (let s = 0; s < SEEDS; s++) {
      const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.goto('file://' + path.join(ROOT, 'regatta/index.html')); await page.addScriptTag({ content: HARNESS });
      await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), v);
      const r = await page.evaluate(async (seed) => {
        const ev = { penalty: 0, aground: 0, finish: 0 };
        let inner = null;
        Object.defineProperty(window, 'onRaceEvent', { configurable: true, get: () => (t, d) => { ev[t] = (ev[t] || 0) + 1; if (inner) inner(t, d); }, set: (f) => { inner = f; } });
        // stuck: a racing, unfinished boat under 0.5 kt for 20 s of race time
        const still = new Map(); let stuck = 0, upd = 0, updN = 0;
        const U = window.update; window.update = function (dt) { const t0 = performance.now(); const o = U.apply(this, arguments); upd += performance.now() - t0; updN++;
          if (state.race && state.race.status === 'racing') for (const b of state.boats) { if (b.raceState.finished) continue;
            const k = b.speed / 0.25 < 0.5 ? (still.get(b) || 0) + dt : 0; still.set(b, k); if (k >= 20 && k - dt < 20) stuck++; }
          return o; };
        const tr = await window.traceHarness.runTrace(seed, { timeLimit: 600, legs: 4 });
        window.update = U;
        const fin = state.boats.filter(b => b.raceState.finished).map(b => b.raceState.finishTime || b.raceState.finishedAt || null).filter(x => x != null).sort((a, b) => a - b);
        return { seed, finished: tr.summary.finished, boats: state.boats.length, pen: tr.summary.penalties, aground: ev.aground, stuck, win: fin[0] ?? null, med: fin.length ? fin[fin.length >> 1] : null, simMs: upd / Math.max(1, updN), t: tr.summary.raceTime };
      }, 90210 + s);
      r.errs = errs.length; r.errMsg = errs.slice(0, 2);
      res[v].push(r); await page.close();
      process.stderr.write(`${v} ${90210 + s}: fin ${r.finished}/${r.boats} win ${r.win && r.win.toFixed(0)} pen ${r.pen} aground ${r.aground} stuck ${r.stuck} sim ${r.simMs.toFixed(2)}ms errs ${r.errs}\n`);
    }
  }
  console.log(JSON.stringify(res));
  await browser.close(); })();

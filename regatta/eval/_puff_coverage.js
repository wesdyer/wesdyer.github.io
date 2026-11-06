// PUFF COVERAGE — do the puffs reach the water the fleet actually sails?
//
// The static venue check (venuecheck 'gust-arena') only asks whether a gust SOURCE lies in the
// arena. Whether its cells ever reach a boat depends on where they drift and when they peak, so
// this races the bots and measures, at every bot's position every 0.5 s:
//   puff  = the live wind is more than 1.5 kt above the mean field x lee there,
//   lull  = more than 1.5 kt below,
//   gf    = per-boat max/mean of the wind it sailed in (a gust factor),
// plus how many live cells sit within reach of the fleet (nearest boat within cell radius + 300 u).
// Wind-guide targets (guidelines/wind/proposals.md, E5): 10–20% puff+lull on steady venues,
// 25–50% on puffy ones; open-sea gust factor ~1.2, inland ~1.5+.
//
//   NODE_PATH=node_modules node regatta/eval/_puff_coverage.js bay ocean ...      (from repo root)
//   CAND=cand.json ... — cand.json is { "<venue>": { "regions": [...gust regions...] } }, swapped
//   into window.VENUE_DOC[venue].gusts before the venue is built, so a source can be tuned
//   without writing the venue file. SEEDS=21,22 (default) races each seed.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const CAND = process.env.CAND ? JSON.parse(fs.readFileSync(process.env.CAND, 'utf8')) : {};
const SEEDS = (process.env.SEEDS || '21,22').split(',').map(Number);
const SECS = +(process.env.SECS || 200);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.error('PAGEERROR', e.message));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') }); await p.waitForTimeout(400);
  for (const v of process.argv.slice(2)) {
    const rows = [];
    for (const seed of SEEDS) {
      const r = await p.evaluate(([v, seed, cand, SECS]) => { try {
        if (cand) window.VENUE_DOC[v].gusts = cand;
        window.evalHarness.seed = seed; localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
        selectVenue(v); resetGame(); startRace();
        const pl = state.boats.find(x => x.isPlayer); if (pl) pl.controller = new BotController(pl);
        let n = 0, puff = 0, lull = 0, near = 0, cells = 0, t = 0; const per = state.boats.map(() => []);
        for (let it = 0; it < 900 * 30 && t < SECS; it++) {
          if (pl) { const d = normalizeAngle(pl.controller.targetHeading - pl.heading); pl.controller.update(1 / 30); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; }
          update(1 / 30);
          if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
          t += 1 / 30; if (it % 15) continue;
          state.boats.forEach((bt, k) => {
            if (bt.raceState.finished) return;
            const m = regionWindAt(bt.x, bt.y), w = getWindAt(bt.x, bt.y), sh = shadowAt(bt.x, bt.y, m.direction, 'wind');
            const d = w.speed - m.speed * sh; n++; if (d > 1.5) puff++; else if (d < -1.5) lull++; per[k].push(w.speed);
          });
          for (const g of state.gusts) { cells++; let best = Infinity;
            for (const bt of state.boats) if (!bt.raceState.finished) best = Math.min(best, Math.hypot(bt.x - g.x, bt.y - g.y));
            if (best < g.radiusX + 300) near++; }
        }
        const gfs = per.filter(a => a.length > 10).map(a => Math.max(...a) / (a.reduce((x, y) => x + y, 0) / a.length)).sort((a, b) => a - b);
        return { puff: puff / n, lull: lull / n, gf: gfs[Math.floor(gfs.length / 2)], cellsAlive: cells / Math.max(1, t * 2), nearFrac: near / Math.max(1, cells) };
      } catch (e) { return { err: e.stack }; } }, [v, seed, CAND[v] || null, SECS]);
      if (r.err) { console.error(v, r.err); continue; }
      rows.push(r);
    }
    const avg = k => rows.reduce((a, r) => a + r[k], 0) / rows.length;
    console.log(`${v.padEnd(10)} puff ${(100 * avg('puff')).toFixed(1)}%  lull ${(100 * avg('lull')).toFixed(1)}%  total ${(100 * (avg('puff') + avg('lull'))).toFixed(1)}%  gust factor ${avg('gf').toFixed(2)}  cells ${avg('cellsAlive').toFixed(1)} (near fleet ${(100 * avg('nearFrac')).toFixed(0)}%)${CAND[v] ? '  [CANDIDATE]' : ''}`);
  }
  await b.close();
})();

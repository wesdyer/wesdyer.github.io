// Probe: the Flats objectives measured on the BOT fleet (the tide-aware router): every bot run through the
// same passage test as checkFlatsRun (sim/course.js FLATS_RUN), with its groundings (Tide.touches).
// Reports per race: finish, nerve, passages sailed, touches; and how many did gamble+headcut clean.
//   node regatta/eval/_flats_fleet_feats.js [races] [seed0]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const races = +(process.argv[2] || 4), seed0 = +(process.argv[3] || 1);
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  await p.waitForTimeout(400);
  let skit = 0, all = 0; const seen = {};
  for (let i = 0; i < races; i++) {
    const r = await p.evaluate((seed) => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); window.evalHarness.seed = seed; resetGame(); startRace();
      const F = FLATS_RUN, lines = state.course.doc.tide.passages.map(q => ({ id: q.id, pts: q.pts }));
      const bots = state.boats.filter(x => !x.isPlayer), pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const st = bots.map(() => ({ cur: null, curS: 0, done: new Set(), flat: 0 }));
      for (let it = 0; it < 60 * 700; it++) { update(1 / 60); if (state.race.status !== 'racing') continue; if (it % 15) continue;
        bots.forEach((bt, k) => { if (bt.raceState.finished) return; const S = st[k];
          if (!bt.aground && Tide.groundAt(bt.x, bt.y) > _flatsZ()) S.flat += 0.25;
          const ln = bt.aground ? null : _flatsPassageAt(bt.x, bt.y, lines);
          if (ln !== S.cur) { S.cur = ln; S.curS = 0; }
          if (ln) { S.curS += 0.25; if (S.curS >= F.hold) S.done.add(ln.id); } });
        if (bots.every(x => x.raceState.finished) || state.race.timer > 600) break; }
      return bots.map((bt, k) => ({ name: bt.name, nerve: bt.traits && bt.traits.nerve, t: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : null, touches: Tide.touches(bt.raceState), flat: Math.round(st[k].flat), routes: [...st[k].done] }));
    }, seed0 + i);
    r.sort((a, b) => (a.t || 1e9) - (b.t || 1e9));
    console.log('race seed', seed0 + i);
    for (const x of r) { all++; const s = x.flat >= 45 && x.t && !x.touches; if (s) skit++; for (const q of x.routes) seen[q] = (seen[q] || 0) + 1;
      console.log(`  ${x.t ? Math.floor(x.t / 60) + ':' + String(x.t % 60).padStart(2, '0') : 'DNF '}  ${x.name.padEnd(10)} nerve ${x.nerve}  touches ${x.touches}  flats ${String(x.flat).padStart(3)}s  ${x.routes.join(' ')}${s ? '   <- MUD RUNNER' : ''}`); }
  }
  console.log(`\nMud Runner (45 s on the flats, never aground): ${skit} of ${all}`); console.log('passages sailed (boat-races):', JSON.stringify(seen));
  if (errs.length) console.log(errs[0]); await b.close(); })();

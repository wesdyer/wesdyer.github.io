// Proof: Clubhouse Point's wildlife is picture only — the same seeded race with and without WILDLIFE.seatrials
// must give identical boats, frame for frame (positions hashed every second).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') }); await p.waitForTimeout(400);
  const run = (withWild) => p.evaluate((withWild) => { const saved = Wildlife.WILDLIFE.seatrials; if (!withWild) delete Wildlife.WILDLIFE.seatrials;
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' })); window.evalHarness.seed = 7; resetGame(); startRace();
    let h = 0; const hs = (v) => { h = (Math.imul(h ^ Math.round(v * 1000), 2654435761) >>> 0); };
    let birds = 0;
    for (let it = 0; it < 60 * 260; it++) { update(1 / 60); if (it % 60) continue; for (const bt of state.boats) { hs(bt.x); hs(bt.y); hs(bt.heading); } if (withWild) birds += Wildlife.debug().clubTerns.length; if (state.boats.every(x => x.raceState.finished)) break; }
    Wildlife.WILDLIFE.seatrials = saved;
    return { h, fin: state.boats.map(x => x.raceState.finished ? Math.round(x.raceState.finishTime * 100) / 100 : null).join(','), birds }; }, withWild);
  const a = await run(true), c = await run(false), a2 = await run(true);
  console.log('with wildlife   ', a.h, a.fin, 'terns sampled', a.birds); console.log('without wildlife', c.h, c.fin); console.log('with, again     ', a2.h);
  console.log(a.h === c.h && a.fin === c.fin ? 'IDENTICAL — picture only' : 'DIFFERENT'); await b.close(); })();

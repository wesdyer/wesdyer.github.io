// Probe: Zee's "Keep Your Distance" measured on the bot fleet — per boat, did it spend 3 s within watchR of
// a colony with 3+ hauled out, without having put a seal off that colony since coming within ringR?
//   node regatta/eval/_flats_seal_watch.js [races] [seed0]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const races = +(process.argv[2] || 3), seed0 = +(process.argv[3] || 1);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') }); await p.waitForTimeout(400);
  let got = 0, all = 0, flushes = 0, nearMin = [];
  for (let i = 0; i < races; i++) {
    const r = await p.evaluate((seed) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); window.evalHarness.seed = seed; resetGame(); startRace();
      const c = Wildlife.WILDLIFE.flats.greySeals, cols = Wildlife.debug().gsealCols, bots = state.boats.filter(x => !x.isPlayer); const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const st = bots.map(() => cols.map(() => ({ inR: false, fl: false, w: 0, ok: false, min: 1e9 })));
      let fl = 0;
      for (let it = 0; it < 60 * 400; it++) { update(1 / 60); if (state.race.status !== 'racing' || it % 6) continue;
        cols.forEach((C, ci) => { const hauled = C.seals.filter(s => s.mode === 'haul'); bots.forEach((bt, k) => { if (bt.raceState.finished) return; const S = st[k][ci], d = Math.hypot(bt.x - C.cx, bt.y - C.cy);
          if (hauled.length >= 3) S.min = Math.min(S.min, d);
          if (d > c.ringR) { S.inR = false; S.w = 0; return; } if (!S.inR) { S.inR = true; S.fl = false; S.w = 0; }
          if (hauled.some(s => Math.hypot(s.x - bt.x, s.y - bt.y) < c.flushR)) { S.fl = true; fl++; }
          if (d < c.watchR && hauled.length >= 3 && !S.fl) { S.w += 0.1; if (S.w >= c.watchS) S.ok = true; } }); });
        if (bots.every(x => x.raceState.finished)) break; }
      return { ok: st.map(a => a.some(s => s.ok)), min: st.map(a => Math.round(Math.min(...a.map(s => s.min)))), fl }; }, seed0 + i);
    got += r.ok.filter(Boolean).length; all += r.ok.length; flushes += r.fl; nearMin.push(...r.min);
  }
  nearMin.sort((a, b) => a - b);
  console.log(`Keep Your Distance on the fleet: ${got} of ${all}; flush-samples ${flushes}; closest pass to a hauled colony (u): ${nearMin.join(' ')}`);
  await b.close(); })();

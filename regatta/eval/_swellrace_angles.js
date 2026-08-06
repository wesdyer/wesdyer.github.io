// WHAT DOES THE FLEET ACTUALLY SAIL ON BLUEWATER, AND HOW MUCH OF THE RUN IS A RIDE?
//
//   node regatta/eval/_swellrace_angles.js [races] [seed0]
//
// `_swellangle.js` measures what is FASTEST at a held angle. This measures what the boats
// CHOOSE, in a real race, and what the sea is doing to them while they do it:
//
//   the true wind angle sailed, upwind and downwind, per boat per leg
//   the angle the AI's own optimiser was returning at that moment, so the choice can be
//     told apart from the constraint (a boat laying a mark is not free to sail its angle)
//   the fraction of downwind frames on a FACE (surfKt > 0) against climbing one
//   the fraction of downwind frames actually surfing (`surf01` over the render threshold)
//
// ⚠️ Angles are folded to |TWA| — the tack is not the question here.
const { chromium } = require('playwright');
const path = require('path');

const RACES = +(process.argv[2] || 4);
const SEED0 = +(process.argv[3] || 9300);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.updateBoat, null, { timeout: 20000 });
  const fs = require('fs');
  await p.addScriptTag({ content: fs.readFileSync(path.resolve('regatta/eval/eval_harness.js'), 'utf8') });

  const all = [];
  for (let i = 0; i < RACES; i++) {
    const r = await p.evaluate(async (seed) => {
      window.evalHarness.seed = seed;
      window.resetGame(); window.startRace();
      state.course.cutoff = 900;
      const bots = state.boats.filter(b => !b.isPlayer);
      const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
      const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      const acc = { up: [], dn: [], face: 0, climb: 0, surf: 0, dnN: 0, aiDn: [], aiUp: [], legOf: {} };
      const dt = 1 / 60;
      for (let it = 0; it < 60 * 940; it++) {
        window.update(dt);
        if (state.race.status === 'finished') break;
        if (state.race.status !== 'racing') continue;
        if (state.race.timer > 900) break;
        if (it % 12) continue;                       // 5 Hz sample
        for (const bt of bots) {
          if (bt.raceState.finished) continue;
          const w = getWindAt(bt.x, bt.y);
          const twa = Math.abs(norm(bt.heading - w.direction)) * 180 / Math.PI;
          if (twa < 75) {
            acc.up.push(twa);
            acc.aiUp.push(getCharacterOptimalVMGAngle('upwind', w.speed, bt.stats) * 180 / Math.PI);
          } else if (twa > 105) {
            acc.dn.push(twa);
            acc.aiDn.push(getCharacterOptimalVMGAngle('downwind', w.speed, bt.stats) * 180 / Math.PI);
            acc.dnN++;
            if (bt.swell) {
              if (bt.swell.surfKt > 0) acc.face++; else acc.climb++;
              if (bt.swell.surf01 > 0.34 && bt.swell.withWave) acc.surf++;
            }
          }
        }
      }
      return { seed, up: acc.up, dn: acc.dn, aiUp: acc.aiUp, aiDn: acc.aiDn,
               face: acc.face, climb: acc.climb, surf: acc.surf, dnN: acc.dnN,
               fins: bots.filter(b => b.raceState.finished).length,
               swellOn: !!(window.Swell && window.Swell.active && window.Swell.active()) };
    }, SEED0 + i);
    all.push(r);
    console.log(`seed ${r.seed}: ${r.fins} finishers, ${r.up.length} upwind samples, ${r.dn.length} downwind, swell=${r.swellOn}`);
  }

  const q = (a, f) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
  const cat = (k) => all.flatMap(r => r[k]);
  const up = cat('up'), dn = cat('dn'), aiUp = cat('aiUp'), aiDn = cat('aiDn');
  const face = all.reduce((s, r) => s + r.face, 0), climb = all.reduce((s, r) => s + r.climb, 0);
  const surf = all.reduce((s, r) => s + r.surf, 0), dnN = all.reduce((s, r) => s + r.dnN, 0);
  const line = (name, a) => console.log(`  ${name.padEnd(26)} p10 ${q(a,0.1)?.toFixed(1)}  med ${q(a,0.5)?.toFixed(1)}  p90 ${q(a,0.9)?.toFixed(1)}   (n=${a.length})`);
  console.log(`\nBluewater — ${RACES} races from seed ${SEED0}\n`);
  line('TWA sailed, upwind', up);
  line("  the AI's own optimum", aiUp);
  line('TWA sailed, downwind', dn);
  line("  the AI's own optimum", aiDn);
  console.log(`\n  downwind frames on a FACE      ${(100 * face / Math.max(1, face + climb)).toFixed(1)}%`);
  console.log(`  downwind frames CLIMBING one   ${(100 * climb / Math.max(1, face + climb)).toFixed(1)}%`);
  console.log(`  downwind frames actually SURFING (surf01 > 0.34, with the wave)  ${(100 * surf / Math.max(1, dnN)).toFixed(1)}%`);
  if (errs.length) console.log('\nERRORS: ' + errs.slice(0, 4).join(' | '));
  await b.close();
})();

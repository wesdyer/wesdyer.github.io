// Probe: how a hauled-out grey seal colony meets a boat. At low water, the colony with most seals hauled out; a boat runs
// straight at it from 800 u at SPEED kn (×15 u/s), passes through and away. Reports: the distance at which the first seal
// came alert and the first fled, how many fled, how many pups stayed on the sand, and when the first and half came back.
// Then the LINGER case: a boat parked outside the flight distance (1.6 × flushR off) for 150 s — when the colony goes.
//   node regatta/eval/_flats_seal_disturb.js [speed kn ...]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const speeds = process.argv.slice(2).map(Number); if (!speeds.length) speeds.push(3, 8);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  for (const kn of speeds.concat(['linger'])) {
    await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); resetGame(); });
    console.log(await p.evaluate((kn) => { const D = Wildlife.debug(), park = () => { for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; } };
      const hauled = (C) => C.seals.filter(s => s.mode === 'haul').length;
      let k = 0; for (; k < 30 * 1800 && Math.max(...D.gsealCols.map(C => hauled(C) / C.seals.length)) < 0.85; k++) { park(); update(1 / 30); }
      for (let i = 0; i < 30 * 70; i++) { park(); update(1 / 30); }
      const C = D.gsealCols.slice().sort((a, c) => hauled(c) - hauled(a))[0], me = state.boats[0], n0 = hauled(C), pups = C.seals.filter(s => s.pup && s.mode === 'haul').length;
      const fr = 30 * 2; let alertD = null, fleeD = null, fled = 0, back1 = null, backHalf = null, t = 0;
      const dist = () => Math.hypot(me.x - C.cx, me.y - C.cy);
      if (kn === 'linger') {
        const R = Wildlife.debug && 160 * 1.6; let goneAt = null; const pre = new Set(C.seals.filter(s => s.mode === 'haul'));
        for (let i = 0; i < 30 * 150; i++) { park(); me.x = C.cx + R; me.y = C.cy; update(1 / 30); t = i / 30;
          if (alertD == null && C.seals.some(s => (s.alert || 0) > 0.5)) alertD = t.toFixed(1) + ' s';
          if (goneAt == null && [...pre].some(s => s.mode !== 'haul')) goneAt = t; }
        return `LINGER at ${R.toFixed(0)} u: alert after ${alertD}; first went at ${goneAt == null ? 'never' : goneAt.toFixed(0) + ' s'}; ${[...pre].filter(s => s.mode !== 'haul').length} of ${pre.size} gone by 150 s`;
      }
      const v = kn * 15, a = 0.7, sx = C.cx - Math.cos(a) * 800, sy = C.cy - Math.sin(a) * 800, pre = new Set(C.seals.filter(s => s.mode === 'haul' && !s.pup));
      for (let i = 0; i < 30 * 400; i++) { park(); const s0 = Math.min(1600, v * i / 30); me.x = sx + Math.cos(a) * s0; me.y = sy + Math.sin(a) * s0; if (s0 >= 1600) { me.x = 1e5; me.y = 1e5; }
        update(1 / 30); t = i / 30; const d = dist();
        if (alertD == null && C.seals.some(s => (s.alert || 0) > 0.5)) alertD = d;
        if (fleeD == null && [...pre].some(s => s.mode !== 'haul')) fleeD = d;
        const out = [...pre].filter(s => s.mode !== 'haul').length; fled = Math.max(fled, out);
        if (fleeD != null && s0 >= 1600) { const backN = [...pre].filter(s => s.mode === 'haul').length; if (back1 == null && backN > 0 && out < fled) back1 = t; if (backHalf == null && backN >= pre.size / 2 && out < fled) backHalf = t; } }
      return `${kn} kn: ${n0} hauled (${pups} pups); first alert at ${alertD == null ? '-' : alertD.toFixed(0)} u, first fled at ${fleeD == null ? '-' : fleeD.toFixed(0)} u; ${fled} of ${pre.size} adults fled; pups still on the sand ${C.seals.filter(s => s.pup && s.mode === 'haul').length}/${pups}; first back ${back1 == null ? '-' : back1.toFixed(0) + ' s'}, half back ${backHalf == null ? '-' : backHalf.toFixed(0) + ' s'}`; }, kn));
  }
  await b.close(); })();

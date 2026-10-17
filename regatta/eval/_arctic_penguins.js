// Probe: Glacier Sound's penguins against the field numbers (Oct 16 2026). Runs N game minutes; reports in game terms
// and REAL (game s / 3): share of swimming time in the air (Yoda 1999: leaps ~3.8% of distance), leaps per minute while
// porpoising, how often swimmers breathe, the huddle's waves and its drift, edge hesitation, and any JUMP (a standing
// bird moving > 2 u or turning > 0.15 rad in a frame).
//   node regatta/eval/_arctic_penguins.js [minutes]      (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const MIN = +(process.argv[2] || 10);
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(async (MIN) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0;
    for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; }
    const dt = 1 / 30, sw = {}, prev = new Map(); const seenW = new Set(); let jumps = [], waves = 0, wavePrev = null, gathers = 0, hes = [], walks = 0;
    const H = () => Wildlife.debug().penguinColonies.find(C => C.huddle), H0 = (() => { const C = H(); return { x: C.birds.reduce((a, q) => a + q.hx, 0) / C.birds.length, y: C.birds.reduce((a, q) => a + q.hy, 0) / C.birds.length }; })();
    for (let i = 0; i < MIN * 1800; i++) { Wildlife.update(dt); if (typeof updateIceFloes === 'function') updateIceFloes(dt);
      const D = Wildlife.debug();
      for (const S of D.swimmers) { const o = sw[S.species] || (sw[S.species] = { t: 0, air: 0, leaps: 0, sur: 0, porpT: 0 });
        for (const q of S.birds) { o.t += dt; if (q.leap >= 0) { o.air += dt; if (q.leap < dt / 0.4 + 1e-6) o.leaps++; } if (q.sur >= 0 && q.sur < dt / 0.7 + 1e-6) o.sur++; } }
      const C = H(); if (C.wave != null && wavePrev == null) waves++; wavePrev = C.wave; for (const q of C.birds) if (q.walk && !seenW.has(q.walk)) { seenW.add(q.walk); walks++; }
      for (const T of D.treks) if (T.gather && T.released && !T._seen) { T._seen = true; gathers++; }
      for (const Cc of D.penguinColonies) for (const q of Cc.birds) { const pv = prev.get(q);
        if (pv && i > 30) { const d = Math.hypot(q.x - pv.x, q.y - pv.y); let a = Math.abs(q.h - pv.h); a = Math.min(a, 2 * Math.PI - a); if (d > 2 || a > 0.15) jumps.push(`${Cc.species} moved ${d.toFixed(1)} turned ${a.toFixed(2)}`); }
        prev.set(q, { x: q.x, y: q.y, h: q.h }); } }
    const C = H(), c1 = { x: C.birds.reduce((a, q) => a + q.hx, 0) / C.birds.length, y: C.birds.reduce((a, q) => a + q.hy, 0) / C.birds.length };
    const lx = Math.sin(C.lee), ly = -Math.cos(C.lee), drift = (c1.x - H0.x) * lx + (c1.y - H0.y) * ly;
    const rows = Object.entries(sw).map(([k, o]) => `${k}: ${(100 * o.air / o.t).toFixed(1)}% of swimming time in the air; ${(o.leaps / (o.t / 60)).toFixed(1)} leaps & ${(o.sur / (o.t / 60)).toFixed(1)} breaths per bird-minute (game)`);
    return { rows, huddle: `huddle: ${waves} step waves in ${MIN} min (every ${(MIN * 60 / Math.max(1, waves)).toFixed(0)} s game, ${(MIN * 180 / Math.max(1, waves)).toFixed(0)} s real); ${walks} birds walked round to the lee; drifted ${drift.toFixed(0)} u downwind`,
      gathers: `${gathers} parties gathered and hesitated at the edge`, jumps };
  }, MIN);
  console.log(r.rows.join('\n')); console.log(r.huddle); console.log(r.gathers);
  console.log(`${r.jumps.length} standing-bird jumps/snaps`); for (const j of r.jumps.slice(0, 10)) console.log('  ' + j);
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close();
})();

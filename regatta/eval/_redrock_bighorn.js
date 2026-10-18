// Probe: Redrock's bighorn bands (Oct 17 2026) over N quiet minutes — time in each mode, the share of grazing time
// spent scanning (rams vs ewes vs lambs), band phases (move / bed / drink), clashes, lamb play, drinks with the muzzle
// over water, frames off land; then a boat run in at band 0: who bounds, how far, the look back.
//   node regatta/eval/_redrock_bighorn.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
const MIN = +(process.argv[2] || 10);
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate((MIN) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' })); resetGame();
    for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const d = Wildlife.debug(), dt = 1 / 30, modes = {}, scan = { ram: [0, 0], ewe: [0, 0], lamb: [0, 0] }, phases = {}, ev = { clash: 0, play: 0, drink: 0, bed: 0, move: 0 };
    let wet = 0, dFr = 0, dWet = 0; const prevPh = d.bands.map(G => G.phase), prevM = new Map();
    for (let i = 0; i < 30 * 60 * MIN; i++) { Wildlife.update(dt);
      d.bands.forEach((G, gi) => { phases[G.phase] = (phases[G.phase] || 0) + dt; if (G.phase !== prevPh[gi] && ev[G.phase] !== undefined) ev[G.phase]++; prevPh[gi] = G.phase;
        for (const s of G.members) { const kind = s.ram ? 'ram' : s.lamb ? 'lamb' : 'ewe', m = s.clash ? 'clash' : s.mode; modes[m] = (modes[m] || 0) + dt;
          if (s.mode === 'graze' && !s.clash) { scan[kind][1] += dt; if (s.scan) scan[kind][0] += dt; }
          const pm = prevM.get(s); if (pm !== m) { if (m === 'play') ev.play++; if (m === 'clash' && s.ram && s === G.members[0]) ev.clash++; if (m === 'drink') ev.drink++; } prevM.set(s, m);
          if (!pointOnLand(s.x, s.y)) wet++;
          if (s.mode === 'drink' && s.head > 0.9) { dFr++; const reach = Wildlife.art.bhReach ? Wildlife.art.bhReach(s) : 0; if (!pointOnLand(s.x + Math.sin(s.h) * reach, s.y - Math.cos(s.h) * reach)) dWet++; } } }); }
    const G = d.bands[0], me = state.boats[0], s0 = G.members.map(s => ({ x: s.x, y: s.y }));
    const s = G.members[0]; me.x = s.x + 60; me.y = s.y; const flush = [];
    for (let i = 0; i < 30 * 8; i++) { Wildlife.update(dt); if (i % 30 === 0) flush.push(G.members.map(m => m.mode[0] + (m.mode === 'look' && Math.abs(m.look) > 0.3 ? '*' : '')).join('')); }
    const ran = G.members.map((m, i) => Math.round(Math.hypot(m.x - s0[i].x, m.y - s0[i].y)));
    return { modes: Object.fromEntries(Object.entries(modes).map(([k, v]) => [k, Math.round(v)])), scanShare: Object.fromEntries(Object.entries(scan).map(([k, [a, t]]) => [k, +(a / Math.max(1, t)).toFixed(2)])),
      phases: Object.fromEntries(Object.entries(phases).map(([k, v]) => [k, Math.round(v)])), events: ev, framesOffLand: wet, drinkMuzzleOverWater: dFr ? Math.round(100 * dWet / dFr) + '%' : 'n/a', flushByMember: flush.join(' | '), ranU: ran.join(',') };
  }, MIN);
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();

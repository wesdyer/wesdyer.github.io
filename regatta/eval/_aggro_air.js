// Probe: how long does a rival stay in the player's bad air once it is put there? After 40 s of racing the nearest
// bot is placed D units dead downwind of the player (same heading, same speed); then both sail on (player on autopilot).
//   node regatta/eval/_aggro_air.js [venue] [D] [seeds...]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const venue = process.argv[2] || 'bay', D = +(process.argv[3] || 120), seeds = process.argv.slice(4).map(Number); if (!seeds.length) seeds.push(1, 2, 3, 4, 5, 6);
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  for (const seed of seeds) {
    const r = await p.evaluate(([venue, seed, D]) => { let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      selectVenue(venue); resetGame(); startRace();
      const me = state.boats[0], ctl = me.controller = new BotController(me); let raced = 0, placed = null, held = 0, best = 0, gap = 0, trace = [];
      const step = () => { ctl.update(1 / 30); const dd = normalizeAngle(ctl.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); };
      while (raced < 130 && !me.raceState.finished) { step(); if (state.race.status === 'racing') raced += 1 / 30;
        if (!placed && raced > 40) { const o = state.boats.slice(1).sort((a, c) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(c.x - me.x, c.y - me.y))[0];
          const w = getWindAt(me.x, me.y); o.x = me.x - Math.sin(w.direction) * D; o.y = me.y + Math.cos(w.direction) * D; o.heading = me.heading; o.speed = me.speed; o.raceState.leg = me.raceState.leg; placed = o; }
        if (placed) { const v = _aggroShadow(me, placed); if (v >= AGGRO.airMin) { held += 1 / 30; gap = 0; } else { gap += 1 / 30; if (gap > AGGRO.airGap) held = 0; } best = Math.max(best, held);
          if (Math.round(raced * 30) % 30 === 0) trace.push(Math.round(v * 100)); } }
      return { best: Math.round(best * 10) / 10, name: placed && placed.name, upwind: legGoesUpwind(me.raceState.leg), trace: trace.slice(0, 40).join(' ') }; }, [venue, seed, D]);
    console.log('seed', seed, JSON.stringify(r)); }
  await b.close(); })();

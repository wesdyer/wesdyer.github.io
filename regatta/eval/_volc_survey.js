// Probe: Emberfall's mechanics on the fleet — every boat on the autopilot, N seeds. Per boat: finish
// time, seconds in plume dead air (windMul < 0.75), times fried by lightning and seconds fried, seconds
// in a vent boil; and the route each took round the three islands (inside/outside).
//   node regatta/eval/_volc_survey.js [seeds]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const n = +(process.argv[2] || 4);
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const rows = [];
  for (let k = 0; k < n; k++) {
    const r = await p.evaluate((seed) => { let s = seed;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame(); startRace();
      const me = state.boats[0]; me.controller = new BotController(me);
      const B = state.boats.map(() => ({ dead: 0, fries: 0, friedS: 0, boil: 0, was: false, minX: 1e9, maxX: -1e9 }));
      let t = 0; const dt = 1 / 30;
      while (t < 600 && state.boats.some(o => !o.raceState.finished)) { me.controller.update(dt); const dd = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(dt); t += dt;
        if (state.race.status !== 'racing') continue;
        state.boats.forEach((o, i) => { if (o.raceState.finished) return; const c = B[i];
          if (Volcano.windMul(o.x, o.y) < 0.75) c.dead += dt;
          if (o.fried) { c.friedS += dt; if (!c.was) c.fries++; c.was = true; } else c.was = false;
          if (Volcano.boilAt && Volcano.boilAt(o.x, o.y) > 0.1) c.boil += dt; }); }
      return state.boats.map((o, i) => ({ t: o.raceState.finished ? Math.round(o.raceState.finishTime || 0) : 'DNF', dead: Math.round(B[i].dead), fries: B[i].fries, friedS: Math.round(B[i].friedS), boil: Math.round(B[i].boil) }));
    }, 100 + k * 97);
    rows.push(...r);
    console.log('seed', 100 + k * 97, r.map(o => `${o.t}s dead${o.dead} fry${o.fries}/${o.friedS}s boil${o.boil}`).join(' | '));
  }
  const f = (a) => a.sort((x, y) => x - y), q = (a, p) => a[Math.floor(p * (a.length - 1))];
  const dead = f(rows.map(r => r.dead)), fries = rows.map(r => r.fries), boil = f(rows.map(r => r.boil));
  console.log(`boats ${rows.length}: dead air median ${q(dead, 0.5)}s (min ${dead[0]}, max ${dead[dead.length - 1]}); never fried ${fries.filter(x => x === 0).length}; boil median ${q(boil, 0.5)}s`);
  console.log(errs.length ? errs[0] : 'ok'); await b.close(); })();

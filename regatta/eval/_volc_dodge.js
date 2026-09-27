// Probe: can a sailor dodge Emberfall's AIMED lightning? The player on the autopilot, held course
// (baseline) vs a dodging helm (when a strike aimed at the player is marked, steer straight away
// from the mark for the tell). Counts strikes aimed at the player, the ones ESCAPED (not fried: at
// fire time the player is beyond fryR), fried seconds, and the finish time.
//   node regatta/eval/_volc_dodge.js [seeds]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const n = +(process.argv[2] || 4);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  for (const dodge of [false, true]) { const tot = { aimed: 0, esc: 0, fried: 0, t: [] };
    for (let k = 0; k < n; k++) {
      const r = await p.evaluate(([seed, dodge]) => { let s = seed;
        Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame(); startRace();
        const me = state.boats[0], ctl = me.controller = new BotController(me); const v = () => state.volcano;
        let aimed = 0, esc = 0, fried = 0, t = 0; const ds = []; const seen = new Set();
        while (t < 600 && !me.raceState.finished) { ctl.update(1 / 30);
          const P = v() && v().strikers ? v().strikers.map(q => q.pending).filter(q => q && q.aimed && q.boat === me) : [];
          for (const q of P) if (!seen.has(q)) { seen.add(q); aimed++; q._watch = true; }
          if (dodge && P.length) { const q = P[0]; ctl.targetHeading = Math.atan2(me.x - q.x, -(me.y - q.y)); }
          const dd = normalizeAngle(ctl.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02;
          const before = new Set(P);
          update(1 / 30); t += 1 / 30; if (me.fried) fried += 1 / 30;
          for (const q of before) if (!v().strikers.some(z => z.pending === q)) { const dd2 = Math.hypot(me.x - q.x, me.y - q.y); ds.push(Math.round(dd2)); if (dd2 >= 640) esc++; } }
        return { ds, aimed, esc, fried: Math.round(fried), t: me.raceState.finished ? Math.round(state.race.timer) : 'DNF' };
      }, [100 + k * 97, dodge]);
      (tot.ds = tot.ds || []).push(...r.ds); tot.aimed += r.aimed; tot.esc += r.esc; tot.fried += r.fried; tot.t.push(r.t);
    }
    const D = (tot.ds || []).sort((a, b) => a - b); console.log('   distance at the bolt: median ' + D[D.length >> 1] + ', 80th pct ' + D[Math.floor(D.length * 0.8)] + ', max ' + D[D.length - 1]);
    console.log(dodge ? 'dodging ' : 'holding ', `aimed at player ${tot.aimed}, escaped ${tot.esc}, fried ${tot.fried} s over ${n} races, times ${tot.t.join(' ')}`); }
  await b.close(); })();

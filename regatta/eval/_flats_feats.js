// Probe: Spoonbill Flats' objectives on the autopilot sailing as the player, at a given nerve (0 channel,
// 1 point bars, 2 cuts, 3 everything). Logs the flats feats (passages, groundings), time, place, stars.
//   node regatta/eval/_flats_feats.js [nerve] [seed ...]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const nerve = +(process.argv[2] || 3), seeds = process.argv.slice(3).map(Number); if (!seeds.length) seeds.push(1, 2, 3, 4);
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  for (const seed of seeds) {
    const r = await p.evaluate(([nerve, seed]) => { let s = seed;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('flats'); resetGame(); startRace();
      const feats = []; GameEvents.on('player-feat', e => { if (/^flats:/.test(e.id) && !feats.some(f => f.startsWith(e.id + '@'))) feats.push(e.id.replace('flats:', '') + '@' + Math.round(state.race.timer || 0)); });
      const me = state.boats[0], ctl = me.controller = new BotController(me); if (me.traits) me.traits.nerve = nerve; else me.traits = { nerve };
      let t = 0; while (t < 600 && !me.raceState.finished) { ctl.update(1 / 30); const dd = normalizeAngle(ctl.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); t += 1 / 30; }
      const order = state.boats.slice().sort((a, b) => (a.raceState.finished ? a.raceState.finishTime : 1e9) - (b.raceState.finished ? b.raceState.finishTime : 1e9));
      const pos = order.indexOf(me) + 1;
      return { t: me.raceState.finished ? Math.round(me.raceState.finishTime) : 'DNF', pos, touches: Tide.touches(me.raceState), stars: Series.raceFacts(me.raceState, pos).stars, feats };
    }, [nerve, seed]);
    console.log('nerve', nerve, 'seed', seed, JSON.stringify(r));
  }
  if (errs.length) console.log(errs[0]); await b.close(); })();

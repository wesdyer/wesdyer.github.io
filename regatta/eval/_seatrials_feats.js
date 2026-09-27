// Probe: Clubhouse Point's feats on the plain autopilot sailing as the player.   node regatta/eval/_seatrials_feats.js [seeds...]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const seeds = process.argv.slice(2).map(Number); if (!seeds.length) seeds.push(1, 2, 3, 4, 5, 6);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  for (const seed of seeds) {
    const r = await p.evaluate((seed) => { let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('seatrials'); resetGame(); startRace();
      const feats = []; GameEvents.on('player-feat', e => { if (/^seatrials:/.test(e.id)) feats.push(e.id + '@' + Math.round(state.race.timer || 0)); });
      const me = state.boats[0], ctl = me.controller = new BotController(me); let near = 1e9;
      let t = 0; while (t < 400 && !me.raceState.finished) { ctl.update(1 / 30); const dd = normalizeAngle(ctl.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); t += 1 / 30;
        for (const B of Wildlife.debug().mackBoils) if (B.mode === 'boil') near = Math.min(near, Math.hypot(me.x - B.x, me.y - B.y)); }
      return { t: me.raceState.finished ? Math.round(me.raceState.finishTime) : 'DNF', feats, nearestBoil: Math.round(near) }; }, seed);
    console.log('seed', seed, JSON.stringify(r)); }
  await b.close(); })();

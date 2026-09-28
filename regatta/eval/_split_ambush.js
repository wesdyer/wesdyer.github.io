// Probe: Knot's split from the fleet ('split:leg') and Razor's ambush ('pass:ambush') on the plain autopilot as the
// player, plus the largest single-leg split fraction and the most passes inside 20 s.
//   node regatta/eval/_split_ambush.js [venue] [seeds...]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const venue = process.argv[2] || 'bay', seeds = process.argv.slice(3).map(Number); if (!seeds.length) seeds.push(1, 2, 3, 4);
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  for (const seed of seeds) {
    const r = await p.evaluate(([venue, seed]) => { let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      selectVenue(venue); loadVenueWorld(); resetGame(); startRace();
      const feats = []; GameEvents.on('player-feat', e => { if (/^(split|pass:ambush)/.test(e.id)) feats.push(e.id); });
      const me = state.boats[0], ctl = me.controller = new BotController(me); let t = 0, bestFrac = 0, lastLeg = -1, maxBurst = 0;
      while (t < 600 && !me.raceState.finished) { ctl.update(1 / 30); const dd = normalizeAngle(ctl.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); t += 1 / 30;
        if (_split && _split.t > 5) bestFrac = Math.max(bestFrac, _split.on / _split.t); if (_aggro && _aggro.passT) maxBurst = Math.max(maxBurst, new Set(_aggro.passT.map(x => x.n)).size); }
      for (let i = 0; i < 30 * 60 && state.boats.some(x => !x.raceState.finished); i++) update(1 / 30); const order = state.boats.slice().sort((a, c) => (a.raceState.finished ? a.raceState.finishTime : 1e9) - (c.raceState.finished ? c.raceState.finishTime : 1e9)); const f = Unlocks.raceFacts(order); const got = Unlocks.ACHIEVEMENTS.filter(a => ['Razor', 'Knot'].includes(a.char) && a.test(f, {})).map(a => a.char);
      return { got, pos: me.raceState.finished ? state.boats.filter(b => b.raceState.finished && b.raceState.finishTime < me.raceState.finishTime).length + 1 : null, feats, bestFrac: +bestFrac.toFixed(2), maxBurst }; }, [venue, seed]);
    console.log(venue, 'seed', seed, JSON.stringify(r)); }
  await b.close(); })();

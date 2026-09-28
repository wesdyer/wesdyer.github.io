// Probe: Legal Aggression on the plain autopilot sailing as the player — gross passes, distinct give-ways, the longest
// rival held in the player's bad air, and which rows the real race facts earn. LATE=s holds the player s seconds after
// the gun first (a start from the back, to see how many passes coming through the fleet makes).
//   LATE=30 node regatta/eval/_aggro_feats.js [venue] [seeds...]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const venue = process.argv[2] || 'seatrials', seeds = process.argv.slice(3).map(Number), late = +(process.env.LATE || 0); if (!seeds.length) seeds.push(1, 2, 3, 4);
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const tally = {};
  for (const seed of seeds) {
    const r = await p.evaluate(([venue, seed, late, hold]) => { let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue, soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); if (hold) AGGRO.hold = hold; selectVenue(venue); resetGame(); startRace();
      const me = state.boats[0], ctl = me.controller = new BotController(me);
      let t = 0, raced = 0, airMax = 0;
      while (t < 700 && !me.raceState.finished) { ctl.update(1 / 30); let dd = normalizeAngle(ctl.targetHeading - me.heading);
        if (state.race.status === 'racing') raced += 1 / 30;
        if (raced > 0 && raced < late) { dd = normalizeAngle(state.wind.direction - me.heading); }   // head to wind, parked
        state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); t += 1 / 30;
        if (_aggro) for (const v of _aggro.air.values()) airMax = Math.max(airMax, v); }
      for (let i = 0; i < 30 * 60 && state.boats.some(x => !x.raceState.finished); i++) update(1 / 30);
      const order = state.boats.slice().sort((a, b) => (a.raceState.finished ? a.raceState.finishTime : 1e9) - (b.raceState.finished ? b.raceState.finishTime : 1e9));
      const f = Unlocks.raceFacts(order); const got = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'aggression' && a.test(f, {})).map(a => a.char);
      return { pos: f.pos, pen: f.penalties, pass: (f.vals || {})['pass:n'] || 0, give: (f.vals || {})['give:n'] || 0, airMax: Math.round(airMax), air: f.feats.filter(x => /^air:/.test(x)), got }; }, [venue, seed, late, +(process.env.HOLD || 0)]);
    console.log('seed', seed, JSON.stringify(r)); for (const g of r.got) tally[g] = (tally[g] || 0) + 1;
  }
  console.log(venue, 'earned:', JSON.stringify(tally)); await b.close(); })();

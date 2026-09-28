// Probe: the Leg & Mark Craft rows on the plain autopilot sailing as the player — which rows the real race facts earn.
//   node regatta/eval/_legs_feats.js [venue] [seeds...]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const venue = process.argv[2] || 'seatrials', seeds = process.argv.slice(3).map(Number); if (!seeds.length) seeds.push(1, 2, 3, 4);
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const tally = {};
  for (const seed of seeds) {
    const r = await p.evaluate(([venue, seed]) => { let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue, soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue(venue); resetGame(); startRace();
      const me = state.boats[0], ctl = me.controller = new BotController(me);
      let t = 0; while (t < 500 && !me.raceState.finished) { ctl.update(1 / 30); const dd = normalizeAngle(ctl.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); t += 1 / 30; }
      for (let i = 0; i < 30 * 60 && state.boats.some(x => !x.raceState.finished); i++) update(1 / 30);
      const order = state.boats.slice().sort((a, b) => (a.raceState.finished ? a.raceState.finishTime : 1e9) - (b.raceState.finished ? b.raceState.finishTime : 1e9));
      const f = Unlocks.raceFacts(order); const got = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'legs' && a.test(f, {})).map(a => a.char);
      return { pos: f.pos, ranks: [f.startRank, ...f.legRanks].join('>'), kite: Math.round(((f.vals || {})['kite:secs'] || 0) / (f.time || 1) * 100), up: f.fastestUp, down: f.fastestDown, feats: f.feats.filter(x => /^(mark|pass):/.test(x)), got }; }, [venue, seed]);
    console.log('seed', seed, JSON.stringify(r)); for (const g of r.got) tally[g] = (tally[g] || 0) + 1;
  }
  console.log(venue, 'earned:', JSON.stringify(tally)); await b.close(); })();

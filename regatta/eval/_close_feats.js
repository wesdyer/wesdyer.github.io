// Probe: the close-racing family on the plain autopilot sailing as the player — seconds after the gun it crossed,
// first across?, over early at the gun?, won?   node regatta/eval/_start_feats.js [venue] [seeds...]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const venue = process.argv[2] || 'seatrials', seeds = process.argv.slice(3).map(Number); if (!seeds.length) seeds.push(1, 2, 3, 4, 5, 6, 7, 8);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const rows = [];
  for (const seed of seeds) {
    const r = await p.evaluate(([venue, seed]) => { let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue, soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue(venue); resetGame(); startRace();
      const feats = []; GameEvents.on('player-feat', e => { if (/^close:/.test(e.id)) feats.push(e.id); });
      const me = state.boats[0], ctl = me.controller = new BotController(me);
      let t = 0; while (t < 400 && !me.raceState.finished) { ctl.update(1 / 30); const dd = normalizeAngle(ctl.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); t += 1 / 30; }
      return { delay: me.raceState.startLegDuration, feats }; }, [venue, seed]);
    rows.push(r); console.log('seed', seed, r.delay != null ? r.delay.toFixed(2) + ' s' : 'no start', r.feats.join(' '));
  }
  const has = (k) => rows.filter(q => q.feats.some(f => f.startsWith(k))).length;
  console.log(`${venue}: wide rounding in ${has('close:wide')}/${rows.length}; touched a mark ${has('close:touch')}; photo finish ${has('close:photo')}; inches ${has('close:inches')}`);
  await b.close(); })();

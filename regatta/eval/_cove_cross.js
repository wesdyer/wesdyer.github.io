// How often does an autopilot player cross a cargo ship's track, and how far ahead of the bow?
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof BotController !== 'undefined');
  const seeds = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
  for (const seed of seeds) {
    const r = await p.evaluate(async (seed) => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame(); startRace();
      await new Promise(r => setTimeout(r, 200));
      const me = state.boats[0]; me.controller = new BotController(me);
      const side = new Map(), log = []; let feats = [];
      GameEvents.on('player-feat', (e) => feats.push(e.id));
      let t = 0, minAhead = Infinity;
      while (t < 600 && !me.raceState.finished) {
        me.controller.update(1 / 30); const d = normalizeAngle(me.controller.targetHeading - me.heading);
        state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(1 / 30); t += 1 / 30;
        if (state.race.status !== 'racing') continue;
        for (const v of state.traffic) {
          if (!v.active || !/cargo-ship/.test(v.kind)) continue;
          const fx = Math.sin(v.heading), fy = -Math.cos(v.heading), dx = me.x - v.x, dy = me.y - v.y;
          const ahead = dx * fx + dy * fy - v.hullLen / 2, sd = Math.sign(dx * -fy + dy * fx) || 1, was = side.get(v.id); side.set(v.id, sd);
          const lat = Math.abs(dx * -fy + dy * fx);
          if (lat < 400 && ahead > 0) minAhead = Math.min(minAhead, ahead);
          if (was !== undefined && was !== sd && Math.abs(ahead) < 3000) log.push([v.id, Math.round(ahead), Math.round(state.race.timer)]);
        }
      }
      return { seed, fin: me.raceState.finished, t: Math.round(t), crossings: log, feats: [...new Set(feats)], minAhead: Math.round(minAhead) };
    }, seed);
    console.log(JSON.stringify(r));
  }
  await b.close();
})();

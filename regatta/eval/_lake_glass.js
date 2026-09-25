// Probe: how slow does a boat get in Stillwater's NW glass patch (wind-shore-bay) around mark 3?
// Autopilot player + the whole fleet; logs each boat's minimum speed (kn) while inside the patch.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof BotController !== 'undefined');
  for (const seed of (process.argv[2] || '1,2,3').split(',').map(Number)) {
    const r = await p.evaluate(async (seed) => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame(); startRace(); await new Promise(r => setTimeout(r, 200));
      const poly = VenueDoc.get('lake').wind.regions.find(r => r.id === 'wind-shore-bay').poly.map(q => ({ x: q[0] ?? q.x, y: q[1] ?? q.y }));
      const me = state.boats[0]; me.controller = new BotController(me);
      const minIn = new Map(), timeIn = new Map(); let t = 0;
      while (t < 600 && !me.raceState.finished) {
        me.controller.update(1 / 30); const d = normalizeAngle(me.controller.targetHeading - me.heading);
        state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(1 / 30); t += 1 / 30;
        if (state.race.status !== 'racing') continue;
        for (const bt of state.boats) {
          if (bt.raceState.finished || !pointInPoly(bt.x, bt.y, poly)) continue;
          const kn = bt.speed / 0.25;
          minIn.set(bt.name, Math.min(minIn.get(bt.name) ?? 99, kn));
          timeIn.set(bt.name, (timeIn.get(bt.name) || 0) + 1 / 30);
        }
      }
      const rows = [...minIn.entries()].map(([n, v]) => `${n}${n === me.name ? '*' : ''}:${v.toFixed(1)}kn/${timeIn.get(n).toFixed(0)}s`);
      return { seed, t: Math.round(t), fin: me.raceState.finished, rows };
    }, seed);
    console.log(JSON.stringify(r));
  }
  await b.close();
})();

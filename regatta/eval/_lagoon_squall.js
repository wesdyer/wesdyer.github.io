// Probe: how long does a boat ride a squall's GUST FRONT at Pearl Lagoon, left to itself?
// Autopilot player + the whole fleet. Per boat: the longest continuous stretch in a front
// (inside the cell ellipse and more than a quarter of its depth ahead of centre — the
// boosted leading strip), total seconds in any cell, and seconds in a dead-air wake.
//   node regatta/eval/_lagoon_squall.js [seeds]      (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof BotController !== 'undefined');
  for (const seed of (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number)) {
    if (process.env.OLD) await p.evaluate(() => { window.__OLD = true; });
    const r = await p.evaluate(async (seed) => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      // OLD=1 in the env: the engine defaults (the squalls before Wes's Sep 25 change), for an A/B.
      const sq = VenueDoc.get('lagoon').squalls;
      if (window.__OLD) { delete sq.rx; delete sq.ry; delete sq.speedFactor; }
      resetGame(); startRace(); await new Promise(r => setTimeout(r, 200));
      const me = state.boats[0]; me.controller = new BotController(me);
      const S = new Map(); let t = 0; const dt = 1 / 30;
      const zone = (x, y) => {
        let z = 0;
        for (const q of state.squalls || []) {
          const ux = -Math.sin(q.course), uy = Math.cos(q.course), dx = x - q.x, dy = y - q.y;
          const along = dx * ux + dy * uy, across = dx * uy - dy * ux;
          const d2 = along * along / (q.ry * q.ry) + across * across / (q.rx * q.rx);
          if (d2 < 1) z = Math.max(z, along > 0.25 * q.ry ? 3 : 2);
          const wa = along + q.ry * 1.6, wd2 = wa * wa / (q.ry * q.ry * 1.69) + across * across / (q.rx * q.rx * 0.81);
          if (wd2 < 0.5 && z === 0) z = 1;
        }
        return z;   // 3 front · 2 cell · 1 deep wake · 0 clear
      };
      while (t < 600 && !me.raceState.finished) {
        me.controller.update(dt); const d = normalizeAngle(me.controller.targetHeading - me.heading);
        state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(dt); t += dt;
        if (state.race.status !== 'racing') continue;
        for (const bt of state.boats) {
          if (bt.raceState.finished) continue;
          const o = S.get(bt.name) || { run: 0, best: 0, cell: 0, wake: 0, n: 0 };
          const z = zone(bt.x, bt.y);
          if (z === 3) { if (o.run === 0) o.n++; o.run += dt; o.best = Math.max(o.best, o.run); } else o.run = 0;
          if (z >= 2) o.cell += dt; if (z === 1) o.wake += dt;
          S.set(bt.name, o);
        }
      }
      const rows = [...S.entries()].map(([n, o]) => `${n}${n === me.name ? '*' : ''}:${o.best.toFixed(1)}s(${o.n})`);
      const all = [...S.values()];
      return { seed, t: Math.round(t), fin: me.raceState.finished, rows,
               meanCell: (all.reduce((a, o) => a + o.cell, 0) / all.length).toFixed(0), meanWake: (all.reduce((a, o) => a + o.wake, 0) / all.length).toFixed(0) };
    }, seed);
    console.log(JSON.stringify(r));
  }
  await b.close();
})();

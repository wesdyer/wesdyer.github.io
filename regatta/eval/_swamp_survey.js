// Probe: what a Gatorgrass Bayou race is, as built — legs, time, the wind the player meets,
// time in each weed kind and its speed cost, and where the fleet goes (does it split?).
//   node regatta/eval/_swamp_survey.js [seeds]      (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof BotController !== 'undefined');
  for (const seed of (process.argv[2] || '1,2').split(',').map(Number)) {
    if (process.env.TRACKS) await p.evaluate(() => { window.__dumpTracks = true; });
    const r = await p.evaluate(async (seed) => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'swamp', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame(); startRace(); await new Promise(r => setTimeout(r, 200));
      const me = state.boats[0]; me.controller = new BotController(me);
      const drag = state.course.islands.filter(i => { const k = VenueDoc.traits(i); return !k.hard && (k.drag || /weed|duck|lily|grass/.test(i.kind)); });
      const inKind = {}, spdIn = {}; let t = 0, wind = 0, wn = 0; const tracks = new Map(); const dt = 1 / 30;
      while (t < 600 && !me.raceState.finished) {
        me.controller.update(dt); const d = normalizeAngle(me.controller.targetHeading - me.heading);
        state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(dt); t += dt;
        if (state.race.status !== 'racing') continue;
        const w = getWindAt(me.x, me.y); wind += w.speed; wn++;
        const hit = drag.find(i => pointInPoly(me.x, me.y, i.vertices));
        const k = hit ? hit.kind : 'open'; inKind[k] = (inKind[k] || 0) + dt; spdIn[k] = (spdIn[k] || 0) + me.speed / 0.25 * dt;
        for (const bt of state.boats) { if (bt.raceState.finished) continue; const h = drag.find(i => i.kind === 'mudflat' && pointInPoly(bt.x, bt.y, i.vertices)); if (h) { const o = (window.__mud = window.__mud || {}); o[bt.name] = o[bt.name] || {}; o[bt.name][h.id] = (o[bt.name][h.id] || 0) + dt; } }
        if (Math.round(t * 30) % 60 === 0) for (const bt of state.boats) { if (!tracks.has(bt.name)) tracks.set(bt.name, []); tracks.get(bt.name).push([Math.round(bt.x), Math.round(bt.y)]); }
      }
      const kinds = Object.fromEntries(Object.entries(inKind).map(([k, v]) => [k, `${v.toFixed(0)}s @${(spdIn[k] / v).toFixed(1)}kn`]));
      const fin = state.boats.filter(b => b.raceState.finished).length;
      const mid = [...tracks.entries()].map(([n, tr]) => n + ':' + JSON.stringify(tr[Math.floor(tr.length / 2)]));
      if (window.__dumpTracks) window.__tracks = [...tracks.entries()].map(([n, tr]) => ({ n, fin: state.boats.find(b => b.name === n).raceState.finished, tr }));
      const fins = state.boats.map(bt => [bt.name + (bt === me ? '*' : ''), bt.raceState.finished ? Math.round(bt.raceState.finishTime || bt.raceState.time || 0) : 'DNF', Object.entries((window.__mud || {})[bt.name] || {}).map(([k, v]) => k + ':' + v.toFixed(0)).join(' ')]);
      window.__mud = {};
      return { seed, fins, legs: state.course.route ? state.course.route.length : '?', t: Math.round(t), fin, meanWind: (wind / wn).toFixed(1), kinds, mid };
    }, seed);
    if (process.env.TRACKS) { const tr = await p.evaluate(() => window.__tracks); require('fs').writeFileSync(process.env.TRACKS + '_' + seed + '.json', JSON.stringify(tr)); }
    console.log(JSON.stringify(r));
  }
  await b.close();
})();

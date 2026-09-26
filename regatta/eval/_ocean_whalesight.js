// Probe: how often a sailor SEES whales, and how often the fleet HITS one. (1) The player sails
// a race track (Wes's recorded race if given, else a lap of the course); each second, is a whale
// at the surface within 900 u (about a screen)? (2) The fleet races (seeds) — whale contacts.
//   node regatta/eval/_ocean_whalesight.js [traj.json]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const traj = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).samples.filter(s => s[1] === 1).map(s => [s[0], s[2], s[3]]) : null;
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.Wildlife && typeof BotController !== 'undefined');
  console.log(await p.evaluate((traj) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame();
    const d = Wildlife.debug(), me = state.boats[0]; for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
    const pts = traj || (() => { const w = [[400, -5600], [-3500, -5600], [-4400, -1100], [14000, -1000]], o = []; let t = 0;
      for (let k = 0; k < w.length - 1; k++) { const [ax, ay] = w[k], [bx, by] = w[k + 1], n = Math.round(Math.hypot(bx - ax, by - ay) / 120); for (let i = 0; i < n; i++) o.push([t++, ax + (bx - ax) * i / n, ay + (by - ay) * i / n]); } return o; })();
    let secs = 0, seen = 0, near = 0, dim = 0; const pods = new Set();
    for (let i = 1; i < pts.length; i++) { const [t0] = pts[i - 1], [t1, x, y] = pts[i]; const n = Math.max(1, Math.round((t1 - t0) * 30));
      for (let k = 0; k < n; k++) { me.x = x; me.y = y; Wildlife.update(1 / 30); }
      if (Math.floor(t1) === Math.floor(t0)) continue; secs++;
      let any = false, anyN = false, anyD = false; for (const W of d.whalePods) for (const m of W.members) { const dd = Math.hypot(m.x - x, m.y - y); if (dd < 900) { anyN = true; if (m.mode !== 'under' || m.depth < 0.7) anyD = true; if (m.mode !== 'under' || m.ev) { any = true; pods.add(W.cfg.id); } } }
      if (any) seen++; if (anyN) near++; if (anyD) dim++; }
    const view = `sailing a race (${secs} s), within a screen: a whale at the surface ${(100 * seen / secs).toFixed(0)}%, visible at all (surface or shallow) ${(100 * dim / secs).toFixed(0)}%, anywhere near ${(100 * near / secs).toFixed(0)}%; pods met: ${[...pods].sort().join(',')}`;
    // the fleet
    let hits = 0, races = 0; const prev = window.onRaceEvent; window.onRaceEvent = (ty, dd) => { if (dd && dd.whale) hits++; if (prev) prev(ty, dd); };
    for (const seed of [1, 2, 3]) { let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame(); startRace(); const me2 = state.boats[0]; me2.controller = new BotController(me2); let t = 0;
      while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) { me2.controller.update(1 / 30); const dh = normalizeAngle(me2.controller.targetHeading - me2.heading); state.keys.ArrowLeft = dh < -0.02; state.keys.ArrowRight = dh > 0.02; update(1 / 30); t += 1 / 30; }
      races++; }
    window.onRaceEvent = prev;
    return view + `\\nfleet: ${hits} whale contacts in ${races} races of 10 boats`; }, traj));
  await b.close(); })();

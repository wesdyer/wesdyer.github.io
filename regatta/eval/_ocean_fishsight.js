// Probe: on a sailor's real track, how much flying-fish and mahi action is there? Replays each
// recorded race (Downloads / eval traj, or given files) through the live wildlife: the player's
// position and speed each frame; counts flying fish launched within a screen (900 u), mahi
// hunts started within 1600 u, and the patches the track passed through.
//   node regatta/eval/_ocean_fishsight.js [traj.json ...]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const files = process.argv.slice(2);
  const tr = files.map(f => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return { f: path.basename(f), s: j.samples.filter(q => q[1] === 1).map(q => [q[0], q[2], q[3], q[4], q[5]]) }; });
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.Wildlife && typeof resetGame === 'function');
  for (const T of tr) {
    console.log(T.f, await p.evaluate((S) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame();
      const d = Wildlife.debug(), me = state.boats[0]; for (const bt of state.boats) if (bt !== me) { bt.x = 1e6; bt.y = 1e6; }
      let ffNear = 0, seenF = new Set(), hunts = 0, inPatch = new Set(), secsFast = 0, pods = new Set(); const wasChase = new Map();
      for (let i = 1; i < S.length; i++) { const [t0] = S[i - 1], [t1, x, y, h, sp] = S[i]; const n = Math.max(1, Math.round((t1 - t0) * 30));
        for (let k = 0; k < n; k++) { me.x = x; me.y = y; me.heading = h; me.speed = sp; me.raceState.finished = false; Wildlife.update(1 / 30);
          for (const f of Wildlife.debug().flyfish) if (!seenF.has(f) && Math.hypot(f.x0 - x, f.y0 - y) < 900) { seenF.add(f); ffNear++; }
          if (k === 0) for (const W of d.whalePods) for (const m of W.members) if ((m.mode !== 'under' || m.depth < 0.7) && Math.hypot(m.x - x, m.y - y) < 900) pods.add(W.cfg.id);
          for (const P of d.flyPatches) { if (Math.hypot(P.x - x, P.y - y) < P.r) inPatch.add(P); if (P.pack) { const c = P.pack.some(m => m.mode === 'chase'); if (c && !wasChase.get(P) && Math.hypot(P.x - x, P.y - y) < 1600) hunts++; wasChase.set(P, c); } } }
        if (sp * 4 >= 9) secsFast += t1 - t0; }
      return `${Math.round(S[S.length - 1][0])} s race, fast (>=9 kn) ${Math.round(secsFast)} s: flying fish within a screen ${ffNear}, mahi hunts nearby ${hunts}, patches sailed through ${inPatch.size}/${d.flyPatches.length}, whale pods met ${pods.size} (${[...pods].sort().join(',')})`; }, T.s));
  }
  await b.close(); })();

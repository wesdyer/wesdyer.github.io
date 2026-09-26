// Probe: does every run meet a whale pod, whatever the lane? The player sails the run (mark 4 to
// the finish, ~16 kn) by each route — inshore (via the cape), direct, offshore — starting at many
// different moments; a pod is MET if one of its whales is within 900 u (about a screen) and at or
// near the surface (visible) at some point. Reports, per route, the share of runs that met >= 1.
//   node regatta/eval/_ocean_runwhales.js [starts]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const starts = +(process.argv[2] || 24);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.Wildlife && typeof resetGame === 'function');
  console.log(await p.evaluate((starts) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' }));
    const routes = { inshore: [[-4300, -1000], [3000, -2600], [8000, -3000], [14000, -1300]], direct: [[-4300, -1000], [14000, -1300]], offshore: [[-4300, -1000], [3000, 800], [9000, 1500], [14000, -1300]] };
    const out = [];
    for (const [name, wps] of Object.entries(routes)) {
      let met = 0, podsTot = 0, worst = 99;
      for (let k = 0; k < starts; k++) {
        let s = 3 + k * 977; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        state.race.seed = 1000 + k; resetGame(); const d = Wildlife.debug(), me = state.boats[0]; for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
        for (let i = 0; i < (90 + (k % 8) * 10) * 30; i++) Wildlife.update(1 / 30);          // the race so far
        const seen = new Set();
        for (let w = 0; w < wps.length - 1; w++) { const [ax, ay] = wps[w], [bx, by] = wps[w + 1], n = Math.round(Math.hypot(bx - ax, by - ay) / 8);
          for (let i = 0; i < n; i++) { me.x = ax + (bx - ax) * i / n; me.y = ay + (by - ay) * i / n; Wildlife.update(1 / 30);
            if (i % 10) continue;
            for (const W of d.whalePods) for (const m of W.members) if ((m.mode !== 'under' || m.depth < 0.7) && Math.hypot(m.x - me.x, m.y - me.y) < 900) seen.add(W.cfg.id); } }
        if (seen.size) met++; podsTot += seen.size; worst = Math.min(worst, seen.size);
      }
      out.push(`${name.padEnd(9)} met a pod in ${met}/${starts} runs, mean ${(podsTot / starts).toFixed(1)} pods, worst ${worst}`);
    }
    return out.join('\n'); }, starts));
  await b.close(); })();

// Probe: how every Bluewater Bonanza animal MOVES, measured — the player sails the run at ~16 kn
// for two minutes past patches and pods; per species, speed in game knots (15 u/s = 1 kn, the
// boats' own scale) as median / p90, in body lengths a second, and its rhythm (whale fluke
// strokes, dolphin breaths, albatross arcs), for comparison against the real animal.
//   node regatta/eval/_ocean_motion.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.Wildlife && typeof resetGame === 'function');
  console.log(await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame();
    const d = Wildlife.debug(), me = state.boats[0]; for (const bt of state.boats) if (bt !== me) { bt.x = 1e6; bt.y = 1e6; }
    const S = {}; const add = (k, v) => (S[k] = S[k] || []).push(v);
    const prev = new Map(); const dt = 1 / 30; let hunts = 0, caught = 0, ffSeen = new Set(), breaths = 0, blows = 0;
    // sail back and forth along the run, through the patches
    const P0 = d.flyPatches.slice().sort((a, c) => a.x - c.x);
    let x = -4000, y = -1200, t = 0, tgt = 0;
    for (let i = 0; i < 30 * 150; i++) {
      const T = P0[tgt % P0.length]; const hx = T.x - x, hy = T.y - y, hd = Math.hypot(hx, hy); if (hd < 60) tgt++;
      const h = Math.atan2(hx, -hy); x += Math.sin(h) * 240 * dt; y -= Math.cos(h) * 240 * dt; me.x = x; me.y = y; me.heading = h; me.speed = 4; me.raceState.finished = false;
      const bBefore = Wildlife.debug().blows.length; Wildlife.update(dt); t += dt;
      const track = (k, o, L) => { const q = prev.get(o); if (q) { const v = Math.hypot(o.x - q[0], o.y - q[1]) / dt; if (v < 3000) add(k, v); } prev.set(o, [o.x, o.y]); };
      for (const W of d.whalePods) for (const m of W.members) track(m.calf ? 'calf' : 'whale', m);
      for (const Sch of d.riders) for (const m of Sch.members) if (m.live) track(Sch.resident ? 'dolphin (resident)' : 'dolphin (riding)', m);
      for (const G of d.gliders) track('albatross', G);
      for (const P of d.flyPatches) if (P.pack) for (const m of P.pack) track(m.mode === 'chase' ? 'mahi (chasing)' : 'mahi (patrol)', m);
      for (const f of Wildlife.debug().flyfish) if (f.t > 0 && f.t < f.dur) { add('flying fish', f.len / f.dur); ffSeen.add(f); if (f.caught) caught++; }
    }
    for (const P of d.flyPatches) if (P.pack) hunts += 0;
    const q = (a, f) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * f)];
    const LEN = { whale: 132, calf: 48, 'dolphin (riding)': 26, 'dolphin (resident)': 26, albatross: 60, 'mahi (chasing)': 30, 'mahi (patrol)': 30, 'flying fish': 12 };
    const rows = Object.entries(S).map(([k, a]) => `${k.padEnd(20)} median ${(q(a, 0.5) / 15).toFixed(1).padStart(5)} kn  p90 ${(q(a, 0.9) / 15).toFixed(1).padStart(5)} kn  ~${(q(a, 0.5) / (LEN[k] || 30)).toFixed(1)} BL/s  (n ${a.length})`);
    const caughtN = [...ffSeen].filter(f => f.caught).length;
    return rows.join('\n') + `\nflying fish seen ${ffSeen.size}, taken by mahi ${caughtN}; hunting patches ${d.flyPatches.filter(P => P.pack).length}/${d.flyPatches.length}`; }));
  await b.close(); })();

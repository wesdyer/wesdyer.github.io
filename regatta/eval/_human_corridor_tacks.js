// WHERE DID THE HUMAN TACK, in how much water? — against a recorded trajectory.
//
// Redrock's fleet grinds 4370 shoreline hits a race in 100-150u corridors the human
// sailed cleanly in 140 s. Two rival explanations for how: (a) the human can execute
// tacks in sub-150u water (so the AI's local layer should too), or (b) the human
// TACKS WHERE THERE IS ROOM — beats in the pockets, reaches the narrows — and the
// AI should be taught placement, not execution. The clearance at each of the
// human's actual maneuvers decides it.
//
// Usage: node regatta/eval/_human_corridor_tacks.js <traj.json>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const traj = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.SailCheck, null, { timeout: 20000 });
  const R = await p.evaluate(({ venue, format, samples }) => {
    selectVenue(venue);
    const grid = state.course.botGrid;
    if (!grid._clear) grid._clear = window.SailCheck.clearanceField(grid);
    const F = {}; format.forEach((n, i) => F[n] = i);
    const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const clearAt = (x, y) => {
      const [ci, cj] = grid.cell(x, y);
      const id = Math.max(0, Math.min(grid.n * grid.n - 1, cj * grid.n + ci));
      return grid._clear[id] * grid.res;
    };
    const tacks = [], gybes = [];
    const byLeg = {};
    let lastSide = 0, lastTwa = 0;
    for (const s of samples) {
      if (s[F.phase] !== 1) continue;
      const leg = s[F.leg];
      const x = s[F.x], y = s[F.y];
      const twa = norm(s[F.hdg] - s[F.windDir]);
      const cl = clearAt(x, y);
      const e = byLeg[leg] || (byLeg[leg] = { n: 0, clSum: 0, clMin: 1e9, tacks: 0, gybes: 0, tackCl: [], upN: 0 });
      e.n++; e.clSum += cl; if (cl < e.clMin) e.clMin = cl;
      if (Math.abs(twa) < Math.PI * 0.5) e.upN++;
      const side = Math.sign(twa);
      if (lastSide !== 0 && side !== 0 && side !== lastSide) {
        const rec = { leg, cl, absTwa: Math.abs(lastTwa) * 180 / Math.PI };
        if (Math.abs(lastTwa) < Math.PI / 2) { tacks.push(rec); e.tacks++; e.tackCl.push(Math.round(cl)); }
        else { gybes.push(rec); e.gybes++; }
      }
      if (side !== 0) { lastSide = side; lastTwa = twa; }
    }
    return { byLeg, tacks, gybes };
  }, { venue: traj.venue, format: traj.format, samples: traj.samples });

  console.log(`${path.basename(process.argv[2])} (${traj.venue}, ${(traj.finishTime || 0).toFixed(1)}s)`);
  for (const [leg, e] of Object.entries(R.byLeg)) {
    console.log(`leg ${leg}: samples=${e.n} up%=${Math.round(100 * e.upN / e.n)} clearance mean=${Math.round(e.clSum / e.n)}u min=${Math.round(e.clMin)}u tacks=${e.tacks} gybes=${e.gybes} tackClearances=[${e.tackCl.join(',')}]`);
  }
  const cls = R.tacks.map(t => Math.round(t.cl)).sort((a, b) => a - b);
  console.log(`ALL TACKS n=${cls.length} clearance p10=${cls[Math.floor(0.1 * (cls.length - 1))]}u med=${cls[Math.floor(0.5 * (cls.length - 1))]}u p90=${cls[Math.floor(0.9 * (cls.length - 1))]}u`);
  await b.close();
})();

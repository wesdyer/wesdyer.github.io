// Probe: ten minutes of Emberfall's Sally Lightfoots against the research — run speeds (u/s; 29 u/s ≈ 1 m/s: the
// sprint ~1.4 m/s), clings under the wash, leaps, face-offs, and any crab off the rock or in the lava; then a boat
// driven along a bed (how many bolt).   node regatta/eval/_volc_crab_behave.js
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const beds = Wildlife.debug().crabBeds.filter(B => !B.cleaners), all = beds.flatMap(B => B.crabs), dt = 1 / 30;
    const prev = new Map(all.map(c => [c, [c.x, c.y, 0, 0, 0]])); const v = { flee: [], step: [] };
    let wet = 0, clings = 0, leaps = 0, duels = 0, frames = 0;
    for (let i = 0; i < 30 * 600; i++) { Wildlife.update(dt);
      for (const c of all) { const [px, py, cl, lp, du] = prev.get(c), sp = Math.hypot(c.x - px, c.y - py) / dt;
        if (sp > 1) (c.flee > 0 ? v.flee : v.step).push(sp);
        if (!pointOnLand(c.x, c.y)) wet++; frames++;
        if (c.cling > 0 && !cl) clings++; if (c.leap > 0 && !lp) leaps++; const d = c.duel && c.duel.sh.t > 0 ? 1 : 0; if (d && !du) duels++;
        prev.set(c, [c.x, c.y, c.cling > 0, c.leap > 0, d]); } }
    // a boat along the biggest bed's waterline
    const B = beds.slice().sort((a, b) => b.crabs.length - a.crabs.length)[0], me = state.boats[0]; let bolt = 0;
    const c0 = B.crabs[0]; me.x = c0.x + 150; me.y = c0.y; me.speed = 4; me.heading = 0;
    for (let i = 0; i < 30 * 4; i++) { Wildlife.update(dt); }
    for (const c of B.crabs) if (Math.hypot(c.x - me.x, c.y - me.y) < 250 && c.flee > 0) bolt++;
    const near = B.crabs.filter(c => Math.hypot(c.x - me.x, c.y - me.y) < 250).length;
    const q = (a, f) => a.length ? a.sort((x, y) => x - y)[Math.floor(a.length * f)].toFixed(0) : '-';
    return { crabs: all.length, beds: beds.length, offRockFrac: (wet / frames).toFixed(4), fleeSpeed_med: q(v.flee, 0.5), fleeSpeed_p90: q(v.flee, 0.9), stepSpeed_med: q(v.step, 0.5),
      clingsPerMin: (clings / 10).toFixed(1), leapsPerMin: (leaps / 10).toFixed(1), faceoffsPerMin: (duels / 2 / 10).toFixed(1), boatBolt: bolt + '/' + near }; });
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();

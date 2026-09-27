// Probe: which Flats animals a recorded race came near — for each colony/flock/bed, the closest the track
// passed (u) and when.   node regatta/eval/_flats_seen.js <traj.json>
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const T = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const S = T.samples.map(q => [q[0], q[2], q[3]]);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Tide && typeof resetGame === 'function');
  const r = await p.evaluate((S) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); selectVenue('flats'); resetGame(); startRace();
    const d = Wildlife.debug(), near = (x, y) => { let best = 1e9, at = 0; for (const [t, sx, sy] of S) { const q = Math.hypot(sx - x, sy - y); if (q < best) { best = q; at = t; } } return [Math.round(best), Math.round(at)]; };
    return { seals: d.gsealCols.map(C => [Math.round(C.cx), Math.round(C.cy), ...near(C.cx, C.cy)]), spoon: d.spoonFlocks.map(F => [Math.round(F.hx), Math.round(F.hy), ...near(F.hx, F.hy)]), avo: d.avoFlocks.map(F => [Math.round(F.hx), Math.round(F.hy), ...near(F.hx, F.hy)]),
      crabs: d.scrabBeds.map(B => near(B.cx, B.cy)[0]).sort((a, b) => a - b).slice(0, 40).join(' '), marks: state.course.marks.map(m => [m.id, Math.round(m.x), Math.round(m.y)]) }; }, S);
  console.log('finish', T.finishTime, 'fp', T.venueFingerprint); for (const k of ['seals', 'spoon', 'avo']) console.log(k, JSON.stringify(r[k])); console.log('crab beds, closest pass:', r.crabs); await b.close(); })();

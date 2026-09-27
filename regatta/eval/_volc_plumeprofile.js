// Probe: an erupting cone's plume, profiled — windMul along the plume's axis at distances downwind,
// and its half-width, at the peak of an eruption. The cone is forced to erupt.
//   node regatta/eval/_volc_plumeprofile.js [coneIndex]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const ci = +(process.argv[2] || 2);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate((ci) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame(); startRace();
    const v = state.volcano, C = v.cones[ci];
    // put the cone at the start of its build and run through to mid-peak
    const q = C.period - 12 - 36 - 14; C.phase = ((q - v.t) / C.period % 1 + 1) % 1;
    for (let t = 0; t < 12 + 30; t += 1 / 30) Volcano.update(1 / 30);
    // the axis: through the parcels' centroid direction
    const ps = C.parcels.filter(p => p.dead > 0); let ax = 0, ay = 0; for (const p of ps) { ax += p.x - C.x; ay += p.y - C.y; } const L = Math.hypot(ax, ay) || 1; ax /= L; ay /= L;
    const prof = []; for (const d of [300, 600, 1000, 1500, 2000, 2500, 3000, 3500, 4000]) { const x = C.x + ax * d, y = C.y + ay * d; let w = 0; for (let o = 0; o < 1500; o += 25) if (Volcano.windMul(x - ay * o, y + ax * o) < 0.7) w = o; prof.push(`${d}: ${Volcano.windMul(x, y).toFixed(2)} (half-width@0.7 ${w})`); }
    return { cone: [Math.round(C.x), Math.round(C.y)], I: C.intensity.toFixed(2), n: ps.length, prof }; }, ci);
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();

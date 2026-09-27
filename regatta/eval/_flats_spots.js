// Probe: candidate spots for the Flats' animals off the tide's elevation field — seal banks (sand that
// dries for a third to a half of the cycle, deep channel within reach), wading shallows, crab edges.
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Tide && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); selectVenue('flats'); resetGame(); startRace();
    const F = state.tide.field; const out = { box: [F.x0, F.y0, F.x0 + F.W * F.res, F.y0 + F.H * F.res], marks: state.course.marks.map(m => [m.id, Math.round(m.x), Math.round(m.y)]) };
    const G = Tide.groundAt; const seals = [];
    for (let y = F.y0 + 100; y < F.y0 + F.H * F.res - 100; y += 60) for (let x = F.x0 + 100; x < F.x0 + F.W * F.res - 100; x += 60) {
      if (pointOnLand(x, y)) continue; const z = G(x, y); if (z < -0.5 || z > 0.2) continue;
      let deep = 1e9; for (let a = 0; a < 16; a++) for (const d of [80, 160, 240]) { const q = G(x + Math.cos(a / 16 * 6.283) * d, y + Math.sin(a / 16 * 6.283) * d); if (q < -2) deep = Math.min(deep, d); }
      if (deep <= 240) seals.push([Math.round(x), Math.round(y), +z.toFixed(2), deep]); }
    out.sealN = seals.length; out.sealSample = seals.filter((_, i) => i % Math.max(1, Math.floor(seals.length / 40)) === 0);
    return out; });
  console.log(JSON.stringify(r)); await b.close(); })();

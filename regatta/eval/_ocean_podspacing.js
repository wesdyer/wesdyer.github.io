// Probe: how close humpback pods come to each other — over N simulated minutes (several race seeds),
// the share of time any two pods' centres are within 600 / 900 u, and the closest approach.
//   node regatta/eval/_ocean_podspacing.js [minutes]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const mins = +(process.argv[2] || 10);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.Wildlife && typeof resetGame === 'function');
  console.log(await p.evaluate((mins) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame();
    const d = Wildlife.debug(); for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
    const ctr = (W) => { let x = 0, y = 0; for (const m of W.members) { x += m.x; y += m.y; } return [x / W.members.length, y / W.members.length]; };
    let n = 0, c600 = 0, c900 = 0, minD = 1e9, pair = '';
    for (let i = 0; i < mins * 60 * 30; i++) { Wildlife.update(1 / 30); if (i % 15 || i < 300) continue; n++;
      let any6 = false, any9 = false;
      for (let a = 0; a < d.whalePods.length; a++) for (let b2 = a + 1; b2 < d.whalePods.length; b2++) { const [ax, ay] = ctr(d.whalePods[a]), [bx, by] = ctr(d.whalePods[b2]), q = Math.hypot(ax - bx, ay - by);
        if (q < 600) any6 = true; if (q < 900) any9 = true; if (q < minD) { minD = q; pair = d.whalePods[a].cfg.id + '+' + d.whalePods[b2].cfg.id; } }
      if (any6) c600++; if (any9) c900++; }
    return `over ${mins} min: two pods within 600 u ${(100 * c600 / n).toFixed(1)}% of the time, within 900 u ${(100 * c900 / n).toFixed(1)}%; closest ${Math.round(minD)} u (${pair})`; }, mins));
  await b.close(); })();

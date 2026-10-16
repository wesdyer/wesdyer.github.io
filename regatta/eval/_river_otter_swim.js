// Probe: Sockeye Run's otter families swimming — does the leader get somewhere? Lets each family off its logjam (boats
// parked far away) and logs, every 2 s, the leader's distance from where it was 2 s before, its goal distance and the
// gaps between the swimmers; flags a family whose leader makes under 20 u of headway in 6 s (circling).
//   node regatta/eval/_river_otter_swim.js [seconds]      (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const secs = +(process.argv[2] || 60); const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); resetGame(); });
  await p.waitForTimeout(800);
  console.log(await p.evaluate((secs) => { const Fs = Wildlife.debug().rompers, out = []; for (const F of Fs) F.t = 0;
    const hist = Fs.map(() => []);
    for (let i = 0; i < secs * 30; i++) { for (const b of state.boats) { b.x = 1e5; b.y = 1e5; } Wildlife.update(1 / 30);
      if (i % 60) continue;
      Fs.forEach((F, k) => { const L = F.members[0]; hist[k].push([L.x, L.y, F.mode]); const h = hist[k], n = h.length;
        const moved = n > 1 ? Math.hypot(L.x - h[n - 2][0], L.y - h[n - 2][1]) : 0, six = n > 3 ? Math.hypot(L.x - h[n - 4][0], L.y - h[n - 4][1]) : 99;
        out.push(`f${k} ${String((i / 30) | 0).padStart(3)}s ${F.mode.padEnd(5)} moved ${moved.toFixed(0).padStart(3)} goal ${F.goal ? Math.hypot(F.goal.x - L.x, F.goal.y - L.y).toFixed(0) : '-'} gaps ${F.members.slice(1).map((m, j) => Math.hypot(m.x - F.members[j].x, m.y - F.members[j].y).toFixed(0)).join(',')}${F.mode === 'swim' && six < 20 ? '  ⚠ CIRCLING' : ''}`); }); }
    return out.join('\n'); }, secs));
  await b.close(); })();

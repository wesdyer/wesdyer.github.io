const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Swell && typeof resetGame === 'function');
  console.log(await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' }));
    const run = (kelp) => { VENUE_DOC.otter.swell.kelp = kelp ? { floor: 0.15, reach: 450 } : undefined; resetGame();
      const kelpS = state.course.islands.filter(s => /kelp/.test(s.kind || ''));
      const at = (x, y) => { let m = 0; for (let k = 0; k < 60; k++) { Swell.update(0.5); m = Math.max(m, Math.abs(Swell.surfPushAt(x, y, 1.9))); } return m.toFixed(2); };
      const out = []; for (const id of ['kelp-c2', 'kelp-c3', 'kelp-c4']) { const k = kelpS.find(q => q.id === id);
        out.push(`${id}: in-bed ${at(k.x, k.y)} · inside passage ${at(k.x, k.y + 280)} · outside lane ${at(k.x, k.y - 700)}`); }
      return out.join('\n'); };
    return 'NO KELP DAMPING\n' + run(false) + '\nKELP DAMPING\n' + run(true); })); await b.close(); })();

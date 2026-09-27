const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Tide && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); selectVenue('flats'); resetGame(); startRace();
    for (const o of state.boats) { o.x = 1e6; o.y = 1e6; } const W = Wildlife.debug(), out = {}; state.race.timer = 212; for (let i = 0; i < 30 * 12; i++) update(1 / 30);
    for (let i = 0; i < 30 * 70; i++) { Wildlife.update(1 / 30); update(1 / 30); if (i % 10) continue;
      for (const F of W.spoonFlocks.concat(W.avoFlocks)) if (!F.roosting && F.mode === 'feed') for (const bd of F.birds) if (bd.mode === 'wade' && pointOnLand(bd.x, bd.y)) { const k = F.kind + F.fi + ' swim' + (bd.swim > 0.5 ? 1 : 0) + ' hop' + (bd.hop ? 1 : 0) + ' dCtr' + Math.round(Math.hypot(bd.x - F.cx, bd.y - F.cy)) + ' ctrLand' + (pointOnLand(F.cx, F.cy) ? 1 : 0); out[k] = (out[k] || 0) + 1; } }
    return out; });
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();

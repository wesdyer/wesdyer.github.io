// Probe: Otter Point's great whites over N minutes (boats parked far off, the camera cleared so every shark may hunt).
// Reports, per shark: hunts started (and on what, how far), strikes and the distance from the shark to the sea lion AT
// the strike (a strike far from the shark is the "attacks a seal far from it" bug), and STUCK spells — 5 s in which a
// shark that should be swimming made under 25 u of headway — with where and in what mode.
//   node regatta/eval/_otter_whites.js [minutes]      (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const mins = +(process.argv[2] || 10); const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(1500);
  console.log(await p.evaluate((mins) => { for (const b2 of state.boats) { b2.x = 1e6; b2.y = 1e6; } state.camera = null;
    const D = Wildlife.debug(), W = D.whites, rec = W.map(() => ({ hunts: 0, strikes: [], stuck: [], last: null, prev: null }));
    const swimming = (m) => ['patrol', 'fin', 'stalk', 'chase', 'sprint', 'shadow', 'chaseOtter', 'feed'].includes(m);
    for (let fr = 0; fr < mins * 60 * 30; fr++) {
      const before = W.map(w => ({ mode: w.mode, q: w.target && w.target.q, x: w.x, y: w.y }));
      Wildlife.update(1 / 30);
      W.forEach((w, i) => { const r = rec[i], b0 = before[i];
        if ((w.mode === 'stalk' || w.mode === 'chase') && b0.mode !== w.mode && !(b0.mode === 'stalk' || b0.mode === 'chase')) { r.hunts++; r.huntD = Math.round(Math.hypot(w.target.q.x - w.x, w.target.q.y - w.y)); }
        if ((w.mode === 'strike' || w.mode === 'breach') && b0.mode !== w.mode && b0.q) r.strikes.push(`${b0.mode}->${w.mode} d=${Math.round(Math.hypot(b0.q.x - b0.x, b0.q.y - b0.y))} (hunt began ${r.huntD})`);
        if (fr % 150 === 0) { if (r.prev && swimming(w.mode) && swimming(r.prev.mode) && Math.hypot(w.x - r.prev.x, w.y - r.prev.y) < 25) r.stuck.push(`${(fr / 30) | 0}s ${w.mode} at (${Math.round(w.x)},${Math.round(w.y)})`); r.prev = { x: w.x, y: w.y, mode: w.mode }; } }); }
    return rec.map((r, i) => `shark ${i}: hunts ${r.hunts}; strikes ${r.strikes.length}${r.strikes.length ? ' — ' + r.strikes.join('; ') : ''}\n   stuck spells ${r.stuck.length}${r.stuck.length ? ': ' + r.stuck.slice(0, 8).join(', ') + (r.stuck.length > 8 ? ' …' : '') : ''}`).join('\n'); }, mins));
  await b.close(); })();

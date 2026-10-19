// Film: an Emberfall iguana heap at 3x, one big iguana's whole trip — down to the waterline, out at the surface, the
// dive, grazing on the bottom, home at the surface, out on the rock wet and flat broadside to the sun, then turning to
// point at it — the camera following; land drawn from the venue's own shapes. Sim time runs 2-3x in the long stretches
// (the label says). PNG frames for a GIF.
//   node regatta/eval/_volc_iguana_gif.js outdir
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; } });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { for (let i = 0; i < 30 * 5; i++) Wildlife.update(1 / 30);
    const H = Wildlife.debug().igHeaps, G = H.slice().sort((a, b) => b.members.length - a.members.length)[0];
    const m = G.members.filter(q => q.mode === 'bask' && q.size > 0.95).sort((a, b) => Math.hypot(a.x - G.w.x, a.y - G.w.y) - Math.hypot(b.x - G.w.x, b.y - G.w.y))[0];
    for (const q of G.members) q.t = 1e4; m.warm = 1; m.t = 0; window.__G = G; window.__M = m; window.__cx = m.x; window.__cy = m.y;
    const c = document.createElement('canvas'); c.width = 900; c.height = 700; c.id = 'film'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  for (let fr = 0; fr < 440; fr++) {
    await p.evaluate((fr) => { const G = window.__G, m = window.__M, A = Wildlife.art, c = document.getElementById('film'), g = c.getContext('2d');
      const fast = m.mode === 'swim' || m.mode === 'under' ? 3 : m.mode === 'bask' && m.warm > 0 && m.warm < 0.62 ? 4 : 1;
      if (m.mode === 'bask' && !window.__far) m.t = 0;   // (sent off: it rolls each check until it goes)
      if (m.mode === 'swim' && !m.home && !window.__far) { window.__far = 1; m.tx = m.x + Math.sin(m.h) * 140; m.ty = m.y - Math.cos(m.h) * 140; m.t = 12; }
      if (m.mode === 'bask' && window.__far && !window.__out) { window.__out = 1; m.warm = 0.5; }
      for (let k = 0; k < 2 * fast; k++) Wildlife.update(1 / 30); window.__fast = fast;
      window.__cx += (m.x - window.__cx) * 0.08; window.__cy += (m.y - window.__cy) * 0.08;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#245866'; g.fillRect(0, 0, 900, 700);
      g.setTransform(3, 0, 0, 3, 450 - window.__cx * 3, 350 - window.__cy * 3);
      g.fillStyle = '#2f3034'; for (const s of state.course.islands) if (s.vertices && !s.awash && Math.hypot(s.x - m.x, s.y - m.y) < (s.radius || 0) + 400) { g.beginPath(); s.vertices.forEach((v, i) => i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y)); g.closePath(); g.fill(); }
      for (const q of G.members) if (q.mode === 'swim' || q.mode === 'dive' || q.mode === 'under') A.drawIguana(g, q, false);
      for (const q of G.members) if (q.mode === 'bask' || q.mode === 'walk' || q.mode === 'climb') A.drawIguana(g, q, true);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText('marine iguanas x3 — the followed one: ' + (m.mode === 'swim' ? (m.home ? 'swimming home' : 'swimming out') : m.mode === 'bask' ? (m.up > 0.5 ? 'basking, raised, facing the sun' : 'basking flat, warming') : m.mode === 'climb' ? 'hauling out' : m.mode === 'under' ? 'grazing on the bottom' : m.mode) + (window.__fast > 1 ? '  (' + window.__fast + 'x)' : '') , 14, 24); }, fr);
    await p.screenshot({ path: path.join(out, String(fr).padStart(3, '0') + '.png') }); }
  await b.close(); })();

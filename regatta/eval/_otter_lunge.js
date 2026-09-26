// Probe: a blue whale's lunge in the real game view, frame by frame — it should roll into it
// gradually and be IN the krill swarm (the red patch) when its mouth opens.
//   node regatta/eval/_otter_lunge.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/otter_lunge'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 100));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    window.__park = () => { for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; } }; });
  const found = await p.evaluate(() => { let n = 0, m0 = null; while (n++ < 30 * 900 && !m0) { __park(); Wildlife.update(1 / 30); for (const W of Wildlife.debug().bluePods) for (const m of W.members) if (m.ev === 'lunge') m0 = m; } window.__m = m0; return !!m0; });
  if (!found) { console.log('no lunge in 15 minutes'); await b.close(); return; }
  for (let k = 0; k < 12; k++) {
    const r = await p.evaluate(() => { const m = __m; const K = m.kr; const hx = m.x + Math.sin(m.h) * m.len * 0.45, hy = m.y - Math.cos(m.h) * m.len * 0.45;
      const c = state.camera; c.mode = 'north'; c.x = m.x; c.y = m.y; c.fx = m.x; c.fy = m.y; c.rotation = 0; draw(); draw();
      const o = { t: (m.evT || 0).toFixed(1), roll: (m.roll || 0).toFixed(2), gape: (m.gape || 0).toFixed(2), pouch: (m.pouch || 0).toFixed(2), headToKrill: K ? Math.round(Math.hypot(K.x - hx, K.y - hy)) : null, eat: K ? K.eat.toFixed(2) : null, v: m.v.toFixed(0) };
      for (let i = 0; i < 15; i++) { __park(); Wildlife.update(1 / 30); } return o; });
    await p.screenshot({ path: path.join(out, 'lunge_' + String(k).padStart(2, '0') + '.png') }); console.log(k, JSON.stringify(r));
  }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close(); })();

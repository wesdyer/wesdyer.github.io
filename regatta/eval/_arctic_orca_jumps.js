// Probe: do Glacier Sound's orcas ever JUMP? Runs the sim N game minutes with the pack drifting and flags every frame where a
// member moves further than it can swim (ORCA_KNOTS x 1.4 sprint, plus slack) or its heading turns more than 0.25 rad.
//   node regatta/eval/_arctic_orca_jumps.js [minutes]      (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const MIN = +(process.argv[2] || 10);
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(async (MIN) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0;
    for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; }
    const dt = 1 / 30, maxStep = 50 * 1.4 * dt * 1.6, prev = new Map(), hits = [], worst = { d: 0, a: 0 };
    for (let i = 0; i < MIN * 1800; i++) { Wildlife.update(dt); if (typeof updateIceFloes === 'function') updateIceFloes(dt);
      for (const W of Wildlife.debug().orcaPods) for (const m of W.members) { const q = prev.get(m);
        if (q && i > 30) { const d = Math.hypot(m.x - q.x, m.y - q.y); let a = m.h - q.h; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; a = Math.abs(a);
          worst.d = Math.max(worst.d, d); worst.a = Math.max(worst.a, a);
          if (d > maxStep || a > 0.25) hits.push(`t ${(i * dt).toFixed(1)} pod ${W.i} ${m.kind} moved ${d.toFixed(1)} u turned ${a.toFixed(2)} z ${m.z.toFixed(1)} up ${m.up.toFixed(2)}${m.mom ? ' calf ' + m.pos : ''}`); }
        prev.set(m, { x: m.x, y: m.y, h: m.h }); } }
    return { hits, worst, maxStep };
  }, MIN);
  console.log(`${r.hits.length} jump frames in ${MIN} min (limit ${r.maxStep.toFixed(1)} u/frame, 0.25 rad); worst step ${r.worst.d.toFixed(1)} u, worst turn ${r.worst.a.toFixed(2)} rad`);
  for (const h of r.hits.slice(0, 25)) console.log('  ' + h);
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close();
})();

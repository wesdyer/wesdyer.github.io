// Probe: do Glacier Sound's leopard seals ever JUMP? N game minutes with the pack drifting; flags any frame where a seal
// (in any mode, mode changes included) moves > 5 u or turns > 0.2 rad.   node regatta/eval/_arctic_seal_jumps.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const MIN = +(process.argv[2] || 10);
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(async (MIN) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0;
    for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; }
    const prev = new Map(), hits = [], modes = {}; let worst = 0;
    for (let i = 0; i < MIN * 1800; i++) { Wildlife.update(1 / 30); if (typeof updateIceFloes === 'function') updateIceFloes(1 / 30);
      for (const S of Wildlife.debug().lseals) { const q = prev.get(S); modes[S.mode] = (modes[S.mode] || 0) + 1;
        if (q && i > 30 && S.mode !== 'deep' && q.m !== 'deep') { const d = Math.hypot(S.x - q.x, S.y - q.y); let a = Math.abs(S.h - q.h) % (2 * Math.PI); a = Math.min(a, 2 * Math.PI - a); worst = Math.max(worst, d);
          if (d > 5 || a > 0.2) hits.push(`t ${(i / 30).toFixed(1)} ${q.m}->${S.mode} moved ${d.toFixed(1)} turned ${a.toFixed(2)}`); }
        prev.set(S, { x: S.x, y: S.y, h: S.h, m: S.mode }); } }
    return { hits, worst, modes }; }, MIN);
  console.log(`${r.hits.length} seal jump frames in ${MIN} min; worst step ${r.worst.toFixed(1)} u; mode frames ${JSON.stringify(r.modes)}`);
  for (const h of r.hits.slice(0, 15)) console.log('  ' + h);
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close(); })();

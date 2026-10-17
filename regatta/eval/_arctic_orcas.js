// Probe: Glacier Sound's orca pods against the field numbers (Oct 15 2026). Runs the sim N game minutes and reports,
// in REAL terms (game seconds / 3, scale.md): breaths a minute per kind, time at the surface a breath, dive lengths,
// speed, tail-beat rate, neighbour gaps, the calf's echelon / infant shares; and the draw cost with a pod on camera.
//   node regatta/eval/_arctic_orcas.js [minutes]      (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const MIN = +(process.argv[2] || 6);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(async (MIN) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0;
    for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; }
    const S = {}, k = (m) => m.kind, add = (o, key, v) => { o[key] = (o[key] || 0) + v; };
    const st = new Map(); let gaps = [], echelon = 0, infant = 0, calfN = 0, beatAcc = {}, vAcc = {};
    const dt = 1 / 30, N = MIN * 60 * 30;
    for (let i = 0; i < N; i++) { Wildlife.update(dt);
      for (const W of Wildlife.debug().orcaPods) {
        for (const m of W.members) { const s = st.get(m) || { up: false, rolls: 0, surf: 0, under: 0, dives: [], b0: m.beat }; st.set(m, s);
          const up = m.up >= 0; if (up && !s.up) { s.rolls++; if (s.under > 0) s.dives.push(s.under); s.under = 0; }
          if (up) s.surf += dt; else s.under += dt; s.up = up; s.last = m.beat;
          add(vAcc, k(m), m.v * dt);
          if (m.mom) { calfN++; if (m.inf > 0.5) infant++; else echelon++; } }
        const A = W.members.filter(m => !m.mom);
        if (i % 30 === 0) for (let a = 0; a < A.length; a++) { let best = 1e9; for (let c = 0; c < A.length; c++) if (c !== a) best = Math.min(best, Math.hypot(A[a].x - A[c].x, A[a].y - A[c].y)); gaps.push(best); } } }
    const T = MIN * 60, out = {};
    for (const [m, s] of st) { const o = out[m.kind] || (out[m.kind] = { n: 0, rolls: 0, surf: 0, dives: [], beats: 0 }); o.n++; o.rolls += s.rolls; o.surf += s.surf; o.dives.push(...s.dives); o.beats += (s.last - s.b0) / (2 * Math.PI); }
    const rows = Object.entries(out).map(([kd, o]) => { o.dives.sort((a, b) => a - b); const q = (f) => (o.dives[Math.floor(f * (o.dives.length - 1))] * 3).toFixed(0);
      return `${kd}: ${(o.rolls / o.n / (T * 3 / 60)).toFixed(2)} breaths/min real; ${(o.surf / o.rolls * 3).toFixed(1)} s up a breath; dives real s p10/p50/p90/max ${q(0.1)}/${q(0.5)}/${q(0.9)}/${q(1)}; ` +
        `${(vAcc[kd] / o.n / T / 30).toFixed(2)} m/s; tail ${(o.beats / o.n / (T * 3)).toFixed(2)} Hz real`; });
    gaps.sort((a, b) => a - b);
    // draw cost: follow pod 0 for 10 s of game, timing Wildlife.drawWater each frame, then the same frames' cost with the orcas off camera
    const W = Wildlife.debug().orcaPods[0], c = document.querySelector('canvas'), g = c.getContext('2d'); state.camera.mode = 'north'; state.camera.rotation = 0;
    const variants = { all: () => {}, noOrca: null }; const tm = { all: 0, noBlur: 0, noOrca: 0 }; let worst = 0;
    for (let i = 0; i < 300; i++) { Wildlife.update(dt); state.camera.x = state.camera.fx = W.x; state.camera.y = state.camera.fy = W.y; draw();
      for (const [kv, f] of Object.entries(variants)) { window.__blurMin = 0; let keep = null;
        if (!f) { keep = W.members.map(m => m.x); W.members.forEach(m => { m.x += 1e5; }); } else f();
        const t0 = performance.now(); Wildlife.drawWater(g); const d = performance.now() - t0; tm[kv] += d; if (kv === 'all') worst = Math.max(worst, d);
        if (keep) W.members.forEach((m, j) => { m.x = keep[j]; }); window.__blurMin = 0; } }
    const cost = `Wildlife.drawWater following pod 0 (${W.members.length}): mean ${(tm.all / 300).toFixed(2)} ms (worst ${worst.toFixed(1)}), without the orcas ${(tm.noOrca / 300).toFixed(2)}`;
    return { rows, gaps: `nearest-neighbour centre distance (adults) p10/p50/p90 ${(gaps[Math.floor(gaps.length * 0.1)] / 10).toFixed(1)}/${(gaps[Math.floor(gaps.length * 0.5)] / 10).toFixed(1)}/${(gaps[Math.floor(gaps.length * 0.9)] / 10).toFixed(1)} m`,
      calf: `calf: echelon ${(100 * echelon / calfN).toFixed(0)}%, infant ${(100 * infant / calfN).toFixed(0)}%`, cost };
  }, MIN);
  console.log(r.rows.join('\n')); console.log(r.gaps); console.log(r.calf); console.log(r.cost);
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close();
})();

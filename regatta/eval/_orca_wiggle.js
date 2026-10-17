// Probe: do the orcas WIGGLE? An orca's stroke is vertical; it should bend sideways only in a real turn. Counts, per kind,
// how often the drawn bend (from m.turn) flips side per second, and its typical size. N game minutes.
//   node regatta/eval/_orca_wiggle.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const MIN = +(process.argv[2] || 3); const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(async (MIN) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame(); startRace(); await new Promise(r => setTimeout(r, 600));
    window.requestAnimationFrame = () => 0; for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; }
    const st = new Map(), out = {}, hs = new Map(), raw = {};
    for (let i = 0; i < MIN * 1800; i++) { Wildlife.update(1 / 30); if (typeof updateIceFloes === 'function') updateIceFloes(1 / 30);
      for (const W of Wildlife.debug().orcaPods) for (const m of W.members) { const bend = Math.max(-1, Math.min(1, (m.turn || 0) * 3)) * 0.06, s = st.get(m) || { flips: 0, sum: 0, n: 0, last: 0 };
        const sg = Math.abs(bend) > 0.006 ? Math.sign(bend) : 0; if (sg && s.last && sg !== s.last) s.flips++; if (sg) s.last = sg; s.sum += Math.abs(bend); s.n++; st.set(m, s);
        const q = hs.get(m); if (q) { let d = m.h - q.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const sgn = Math.abs(d) > 0.002 ? Math.sign(d) : 0;
          const R = raw[m.kind] || (raw[m.kind] = { flips: 0, n: 0, big: 0 }); if (sgn && q.s && sgn !== q.s) R.flips++; if (Math.abs(d) > 0.02) R.big++; R.n++; hs.set(m, { h: m.h, s: sgn || q.s }); } else hs.set(m, { h: m.h, s: 0 }); } }
    for (const [m, s] of st) { const o = out[m.kind] || (out[m.kind] = { flips: 0, sum: 0, n: 0, k: 0 }); o.flips += s.flips; o.sum += s.sum; o.n += s.n; o.k++; }
    const rr = Object.entries(raw).map(([k, R]) => `${k}: RAW heading reverses ${(R.flips / R.n * 30).toFixed(2)} times/s per whale; frames turning >0.02 rad: ${(100 * R.big / R.n).toFixed(1)}%`);
    return rr.concat(Object.entries(out).map(([k, o]) => `${k}: bend flips side ${(o.flips / o.k / (MIN * 60)).toFixed(2)}/s (game), mean |bend| ${(o.sum / o.n).toFixed(3)} of L`)); }, MIN);
  console.log(r.join('\n')); await b.close(); })();

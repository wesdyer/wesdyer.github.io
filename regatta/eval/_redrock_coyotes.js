// Probe: Redrock's coyotes (Oct 17 2026) — time in each mode, measured speed per gait (knots on the game's clock, 15 u/s
// a knot), strides a second, pounces and drinks, frames off land; then a boat run in at one: the lope, how far, and the
// stop to look back.   node regatta/eval/_redrock_coyotes.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
const MIN = +(process.argv[2] || 10);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate((MIN) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); const d = Wildlife.debug(); for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
    const dt = 1 / 30, modes = {}, sp = { walk: [], trot: [], lope: [] }, ev = { pounce: 0, drink: 0, sit: 0 }; let wet = 0;
    for (let i = 0; i < MIN * 60 * 30; i++) {
      const prev = d.coyotes.map(K => ({ x: K.x, y: K.y, m: K.mode }));
      Wildlife.update(dt);
      d.coyotes.forEach((K, k) => { modes[K.mode] = (modes[K.mode] || 0) + dt; const q = prev[k];
        if (sp[K.mode] && q.m === K.mode) sp[K.mode].push(Math.hypot(K.x - q.x, K.y - q.y) / dt);
        if (K.mode !== q.m && ev[K.mode] !== undefined) ev[K.mode]++;
        if (!pointOnLand(K.x, K.y)) wet++; });
    }
    const med = (a) => { const s = a.filter(v => v > 1).sort((x, y) => x - y); return s.length ? +(s[s.length >> 1] / 15).toFixed(1) : null; };
    // a boat runs in at coyote 0
    const K = d.coyotes[0], me = state.boats[0]; K.mode = 'stand'; K.t = 5;
    me.x = K.x + 100; me.y = K.y; const x0 = K.x, y0 = K.y, trace = [];
    for (let i = 0; i < 30 * 8; i++) { Wildlife.update(dt); me.x = x0 + 100; me.y = y0; if (i % 15 === 0) trace.push(`${K.mode}${Math.round(Math.hypot(K.x - x0, K.y - y0))}${Math.abs(K.look) > 0.3 ? '*' : ''}`); }
    return { modes: Object.fromEntries(Object.entries(modes).map(([k, v]) => [k, Math.round(v)])), kn: { walk: med(sp.walk), trot: med(sp.trot), lope: med(sp.lope) }, events: ev, framesOffLand: wet, flush: trace.join(' ') };
  }, MIN);
  console.log(JSON.stringify(r, null, 1)); console.log('strides/s (game): walk 1.75, trot 3.0, lope 4.2 (COY_GAIT); * = head turned to the boat'); await b.close();
})();

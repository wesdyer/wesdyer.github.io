// Probe: Redrock's condors in flight (Oct 17 2026) — lap times, bank, airspeed, time in each mode, height band, the
// glide out and back, thermals found out over the course. Real terms: game s x3 (the game's clock), a knot = 15 u/s.
//   node regatta/eval/_redrock_condors.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
const MIN = +(process.argv[2] || 10);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate((MIN) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); const d = Wildlife.debug(); for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
    const dt = 1 / 30, st = d.condors.map(() => ({ modes: {}, laps: [], turn: 0, lapT: 0, bankMax: 0, bankSum: 0, n: 0, speed: [], zmin: 1e9, zmax: -1e9, glides: 0, thermals: 0, maxRoost: 0 }));
    const [rx, ry] = Wildlife.WILDLIFE.redrock.condors.roost;
    for (let i = 0; i < MIN * 60 * 30; i++) {
      const prev = d.condors.map(C => ({ x: C.x, y: C.y, h: C.h, m: C.mode }));
      Wildlife.update(dt);
      d.condors.forEach((C, k) => { const s = st[k], q = prev[k];
        s.modes[C.mode] = (s.modes[C.mode] || 0) + dt;
        if (C.mode !== q.m && C.mode === 'glide' && q.m === 'circle') s.glides++;
        if (C.mode !== q.m && C.mode === 'thermal') s.thermals++;
        s.speed.push(Math.hypot(C.x - q.x, C.y - q.y) / dt);
        s.zmin = Math.min(s.zmin, C.z); s.zmax = Math.max(s.zmax, C.z);
        s.bankMax = Math.max(s.bankMax, Math.abs(C.bank)); s.bankSum += Math.abs(C.bank); s.n++;
        if (C.mode === 'circle') { s.maxRoost = Math.max(s.maxRoost, Math.hypot(C.x - rx, C.y - ry));
          let dh = C.h - q.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
          s.turn += Math.abs(dh); s.lapT += dt; if (s.turn >= 2 * Math.PI) { s.laps.push(s.lapT); s.turn -= 2 * Math.PI; s.lapT = 0; } }
        else { s.turn = 0; s.lapT = 0; } });
    }
    return st.map(s => { const sp = s.speed.slice().sort((a, b) => a - b), med = sp[sp.length >> 1], L = s.laps.slice().sort((a, b) => a - b);
      return { modes: Object.fromEntries(Object.entries(s.modes).map(([k, v]) => [k, Math.round(v)])), lapMedS: L.length ? +L[L.length >> 1].toFixed(1) : null, lapRange: L.length ? [+L[0].toFixed(1), +L[L.length - 1].toFixed(1)] : null,
        bankMaxDeg: Math.round(s.bankMax * 50), bankMeanDeg: Math.round(s.bankSum / s.n * 50), speedMedKn: +(med / 15).toFixed(1), z: [Math.round(s.zmin), Math.round(s.zmax)], glidesOut: s.glides, thermalsAway: s.thermals, maxFromRoostCircling: Math.round(s.maxRoost) }; });
  }, MIN);
  r.forEach((s, i) => console.log('condor ' + i, JSON.stringify(s)));
  console.log('(lap seconds are GAME seconds; x3 for real)'); await b.close();
})();

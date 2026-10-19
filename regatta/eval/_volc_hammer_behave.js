// Probe: Emberfall's hammerhead schools over N minutes, no boats near — the corkscrew displays (how often, the loop's
// radius and duration, the roll), the head shakes round them, the tail beat (Hz) and speed through the water while
// holding and in the burst, and how often two sharks in a school lie within half a length at the same depth.
//   node regatta/eval/_volc_hammer_behave.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
const MIN = +(process.argv[2] || 5);
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  console.log(await p.evaluate((MIN) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame();
    for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const D = Wildlife.debug(), Sc = D.hammerSchools, dt = 1 / 30; let screws = 0, shakes = 0, close = 0, pairs = 0; const loops = [], hz = { hold: [], screw: [] };
    const prev = new Map();
    for (let i = 0; i < 30 * 60 * MIN; i++) {
      for (const S of Sc) for (const f of S.fish) prev.set(f, { m: f.mode, ph: f.ph, x: f.x, y: f.y, sh: f.shake });
      Wildlife.update(dt);
      for (const S of Sc) { for (const f of S.fish) { const q = prev.get(f);
          if (f.mode === 'screw' && q.m !== 'screw') { screws++; f._lp = { x: f.x, y: f.y, t: 0, mx: 0 }; }
          if (f.mode === 'screw') { f._lp.t += dt; f._lp.mx = Math.max(f._lp.mx, Math.hypot(f.x - f._lp.x, f.y - f._lp.y)); }
          if (q.m === 'screw' && f.mode !== 'screw') loops.push(f._lp.t.toFixed(1) + 's diam' + f._lp.mx.toFixed(0) + ' back' + Math.hypot(f.x - f._lp.x, f.y - f._lp.y).toFixed(0));
          if (f.shake > 0 && !(q.sh > 0)) shakes++;
          if (i % 30 === 0) (f.mode === 'screw' ? hz.screw : f.mode === 'hold' ? hz.hold : []).push((f.ph - q.ph) / dt / 6.283); }
        if (i % 30 === 0) for (let a = 0; a < S.fish.length; a++) for (let c = a + 1; c < S.fish.length; c++) { const A = S.fish[a], B = S.fish[c]; pairs++;
          if (Math.hypot(A.x - B.x, A.y - B.y) < 35 && Math.abs(A.depth - B.depth) < 0.12) close++; } } }
    const med = (a) => a.length ? a.sort((x, y) => x - y)[a.length >> 1].toFixed(2) : '-';
    return `${Sc.length} schools, ${MIN} min: corkscrews ${screws} (${(screws / Sc.length / MIN).toFixed(1)}/school/min), head shakes ${shakes}\n loops: ${loops.slice(0, 8).join('; ')}\n tail beat Hz median: hold ${med(hz.hold)}, burst ${med(hz.screw)}\n pairs within half a length at the same depth: ${(100 * close / pairs).toFixed(2)}%`; }, MIN));
  await b.close(); })();

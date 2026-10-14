// PT-077: follow the first orca member stuck 10 s (seed arg), log it every 2 s and shoot the scene.
//   OUT=dir node eval/rl/_pt077_orca.js [seed]
const { chromium } = require('playwright'); const path = require('path');
const SEED = +(process.argv[2] || 1), OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate((SEED) => { let s = SEED;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('arctic'); resetGame(); startRace();
    window.__park = () => { for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; bt.speed = 0; } };
    const hist = new Map(); let target = null; const log = [];
    for (let sec = 0; sec < 600 && !target; sec++) { for (let i = 0; i < 30; i++) { __park(); update(1 / 30); }
      for (const W of Wildlife.debug().orcaPods) for (const m of W.members) { const h = hist.get(m) || []; h.push([m.x, m.y]); if (h.length > 11) h.shift(); hist.set(m, h);
        if (h.length === 11 && Math.hypot(m.x - h[0][0], m.y - h[0][1]) < 25) { target = { W, m, sec }; break; } } }
    if (!target) return { none: true };
    const { W, m } = target; window.__M = m; window.__W = W;
    for (let k = 0; k < 6; k++) { for (let i = 0; i < 60; i++) { __park(); update(1 / 30); }
      const fx = Math.sin(W.h), fy = -Math.cos(W.h), rx = -fy, ry = fx, tx2 = W.x + rx * m.sd * 46 - fx * m.back, ty2 = W.y + ry * m.sd * 46 - fy * m.back;
      log.push(`t${target.sec + 2 * (k + 1)} m ${Math.round(m.x)},${Math.round(m.y)} h${m.h.toFixed(2)} up${(m.up || 0).toFixed(2)} hold ${!!m.hold} | pod ${Math.round(W.x)},${Math.round(W.y)} wi${W.wi} | slot d ${Math.round(Math.hypot(tx2 - m.x, ty2 - m.y))} | follow ${(m._follow || 0).toFixed(1)} side ${m._side || 0} | crumbs ${W.crumbs ? W.crumbs.length : 0}`); }
    return { pod: W.cfg.id, kind: m.kind, log };
  }, SEED);
  console.log(JSON.stringify(r, null, 1));
  if (!r.none) {
    await p.evaluate(() => { const m = __M; state.camera.target = 'probe'; state.camera.mode = 'north'; state.camera.x = m.x; state.camera.y = m.y; state.camera.rotation = 0; draw(); });
    await p.waitForTimeout(100); await p.screenshot({ path: `${OUT}/pt077_orca_${SEED}.png` });
  }
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();

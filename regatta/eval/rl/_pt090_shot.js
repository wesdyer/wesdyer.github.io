// PT-090 proof: the first MASS HOP — a feeding Flats flock with 60% of its birds leaving the water within
// 0.3 s (no boat near: the tide) — or, with AT=i,fi, that flock at that frame, frames every 0.2 s from just before to 2.6 s after, camera on the flock.
//   ROOT=<checkout's regatta dir> OUT=dir TAG=x node eval/rl/_pt090_shot.js
const { chromium } = require('playwright'); const path = require('path');
const AT = process.env.AT ? process.env.AT.split(',').map(Number) : null, OUT = process.env.OUT, TAG = process.env.TAG || 'after', ROOT = process.env.ROOT || path.resolve('.');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 700, height: 520 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const found = await p.evaluate((AT) => { let s = 3;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('flats'); resetGame(); startRace();
    window.__park = () => { for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; bt.speed = 0; } };
    const fl = () => [...Wildlife.debug().spoonFlocks, ...Wildlife.debug().avoFlocks];
    if (AT) { for (let i = 0; i < AT[0]; i++) { __park(); update(1 / 30); } const F = fl()[AT[1]]; return { i: AT[0], fi: AT[1], kind: F.kind, n: F.birds.length }; }
    const hist = new Map();
    for (let i = 0; i < 240 * 30; i++) { __park(); update(1 / 30);
      for (const [fi, F] of fl().entries()) { const up = F.birds.filter(b => b.mode !== 'wade').length, h = hist.get(fi) || []; h.push(up); if (h.length > 15) h.shift(); hist.set(fi, h);
        if (i > 300 && F.mode === 'feed' && h[h.length - 10] === 0 && up >= F.birds.length * 0.6) { window.__F = F; return { i, fi, kind: F.kind, n: F.birds.length }; } } }
    return null; }, AT);
  console.log(TAG, 'event', JSON.stringify(found));
  if (found) {
    // back up: replay to 0.6 s before the event
    await p.evaluate((found) => { let s = 3;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      selectVenue('flats'); resetGame(); startRace();
      for (let i = 0; i < found.i - 18; i++) { __park(); update(1 / 30); }
      window.__F = [...Wildlife.debug().spoonFlocks, ...Wildlife.debug().avoFlocks][found.fi]; }, found);
    for (let k = 0; k < 16; k++) {
      await p.evaluate(() => { for (let i = 0; i < 6; i++) { __park(); update(1 / 30); } const F = __F;
        state.camera.target = 'probe'; state.camera.mode = 'north'; state.camera.x = F.cx; state.camera.y = F.cy; state.camera.rotation = 0; draw(); });
      await p.waitForTimeout(60);
      await p.screenshot({ path: `${OUT}/pt090_${TAG}_${String(k).padStart(2, '0')}.png`, clip: { x: 200, y: 140, width: 300, height: 240 } });
    }
  }
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();

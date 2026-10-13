// PT-083 probe: each Otter sea-lion haul-out at race zoom after SECS of sim (no boat near).
// COLL=1 strokes the rock's collider (yellow) over the render.
//   OUT=dir [SECS=90] [TAG=a] [COLL=1] node eval/rl/_pt083_shot.js   (from regatta/)
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT, SECS = +(process.env.SECS || 90), TAG = process.env.TAG || 'a', COLL = !!process.env.COLL;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const ids = await p.evaluate((SECS) => { let s = 7;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('otter'); resetGame(); startRace();
    const park = () => { for (const bt of state.boats) { bt.x = 30000; bt.y = 30000; bt.speed = 0; } };
    for (let i = 0; i < SECS * 30; i++) { park(); update(1 / 30); }
    return Wildlife.debug().slHauls.map(H => H.id);
  }, SECS);
  for (const id of ids) {
    const info = await p.evaluate(({ id, COLL }) => {
      const H = Wildlife.debug().slHauls.find(q => q.id === id);
      state.camera.target = 'probe'; state.camera.mode = 'north'; state.camera.x = H.C.x; state.camera.y = H.C.y; state.camera.rotation = 0;
      window.__probeH = H;
      if (COLL && !Wildlife.__dp) { const dp = Wildlife.__dp = Wildlife.drawPerched; Wildlife.drawPerched = (c) => { dp(c); const V = window.__probeH.V; c.save(); c.strokeStyle = 'yellow'; c.lineWidth = 1.2; c.beginPath(); V.forEach((v, i) => i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)); c.closePath(); c.stroke(); c.restore(); }; }
      draw();
      const m = {}; for (const q of H.members) m[q.mode] = (m[q.mode] || 0) + 1; return JSON.stringify(m);
    }, { id, COLL });
    await p.waitForTimeout(150); console.log(id, info);
    await p.screenshot({ path: `${OUT}/${TAG}_${id}.png` });
  }
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();

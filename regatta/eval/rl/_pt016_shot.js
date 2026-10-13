// PT-016: the Cove's bow-riding porpoises at race zoom, with the player's boat parked alongside for scale.
//   OUT=dir node eval/rl/_pt016_shot.js
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { let s = 5;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('bay'); resetGame(); startRace(); });
  for (let k = 0; k < 3; k++) {
    await p.evaluate((k) => {
      const me = state.boats[0];
      for (let i = 0; i < 30 * (40 + k * 7); i++) { for (const bt of state.boats) { bt.x = 30000; bt.y = 30000; bt.speed = 0; } update(1 / 30);
        const P = Wildlife.debug().pods.find(q => q.members.filter(m => m.phase > 0.3 && m.phase < 0.6).length >= 2); if (P && i > 30 * 40) break; }
      const P = Wildlife.debug().pods[0], S = P.ship, fx = Math.sin(S.heading), fy = -Math.cos(S.heading), bx = S.x + fx * (S.hullLen / 2 + 40), by = S.y + fy * (S.hullLen / 2 + 40);
      me.x = bx - fy * 130; me.y = by + fx * 130; me.heading = S.heading; me.speed = 0;
      state.camera.target = 'probe'; state.camera.mode = 'north'; state.camera.x = bx - fy * 60; state.camera.y = by + fx * 60; state.camera.rotation = 0; draw();
    }, k);
    await p.waitForTimeout(120);
    await p.screenshot({ path: `${OUT}/pt016_${k}.png`, clip: { x: 200, y: 150, width: 500, height: 400 } });
  }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close(); })();

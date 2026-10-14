// PT-084: the new kelp fields at race zoom — the north-coast chain and the beat slalom.
//   OUT=dir node eval/rl/_pt084_shot.js
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('otter'); resetGame(); startRace(); for (let i = 0; i < 60; i++) update(1 / 30); });
  for (const [tag, x, y] of [['north-a', 750, -6300], ['north-b', 2850, -6700], ['beat', -3500, -1750]]) {
    await p.evaluate(({ x, y }) => { for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; } const me = state.boats[0]; me.x = x; me.y = y + 250; me.heading = Math.PI / 2;
      state.camera.target = 'probe'; state.camera.mode = 'north'; state.camera.x = x; state.camera.y = y; state.camera.rotation = 0; draw(); }, { x, y });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/pt084_${tag}.png` });
  }
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();

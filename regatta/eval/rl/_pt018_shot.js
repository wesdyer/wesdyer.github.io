// PT-018: your boat (and a rival) under the Cove's suspension-bridge deck and under Otter's centre
// arch — the TWA pill and the name tag should go under the span with the hull.
//   ROOT=<checkout's regatta dir> OUT=dir TAG=x node eval/rl/_pt018_shot.js
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT, TAG = process.env.TAG || 'after', ROOT = process.env.ROOT || path.resolve('.');
const scenes = [
  { name: 'cove-bridge', venue: 'bay', x: 2313, y: 2985, rival: [2240, 2970], h: 0 },
  { name: 'cove-bridge-edge', venue: 'bay', x: 2313, y: 3040, rival: [2400, 3030], h: 0 },
  { name: 'otter-arch', venue: 'otter', x: -1855, y: -4890, rival: [-1855, -4830], h: 0.3 },
];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof resetGame === 'function');
  for (const sc of scenes) {
    await p.evaluate((sc) => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: sc.venue, soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      selectVenue(sc.venue); resetGame(); startRace(); for (let i = 0; i < 40; i++) update(1 / 30);
      const me = state.boats[0], rv = state.boats[1];
      for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
      me.x = sc.x; me.y = sc.y; me.heading = sc.h; me.speed = 2;
      rv.x = sc.rival[0]; rv.y = sc.rival[1]; rv.heading = sc.h;
      window.__sc = sc;
    }, sc);
    for (let k = 0; k < 3; k++) await p.evaluate(() => { const me = state.boats[0], sc = __sc; me.x = sc.x; me.y = sc.y; state.boats[1].x = sc.rival[0]; state.boats[1].y = sc.rival[1];
      state.camera.target = 'probe'; state.camera.mode = 'north'; state.camera.x = sc.x; state.camera.y = sc.y + 60; state.camera.rotation = 0; draw(); });
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${OUT}/pt018_${TAG}_${sc.name}.png`, clip: { x: 250, y: 180, width: 400, height: 340 } });
  }
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();

// The Spindrift 18's bowsprit and tiller in the race view: jib up and kite up, close in (4x) and at race zoom,
// then the tiller held hard over each way.
//   ROOT=<checkout's regatta dir> OUT=dir TAG=x node eval/rl/_bowsprit_shot.js
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT, TAG = process.env.TAG || 'after', ROOT = process.env.ROOT || path.resolve('.');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 500 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function' && typeof drawBoat === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('lake'); resetGame(); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const host = document.createElement('div'); host.id = 'bs-host'; host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#111;padding:4px;display:flex;gap:6px'; document.body.appendChild(host); });
  for (const [name, prog, ang, zoom, til] of [['jib', 0, 0.35, 4, 0], ['kite', 1, -0.9, 4, 0], ['kite-race', 1, -0.9, 1, 0], ['helm-port', 0, 0.35, 4, 0.55], ['helm-stbd', 0, 0.35, 4, -0.55]]) {
    await p.evaluate(({ prog, ang, zoom, til }) => {
      const bt = state.boats[1]; const c = document.createElement('canvas'); c.width = 260; c.height = 260; c.style.width = '260px'; c.style.height = '260px'; const g = c.getContext('2d');
      g.fillStyle = '#1d6d8c'; g.fillRect(0, 0, 260, 260); g.translate(130, zoom > 1 ? 150 : 140); g.scale(zoom > 1 ? 3.4 : zoom, zoom > 1 ? 3.4 : zoom);
      bt.spinnakerDeployProgress = prog; bt.sailAngle = ang; bt.boomSide = ang > 0 ? -1 : 1; bt.luffIntensity = 0; bt.kiteLuff = 0; bt.opacity = 1;
      bt._tiller = til; bt._tillerH = bt.heading; bt._tillerT = performance.now() / 1000 + 1;   // hold the helm for the shot
      drawBoat(g, bt); document.getElementById('bs-host').appendChild(c);
    }, { prog, ang, zoom, til });
  }
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/bowsprit_${TAG}.png`, clip: { x: 0, y: 0, width: 1350, height: 270 } });
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();

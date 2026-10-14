// The Spindrift 18's rig in the race view: main over its boom, jib, kite, mast, tiller — close-hauled to a run on
// both sides, a luff, mid-tack, and race zoom.   ROOT=<regatta dir> OUT=dir TAG=x [SHOTS=json PANEL=w,h] node eval/rl/_sails_shot.js
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT, TAG = process.env.TAG || 'sails', ROOT = process.env.ROOT || path.resolve('.');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1700, height: 700 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function' && typeof drawBoat === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('lake'); resetGame(); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const host = document.createElement('div'); host.id = 'bs-host'; host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#111;padding:4px;display:flex;flex-wrap:wrap;gap:6px;width:1690px'; document.body.appendChild(host); });
  // SHOTS='[[name, kiteProgress, sailAngle, boomSide, luff, zoom, heel], ...]'  PANEL='w,h'   (heel: boat.heel, 1 = pressed)
  const shots = process.env.SHOTS ? JSON.parse(process.env.SHOTS) : [
    // sheets are the sim's: (AWA - 25°) x 2/3 — close-hauled AWA 27°, close reach 50°, beam 85°, broad 130°, run 170°
    ['close-hauled stbd', 0, 0.023, 1, 0, 3.4, 1.0], ['close-hauled port', 0, -0.023, -1, 0, 3.4, 1.0], ['close reach', 0, 0.29, 1, 0, 3.4, 1.0],
    ['beam reach', 0, 0.70, 1, 0, 3.4, 0.9], ['broad reach', 0, 1.22, 1, 0, 3.4, 0.4], ['run', 0, 1.57, 1, 0, 3.4, 0.2],
    ['luffing', 0, 0.1, 1, 0.8, 3.4, 0.4], ['mid-tack', 0, 0.005, 0.1, 0, 3.4, 0.5], ['kite', 1, -0.9, -1, 0, 3.4, 0.6],
    ['race close-hauled', 0, 0.023, 1, 0, 1, 1.0], ['race beam', 0, 0.70, 1, 0, 1, 0.9], ['race kite', 1, -0.9, -1, 0, 1, 0.6],
  ];
  const [PW, PH] = (process.env.PANEL || '260,300').split(',').map(Number);
  for (const [name, prog, ang, side, luff, zoom, heel] of shots) {
    await p.evaluate(({ name, prog, ang, side, luff, zoom, heel, PW, PH }) => {
      const bt = state.boats[1]; const c = document.createElement('canvas'); c.width = PW; c.height = PH; c.style.width = PW + 'px'; c.style.height = PH + 'px'; const g = c.getContext('2d');
      g.fillStyle = '#1d6d8c'; g.fillRect(0, 0, PW, PH); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(name, 6, 14);
      g.translate(PW / 2, zoom > 1 ? PH * 0.4 : PH / 2); g.scale(zoom, zoom);
      bt.colors = Object.assign({}, bt.colors, { hull: '#2f6fd6', sail: '#ffffff', cockpit: '#d7dbe0', spinnaker: '#f5c518' }); bt.spinnakerDeployProgress = prog; bt.sailAngle = ang; bt.boomSide = side; bt.luffIntensity = luff; bt.kiteLuff = 0; bt.opacity = 1; bt.heel = heel || 0;
      drawBoat(g, bt); document.getElementById('bs-host').appendChild(c);
    }, { name, prog, ang, side, luff, zoom, heel, PW, PH });
  }
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/sails_${TAG}.png`, clip: { x: 0, y: 0, width: 1700, height: Math.min(700, (PH + 6) * Math.ceil(shots.length / Math.floor(1690 / (PW + 6))) + 8) } });
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();

// Filmstrips of the researched humpback (Oct 19 2026): row 1 one fluke stroke (no side-to-side wag, flippers held);
// row 2 a hard right turn (outer flipper reaching, inner swept back) and a lunge's flipper beat; row 3 the blow over
// 3.5 s (adult) and a calf's; row 4 a head lunge and a fluke-up vs fluke-down dive.   node regatta/eval/_ocean_hump_moves.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1200 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
    const g = document.createElement('canvas').getContext('2d'); for (const calf of [false, true]) Wildlife.art.drawWhale(g, { j: 0, calf, len: 50, x: 0, y: 0, h: 0, mode: 'surface', depth: 0, ph: 0 }); });
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1600; c.height = 1200; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1e5fa6'; g.fillRect(0, 0, 1600, 1200); state.wind = { direction: Math.PI / 2, speed: 5 };
    const W = (o) => Object.assign({ j: 0, calf: false, len: 132, x: 0, y: 0, h: 0, mode: 'under', depth: 0.15, fluke: 0, roll: 0, fin: 0, lift: 0, slick: 0, sd: 1, ev: null, ph: 0, st: 0, turn: 0, evT: 0 }, o);
    const lab = (t, x, y) => { g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(t, x, y); };
    const at = (x, y, s, f) => { g.save(); g.translate(x, y); g.scale(s, s); f(); g.restore(); };
    for (let i = 0; i < 6; i++) { at(130 + i * 250, 150, 1.4, () => A.drawWhale(g, W({ st: i / 6 * Math.PI * 2 }))); lab('stroke ' + i + '/6', 100 + i * 250, 290); }
    at(150, 440, 1.4, () => A.drawWhale(g, W({ turn: 0.33 }))); lab('turning right', 110, 580);
    at(400, 440, 1.4, () => A.drawWhale(g, W({ turn: -0.33 }))); lab('turning left', 360, 580);
    for (let i = 0; i < 3; i++) { at(680 + i * 250, 440, 1.4, () => A.drawWhale(g, W({ mode: 'surface', ev: 'feed', evT: 0.3 + i * 0.4, lift: 0 }))); lab('lunge flipper beat ' + i, 630 + i * 250, 580); }
    for (let i = 0; i < 6; i++) { const t = [0.1, 0.25, 0.6, 1.2, 2, 3][i]; at(130 + i * 250, 720, 1.4, () => { A.drawWhale(g, W({ mode: 'surface', rollT: t, depth: 0 })); A.drawBlow(g, { x: 0, y: -132 * 0.27, t, size: 1, seed: 1, vx: 0, vy: -55 }); }); lab('blow t=' + t + 's', 100 + i * 250, 860); }
    at(130, 1030, 1.4, () => A.drawWhale(g, W({ mode: 'surface', ev: 'headlunge', lift: 0.35, depth: 0 }))); lab('head lunge', 100, 1170);
    at(380, 1030, 1.4, () => A.drawWhale(g, W({ mode: 'dive', t: 1.6, fluke: 1, depth: 0 }))); lab('dive, fluke-up', 340, 1170);
    at(630, 1030, 1.4, () => A.drawWhale(g, W({ mode: 'dive', t: 1.6, fluke: 0, depth: 0 }))); lab('dive, fluke-down', 590, 1170);
    for (let i = 0; i < 3; i++) { const t = [0.2, 0.8, 2][i]; at(900 + i * 230, 1030, 2.4, () => { A.drawWhale(g, W({ calf: true, len: 48, mode: 'surface', rollT: t, depth: 0 })); A.drawBlow(g, { x: 0, y: -48 * 0.27, t, size: 0.55, seed: 2 }); }); lab('calf blow t=' + t, 860 + i * 230, 1170); }
  });
  await p.screenshot({ path: process.argv[2] }); await b.close();
})();

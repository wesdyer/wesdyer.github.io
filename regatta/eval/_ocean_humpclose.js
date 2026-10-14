// close-up of the sprite humpback poses at 4x: shallow / surface / bent hard / breach, plus the calf
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
    const g = document.createElement('canvas').getContext('2d'); for (const calf of [false, true]) Wildlife.art.drawWhale(g, { j: 0, calf, len: 50, x: 0, y: 0, h: 0, mode: 'surface', depth: 0, ph: 0 }); });
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1600; c.height = 900; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1e5fa6'; g.fillRect(0, 0, 1600, 900);
    const W = (o) => Object.assign({ j: 0, calf: false, len: 132, x: 0, y: 0, h: 0, mode: 'surface', depth: 0, fluke: 0, roll: 0, fin: 0, lift: 0, slick: 0, sd: 1, ev: null, ph: 0, turn: 0 }, o);
    const shots = [W({ mode: 'under', depth: 0.3 }), W({ mode: 'surface', rollT: 1.4 }), W({ mode: 'under', depth: 0.1, turn: 0.33, ph: 0.4 }), W({ ev: 'breach', lift: 1, roll: 0 }), W({ calf: true, len: 48, mode: 'under', depth: 0.2 })];
    shots.forEach((m, i) => { g.save(); g.translate(170 + i * 315, 430); g.scale(i === 4 ? 6 : 2.6, i === 4 ? 6 : 2.6); A.drawWhale(g, m); g.restore(); });
  });
  await p.screenshot({ path: process.argv[2] }); await b.close();
})();

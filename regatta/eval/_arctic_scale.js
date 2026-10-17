const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2];
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 560 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
    const A = Wildlife.art, cam = state.camera; state.camera = null;
    const orca = (k) => ({ kind: k, x: 0, y: 0, h: 0, z: 0, up: -1, beat: 1.6, blow: 0, turn: 0, trail: [], j: 0 });
    for (const k of ['orca', 'orca-b', 'orca-calf']) A.drawOrca(document.createElement('canvas').getContext('2d'), orca(k));
    for (const k of ['penguin-emperor', 'penguin-adelie', 'penguin-gentoo', 'seal']) A.arcticImg(k);
    await new Promise(r => setTimeout(r, 1200));
    const c = document.createElement('canvas'); c.width = 1000; c.height = 560; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1d3a5f'; g.fillRect(0, 0, 1000, 560);
    const hull = () => { g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); };
    const items = [['boat 5.5 m', hull], ['orca bull 7.6 m', () => A.drawOrca(g, orca('orca'))], ['orca cow 6 m', () => A.drawOrca(g, orca('orca-b'))], ['orca calf 3.2 m', () => A.drawOrca(g, orca('orca-calf'))],
      ['leopard seal 3.2 m', () => A.drawLeopardSeal(g, { mode: 'haul', x: 0, y: 0, h: 0, plop: 0, lx: 0, ly: 0 })], ['emperor 1.15 m', () => A.drawArcticSprite(g, 'emperor', 0, 0, 0, 1)],
      ['gentoo 0.8 m', () => A.drawArcticSprite(g, 'gentoo', 0, 0, 0, 1)], ['adélie 0.7 m', () => A.drawArcticSprite(g, 'adelie', 0, 0, 0, 1)]];
    g.font = '11px sans-serif';
    items.forEach(([n, fn], i) => { g.save(); g.translate(40 + i * 46, 80); fn(); g.restore(); });
    g.fillStyle = '#fff'; g.fillText('game scale (1 unit = 1 px)', 20, 20);
    items.forEach(([n, fn], i) => { const x = 70 + i * 122; g.save(); g.translate(x, 330); g.scale(2.5, 2.5); fn(); g.restore(); g.fillStyle = '#fff'; g.fillText(n, x - 45, 450 + (i % 2) * 14); });
    g.fillText('x2.5', 20, 180); state.camera = cam;
  });
  await p.screenshot({ path: out }); await b.close();
})();

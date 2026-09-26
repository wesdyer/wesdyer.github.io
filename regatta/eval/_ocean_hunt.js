// Probe: a mahi-mahi hunt watched — the live objects stepped, drawn by the real Wildlife.draw*
// onto an overlay centred on a hunting patch (no camera), frames every 0.25 s into one strip,
// a 55-unit hull for scale.   node regatta/eval/_ocean_hunt.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.Wildlife && typeof resetGame === 'function');
  const info = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame();
    const d = Wildlife.debug(), me = state.boats[0]; for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
    const P = d.flyPatches.find(q => q.pack); me.x = P.x + 1200; me.y = P.y; me.speed = 0;
    for (let i = 0; i < 60; i++) Wildlife.update(1 / 30);
    P.huntT = 0;
    const c = document.createElement('canvas'); c.width = 1500; c.height = 900; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1b5ea8'; g.fillRect(0, 0, 1500, 900); const A = Wildlife.art;
    const cx0 = P.x, cy0 = P.y;
    for (let f = 0; f < 10; f++) {
      for (let i = 0; i < 6; i++) { me.x = P.x + 1200; me.y = P.y; Wildlife.update(1 / 30); }
      const col = f % 5, row = Math.floor(f / 5), X = 150 + col * 300, Y = 225 + row * 450;
      g.save(); g.beginPath(); g.rect(X - 148, Y - 222, 296, 444); g.clip(); g.fillStyle = '#1b5ea8'; g.fillRect(X - 148, Y - 222, 296, 444);
      const mx = P.pack.reduce((a, m) => a + m.x, 0) / P.pack.length, my = P.pack.reduce((a, m) => a + m.y, 0) / P.pack.length;
      g.translate(X, Y); g.scale(0.9, 0.9); g.translate(-mx, -my);
      g.save(); g.translate(mx + 110, my + 170); g.fillStyle = '#f2f2f2'; g.beginPath(); g.moveTo(0, -27); g.bezierCurveTo(8.5, -13, 8.5, 11, 6, 27); g.lineTo(-6, 27); g.bezierCurveTo(-8.5, 11, -8.5, -13, 0, -27); g.fill(); g.restore();
      for (const S of Wildlife.debug().splashes) A.drawSplash(g, S);
      for (const m of P.pack) if (!(m.leap > 0)) A.drawMahi(g, m);
      for (const ff of Wildlife.debug().flyfish) if (!ff.caught) A.drawFlyfish(g, ff);
      for (const m of P.pack) if (m.leap > 0) A.drawMahi(g, m);
      g.restore();
      g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(`${((f + 1) * 6 / 30).toFixed(2)}s  ${P.pack.map(m => m.mode[0] + (m.leap > 0 ? '^' : '')).join('')}  fish ${Wildlife.debug().flyfish.filter(q => !q.caught).length}`, X - 140, Y - 205);
    }
    return P.pack.length; });
  await p.screenshot({ path: process.argv[2] }); console.log('pack', info, errs.length ? errs[0] : 'ok'); await b.close(); })();

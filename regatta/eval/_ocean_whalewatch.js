// Probe: one humpback pod watched through a full surfacing sequence — the LIVE objects stepped by
// update(), drawn by the real Wildlife.draw* onto an overlay centred on the pod (no camera), with
// the sea's colour behind and a 55-unit hull for scale. Frames every ~1.2 s into one strip.
//   node regatta/eval/_ocean_whalewatch.js <out.png> [podId]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate((pod) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame();
    const d = Wildlife.debug(), W = d.whalePods.find(w => w.cfg.id === pod), me = state.boats[0];
    for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
    const m = W.members[0]; m.mode = 'under'; m.t = 0.5; m.depth = 0.5;         // about to surface
    const c = document.createElement('canvas'); c.width = 1500; c.height = 900; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1b5ea8'; g.fillRect(0, 0, 1500, 900);
    const A = Wildlife.art;
    for (let f = 0; f < 15; f++) {
      for (let i = 0; i < 36; i++) Wildlife.update(1 / 30);
      const col = f % 5, row = Math.floor(f / 5), cx = 150 + col * 300, cy = 150 + row * 300;
      g.save(); g.beginPath(); g.rect(cx - 148, cy - 148, 296, 296); g.clip();
      g.fillStyle = '#1b5ea8'; g.fillRect(cx - 148, cy - 148, 296, 296);
      g.translate(cx, cy); g.scale(0.95, 0.95); g.rotate(-m.h); g.translate(-m.x, -m.y);
      for (const F of Wildlife.debug().prints) A.drawPrint ? A.drawPrint(g, F) : 0;
      for (const w of W.members) A.drawWhale(g, w);
      for (const S of Wildlife.debug().splashes) A.drawSplash(g, S);
      for (const B of Wildlife.debug().blows) A.drawBlow(g, B);
      g.restore();
      g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(`${(f + 1) * 1.2}s ${m.mode}${m.ev ? ' ' + m.ev : ''} roll ${m.rollT != null ? m.rollT.toFixed(1) : '-'}`, cx - 140, cy - 132);
      // hull for scale
      g.save(); g.translate(cx + 120, cy + 110); g.fillStyle = '#f2f2f2'; g.beginPath(); g.moveTo(0, -26); g.bezierCurveTo(8.5, -13, 8.5, 11, 6, 26); g.lineTo(-6, 26); g.bezierCurveTo(-8.5, 11, -8.5, -13, 0, -26); g.fill(); g.restore();
    }
  }, process.argv[3] || 'B');
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs[0] : 'ok'); await b.close(); })();

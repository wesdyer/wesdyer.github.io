// Probe: frames for a GIF of a LIVE fluking dive — a humpback (ocean) or a blue whale (otter) put into its
// terminal dive with the flukes up and stepped by Wildlife.update, drawn by the real draw functions with
// the splashes and prints, heading up, at `scale`.
//   node regatta/eval/_fluke_gif.js <dir> humpback|blue [frames] [scale]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], kind = process.argv[3] || 'blue', N = +(process.argv[4] || 70), sc = +(process.argv[5] || 1.6); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 640 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate((kind) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: kind === 'blue' ? 'otter' : 'ocean' })); resetGame(); }, kind);
  await p.waitForTimeout(900);
  await p.evaluate((kind) => { const c = document.createElement('canvas'); c.width = 640; c.height = 640; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
    const d = Wildlife.debug(), m = kind === 'blue' ? d.bluePods[0].members[0] : d.whalePods.find(w => !w.cfg.calf).members[0];
    for (let i = 0; i < 30; i++) Wildlife.update(1 / 30);
    m.mode = 'dive'; m.t = kind === 'blue' ? 6 : 3.2; m.flukeUp = true; m.ev = null; window.__M = m; window.__kind = kind; }, kind);
  for (let f = 0; f < N; f++) {
    await p.evaluate((sc) => { const m = window.__M, blue = window.__kind === 'blue'; Wildlife.update(1 / 30); Wildlife.update(1 / 30);
      if (m.mode === 'dive') m.flukeUp = true;
      const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc, water = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#1e6aa6';
      // the camera on the tail stock
      const tx = m.x - Math.sin(m.h) * m.len * 0.3, ty = m.y + Math.cos(m.h) * m.len * 0.3; state.camera = { x: tx, y: ty, rotation: 0 };
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = water; g.fillRect(0, 0, 640, 640);
      g.save(); g.translate(320, 300); g.scale(sc, sc); g.rotate(-m.h); g.translate(-tx, -ty);
      const d = Wildlife.debug(), A = Wildlife.art;
      for (const F of d.prints) A.drawPrint(g, F);
      if (blue) A.drawBlueWhale(g, m); else A.drawWhale(g, m);
      for (const S of d.splashes) A.drawSplash(g, S);
      g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`${blue ? 'blue whale' : 'humpback'} x${sc} — ${m.mode}, flukes ${(m.fluke || 0).toFixed(2)}`, 10, 18); }, sc);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 640 } });
  }
  await b.close(); console.log('ok', N); })();

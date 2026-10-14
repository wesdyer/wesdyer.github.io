// Probe: frames for a GIF of a LIVE diver group on the lake (loons by default, or beavers) — Wildlife.update, the real draw
// (Wildlife.drawWater), the camera on the group, the fleet out of the way so nothing spooks them.
//   node regatta/eval/_lake_divergif.js <dir> [loon|beaver] [frames] [scale]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], kind = process.argv[3] || 'loon', N = +(process.argv[4] || 200), sc = +(process.argv[5] || 3); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 480 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' })); resetGame(); });
  await p.waitForTimeout(1000);
  await p.evaluate((kind) => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    for (const b2 of state.boats) { b2.x = 1e6; b2.y = 1e6; } window.__G = Wildlife.debug().divers.find(G => G.cfg.kind === kind); }, kind);
  for (let f = 0; f < N; f++) {
    await p.evaluate((sc) => { for (let k = 0; k < 2; k++) Wildlife.update(1 / 30); const G = window.__G, bs = G.birds;
      const cx = bs.reduce((s2, q) => s2 + q.x, 0) / bs.length, cy = bs.reduce((s2, q) => s2 + q.y, 0) / bs.length;
      window.__c = window.__c ? { x: window.__c.x + (cx - window.__c.x) * 0.1, y: window.__c.y + (cy - window.__c.y) * 0.1 } : { x: cx, y: cy }; const v = window.__c; state.camera = { x: v.x, y: v.y, rotation: 0 };
      const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a5a7a'; g.fillRect(0, 0, 640, 480);
      g.save(); g.translate(320, 240); g.scale(sc, sc); g.translate(-v.x, -v.y); Wildlife.drawWater(g); g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`${G.cfg.kind}s x${sc} — ${bs.map(q => q.mode).join(' ')}`, 10, 18); }, sc);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 480 } });
  }
  console.log('ok'); await b.close(); })();

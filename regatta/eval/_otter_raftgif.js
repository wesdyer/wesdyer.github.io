// Probe: frames for a GIF of a LIVE sea otter raft — the real update and draw (Wildlife.drawWater/
// drawPerched/drawAir), the camera on the raft's centre, at `scale` (the kelp canopy is the game
// renderer's, so it is not under them here).
//   node regatta/eval/_otter_raftgif.js <dir> [frames] [scale] [raftIndex]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], N = +(process.argv[3] || 90), sc = +(process.argv[4] || 3), ri = +(process.argv[5] || 0); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 480 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate((ri) => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; } for (let i = 0; i < 90; i++) Wildlife.update(1 / 30);
    const R = Wildlife.debug().seaOtterRafts[ri], ms = R.members || R.otters || []; window.__R = R; window.__ms = ms; }, ri);
  for (let f = 0; f < N; f++) {
    await p.evaluate((sc) => { Wildlife.update(1 / 30); Wildlife.update(1 / 30);
      const ms = window.__ms.filter(m => m.mode !== 'under'); const all = ms.length ? ms : window.__ms;
      const cx = all.reduce((s, m) => s + m.x, 0) / all.length, cy = all.reduce((s, m) => s + m.y, 0) / all.length;
      window.__c = window.__c ? { x: window.__c.x + (cx - window.__c.x) * 0.05, y: window.__c.y + (cy - window.__c.y) * 0.05 } : { x: cx, y: cy };
      const v = window.__c; state.camera = { x: v.x, y: v.y, rotation: 0 };
      const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc, water = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a';
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = water; g.fillRect(0, 0, 640, 480);
      g.save(); g.translate(320, 240); g.scale(sc, sc); g.translate(-v.x, -v.y); Wildlife.drawWater(g); if (Wildlife.drawPerched) Wildlife.drawPerched(g); if (Wildlife.drawAir) Wildlife.drawAir(g); g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`sea otter raft x${sc}`, 10, 18); }, sc);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 480 } });
  }
  console.log('ok'); await b.close(); })();

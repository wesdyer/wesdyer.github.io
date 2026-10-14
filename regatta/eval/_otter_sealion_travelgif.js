// Probe: frames for a GIF of a LIVE sea lion group TRAVELLING (breathing rolls, every third a leap) or FLEEING
// (every surfacing a porpoising leap) — the group set going, stepped by Wildlife.update, its own draw
// (drawSLGroupWater / Air through Wildlife.drawWater/drawAir), the camera following the group.
//   node regatta/eval/_otter_sealion_travelgif.js <dir> travel|flee [frames] [scale]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], mode = process.argv[3] || 'travel', N = +(process.argv[4] || 90), sc = +(process.argv[5] || 2); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 480 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate((mode) => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
    const d = Wildlife.debug(), G = d.slGroups.find(G2 => G2.members.length >= 3) || d.slGroups[0];
    // set it going out to sea: to a clear spot a long way off (travel heads for its haul-out's sea spot, flee for its aim)
    let tgt = null; for (let r = 1500; r < 4000 && !tgt; r += 250) for (let i = 0; i < 16 && !tgt; i++) { const x = G.x + Math.cos(i * 0.39) * r, y = G.y + Math.sin(i * 0.39) * r; if (!pointOnLand(x, y)) tgt = { x, y }; }
    G.mode = mode; G.t = 60; G.tx = tgt.x; G.ty = tgt.y; G.aim = tgt; G.jink = false; G.H = Object.assign({}, G.H, { sea: tgt }); window.__G = G; for (let i = 0; i < 30; i++) Wildlife.update(1 / 30); }, mode);
  for (let f = 0; f < N; f++) {
    await p.evaluate((sc) => { const G = window.__G; Wildlife.update(1 / 30); Wildlife.update(1 / 30);
      const ms = G.members.filter(q => !q.gone), cx = ms.reduce((s2, q) => s2 + q.x, 0) / ms.length, cy = ms.reduce((s2, q) => s2 + q.y, 0) / ms.length;
      window.__c = { x: cx, y: cy, h: window.__c ? window.__c.h + Math.atan2(Math.sin(G.h - window.__c.h), Math.cos(G.h - window.__c.h)) * 0.05 : G.h };   // (on the group, heading up)
      const v = window.__c; state.camera = { x: v.x, y: v.y, rotation: 0 };
      const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc, water = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a';
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = water; g.fillRect(0, 0, 640, 480);
      g.save(); g.translate(320, 240); g.scale(sc, sc); g.rotate(-v.h); g.translate(-v.x, -v.y); Wildlife.drawWater(g); if (Wildlife.drawAir) Wildlife.drawAir(g); g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`sea lions ${G.mode} x${sc} — breathing ${ms.filter(q => q.surf > 0).length}, leaping ${ms.filter(q => q.leap > 0).length}`, 10, 18); }, sc);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 480 } });
  }
  console.log('ok'); await b.close(); })();

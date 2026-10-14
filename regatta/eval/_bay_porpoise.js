// Probe: the painted harbour porpoise through its roll (the body under the surface, the head and then the back and
// fin breaking through, sliding under), close up; then a GIF of a LIVE pod ahead of a cargo ship (frames to <dir>).
//   node regatta/eval/_bay_porpoise.js <out.png> [gifdir]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2], dir = process.argv[3]; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 300 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 300; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2f7fb0'; g.fillRect(0, 0, 1500, 300); state.camera = { x: 0, y: 0, rotation: 0 }; A.setT(1);
    [0.05, 0.18, 0.32, 0.45, 0.58, 0.72, 0.86, 0.96].forEach((ph, i) => { const x = 95 + i * 185; g.save(); g.translate(x, 140); g.scale(5, 5); A.drawPorpoise(g, { phase: ph, sx: 0, sy: 0, sh: 0, i: 0 }); g.restore();
      g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText('roll ' + ph, x - 25, 285); }); });
  await p.screenshot({ path: out });
  if (dir) { fs.mkdirSync(dir, { recursive: true }); await p.setViewportSize({ width: 640, height: 480 });
    await p.evaluate(() => { const c = document.getElementById('gifc'); c.width = 640; c.height = 480; for (let i = 0; i < 90; i++) Wildlife.update(1 / 30);
      const d = Wildlife.debug(); window.__pod = (d.pods || []).find(q => q.members && q.members.length) || d.resident; });
    for (let f = 0; f < 120; f++) {
      await p.evaluate(() => { for (let k = 0; k < 2; k++) Wildlife.update(1 / 30); const P = window.__pod, ms = P.members, act = ms.filter(m => m.phase >= 0), all = act.length ? act : ms;
        const cx = all.reduce((s2, m) => s2 + (m.sx || m.x || 0), 0) / all.length, cy = all.reduce((s2, m) => s2 + (m.sy || m.y || 0), 0) / all.length;
        window.__c = window.__c ? { x: window.__c.x + (cx - window.__c.x) * 0.15, y: window.__c.y + (cy - window.__c.y) * 0.15 } : { x: cx, y: cy };
        const v = window.__c; state.camera = { x: v.x, y: v.y, rotation: 0 };
        const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2f7fb0'; g.fillRect(0, 0, 640, 480);
        g.save(); g.translate(320, 240); g.scale(3, 3); g.translate(-v.x, -v.y); Wildlife.drawWater(g); g.restore();
        g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('harbour porpoises, x3', 10, 18); });
      await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 480 } }); } }
  console.log('ok'); await b.close(); })();

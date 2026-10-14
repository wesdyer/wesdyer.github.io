// Probe: the painted pelican in flight — gliding, eight frames through a wingbeat, and the plunge dive's fold — with its
// shadow at height, on the venue's water; then (frames to <dir>) a GIF of the LIVE formation going to a bait boil and diving.
//   node regatta/eval/_bay_pelican.js <out.png> [gifdir] [boil]     (from the repo root; boil: the camera on the bait ball, close in)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2], dir = process.argv[3], onBoil = process.argv[4] === "boil"; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1650, height: 320 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1650; c.height = 320; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2f7fb0'; g.fillRect(0, 0, 1650, 320); state.camera = { x: 0, y: 0, rotation: 0 };
    const cells = [['glide', 0, 13 * Math.PI, false]];   // flap 13pi: sin(flap*0.12) < -0.2 -> the glide
    for (let f = 0; f < 8; f++) cells.push(['beat ' + f + '/8', 25, f / 8 * Math.PI * 2, false]);
    cells.length = 7; [[0.04, 64], [0.1, 60], [0.35, 37], [0.65, 9]].forEach(([dt, z]) => cells.push(['dive ' + dt + 's z' + z, z, 0, true, dt]));
    cells.forEach(([lab, z, flap, fold, dt], i) => { const x = 85 + i * 150, y = 140; g.save(); g.translate(x, y); g.scale(1.9, 1.9); A.drawPelicanFlying(g, 0, 0, 0, z, flap, fold, dt); g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(lab, x - 30, 305); }); });
  await p.screenshot({ path: out });
  if (dir) { fs.mkdirSync(dir, { recursive: true }); await p.setViewportSize({ width: 640, height: 480 });
    await p.evaluate(() => { const c = document.getElementById('gifc'); c.width = 640; c.height = 480; for (let i = 0; i < 60; i++) Wildlife.update(1 / 30);
      const fl = Wildlife.debug().flight; if (fl && Wildlife.forceBoil) Wildlife.forceBoil(fl.x + Math.sin(fl.h) * 300, fl.y - Math.cos(fl.h) * 300); });   // a bait boil ahead of them: they go to it and dive
    for (let f = 0; f < 150; f++) {
      await p.evaluate((onBoil) => { for (let k = 0; k < 2; k++) Wildlife.update(1 / 30); const fl = Wildlife.debug().flight || Wildlife.debug().fishers; const birds = (fl && fl.birds) || [];
        const bo = Wildlife.debug().boil, act = onBoil && bo ? [bo] : birds.length ? birds : [{ x: 0, y: 0 }], cx = act.reduce((s2, q) => s2 + q.x, 0) / act.length, cy = act.reduce((s2, q) => s2 + q.y, 0) / act.length;
        window.__c = window.__c ? { x: window.__c.x + (cx - window.__c.x) * 0.2, y: window.__c.y + (cy - window.__c.y) * 0.2 } : { x: cx, y: cy }; const v = window.__c; state.camera = { x: v.x, y: v.y, rotation: 0 };
        const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2f7fb0'; g.fillRect(0, 0, 640, 480);
        const sc = onBoil ? 3 : 1.6; g.save(); g.translate(320, 240); g.scale(sc, sc); g.translate(-v.x, -v.y); Wildlife.drawWater(g); Wildlife.drawPerched(g); Wildlife.drawAir(g); g.restore();
        g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`brown pelicans, x${sc} — ${birds.map(q => q.mode).join(' ')}`, 10, 18); }, onBoil);
      await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 480 } }); } }
  console.log('ok'); await b.close(); })();

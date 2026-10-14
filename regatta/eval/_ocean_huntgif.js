// Probe: frames for a GIF of a LIVE mahi-mahi hunt — a pack's patch made to hunt now (as test_ocean does), the flying fish
// bursting off and gliding (some touching down and going again), the mahi racing under them; the real update and the
// real draw (Wildlife.drawWater/drawAir), the camera following the lead mahi (so the fish it hunts stays in view).
//   node regatta/eval/_ocean_huntgif.js <dir> [frames] [scale]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], N = +(process.argv[3] || 90), sc = +(process.argv[4] || 0.9); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 760, height: 560 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 760; c.height = 560; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const d = Wildlife.debug(), P = d.flyPatches.find(q => q.pack); const me = state.boats[0]; for (const bt of state.boats.slice(1)) { bt.x = 1e6; bt.y = 1e6; }
    me.x = P.x + 700; me.y = P.y; me.speed = 0; for (let i = 0; i < 20; i++) Wildlife.update(1 / 30); P.huntT = 0; P.since = 99; window.__P = P; window.__me = me; });
  for (let f = 0; f < N; f++) {
    await p.evaluate((sc) => { const P = window.__P, me = window.__me; for (let k = 0; k < 2; k++) { me.x = P.x + 700; me.y = P.y; Wildlife.update(1 / 30); }
      // the camera on the first mahi (it races under the fish it hunts), eased so it does not jitter
      const m0 = P.pack[0]; window.__c = window.__c ? { x: window.__c.x + (m0.x - window.__c.x) * 0.25, y: window.__c.y + (m0.y - window.__c.y) * 0.25 } : { x: m0.x, y: m0.y };
      const cv = window.__c; state.camera = { x: cv.x, y: cv.y, rotation: 0 };
      const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc, water = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#1e5fa6';
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = water; g.fillRect(0, 0, 760, 560);
      g.save(); g.translate(380, 280); g.scale(sc, sc); g.translate(-cv.x, -cv.y); Wildlife.drawWater(g); if (Wildlife.drawAir) Wildlife.drawAir(g);
      // a 10 m scale bar
      g.restore(); g.fillStyle = '#fff'; g.fillRect(20, 535, 100 * sc, 3); g.font = '12px sans-serif'; g.fillText('10 m', 20 + 100 * sc + 6, 540);
      const fl = Wildlife.debug().flyfish.filter(q => q.t > 0 && q.t < q.dur).length, ch = P.pack.filter(m => m.mode === 'chase').length;
      g.fillText(`a mahi hunt, x${sc} — flying fish in the air ${fl}, mahi chasing ${ch}`, 10, 18); }, sc);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 760, height: 560 } });
  }
  console.log('ok'); await b.close(); })();

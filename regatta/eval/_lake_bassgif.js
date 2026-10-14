// Probe: frames for a GIF of LIVE bass jumping round the player on the lake (Wildlife.update's leapers, the real draw),
// the player's hull parked, the camera on it, at `scale`.
//   node regatta/eval/_lake_bassgif.js <dir> [frames] [scale] [follow]     (from the repo root; follow: the camera on the latest jump)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], N = +(process.argv[3] || 150), sc = +(process.argv[4] || 2), follow = process.argv[5] === 'follow'; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 480 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const me = state.boats.find(b2 => b2.isPlayer) || state.boats[0]; for (const b2 of state.boats) if (b2 !== me) { b2.x = 1e6; b2.y = 1e6; } me.speed = 0; window.__me = me; state.camera = { x: me.x, y: me.y, rotation: 0 }; });   // (the fleet away: a leap never lands within 90 u of a boat)
  for (let f = 0; f < N; f++) {
    await p.evaluate(([sc, follow]) => { const me = window.__me; for (let k = 0; k < 2; k++) Wildlife.update(1 / 30);
      const lp = Wildlife.debug().leaps; if (follow && lp && lp.length) { const L = lp[lp.length - 1]; window.__fc = { x: L.x, y: L.y }; }
      const fc = follow && window.__fc ? window.__fc : me; state.camera = { x: fc.x, y: fc.y, rotation: 0 };
      const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a5a7a'; g.fillRect(0, 0, 640, 480);
      g.save(); g.translate(320, 240); g.scale(sc, sc); g.translate(-state.camera.x, -state.camera.y); Wildlife.drawWater(g);
      g.save(); g.translate(me.x, me.y); g.rotate(me.heading || 0); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); g.restore();
      Wildlife.drawAir(g); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`bass jumping near the player, x${sc}${follow ? ' (following each jump)' : ''}`, 10, 18); }, [sc, follow]);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 480 } });
  }
  console.log('ok'); await b.close(); })();

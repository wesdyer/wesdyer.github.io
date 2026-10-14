// Probe: the Cove's herring gulls — perched, gliding, five frames through a wingbeat, high and low (by height), and a
// juvenile — at 3x on the venue's water, with a 55-unit hull at the same scale; then (frames to <dir>) a GIF of the
// LIVE gull-rock colony flushed by a boat and settling again.
//   node regatta/eval/_bay_gulls.js <out.png> [gifdir]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2], dir = process.argv[3]; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 300 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 300; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2f7fb0'; g.fillRect(0, 0, 1500, 300); state.camera = { x: 0, y: 0, rotation: 0 };
    const cell = (i, lab, fn) => { const x = 70 + i * 125; g.save(); g.translate(x, 130); g.scale(3, 3); fn(); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(lab, x - 40, 285); };
    cell(0, 'perched', () => A.drawGullPerched(g, 0, 0, 0));
    cell(1, 'glide', () => A.drawGullFlying(g, 0, 0, 0, 30, 0, true));
    [0, 0.25, 0.5, 0.75].forEach((f, i) => cell(2 + i, 'beat ' + f, () => A.drawGullFlying(g, 0, 0, 0, 30, f * Math.PI * 2, false)));
    cell(6, 'low (2 m)', () => A.drawGullFlying(g, 0, 0, 0, 20, 0, true));
    cell(7, 'high (8 m)', () => A.drawGullFlying(g, 0, 0, 0, 80, 0, true));
    cell(8, 'juvenile', () => A.drawGullFlying(g, 0, 0, 0, 30, 0, true, true));
    cell(9, 'juvenile perched', () => A.drawGullPerched(g, 0, 0, 0, true));
    cell(10, 'hull 55', () => { g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); }); });
  await p.screenshot({ path: out });
  if (dir) { fs.mkdirSync(dir, { recursive: true }); await p.setViewportSize({ width: 640, height: 480 });
    await p.evaluate(() => { const c = document.getElementById('gifc'); c.width = 640; c.height = 480; const C = Wildlife.debug().colonies[0]; const me = state.boats[0]; for (const bt of state.boats.slice(1)) { bt.x = 1e6; bt.y = 1e6; }
      const bx = C.birds.reduce((s2, q) => s2 + q.hx, 0) / C.birds.length, by = C.birds.reduce((s2, q) => s2 + q.hy, 0) / C.birds.length; window.__C = { x: bx, y: by }; me.x = bx + 900; me.y = by; me.speed = 0; window.__me = me; window.__f = 0; });
    for (let f = 0; f < 180; f++) {
      await p.evaluate(() => { const me = window.__me, C = window.__C; window.__f++;
        // a boat sails in past the rock, then away
        const f2 = window.__f; me.x = C.x + 900 - Math.min(f2, 70) * 12 + Math.max(0, f2 - 90) * 14; me.y = C.y + 40; me.heading = f2 < 90 ? -Math.PI / 2 : Math.PI / 2; me.speed = 3;
        for (let k = 0; k < 2; k++) Wildlife.update(1 / 30);
        const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc; state.camera = { x: C.x, y: C.y, rotation: 0 };
        g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2f7fb0'; g.fillRect(0, 0, 640, 480);
        g.save(); g.translate(320, 240); g.scale(1.6, 1.6); g.translate(-C.x, -C.y); if (typeof drawIslands === 'function') { try { drawIslands(g); } catch (e) {} } Wildlife.drawWater(g); Wildlife.drawPerched(g); Wildlife.drawAir(g); g.restore();
        g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('the gull rock, x1.6', 10, 18); });
      await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 480 } }); } }
  console.log('ok'); await b.close(); })();

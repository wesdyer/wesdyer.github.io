// Probe: frames for a GIF of one LIVE blue whale — the whole animal at game scale (heading up, beside a
// hull) and its flukes at 2.5x — stepped by Wildlife.update; `speed` sim seconds per GIF second.
//   node regatta/eval/_otter_bluegif.js <dir> [frames] [speed] [podIndex] [surface|lunge]     (from the repo root; lunge: it lunges at once, the close-up on its head)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], N = +(process.argv[3] || 120), speed = +(process.argv[4] || 2), pi = +(process.argv[5] || 0), surf = process.argv[6] === 'surface', lunge = process.argv[6] === 'lunge';
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 820, height: 460 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(([pi, surf, lunge]) => { const c = document.createElement('canvas'); c.width = 820; c.height = 460; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const P = Wildlife.debug().bluePods[pi]; window.__M = P.members ? P.members[0] : P;
    if (surf) { const m = window.__M; m.mode = 'under'; m.t = 0.3; }
    if (lunge) { const m = window.__M; m.mode = 'surface'; m.t = 12; m.rollT = 99; m.ev = 'lunge'; m.evT = 0; m.sd = 1; m.kr = null; } window.__lunge = lunge; }, [pi, surf, lunge]);
  for (let f = 0; f < N; f++) {
    await p.evaluate((steps) => { const m = window.__M; for (let i = 0; i < steps; i++) Wildlife.update(1 / 30);
      const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc, water = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a';
      state.camera = { x: m.x, y: m.y, rotation: 0 };
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = water; g.fillRect(0, 0, 820, 460);
      const panel = (cx, cy, s, oy) => { g.save(); g.translate(cx, cy); g.scale(s, s); g.translate(0, oy || 0); g.rotate(-m.h); g.translate(-m.x, -m.y);
        for (const B of Wildlife.debug().splashes) Wildlife.art.drawSplash(g, B); Wildlife.art.drawBlueWhale(g, m); for (const B of Wildlife.debug().blueBlows) Wildlife.art.drawBlueBlow(g, B); g.restore(); };
      g.save(); g.beginPath(); g.rect(0, 0, 300, 460); g.clip(); panel(150, 235, 1.15);
      g.translate(262, 380); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); g.restore();
      g.save(); g.beginPath(); g.rect(300, 0, 520, 460); g.clip(); panel(560, 230, window.__lunge ? 1.6 : 2.5, window.__lunge ? m.len * 0.2 : -m.len * 0.33); g.restore();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(300, 0, 2, 460);
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('game scale x1.15 (with a hull)', 10, 18); g.fillText(`${window.__lunge ? 'the head, 1.6x' : 'the flukes, 2.5x'} — ${m.mode}${m.lunge > 0.01 ? ' lunge' : ''}`, 312, 18); }, Math.round(speed * 30 / 15));
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 820, height: 460 } });
  }
  await b.close(); console.log('ok', N); })();

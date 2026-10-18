// Probe: one ram clash frame by frame (the sim at 30 fps), drawn 4x on rock round the two rams, north up — from the
// face-off through the rear, the charge, the hit, the recoil and the horn presentation. Writes <dir>/f000.png ...
// (play at 33 ms a frame for true speed). Band 2 has two rams.   node regatta/eval/_redrock_clashgif.js <dir> [band]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], bi = +(process.argv[3] || 2); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 420 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false })); resetGame(); });
  await p.waitForTimeout(1200);
  await p.evaluate((bi) => { for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const G = Wildlife.debug().bands[bi]; G.phase = 'feed'; G.t = 999; G.clashT = 0.2;
    // step until the rams are squared off and about to rear
    for (let i = 0; i < 30 * 30; i++) { Wildlife.update(1 / 30); const r = G.members.find(m => m.ram); if (r.clash && r.clash.ph === 'face' && r.clash.t > 0.8 && G.members.filter(m => m.ram)[1].clash && G.members.filter(m => m.ram)[1].clash.ph === 'face') break; }
    const c = document.createElement('canvas'); c.width = 420; c.height = 420; c.id = 'cc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const [A, B] = G.members.filter(m => m.ram); window.__C = { G, A, B, cx: (A.x + B.x) / 2, cy: (A.y + B.y) / 2 }; }, bi);
  let n = 0;
  for (let f = 0; f < 150; f++) {
    const ph = await p.evaluate(() => { const { G, A, B, cx, cy } = window.__C; Wildlife.update(1 / 30);
      const g = document.getElementById('cc').getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#c98f5e'; g.fillRect(0, 0, 420, 420);
      g.save(); g.translate(210, 210); g.scale(4, 4); g.translate(-cx, -cy); Wildlife.art.drawBighornDust(g, G); for (const s of G.members) Wildlife.art.drawBighorn(g, s); g.restore();
      const ph = A.clash ? A.clash.ph : 'done'; g.fillStyle = '#222'; g.font = '14px sans-serif'; g.fillText(ph + (A.clash ? '  t ' + A.clash.t.toFixed(2) : ''), 8, 18); return ph; });
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`) }); n++;
    if (ph === 'done') break;
  }
  await b.close(); console.log('frames', n); })();

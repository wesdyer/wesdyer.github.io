// Film: an Emberfall booby flock at 2x over the venue's water — circling (flap-and-glide), then the group plunge forced:
// the spotter tips over first, the rest a beat after; the W, the plunge, the arrow; splashes, a few seconds under,
// up to sit, off again. ~13 s at 15 fps -> PNG frames.   node regatta/eval/_volc_booby_gif.js outdir
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; } });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { for (let i = 0; i < 30 * 10; i++) Wildlife.update(1 / 30);
    const F = Wildlife.debug().boobyFlocks.slice().sort((a, b) => b.birds.length - a.birds.length)[0]; F.mode = 'circle'; F.t = 3; window.__F = F;
    const c = document.createElement('canvas'); c.width = 900; c.height = 700; c.id = 'film'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  for (let fr = 0; fr < 230; fr++) {
    await p.evaluate((fr) => { const F = window.__F, A = Wildlife.art, c = document.getElementById('film'), g = c.getContext('2d');
      Wildlife.update(1 / 30); Wildlife.update(1 / 30); A.setT(performance.now() / 1000);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 900, 700);
      g.setTransform(2, 0, 0, 2, 450 - F.cx * 2, 350 - F.cy * 2);
      for (const b of F.birds) if (b.mode === 'sit' || b.mode === 'under' || b.splash > 0) A.drawBooby(g, b);
      for (const b of F.birds) if (b.mode !== 'sit' && b.mode !== 'under') A.drawBooby(g, b);
      const m = {}; for (const b of F.birds) m[b.mode] = (m[b.mode] || 0) + 1;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText('blue-footed boobies x2 — ' + F.mode + '   ' + Object.entries(m).map(([k, v]) => v + ' ' + k).join(', '), 14, 24); }, fr);
    await p.screenshot({ path: path.join(out, String(fr).padStart(3, '0') + '.png') }); }
  await b.close(); })();

// Film: an Emberfall sooty tern flock at 2x, wheeling over a booby flock's fish — long glides and slow deep beats, banked
// round, swooping down to dip at the surface (tails opening) and climbing away; the boobies below. ~12 s at 15 fps.
//   node regatta/eval/_volc_sooty_gif.js outdir
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; } });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { for (let i = 0; i < 30 * 15; i++) Wildlife.update(1 / 30);
    const F = Wildlife.debug().ternFlocks.filter(q => q.sooty && q.fish).sort((a, b) => b.birds.length - a.birds.length)[0]; window.__F = F;
    window.__G = Wildlife.debug().boobyFlocks.slice().sort((a, b) => Math.hypot(a.cx - F.cx, a.cy - F.cy) - Math.hypot(b.cx - F.cx, b.cy - F.cy))[0];
    const c = document.createElement('canvas'); c.width = 900; c.height = 700; c.id = 'film'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  for (let fr = 0; fr < 180; fr++) {
    await p.evaluate(() => { const F = window.__F, G = window.__G, A = Wildlife.art, c = document.getElementById('film'), g = c.getContext('2d');
      Wildlife.update(1 / 30); Wildlife.update(1 / 30);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 900, 700); g.setTransform(2, 0, 0, 2, 450 - F.cx * 2, 350 - F.cy * 2);
      for (const q of G.birds) if (q.mode === 'sit' || q.mode === 'under' || q.splash > 0) A.drawBooby(g, q);
      for (const q of G.birds) if (q.mode !== 'sit' && q.mode !== 'under') A.drawBooby(g, q);
      for (const q of F.birds) A.drawTern(g, q);
      const dip = F.birds.filter(q => q.mode === 'dip').length;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText('sooty terns x2 over a booby flock — ' + dip + ' dipping', 14, 24); });
    await p.screenshot({ path: path.join(out, String(fr).padStart(3, '0') + '.png') }); }
  await b.close(); })();

// Film: one Emberfall hammerhead school at 2x on the venue's deep water, a corkscrew forced at the start (the display
// shark ringed for the first frames), ~8 s at 15 fps -> PNG frames for a GIF.
//   node regatta/eval/_volc_hammer_gif.js outdir
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; } });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { for (let i = 0; i < 30 * 20; i++) Wildlife.update(1 / 30);
    const S = Wildlife.debug().hammerSchools[3]; S.dispT = 0; window.__S = S;
    const c = document.createElement('canvas'); c.width = 900; c.height = 700; c.id = 'film'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  for (let fr = 0; fr < 130; fr++) {
    await p.evaluate((fr) => { const S = window.__S, A = Wildlife.art, c = document.getElementById('film'), g = c.getContext('2d');
      Wildlife.update(1 / 30); Wildlife.update(1 / 30);
      const sc = S.fish.find(f => f.mode === 'screw'); if (sc && !window.__C) window.__C = sc;
      const C = window.__C || S.fish[0]; window.__cx = window.__cx ?? C.x; window.__cy = window.__cy ?? C.y;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#173b55'; g.fillRect(0, 0, 900, 700);
      g.setTransform(2, 0, 0, 2, 450 - window.__cx * 2, 350 - window.__cy * 2);
      for (const f of [...S.fish].sort((a, b) => b.depth - a.depth)) A.drawHammer(g, f, Math.min(1, f.depth + S.sink * 0.4));
      if (window.__C && fr < 20) { g.strokeStyle = 'rgba(255,220,120,0.6)'; g.lineWidth = 1; g.beginPath(); g.arc(C.x, C.y, 45, 0, 7); g.stroke(); }
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText('hammerhead school x2 — ' + (C.mode === 'screw' ? 'CORKSCREW' : C.mode) + (S.fish.some(f => f.shake > 0) ? ' · head shakes' : ''), 14, 24); }, fr);
    await p.screenshot({ path: path.join(out, String(fr).padStart(3, '0') + '.png') }); }
  await b.close(); })();

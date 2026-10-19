// Probe: follow live Emberfall hammerheads in their OWN frame (heading up, 4x) through the real update for ~6 s each,
// and measure the tail tip's sideways reach either side of the body's axis (from the pixels): left max, right max.
//   python3 -m http.server 8731 & (repo root), then node regatta/eval/_volc_hammer_follow.js [nSharks]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const N = +(process.argv[2] || 6); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  await p.goto('http://localhost:8731/regatta/index.html');   // (served: a file:// canvas with the painting in it is tainted)
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; } });
  await p.waitForTimeout(2500);
  const res = await p.evaluate((N) => { for (let i = 0; i < 30 * 20; i++) Wildlife.update(1 / 30);
    const A = Wildlife.art, S = Wildlife.debug().hammerSchools[2], c = document.createElement('canvas'); c.width = c.height = 400; const g = c.getContext('2d', { willReadFrequently: true });
    const out = [];
    for (let k = 0; k < N; k++) { const f = S.fish[k * 3]; let L = 0, Rr = 0, bendSum = 0, n = 0;
      for (let i = 0; i < 180; i++) { Wildlife.update(1 / 30); if (f.mode !== 'hold') continue;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 400, 400);
        const o = Object.assign({}, f, { x: 0, y: 0, h: 0 }); g.setTransform(4, 0, 0, 4, 200, 120); A.drawHammer(g, o, 0);
        // the tail: the last 12 rows of ink
        const d = g.getImageData(0, 0, 400, 400).data; let last = -1; for (let y = 399; y >= 0 && last < 0; y--) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4 + 3] > 60) { last = y; break; }
        let sx = 0, cnt = 0; for (let y = last - 12; y <= last; y++) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4 + 3] > 60) { sx += x; cnt++; }
        const tx = sx / cnt - 200; L = Math.min(L, tx); Rr = Math.max(Rr, tx); bendSum += Math.max(-1, Math.min(1, f.turn * 4)); n++; }
      out.push(`shark ${k * 3} mir ${f.mir}: tail left ${L.toFixed(0)} right +${Rr.toFixed(0)} px (${n} frames)`); }
    return out.join('\n'); }, N);
  console.log(res); await b.close(); })();

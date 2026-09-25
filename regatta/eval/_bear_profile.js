// Probe: the bear's silhouette measured — drawn alone at rest on grey, masked by its coat
// colour, and read as widths from nose to rump, head/shoulder and haunch/shoulder ratios. A
// grizzly wants the shoulders widest (haunch/shoulder < 1) and a broad head (~0.6+ of them).
//   node regatta/eval/_bear_profile.js <out.png>     (from the repo root; prints the numbers)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); resetGame();
    const c = document.createElement('canvas'); c.width = 400; c.height = 400; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#8f9a98'; g.fillRect(0, 0, 400, 400);
    g.save(); g.translate(200, 215); g.scale(3.2, 3.2);
    Wildlife.art.drawBear(g, { i: 0, x: 0, y: 0, h: 0, up: 0, hx: 0, hy: 0, kn: 0.2, mode: 'watch', rear: 0, lunge: 0, look: 0, splash: 0, fish: 0 });
    g.restore();
    const d = g.getImageData(0, 0, 400, 400).data, rows = [];
    for (let y = 0; y < 400; y++) { let x0 = -1, x1 = -1; for (let x = 0; x < 400; x++) { const i = (y * 400 + x) * 4; if (d[i] - d[i + 2] > 25 && d[i] - d[i + 1] > 8) { if (x0 < 0) x0 = x; x1 = x; } } if (x0 >= 0) rows.push([y, x1 - x0 + 1]); }
    const y0 = rows[0][0], y1 = rows[rows.length - 1][0], L = y1 - y0 + 1, at = (f) => { const y = Math.round(y0 + f * (L - 1)); const r = rows.find(q => q[0] === y); return r ? r[1] : 0; };
    const w = Array.from({ length: 21 }, (_, i) => at(i / 20)), W = Math.max(...w);
    const head = Math.max(...w.slice(1, 5)), sh = Math.max(...w.slice(6, 11)), ha = Math.max(...w.slice(13, 19));
    return { WL: W / L, prof: w.map(x => (x / W).toFixed(2)).join(' '), head: head / sh, haunch: ha / sh };
  });
  if (process.argv[2]) await p.screenshot({ path: process.argv[2] });
  console.log(`W/L ${r.WL.toFixed(2)}  head/shoulder ${r.head.toFixed(2)}  haunch/shoulder ${r.haunch.toFixed(2)}\nnose→rump ${r.prof}`);
  await b.close(); })();

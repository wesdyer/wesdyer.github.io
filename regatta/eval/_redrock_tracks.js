// Probe: plot each Redrock coyote's track over N minutes on its island (outline), coloured by time, with the targets it
// picked — to see the shape of its wandering. Writes <out>.png.   node regatta/eval/_redrock_tracks.js <out.png> [minutes]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2], MIN = +(process.argv[3] || 5);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 800 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate((MIN) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false })); resetGame();
    for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const d = Wildlife.debug(), K = d.coyotes, tr = K.map(() => []), tg = K.map(() => []);
    for (let i = 0; i < 30 * 60 * MIN; i++) { Wildlife.update(1 / 30); K.forEach((k, j) => { if (i % 3 === 0) tr[j].push([k.x, k.y, k.mode]); const t = tg[j]; if (!t.length || t[t.length - 1][0] !== k.tx) t.push([k.tx, k.ty]); }); }
    const c = document.createElement('canvas'); c.width = 1600; c.height = 800; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#2a7f8c'; g.fillRect(0, 0, 1600, 800);
    // one panel per island
    const isl = [...new Set(K.map(k => k.V))];
    isl.forEach((V, n) => { const xs = V.map(v => v.x), ys = V.map(v => v.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const s = Math.min(380 / (x1 - x0), 760 / (y1 - y0)), ox = 10 + n * 400, oy = 20, P = (x, y) => [ox + (x - x0) * s, oy + (y - y0) * s];
      g.fillStyle = '#d9b98c'; g.beginPath(); V.forEach((v, i) => { const [a, b2] = P(v.x, v.y); i ? g.lineTo(a, b2) : g.moveTo(a, b2); }); g.closePath(); g.fill();
      K.forEach((k, j) => { if (k.V !== V) return; const T = tr[j];
        for (let i = 1; i < T.length; i++) { const u = i / T.length; g.strokeStyle = `hsl(${(j * 90 + 300 * u) % 360},80%,${30 + 20 * u}%)`; g.lineWidth = 1.5; const [a, b2] = P(T[i - 1][0], T[i - 1][1]), [c2, d2] = P(T[i][0], T[i][1]); g.beginPath(); g.moveTo(a, b2); g.lineTo(c2, d2); g.stroke(); }
        g.fillStyle = '#000'; for (const [x, y] of tg[j]) { const [a, b2] = P(x, y); g.fillRect(a - 2, b2 - 2, 4, 4); } });
      g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText('island ' + n + ' (' + Math.round(x1 - x0) + ' x ' + Math.round(y1 - y0) + ' u)', ox, 15); });
  }, MIN);
  await p.screenshot({ path: out }); await b.close(); })();

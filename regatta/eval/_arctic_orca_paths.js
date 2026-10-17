// Probe: where Glacier Sound's orca pods actually travel. N game minutes; draws each pod's track (and its waypoints)
// over the venue's land, and reports heading changes per minute and time spent turning hard. Writes a PNG.
//   node regatta/eval/_arctic_orca_paths.js <out.png> [minutes]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2], MIN = +(process.argv[3] || 8); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(async (MIN) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame(); startRace(); await new Promise(r => setTimeout(r, 600));
    window.requestAnimationFrame = () => 0; for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; }
    const tracks = Wildlife.debug().orcaPods.map(() => []), turn = Wildlife.debug().orcaPods.map(() => ({ hard: 0, tot: 0, under: 0, n: 0 }));
    let prevH = Wildlife.debug().orcaPods.map(W => W.h);
    for (let i = 0; i < MIN * 1800; i++) { Wildlife.update(1 / 30); if (typeof updateIceFloes === 'function') updateIceFloes(1 / 30);
      Wildlife.debug().orcaPods.forEach((W, k) => { if (i % 15 === 0) tracks[k].push([W.x, W.y]); let d = Math.abs(W.h - prevH[k]) % (2 * Math.PI); d = Math.min(d, 2 * Math.PI - d); turn[k].tot += d; if (d / (1 / 30) > 0.35) turn[k].hard += 1 / 30; prevH[k] = W.h;
        turn[k].n++; for (const m of W.members) if (state.course.islands.some(s => s.isFloe && s.vertices && Math.hypot(m.x - s.x, m.y - s.y) < (s.radius || 0) && pointInPoly(m.x, m.y, s.vertices))) turn[k].under += 1 / W.members.length; }); }
    const c = document.createElement('canvas'); c.width = 1000; c.height = 1000; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1d3a5f'; g.fillRect(0, 0, 1000, 1000); const S = 1000 / 8000, X = (x) => 500 + x * S, Y = (y) => 500 + y * S;
    for (const s of state.course.islands) { if (!s.vertices) continue; g.fillStyle = s.isFloe ? 'rgba(220,235,250,0.6)' : '#cfd8e2'; g.beginPath(); s.vertices.forEach((v, i) => i ? g.lineTo(X(v.x), Y(v.y)) : g.moveTo(X(v.x), Y(v.y))); g.fill(); }
    const col = ['#ff6b6b', '#ffd93d', '#6bcB77'];
    tracks.forEach((T, k) => { g.strokeStyle = col[k]; g.lineWidth = 1.5; g.beginPath(); T.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.stroke();
      for (const q of Wildlife.debug().orcaPods[k].pts) { g.fillStyle = col[k]; g.beginPath(); g.arc(X(q.x), Y(q.y), 5, 0, 7); g.fill(); } });
    return turn.map((t, k) => `pod ${k}: turned ${(t.tot / MIN).toFixed(1)} rad/min (game), hard turns ${(100 * t.hard / (MIN * 60)).toFixed(0)}% of the time, members under floes ${(100 * t.under / t.n).toFixed(1)}%`); }, MIN);
  console.log(r.join('\n')); await p.screenshot({ path: out }); await b.close(); })();

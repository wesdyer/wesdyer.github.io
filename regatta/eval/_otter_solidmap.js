// Probe: a map of what is solid (land and rock colliders, dark) round a box of Otter Point, with the
// wildlife paths drawn over it (sharks red, whales blue) and the fleet-line sample points if given.
//   node regatta/eval/_otter_solidmap.js out.png x0 y0 x1 y1 [u-per-px]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const [out, x0, y0, x1, y1, upp] = [process.argv[2], ...process.argv.slice(3).map(Number)]; const k = upp || 10;
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  if (process.env.WPS) await p.evaluate((w) => { window.__wps = JSON.parse(w); }, process.env.WPS);
  const url = await p.evaluate(([x0, y0, x1, y1, k]) => { const process_wps = !!window.__wps; localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
    const W = Math.round((x1 - x0) / k), H = Math.round((y1 - y0) / k), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#bfe3ee'; g.fillRect(0, 0, W, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + i * k, y = y0 + j * k; if (pointOnLand(x, y)) { g.fillStyle = '#555'; g.fillRect(i, j, 1, 1); } }
    for (const s of state.course.islands) if (s.id.startsWith('kelp') || s.id === 'shape-5' || s.id === 'shape-6') { g.strokeStyle = '#8a6d1a'; g.beginPath(); s.vertices.forEach((v, i) => g[i ? 'lineTo' : 'moveTo']((v.x - x0) / k, (v.y - y0) / k)); g.closePath(); g.stroke(); }
    const C = Wildlife.WILDLIFE.otter; const line = (P, col) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); P.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo']((x - x0) / k, (y - y0) / k)); g.closePath(); g.stroke(); };
    if (!process_wps) { C.whites.forEach(w => line(w.path, 'red')); C.blues.pods.forEach(w => line(w.path, 'blue')); }
    for (const [x, y] of (window.__wps || [])) { g.fillStyle = 'red'; g.fillRect((x - x0) / k - 3, (y - y0) / k - 3, 6, 6); }
    g.fillStyle = '#000'; g.font = '10px sans-serif'; for (let x = Math.ceil(x0 / 500) * 500; x < x1; x += 500) g.fillText(x, (x - x0) / k, 10); for (let y = Math.ceil(y0 / 500) * 500; y < y1; y += 500) g.fillText(y, 2, (y - y0) / k);
    return c.toDataURL(); }, [x0, y0, x1, y1, k]);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); await b.close(); })();

// Probe: where Emberfall's ash plumes put DEAD AIR over a race — the share of time each point of the
// map has the wind cut below 60% (windMul < 0.6), accumulated over T seconds, drawn red over the land
// (grey) with the cones (black dots) and Wes's recorded lines (blue).
//   node regatta/eval/_volc_plumemap.js out.png [seconds]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2], T = +(process.argv[3] || 240);
  const tr = fs.readdirSync('regatta/eval/rl/traj').filter(f => /volcanic/.test(f)).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f))).map(j => j.samples.filter(s => s[1] === 1).map(s => [s[2], s[3]]));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate(([T, tr]) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame(); startRace();
    for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const x0 = -3200, y0 = -7100, x1 = 5300, y1 = 2600, k = 50, W = Math.round((x1 - x0) / k), H = Math.round((y1 - y0) / k), acc = new Float32Array(W * H);
    let n = 0, laneDead = 0, laneN = 0;
    for (let t = 0; t < T; t += 1 / 30) { Volcano.update(1 / 30); if (Math.round(t * 30) % 15) continue; n++;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (Volcano.windMul(x0 + i * k, y0 + j * k) < 0.6) acc[j * W + i]++;
      for (const L of tr) for (let q = 0; q < L.length; q += 40) { laneN++; if (Volcano.windMul(L[q][0], L[q][1]) < 0.6) laneDead++; } }
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const img = g.createImageData(W, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const o = (j * W + i) * 4, land = pointOnLand(x0 + i * k, y0 + j * k), f = acc[j * W + i] / n;
      img.data[o] = land ? 150 : 225 - f * 40; img.data[o + 1] = land ? 150 : 235 - f * 235; img.data[o + 2] = land ? 150 : 245 - f * 245; img.data[o + 3] = 255; }
    g.putImageData(img, 0, 0); g.strokeStyle = 'rgba(0,60,200,0.6)'; for (const L of tr) { g.beginPath(); L.forEach(([x, y], q) => g[q ? 'lineTo' : 'moveTo']((x - x0) / k, (y - y0) / k)); g.stroke(); }
    g.fillStyle = '#000'; for (const C of state.volcano.cones) { g.beginPath(); g.arc((C.x - x0) / k, (C.y - y0) / k, 3, 0, 7); g.fill(); }
    return { url: c.toDataURL(), laneDeadShare: +(laneDead / laneN).toFixed(3), wind: +(state.wind.direction * 180 / Math.PI).toFixed(0), cones: state.volcano.cones.map(C => [Math.round(C.x), Math.round(C.y), C.scale, Math.round(C.period)]) }; }, [T, tr]);
  fs.writeFileSync(out, Buffer.from(r.url.split(',')[1], 'base64')); console.log('dead-air share along Wes lines', r.laneDeadShare, 'wind from', r.wind, 'cones', JSON.stringify(r.cones)); await b.close(); })();

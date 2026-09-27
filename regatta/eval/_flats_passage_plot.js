// Probe: plot the Flats' marked passages (drying stretch thick) against Wes's recorded laps (red) and
// one bot race's tracks (orange; the named boat thick) over the ground at mean tide.   node regatta/eval/_flats_passage_plot.js out.png [seed] [boat]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2], seed = +(process.argv[3] || 1), who = process.argv[4] || 'Stomp';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') }); await p.waitForTimeout(400);
  const wes = fs.readdirSync('regatta/eval/rl/traj').filter(f => /^traj_flats_/.test(f)).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f, 'utf8')).samples.filter((q, i) => i % 3 === 0).map(q => [q[2], q[3]]));
  const url = await p.evaluate(([seed, who, wes]) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); window.evalHarness.seed = seed; resetGame(); startRace();
    const bots = state.boats.filter(x => !x.isPlayer), pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6; const tr = bots.map(() => []);
    for (let it = 0; it < 60 * 420; it++) { update(1 / 60); if (state.race.status !== 'racing' || it % 30) continue; bots.forEach((bt, k) => { if (!bt.raceState.finished) tr[k].push([bt.x, bt.y]); }); if (bots.every(x => x.raceState.finished)) break; }
    const x0 = -3200, y0 = -11400, x1 = 2400, y1 = 7900, sc = 0.16, W = Math.round((x1 - x0) * sc), H = Math.round((y1 - y0) * sc);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const X = x => (x - x0) * sc, Y = y => (y - y0) * sc;
    const img = g.createImageData(W, H); const T = state.tide;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const z = Tide.groundAt(i / sc + x0, j / sc + y0), k = (j * W + i) * 4; const land = pointOnLand(i / sc + x0, j / sc + y0);
      const v = land ? [150, 150, 140] : z > -1.3 ? [215, 190, 140] : z > -1.9 ? [150, 185, 205] : [70, 110, 150]; img.data[k] = v[0]; img.data[k + 1] = v[1]; img.data[k + 2] = v[2]; img.data[k + 3] = 255; }
    g.putImageData(img, 0, 0);
    const line = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.stroke(); };
    tr.forEach((t, k) => line(t, bots[k].name === who ? 'rgba(255,120,0,1)' : 'rgba(255,160,60,0.35)', bots[k].name === who ? 2.5 : 1));
    for (const w of wes) line(w, 'rgba(220,0,0,0.9)', 1.5);
    for (const ps of state.course.doc.tide.passages) { line(ps.pts, 'rgba(0,120,0,0.8)', 1); const D = _flatsDryStretch(ps.pts);
      // the dry stretch, thick
      let acc = 0; const seg = []; for (let i = 1; i < ps.pts.length; i++) { const a = ps.pts[i - 1], bb = ps.pts[i], L = Math.hypot(bb[0] - a[0], bb[1] - a[1]); for (let u = 0; u <= L; u += 20) { const s = acc + u; if (s >= D.d0 && s <= D.d1) seg.push([a[0] + (bb[0] - a[0]) * u / L, a[1] + (bb[1] - a[1]) * u / L]); } acc += L; }
      line(seg, 'rgba(0,160,0,1)', 4); g.fillStyle = '#004400'; g.font = 'bold 13px sans-serif'; const m = ps.pts[Math.floor(ps.pts.length / 2)]; g.fillText(ps.id, X(m[0]) + 6, Y(m[1])); }
    return c.toDataURL('image/png'); }, [seed, who, wes]);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out); await b.close(); })();

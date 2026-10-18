// Probe: what Glowtide's swimmers actually do frame to frame. The manta: its drawn span (solid pixels of the painted
// pose) through its strokes, and how often it is gliding. The hawksbills: heading swings while swimming and while
// feeding (deg peak to peak over each second, and the frequency), so a "wiggle" can be named.
//   node regatta/eval/_glowtide_motion.js      (from the repo root; served over http so the sprites can be read back)
const { chromium } = require('playwright'); const path = require('path'); const { spawn } = require('child_process');
(async () => { const port = 8600 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: path.resolve('.'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto(`http://localhost:${port}/regatta/index.html`); await p.waitForFunction(() => window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide' })); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const D = Wildlife.debug(), g = document.createElement('canvas').getContext('2d'); state.camera.x = D.mantas[0].x; state.camera.y = D.mantas[0].y; Wildlife.art.drawManta(g, D.mantas[0]); Wildlife.art.drawHawksbill(g, D.hawksbills[0]); });
  await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => {
    const D = Wildlife.debug(), M = D.mantas[0], A = Wildlife.art; M.mode = 'travel'; M.glide = -1; M.pitch = 0; const c = document.createElement('canvas'); c.width = c.height = 200; const g = c.getContext('2d');
    const spans = [], gl = [0, 0];
    for (let i = 0; i < 30 * 12; i++) { Wildlife.update(1 / 30); gl[M.glide > 0 ? 0 : 1]++;
      if (i % 2) continue; const cam = state.camera; state.camera = null; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 200, 200); g.translate(100, 100); g.rotate(-M.h); g.translate(-M.x, -M.y); A.drawManta(g, M); state.camera = cam;
      const d = g.getImageData(0, 0, 200, 200).data; let x0 = 200, x1 = -1; for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) if (d[(y * 200 + x) * 4 + 3] > 150) { if (x < x0) x0 = x; if (x > x1) x1 = x; } spans.push(x1 - x0 + 1); if (spans.length < 40) M._log = (M._log || "") + (x1 - x0 + 1) + "@" + M.beat.toFixed(2) + (M.glide > 0 ? "g" : "") + " "; }
    const H = D.hawksbills.filter(h => h.mode === 'swim'), sw = { swim: [], feed: [] };
    for (const h of H) h._h = h.h;
    const per = H.map(() => ({ swim: [], feed: [] }));
    for (let i = 0; i < 30 * 60; i++) { Wildlife.update(1 / 30); H.forEach((h, k) => { per[k][h.feed > 0 ? 'feed' : 'swim'].push(h.h); }); }
    const ptp = (arr) => { const o = []; for (let i = 0; i + 30 <= arr.length; i += 30) { const s = arr.slice(i, i + 30), m = s[0]; let lo = 0, hi = 0; for (const v of s) { const dv = Math.atan2(Math.sin(v - m), Math.cos(v - m)); lo = Math.min(lo, dv); hi = Math.max(hi, dv); } o.push((hi - lo) * 57.3); } o.sort((a, c2) => a - c2); return o.length ? `median ${o[o.length >> 1].toFixed(1)}°, 90% ${o[(o.length * 0.9) | 0].toFixed(1)}° per second` : '-'; };
    const all = { swim: [].concat(...per.map(q => q.swim.length ? [q.swim] : [])), feed: [].concat(...per.map(q => q.feed.length ? [q.feed] : [])) };
    return `manta 0 (${M.mode}): drawn span over 12 s min ${Math.min(...spans)} max ${Math.max(...spans)}; gliding ${Math.round(100 * gl[0] / (gl[0] + gl[1]))}% of frames\n  ${M._log}\\n` +
      `hawksbill heading swing, swimming: ${ptp(all.swim.flat ? all.swim.flat() : [])}\\n` + per.map((q, k) => `  #${k} swim ${ptp(q.swim)} | feed ${ptp(q.feed)}`).join('\\n'); }));
  await b.close(); srv.kill(); })();

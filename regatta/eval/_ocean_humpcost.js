// Probe: what the humpbacks cost to draw — Wildlife.drawWater over the biggest pod, with the pixels
// flushed (getImageData) each pass, so deferred fills are paid for. Served over http so the canvas
// isn't tainted. Also counts how many whales a real frame draws (on-camera cull).
//   node regatta/eval/_ocean_humpcost.js [port]      (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const { spawn } = require('child_process');
(async () => { const port = process.argv[2] || 8765;
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: path.resolve('.'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(`http://localhost:${port}/regatta/index.html`);
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame();
    const g = document.createElement('canvas').getContext('2d'); for (const calf of [false, true]) Wildlife.art.drawWhale(g, { j: 0, calf, len: 50, x: 0, y: 0, h: 0, mode: 'surface', depth: 0, ph: 0 }); });
  await p.waitForTimeout(1000);
  const r = await p.evaluate(() => {
    const d = Wildlife.debug(), W = d.whalePods.reduce((a, w) => w.members.length > a.members.length ? w : a);
    for (let i = 0; i < 60; i++) Wildlife.update(1 / 30);
    const cx = W.members.reduce((s, m) => s + m.x, 0) / W.members.length, cy = W.members.reduce((s, m) => s + m.y, 0) / W.members.length;
    state.camera = Object.assign(state.camera || {}, { x: cx, y: cy, rotation: 0 });
    const c = document.createElement('canvas'); c.width = 1400; c.height = 900; const g = c.getContext('2d');
    const frame = () => { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1e5fa6'; g.fillRect(0, 0, 1400, 900); g.translate(700 - cx, 450 - cy); Wildlife.drawWater(g); g.getImageData(0, 0, 1, 1); };
    for (let i = 0; i < 30; i++) { Wildlife.update(1 / 30); frame(); }
    const t0 = performance.now(); for (let i = 0; i < 200; i++) { Wildlife.update(1 / 30); frame(); }
    let all = 0, near = 0; for (const w of d.whalePods) for (const m of w.members) { all++; if (Math.hypot(m.x - cx, m.y - cy) < 900) near++; }
    return { msPerFrame: ((performance.now() - t0) / 200).toFixed(2), whales: all, inView: near };
  });
  console.log(r); await b.close(); srv.kill(); })();

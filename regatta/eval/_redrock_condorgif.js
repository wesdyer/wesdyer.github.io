// Probe: frames for a GIF of Redrock's condors in the REAL game view — the camera on one condor (default the first,
// sent out on its glide at once), the sim stepped by hand at 15 fps, the game's own draw(); a 3x inset of the bird,
// heading up, in the corner. Writes <dir>/f000.png ...
//   node regatta/eval/_redrock_condorgif.js <dir> [frames] [condorIndex] [glide|circle]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], N = +(process.argv[3] || 150), ci = +(process.argv[4] || 0), mode = process.argv[5] || 'glide';
  fs.mkdirSync(dir, { recursive: true });
  const W = 900, H = 600;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 400));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none'; });
  await p.waitForTimeout(1200);   // the sprites load
  await p.evaluate(({ ci, mode, W, H }) => { state.paused = true;
    for (const o of state.boats) { o.x = 1e5 + Math.random(); o.y = 1e5; }
    const C = Wildlife.debug().condors[ci]; if (mode === 'glide') { C.t = 0; C.z = 107; } else C.t = 1e9;
    const c = document.createElement('canvas'); c.width = 230; c.height = 230; c.id = 'ins'; c.style.cssText = `position:fixed;right:8px;bottom:8px;z-index:99999;border:1px solid rgba(255,255,255,0.5)`; document.body.appendChild(c);
    window.__C = C; }, { ci, mode, W, H });
  for (let f = 0; f < N; f++) {
    const note = await p.evaluate(() => { const C = window.__C;
      for (let k = 0; k < 2; k++) { for (const o of state.boats) { o.x = 1e5; o.y = 1e5; } update(1 / 30); }
      state.camera.x = C.x; state.camera.y = C.y; state.camera.rotation = 0; draw();
      const g = document.getElementById('ins').getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#3d8f9a'; g.fillRect(0, 0, 230, 230);
      g.save(); g.translate(115, 125); g.scale(1.6, 1.6); g.rotate(-C.h); g.translate(-C.x, -C.y); Wildlife.art.drawCondor(g, C); g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`${C.mode}  bank ${Math.round(C.bank * 50)}°  z ${Math.round(C.z)}`, 8, 16);
      return C.mode; });
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`) });
    if (f % 30 === 0) console.log(f, note);
  }
  await b.close(); console.log('ok', N); })();

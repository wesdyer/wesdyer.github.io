// Probe: frames for a GIF of one of Glowtide's animals in the REAL game view — the camera on it, the sim stepped by hand,
// the game's own draw(); a zoomed inset of the animal, heading up, in the corner. Writes <dir>/f000.png ...
//   node regatta/eval/_glowtide_gif.js <dir> <manta|fox|hawksbill|dugong|jelly> [index] [frames] [setup js] [steps per frame]
// (jelly: the camera on the bloom's centre, the inset a 60 u patch of it at 4x; index unused)
// `setup` runs once in the page with A (the animal; for a fox, its flock F too) in scope, e.g. "A.mode='loop';A.lt=12".
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const [dir, kind] = process.argv.slice(2, 4), idx = +(process.argv[4] || 0), N = +(process.argv[5] || 150), setup = process.argv[6] || '', steps = +(process.argv[7] || 2);
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 400));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none'; });
  await p.evaluate(() => { const A = Wildlife.art; for (const f of ['drawManta', 'drawFlyingFox', 'drawHawksbill', 'drawDugong']) try { A[f](document.createElement('canvas').getContext('2d'), { x: 0, y: 0, h: 0, beat: 0, pitch: 0, mode: 'travel', flap: 0, z: 50, len: 52, trail: [], sparks: [] }); } catch (e) {} });
  await p.waitForTimeout(1500);   // the sprites load
  await p.evaluate(({ kind, idx, setup }) => { state.paused = true;
    for (const o of state.boats) { o.x = 1e5; o.y = 1e5; }
    const D = Wildlife.debug(); let A, F;
    if (kind === 'manta') A = D.mantas[idx]; else if (kind === 'hawksbill') A = D.hawksbills[idx]; else if (kind === 'dugong') A = D.dugongs[idx]; else if (kind === 'jelly') A = { x: D.jellyBloom.cx, y: D.jellyBloom.cy, h: 0, mode: 'bloom' }; else { F = D.foxFlocks[idx]; A = F.bats[0]; }
    eval(setup);
    const c = document.createElement('canvas'); c.width = 260; c.height = 260; c.id = 'ins'; c.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99999;border:1px solid rgba(255,255,255,0.5)'; document.body.appendChild(c);
    window.__A = A; window.__F = F; window.__K = kind; }, { kind, idx, setup });
  for (let f = 0; f < N; f++) {
    const note = await p.evaluate((steps) => { const A = window.__A, K = window.__K;
      for (let k = 0; k < steps; k++) { for (const o of state.boats) { o.x = 1e5; o.y = 1e5; } update(1 / 30); }
      state.camera.x = A.x; state.camera.y = A.y; state.camera.rotation = 0; draw();
      const g = document.getElementById('ins').getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1d4a5c'; g.fillRect(0, 0, 260, 260);
      const z = K === 'jelly' ? 4 : K === 'manta' ? 2.6 : K === 'dugong' ? 3 : K === 'hawksbill' ? 5 : 4.5, W = Wildlife.art;
      g.save(); g.translate(130, 135); g.scale(z, z); g.rotate(-A.h); g.translate(-A.x, -A.y);
      if (K === 'jelly') { for (const j of Wildlife.debug().jellyBloom.jel.slice().sort((p2, q) => q.depth - p2.depth)) if (Math.abs(j.x - A.x) < 40 && Math.abs(j.y - A.y) < 40) W.drawGoldJelly(g, j); } else if (K === 'manta') W.drawManta(g, A); else if (K === 'hawksbill') W.drawHawksbill(g, A); else if (K === 'dugong') W.drawDugong(g, A); else W.drawFlyingFox(g, A);
      g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`${A.mode || (window.__F && window.__F.mode)}${A.style ? ' ' + A.style : ''}`, 8, 16);
      return A.mode || window.__F.mode; }, steps);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`) });
    if (f % 30 === 0) console.log(f, note);
  }
  await b.close(); console.log('ok', N); })();

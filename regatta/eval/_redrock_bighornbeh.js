// Probe: frames of ONE Redrock bighorn behaviour in the REAL game view (camera on the band, the game's own draw(), a
// 2.6x inset in the corner on the band, the lamb, or the rams), the sim stepped by hand at 15 fps, held for the clip.
//   node regatta/eval/_redrock_bighornbeh.js <dir> <graze|move|bed|drink|stare|flush|play|clash> [frames] [band]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], beh = process.argv[3], N = +(process.argv[4] || 90), bi = +(process.argv[5] || (beh === 'clash' ? 2 : 0));
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 420 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 400));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub, .hud, #minimap')) el.style.display = 'none'; });
  await p.waitForTimeout(1200);
  await p.evaluate(({ bi, beh }) => { state.paused = true;
    window.showRaceMessage = () => {};   // (the prestart's OVER EARLY banner, set off by parking the player's boat by the sheep)
    for (const o of state.boats) { o.x = 1e5 + Math.random(); o.y = 1e5; }
    const G = Wildlife.debug().bands[bi], M = G.members, me = state.boats[0];
    const cen = () => ({ x: M.reduce((a, m) => a + m.x, 0) / M.length, y: M.reduce((a, m) => a + m.y, 0) / M.length });
    const boatAt = (d0, d1) => { const c = cen(); for (let r = d0; r < d1; r += 8) for (let a = 0; a < 36; a++) { const x = c.x + Math.cos(a / 36 * 6.283) * r, y = c.y + Math.sin(a / 36 * 6.283) * r;
        if (!pointOnLand(x, y)) { let ok = true; for (let k = 0; k < 8; k++) if (pointOnLand(x + Math.cos(k * 0.785) * 30, y + Math.sin(k * 0.785) * 30)) ok = false; if (ok) return { x, y, h: Math.atan2(c.x - x, -(c.y - y)) }; } } return null; };
    const B = { boat: null, move: 0 };
    G.phase = 'feed'; G.t = 999; G.clashT = 999; for (const m of M) { m.mode = 'graze'; m.clash = null; }
    if (beh === 'move') { const p2 = (() => { for (let k = 0; k < 40; k++) { const q = { x: G.home.x + (Math.random() - 0.5) * 220, y: G.home.y + (Math.random() - 0.5) * 220 }; if (pointOnLand(q.x, q.y) && Math.hypot(q.x - G.leader.x, q.y - G.leader.y) > 90) return q; } })(); if (p2) { G.phase = 'move'; G.px = p2.x; G.py = p2.y; } }
    if (beh === 'bed') { G.phase = 'bed'; G.t = 999; for (const m of M) m.bedIn = Math.random() * 3; }
    if (beh === 'drink') { const sp = G.shore(); if (sp) { G.phase = 'drink'; G.sp = sp; G.t = 999; for (const m of M) { m.drunk = false; m.dspot = null; } } }
    if (beh === 'stare') { B.boat = boatAt(230, 320); }
    if (beh === 'flush') { B.boat = boatAt(200, 280); B.move = 50; }
    if (beh === 'clash') G.clashT = 0.5;
    if (B.boat) { me.x = B.boat.x; me.y = B.boat.y; me.h = B.boat.h; }
    const c0 = cen(); window.__S = { G, M, B, beh, cam: { x: c0.x, y: c0.y }, cen };
    const c = document.createElement('canvas'); c.width = 250; c.height = 250; c.id = 'ins'; c.style.cssText = 'position:fixed;right:6px;bottom:6px;z-index:99999;border:1px solid rgba(255,255,255,0.6)'; document.body.appendChild(c);
  }, { bi, beh });
  for (let f = 0; f < N; f++) {
    await p.evaluate(() => { const { G, M, B, beh, cam, cen } = window.__S, me = state.boats[0];
      for (let k = 0; k < 2; k++) {
        for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; }
        if (B.boat) { if (B.move) { const nx = B.boat.x + Math.sin(B.boat.h) * B.move / 30, ny = B.boat.y - Math.cos(B.boat.h) * B.move / 30; if (!pointOnLand(nx, ny)) { B.boat.x = nx; B.boat.y = ny; } } me.x = B.boat.x; me.y = B.boat.y; me.h = B.boat.h; me.speed = 0; } else { me.x = 1e5; me.y = 1e5; }
        if (beh === 'play') { const L = M.find(m => m.lamb); if (L && L.mode !== 'play') { L.mode = 'play'; L.pt = 0; } }
        if (beh === 'graze' || beh === 'play') { G.phase = 'feed'; G.t = 999; G.clashT = 999; }
        if (beh === 'bed') { G.phase = 'bed'; G.t = 999; }
        if (beh === 'clash' && !M.some(m => m.clash) && G.clashT > 5) G.clashT = 2;
        update(1 / 30); }
      // the inset's subject
      let fx, fy; const rams = M.filter(m => m.ram), L = M.find(m => m.lamb);
      if (beh === 'clash' && rams.length > 1) { fx = (rams[0].x + rams[1].x) / 2; fy = (rams[0].y + rams[1].y) / 2; } else if (beh === 'play' && L) { fx = L.x; fy = L.y; } else { const c = cen(); fx = c.x; fy = c.y; }
      cam.x += (fx - cam.x) * 0.15; cam.y += (fy - cam.y) * 0.15;
      state.camera.x = cam.x; state.camera.y = cam.y; state.camera.rotation = 0; draw();
      const g = document.getElementById('ins').getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#c98f5e'; g.fillRect(0, 0, 250, 250);
      const sc = beh === 'clash' || beh === 'play' ? 3.2 : 2.2;
      g.save(); g.translate(125, 125); g.scale(sc, sc); g.translate(-cam.x, -cam.y); Wildlife.art.drawBighornDust ? 0 : 0;
      for (const s of M) Wildlife.art.drawBighorn(g, s); g.restore();
      g.fillStyle = '#222'; g.font = '12px sans-serif'; g.fillText(beh + ': ' + M.map(m => m.clash ? 'clash:' + m.clash.ph : m.mode + (m.scan ? '^' : '')).join(' '), 6, 15); });
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`) });
  }
  await b.close(); console.log(beh, 'ok', N); })();

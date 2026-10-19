// Probe: frames of ONE Redrock coyote behaviour in the REAL game view (camera following it, the game's own draw(), a
// 3.5x inset heading-up in the corner), the sim stepped by hand at 15 fps; the behaviour is held for the whole clip.
//   node regatta/eval/_redrock_coyotebeh.js <dir> <walk|trot|sidetrot|stare|flush|sit|drink|pounce> [frames] [coyote]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], beh = process.argv[3], N = +(process.argv[4] || 90), ci = +(process.argv[5] || 2);
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 420 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 400));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub, .hud, #minimap')) el.style.display = 'none'; });
  await p.waitForTimeout(1200);
  await p.evaluate(({ ci, beh }) => { state.paused = true;
    for (const o of state.boats) { o.x = 1e5 + Math.random(); o.y = 1e5; }
    const K = Wildlife.debug().coyotes[ci], me = state.boats[0];
    // a boat parked on the water at a given distance from it
    const boatAt = (d0, d1) => { for (let r = d0; r < d1; r += 8) for (let a = 0; a < 36; a++) { const x = K.x + Math.cos(a / 36 * 6.283) * r, y = K.y + Math.sin(a / 36 * 6.283) * r;
        if (!pointOnLand(x, y)) { let clear = true; for (let k = 0; k < 8; k++) if (pointOnLand(x + Math.cos(k * 0.785) * 30, y + Math.sin(k * 0.785) * 30)) clear = false; if (clear) return { x, y, h: Math.atan2(K.x - x, -(K.y - y)) }; } } return null; };
    const B = { boat: null, move: 0 };
    // put it somewhere with room: the middle of its island
    const mid = { x: K.cx, y: K.cy }; if (pointOnLand(mid.x, mid.y)) { K.x = mid.x; K.y = mid.y; }
    if (beh === 'sidetrot') B.boat = boatAt(200, 270);
    if (beh === 'stare' || beh === 'sit') { B.boat = boatAt(180, 250); B.drift = 1; }
    if (beh === 'flush') { B.boat = boatAt(150, 230); B.move = 45; }
    if (beh === 'drink') { const e = K.edge(); if (e) { K.x = e.x - Math.sin(e.h) * 45; K.y = e.y + Math.cos(e.h) * 45; if (!pointOnLand(K.x, K.y)) { K.x = e.x; K.y = e.y; } K.h = e.h; K.drink = e; K.mode = 'walk'; K.tx = e.x; K.ty = e.y; } }
    if (beh === 'pounce') { for (let t = 0; t < 40; t++) { const q = K.spot(); K.h = Math.random() * 6.28; if (pointOnLand(q.x + Math.sin(K.h) * 60, q.y - Math.cos(K.h) * 60)) { K.x = q.x; K.y = q.y; break; } } K.mode = 'stalk'; K.t = 1.2; K.moving = 0; }
    if (beh === 'sit') { K.mode = 'sit'; K.t = 99; }
    if (beh === 'stare') { K.mode = 'stand'; K.t = 99; K.h += 2.2; }
    if (B.boat) { me.x = B.boat.x; me.y = B.boat.y; me.h = B.boat.h; }
    window.__S = { K, B, beh, cam: { x: K.x, y: K.y } };
    const c = document.createElement('canvas'); c.width = 230; c.height = 230; c.id = 'ins'; c.style.cssText = 'position:fixed;right:6px;bottom:6px;z-index:99999;border:1px solid rgba(255,255,255,0.6)'; document.body.appendChild(c);
  }, { ci, beh });
  for (let f = 0; f < N; f++) {
    await p.evaluate(() => { const { K, B, beh, cam } = window.__S, me = state.boats[0];
      for (let k = 0; k < 2; k++) {
        for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; }
        if (B.boat) { if (B.move) { const nx = B.boat.x + Math.sin(B.boat.h) * B.move / 30, ny = B.boat.y - Math.cos(B.boat.h) * B.move / 30; if (!pointOnLand(nx, ny)) { B.boat.x = nx; B.boat.y = ny; } }
          if (B.drift) { B.boat.h += 0.004; }
          me.x = B.boat.x; me.y = B.boat.y; me.h = B.boat.h; me.speed = 0; } else { me.x = 1e5; me.y = 1e5; }
        // hold the behaviour
        const keepGait = (g) => { if (K.mode !== g) { const q = K.ahead(K); K.mode = g; K.tx = q.x; K.ty = q.y; K.drink = null; } };   // its own choice of where next
        if (beh === 'walk') keepGait('walk');
        if (beh === 'trot' || beh === 'sidetrot') keepGait('trot');
        if (beh === 'sit' && K.mode !== 'sit') { K.mode = 'sit'; K.t = 99; }
        if (beh === 'stare' && K.mode !== 'stand') { K.mode = 'stand'; K.t = 99; }
        if (beh === 'pounce' && K.mode === 'stand') { K.mode = 'stalk'; K.t = 1.0; }
        update(1 / 30); }
      cam.x += (K.x - cam.x) * 0.2; cam.y += (K.y - cam.y) * 0.2;
      state.camera.x = cam.x; state.camera.y = cam.y; state.camera.rotation = 0; draw();
      const g = document.getElementById('ins').getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#d9b98c'; g.fillRect(0, 0, 230, 230);
      g.save(); g.translate(115, 120); g.scale(3.5, 3.5); g.rotate(-K.h); g.translate(-K.x, -K.y); Wildlife.art.drawCoyote(g, K); g.restore();
      g.fillStyle = '#222'; g.font = '12px sans-serif'; g.fillText(K.mode, 6, 15); });
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`) });
  }
  await b.close(); console.log(beh, 'ok', N); })();

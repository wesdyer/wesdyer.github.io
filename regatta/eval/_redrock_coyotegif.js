// Probe: frames for a GIF of one Redrock coyote in the REAL game view, the sim stepped by hand at 15 fps and the
// game's own draw(), with a 4x inset (heading up) — scripted through its repertoire: a trot, mousing (freeze, listen,
// spring), a drink at the edge, sitting, then a boat running in (the lope, the stop to look back).
//   node regatta/eval/_redrock_coyotegif.js <dir> [coyoteIndex]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], ci = +(process.argv[3] || 2); fs.mkdirSync(dir, { recursive: true });
  const W = 900, H = 600;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 400));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none'; });
  await p.waitForTimeout(1200);
  await p.evaluate((ci) => { state.paused = true;
    for (const o of state.boats) { o.x = 1e5 + Math.random(); o.y = 1e5; }
    const c = document.createElement('canvas'); c.width = 300; c.height = 300; c.id = 'ins'; c.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99999;border:1px solid rgba(255,255,255,0.5)'; document.body.appendChild(c);
    window.__K = Wildlife.debug().coyotes[ci]; window.__cam = { x: window.__K.x, y: window.__K.y }; }, ci);
  // the script: [from frame, what to do]
  const plan = [[0, 'trot'], [75, 'stalk'], [150, 'drink'], [255, 'sit'], [330, 'boat'], [450, 'end']];
  let f = 0;
  for (const [i, [f0, what]] of plan.entries()) { if (what === 'end') break; const f1 = plan[i + 1][0];
    await p.evaluate((what) => { const K = window.__K, me = state.boats[0];
      if (what === 'trot') { const q = K.spot(); K.mode = 'trot'; K.tx = q.x; K.ty = q.y; }
      if (what === 'stalk') { K.mode = 'stalk'; K.t = 1.6; }
      if (what === 'drink') { const e = K.edge(); if (e) { K.x = e.x - Math.sin(e.h) * 40; K.y = e.y + Math.cos(e.h) * 40; K.h = e.h; if (!pointOnLand(K.x, K.y)) { K.x = e.x; K.y = e.y; } K.drink = e; K.mode = 'walk'; K.tx = e.x; K.ty = e.y; } }
      if (what === 'sit') { K.drink = null; K.mode = 'sit'; K.t = 30; }
      if (what === 'boat') { for (let r = 120; r < 400; r += 10) { let ok = false; for (let a = 0; a < 24; a++) { const x = K.x + Math.cos(a / 24 * 6.283) * r, y = K.y + Math.sin(a / 24 * 6.283) * r; if (!pointOnLand(x, y)) { me.x = x; me.y = y; me.h = Math.atan2(K.x - x, -(K.y - y)); ok = true; break; } } if (ok) break; } window.__boat = { x: me.x, y: me.y, h: me.h }; }
    }, what);
    for (; f < f1; f++) {
      const note = await p.evaluate((what) => { const K = window.__K, me = state.boats[0];
        for (let k = 0; k < 2; k++) { for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; }
          if (window.__boat) { const B = window.__boat; B.x += Math.sin(B.h) * 40 / 30; B.y -= Math.cos(B.h) * 40 / 30; if (!pointOnLand(B.x, B.y)) { me.x = B.x; me.y = B.y; } me.h = B.h; me.speed = 0; } else { me.x = 1e5; me.y = 1e5; }
          update(1 / 30); }
        const C = window.__cam; C.x += (K.x - C.x) * 0.15; C.y += (K.y - C.y) * 0.15;
        state.camera.x = C.x; state.camera.y = C.y; state.camera.rotation = 0; draw();
        const g = document.getElementById('ins').getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#d9b98c'; g.fillRect(0, 0, 300, 300);
        g.save(); g.translate(150, 160); g.scale(4, 4); g.rotate(-K.h); g.translate(-K.x, -K.y); Wildlife.art.drawCoyote(g, K); g.restore();
        g.fillStyle = '#222'; g.font = '13px sans-serif'; g.fillText(`${K.mode}`, 8, 18);
        return K.mode; }, what);
      await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`) });
      if (f % 25 === 0) console.log(f, what, note);
    }
  }
  await b.close(); console.log('ok', f); })();

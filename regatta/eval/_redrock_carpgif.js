// Probe: frames of the game's OWN carp leaps in the real Redrock view (30 fps, the game's draw()), the camera on each
// jump from just before it leaves to its last rings, with a 3x inset. Writes <dir>/f000.png ...
//   node regatta/eval/_redrock_carpgif.js <dir> [jumps]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], J = +(process.argv[3] || 3); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 480, height: 320 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 400)); window.showRaceMessage = () => {};
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub, .hud, #minimap')) el.style.display = 'none'; });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { state.paused = true; window.__CARP_DRAWN = false;
    const c = document.createElement('canvas'); c.width = 180; c.height = 180; c.id = 'ins'; c.style.cssText = 'position:fixed;right:4px;bottom:4px;z-index:99999;border:1px solid rgba(255,255,255,0.6)'; document.body.appendChild(c); });
  let f = 0;
  for (let j = 0; j < J; j++) {
    // run until a fresh carp leap is about to leave
    await p.evaluate(() => { const me = state.boats[0]; let L = null;
      for (let i = 0; i < 30 * 40 && !L; i++) { for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; } me.x = -1600; me.y = -700; me.speed = 0; update(1 / 30);
        L = Wildlife.debug().leaps.find(q => q.kind === 'carp' && q.t >= -0.1 && q.t < 0 ); }
      window.__L = L || Wildlife.debug().leaps.find(q => q.kind === 'carp'); });
    for (let k = 0; k < 75; k++) {
      await p.evaluate(() => { const L = window.__L, me = state.boats[0]; for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; } me.x = -1600; me.y = -700; me.speed = 0; update(1 / 30);
        if (!L) return; state.camera.x = L.x; state.camera.y = L.y; state.camera.rotation = 0; draw();
        const g = document.getElementById('ins').getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(document.getElementById('gameCanvas') || document.querySelector('canvas'), 240 - 30, 160 - 30, 60, 60, 0, 0, 180, 180); });
      await p.screenshot({ path: path.join(dir, `f${String(f++).padStart(3, '0')}.png`) });
    }
  }
  await b.close(); console.log('frames', f); })();

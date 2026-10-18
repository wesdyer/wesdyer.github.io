// Probe: frames for a GIF of all of Spoonbill Flats' wildlife in the REAL game view — the sim stepped by hand, the game's
// own draw(), the camera on each subject in turn with a zoomed inset (north up) in the corner. Each scene runs a while
// undisturbed, then the player's boat sails in through it, so the flush shows too: the seals humping down into the
// channel, the spoonbills and avocets lifting off. Writes <dir>/f000.png ...
//   node regatta/eval/_flats_gif.js <dir> [frames per scene] [warm seconds: at least, then on to low water] [scenes,..] [first frame no.]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], N = +(process.argv[3] || 90), warm = +(process.argv[4] || 150);
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async (warm) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 400)); window.requestAnimationFrame = () => 0;
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    // on to low water: until some colony has most of its seals hauled out (and at least `warm` seconds)
    const D = Wildlife.debug(), hauled = () => Math.max(...D.gsealCols.map(C => C.seals.filter(s => s.mode === 'haul').length / C.seals.length));
    let i = 0; for (; i < 30 * 1800 && (i < 30 * warm || hauled() < 0.8); i++) { for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; } update(1 / 30); }
    for (let k = 0; k < 30 * 60; k++) { for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; } update(1 / 30); }   // (a minute on: dry)
    // the inset is a second pass of the game's own draw() with the world scaled up about the screen's middle: the camera
    // transform (translate to the middle, rotate, translate to the camera) gets a scale slipped in after its first step
    const cx2 = canvas.getContext('2d'), tr = cx2.translate.bind(cx2);
    cx2.translate = (x, y) => { tr(x, y); if (window.__Z && x === canvas.width / 2 && y === canvas.height / 2) cx2.scale(window.__Z, window.__Z); };
    const main = document.querySelector('canvas'); for (const el of document.body.querySelectorAll('*')) if (el !== main && !el.contains(main) && el.tagName !== 'SCRIPT') el.style.visibility = 'hidden';   // the HUD off
    const c = document.createElement('canvas'); c.width = 330; c.height = 330; c.id = 'ins'; c.style.cssText = 'position:fixed;right:8px;bottom:8px;width:330px;height:330px;z-index:99999;border:1px solid rgba(255,255,255,0.6);visibility:visible'; document.body.appendChild(c); }, warm);
  await p.waitForTimeout(3000);   // the paintings load
  const scenes = (process.argv[5] || 'seals,spoonbills,avocets,crabs').split(',');
  let f = +(process.argv[6] || 0);
  for (const sc of scenes) {
    // the subject: the colony with most seals hauled out; the flock nearest the camera that is feeding; the busiest crab bed
    await p.evaluate((sc) => { const D = Wildlife.debug(); let S;
      if (sc === 'seals') S = D.gsealCols.slice().sort((a, c) => c.seals.filter(s => s.mode === 'haul').length - a.seals.filter(s => s.mode === 'haul').length)[0];
      else if (sc === 'crabs') { const edge = (B) => B.crabs.filter(q => { const d = Tide.depthAt(q.x, q.y); return d > -0.1 && d < 0.2; }).length; S = D.scrabBeds.slice().sort((a, c) => edge(c) - edge(a))[0]; }
      else S = (sc === 'spoonbills' ? D.spoonFlocks : D.avoFlocks).find(F => F.mode === 'feed' && !F.roosting) || (sc === 'spoonbills' ? D.spoonFlocks : D.avoFlocks)[0];
      window.__S = S; window.__sc = sc; const x = S.cx, y = S.cy;
      window.__cam = { x, y }; window.__boat = sc === 'seals' ? { x: x - 560, y: y + 280 } : { x: x - 220, y: y + 110 };   /* (the seals: from further out, so they are seen to come alert before they go) */ }, sc);
    for (let i = 0; i < N; i++, f++) {
      const note = await p.evaluate(({ i, N }) => { const S = window.__S, sc = window.__sc, me = state.boats[0], B = window.__boat;
        // the boat: parked away for the first half, then sailing in through the subject at 8 kn
        const inb = i > N * (sc === 'seals' ? 0.12 : 0.35) && sc !== 'crabs';
        for (let k = 0; k < 2; k++) {
          for (const o of state.boats) if (o !== me || !inb) { o.x = 1e5 + o.id * 300; o.y = 1e5; }
          if (inb) { const tx = S.cx + 300, ty = S.cy - 150, d = Math.hypot(tx - B.x, ty - B.y), v = (sc === 'seals' ? 75 : 120) / 30; B.x += (tx - B.x) / d * v; B.y += (ty - B.y) / d * v; me.x = B.x; me.y = B.y; me.heading = Math.atan2(tx - B.x, -(ty - B.y)); }
          update(1 / 30); }
        // the camera follows the subject (a flock in the air: its birds' middle)
        let cx = S.cx, cy = S.cy;
        const birds = S.birds || S.crabs; if (birds) { cx = birds.reduce((a, q) => a + q.x, 0) / birds.length; cy = birds.reduce((a, q) => a + q.y, 0) / birds.length; }
        const C = window.__cam; C.x += (cx - C.x) * 0.15; C.y += (cy - C.y) * 0.15;
        state.camera.x = C.x; state.camera.y = C.y; state.camera.rotation = 0;
        const g = document.getElementById('ins').getContext('2d'), W = Wildlife.art, z = sc === 'seals' ? 2 : sc === 'crabs' ? 4 : sc === 'spoonbills' ? 3.2 : 3.6;
        const M = canvas; window.__Z = z; draw(); window.__Z = 0; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(M, M.width / 2 - 165, M.height / 2 - 165, 330, 330, 0, 0, 330, 330); draw();
        const mode = sc === 'seals' ? Object.entries(S.seals.reduce((a, s) => (a[s.mode] = (a[s.mode] || 0) + 1, a), {})).map(([k, v]) => v + ' ' + k).join(', ') : sc === 'crabs' ? S.crabs.length + ' crabs' : S.mode + (S.roosting ? ' (roost)' : '');
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, 330, 22); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(`${sc}: ${mode}`, 8, 15);
        return mode; }, { i, N });
      await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`) });
      if (i % 30 === 0) console.log(sc, i, note);
    }
  }
  await b.close(); console.log('ok', f); })();

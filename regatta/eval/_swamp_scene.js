// Probe: follow one of Gatorgrass Bayou's animals (or VENUE=<key>'s) in the REAL game view, the camera on it each frame; writes frames.
//   node regatta/eval/_swamp_scene.js <framesdir> <pick js: returns the animal, `D` = Wildlife.debug()> [frames] [js run once, `a` = the animal] [step frames per shot]
// ZOOM=4 instead renders the animal's own layers (Wildlife.drawWater/drawPerched/drawAir) onto a canvas zoomed about it,
// over flat bayou water — the art at a size you can judge.
// e.g.  node regatta/eval/_swamp_scene.js /tmp/g 'D.lurkers[3]' 60 "a.mode='swim'; a.t=20"
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const CW = +(process.env.CLIPW || 320), CH = +(process.env.CLIPH || 240);   // CLIPW/CLIPH: the shot's size; BG: the ZOOM backdrop
(async () => { const out = process.argv[2], pick = process.argv[3], N = +(process.argv[4] || 60), once = process.argv[5] || '', step = +(process.argv[6] || 2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: process.env.ZOOM ? 3 : 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate((v) => { window.__VENUE = v; }, process.env.VENUE || 'swamp');
  await p.evaluate(async ({ pick, once }) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: window.__VENUE || 'swamp', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 100));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    window.__park = () => { for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; } };
    for (let i = 0; i < 60; i++) { __park(); update(1 / 30); }
    const D = Wildlife.debug(); window.__A = (0, eval)('(D) => (' + pick + ')')(D); const a = window.__A; if (once) (0, eval)('(a) => {' + once + '}')(a); }, { pick, once });
  await p.evaluate(([z, bg]) => { window.__ZOOM = z; window.__BG = bg; }, [+(process.env.ZOOM || 0), process.env.BG || '']);
  await new Promise(r => setTimeout(r, 2500));
  for (let i = 0; i < N; i++) {
    const r = await p.evaluate((step) => { for (let k = 0; k < step; k++) { __park(); update(1 / 30); } const a = __A; state.camera.mode = 'north'; state.camera.fx = a.x; state.camera.fy = a.y; state.camera.x = a.x; state.camera.y = a.y; state.camera.rotation = 0; draw();
      const Z = +window.__ZOOM || 0;
      if (Z) { let c = document.getElementById('__zc'); if (!c) { c = document.createElement('canvas'); c.id = '__zc'; c.width = 320 * 3; c.height = 240 * 3; Object.assign(c.style, { position: 'fixed', left: '440px', top: '280px', width: '320px', height: '240px', zIndex: 99999 }); document.body.appendChild(c); }
        const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = window.__BG || '#4f5a33'; g.fillRect(0, 0, c.width, c.height);
        g.setTransform(Z * 3, 0, 0, Z * 3, c.width / 2 - Z * 3 * a.x, c.height / 2 - Z * 3 * a.y);
        Wildlife.drawWater(g); Wildlife.drawPerched(g); Wildlife.drawAir(g); }
      return { m: a.mode }; }, step);
    await p.screenshot({ path: path.join(out, `f${String(i).padStart(3, '0')}.png`), clip: { x: 600 - CW / 2, y: 400 - CH / 2, width: CW, height: CH } });
    if (i % 10 == 0) console.log(i, r.m);
  }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close(); })();

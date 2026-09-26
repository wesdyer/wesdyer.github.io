// Probe: Bluewater Bonanza on screen — the player parked on the run, the sim stepped by hand,
// frames at a few moments (and, with ZOOM=<factor>, pulled back) so the swell's sets read.
//   node regatta/eval/_ocean_shot.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/ocean_shot'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Swell && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 300));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none'; });
  for (const k of [0, 1, 2, 3]) {
    const info = await p.evaluate(({ k, zoom }) => { const me = state.boats[0];
      for (let i = 0; i < 30 * 12; i++) { me.x = 4000; me.y = -2500; me.heading = Math.PI / 2; me.speed = 0; update(1 / 30); }
      if (zoom) state.camera.zoom = (state.camera.zoom || 1) / zoom;
      draw(); const P = Swell.primary(); return `t${Math.round(Swell.now())} set here ${Swell.setAt(P, me.x, me.y).toFixed(2)}`; }, { k, zoom: +(process.env.ZOOM || 0) });
    await p.screenshot({ path: path.join(out, `run_${k}.png`) }); console.log(k, info); }
  console.log(errs.length ? 'page errors: ' + errs[0] : 'no page errors'); await b.close(); })();

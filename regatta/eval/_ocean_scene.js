// Probe: Bluewater Bonanza's animals in the scene — the real canvas stepped by hand, the camera
// on the mother and calf, on pod A (forced to breach), and on a fast boat with its dolphins and
// flying fish.   node regatta/eval/_ocean_scene.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/ocean_scene'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 300));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none'; });
  for (const shot of ['calf', 'breach', 'feed', 'bow']) {
    const info = await p.evaluate((shot) => { const me = state.boats[0], d = Wildlife.debug();
      const W = shot === 'calf' ? d.whalePods.find(w => w.cfg.calf) : d.whalePods.find(w => w.cfg.id === 'A');
      const m = W.members[0];
      if (shot === 'breach' || shot === 'feed') { m.mode = 'surface'; m.ev = null; m.breaths = 3; m.blowT = 5; }
      const steps = shot === 'breach' ? 58 : shot === 'feed' ? 30 : 90;
      if (shot === 'breach' || shot === 'feed') { m.ev = shot; m.evT = 0; m.sd = 1; m.slaps = 1; m.crashed = false; }
      for (let i = 0; i < steps; i++) {
        if (shot === 'bow') { me.x = 5000 + i * 4; me.y = -500; me.heading = Math.PI / 2 + 0.3; me.speed = 4.2; }
        else { me.x = m.x + 320; me.y = m.y + 260; me.heading = 0.5; me.speed = 0; }
        update(1 / 30); }
      state.camera.x = shot === 'bow' ? me.x : m.x; state.camera.y = shot === 'bow' ? me.y : m.y; draw();
      return { mode: m.mode, ev: m.ev, riders: d.riders.filter(s => s.boat).length, flyfish: d.flyfish.length }; }, shot);
    await p.screenshot({ path: path.join(out, `${shot}.png`) }); console.log(shot, JSON.stringify(info)); }
  console.log(errs.length ? 'errors: ' + errs[0] : 'no page errors'); await b.close(); })();

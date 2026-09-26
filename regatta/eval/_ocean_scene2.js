// Probe: Bluewater Bonanza's animals the way the player meets them — the player driven fast down
// the run (dolphins should come to the bow, flying fish should burst off it, albatross quarter
// round), frames every few seconds with a 2x crop on the bow; and a whale pod watched through a
// full surfacing (the roll of the back, the blow, the dive).
//   node regatta/eval/_ocean_scene2.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/ocean_scene2'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 300));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    window.__me = { x: 2000, y: -1200 }; });
  // 1) the run: drive the player at ~16 kn heading ESE, frames at 4, 10, 16, 22 s
  let t = 0;
  for (const at of [4, 10, 16, 22]) {
    const info = await p.evaluate(({ from, to }) => { const me = state.boats[0], d = Wildlife.debug();
      for (let i = Math.round(from * 30); i < Math.round(to * 30); i++) { __me.x += Math.sin(1.75) * 240 / 30; __me.y -= Math.cos(1.75) * 240 / 30;
        me.x = __me.x; me.y = __me.y; me.heading = 1.75; me.speed = 4.0; update(1 / 30); }
      draw();
      const S = d.riders.find(s => s.boat === me);
      return { riding: S ? S.state : 'none', near: S ? S.members.map(m => Math.round(Math.hypot(m.x - me.x, m.y - me.y))).join(',') : '-',
        flyfish: d.flyfish.filter(f => f.t >= 0 && f.t < f.dur).length, albatross: d.gliders.map(G => Math.round(Math.hypot(G.x - me.x, G.y - me.y))).join(',') }; }, { from: t, to: at });
    t = at;
    await p.screenshot({ path: path.join(out, `run_${at}s.png`) });
    console.log(`run ${at}s`, JSON.stringify(info));
  }
  // 2) a whale pod through a surfacing: park the player well off, watch pod B's lead whale
  for (const [name, sec] of [['w_roll', 1.2], ['w_roll2', 2.4], ['w_under', 8]]) {
    await p.evaluate(({ sec, first }) => { const me = state.boats[0], d = Wildlife.debug(), W = d.whalePods.find(w => w.cfg.id === 'B'), m = W.members[0];
      if (first) { m.mode = 'surface'; m.ev = null; m.breaths = 3; m.blowT = 0; }
      for (let i = 0; i < sec * 30; i++) { me.x = m.x + 230; me.y = m.y + 170; me.speed = 0; update(1 / 30); }
      state.camera.x = m.x; state.camera.y = m.y; draw(); }, { sec, first: name === 'w_roll' });
    await p.screenshot({ path: path.join(out, `${name}.png`) });
  }
  console.log(errs.length ? 'errors: ' + errs[0] : 'no page errors'); await b.close(); })();

// Probe: follow one of Pearl Lagoon's cruisers in the REAL game view (the painted sea bed under it), the camera on
// it each frame; writes frames for a GIF and logs the bed depth under it and its own depth.
//   node regatta/eval/_lagoon_scene_follow.js <framesdir> <kind> [index] [frames] [js run once after warm-up, `f` = the animal]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2], kind = process.argv[3], idx = +(process.argv[4] || 0), N = +(process.argv[5] || 120), once = process.argv[6] || '';
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async ({ kind, idx, once }) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 100));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    window.__park = () => { for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; } };
    for (let i = 0; i < 90; i++) { __park(); update(1 / 30); }
    const G = Wildlife.debug().cruisers.find(G => G.cfg.kind === kind); window.__F = G.fish[idx]; const f = window.__F; if (once) (0, eval)('(f) => {' + once + '}')(f); }, { kind, idx, once });
  await new Promise(r => setTimeout(r, 3000));
  const log = [];
  for (let i = 0; i < N; i++) {
    const r = await p.evaluate(() => { for (let k = 0; k < 2; k++) { __park(); update(1 / 30); } const f = __F; state.camera.mode = 'north'; state.camera.fx = f.x; state.camera.fy = f.y; state.camera.x = f.x; state.camera.y = f.y; state.camera.rotation = 0; draw();
      return { d: f.depth, bed: Wildlife.debug().bedAt ? Wildlife.debug().bedAt(f.x, f.y) : null, m: f.mode, up: !!f.sfOn }; });
    if (i % 10 == 0) log.push(`${i} depth=${r.d.toFixed(2)} bed=${r.bed} ${r.m}${r.up ? ' FIN' : ''}`);
    await p.screenshot({ path: path.join(out, `f${String(i).padStart(3, '0')}.png`), clip: { x: 600 - 200, y: 400 - 150, width: 400, height: 300 } });
  }
  console.log(log.join('\n')); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close(); })();

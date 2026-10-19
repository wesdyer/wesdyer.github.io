// Probe: frames of one of Glowtide's moon-jelly drifts at night, the camera on it (crop and enlarge the frames: the game
// view has no zoom), to watch the bells tilt, rise and sink and the arms trail. Writes <dir>/f000.png ...
//   node regatta/eval/_glowtide_moonjelly.js <dir> [frames] [drift index] [unused] [steps per frame]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], N = +(process.argv[3] || 60), di = +(process.argv[4] || 0), Z = +(process.argv[5] || 3), steps = +(process.argv[6] || 2);
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 400));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none'; state.paused = true; });
  await p.waitForTimeout(1500);
  for (let f = 0; f < N; f++) {
    const note = await p.evaluate(({ di, Z, steps }) => { for (let k = 0; k < steps; k++) { for (const o of state.boats) { o.x = 1e5; o.y = 1e5; } update(1 / 30); }
      const q = state.course.props.filter(r => /jelly/.test(r.kind))[di];
      const ms = q._jelly || [], cx = q.x + ms.reduce((a, m) => a + m.ox + m.sx, 0) / Math.max(1, ms.length), cy = q.y + ms.reduce((a, m) => a + m.oy + m.sy, 0) / Math.max(1, ms.length);
      state.camera.x = cx; state.camera.y = cy; state.camera.rotation = 0; draw();
      return ms.map(m => (m.pitch < 0 ? 'v' : '^') + m.z.toFixed(1)).join(' '); }, { di, Z, steps });
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`) });
    if (f % 20 === 0) console.log(f, note);
  }
  await b.close(); })();

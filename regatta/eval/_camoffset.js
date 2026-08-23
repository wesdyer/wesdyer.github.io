// WHERE ON SCREEN DOES THE BOAT ACTUALLY SIT?
//
// Projects the hull through the same transform draw() uses and reports its position as a
// fraction of the frame, in both camera modes and across a range of headings. The claim
// being checked is not "the camera moved" but "the boat is at 3/4 down and STAYS there
// whichever way it is pointing" — an offset applied along the wrong axis passes the first
// and fails the second.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);

  const r = await p.evaluate(() => {
    state.paused = true;
    settings.venue = 'ocean'; resetGame(); startRace();
    for (const bt of state.boats) bt.isPlayer = false;
    for (let i = 0; i < 1800; i++) update(1 / 60);
    const out = [];
    const wantHeading = 0.5 + CAM_LOOK_AHEAD;   // read from the code, never restated here
    // The projection draw() applies: translate(centre) -> rotate(-rot) -> translate(-cam).
    const screenOf = (wx, wy) => {
      const rot = -state.camera.rotation;
      const dx = wx - state.camera.x, dy = wy - state.camera.y;
      return { x: (canvas.width / 2 + dx * Math.cos(rot) - dy * Math.sin(rot)) / canvas.width,
               y: (canvas.height / 2 + dx * Math.sin(rot) + dy * Math.cos(rot)) / canvas.height };
    };
    // ⚠️ TWO CONDITIONS, because the camera lerps toward its target at 10% a frame and so
    // TRAILS a moving boat by an amount proportional to speed. That lag is pre-existing and
    // is not what this is testing — `north` mode, which the offset does not touch, shows the
    // same few percent of it. Hove-to isolates the offset; under way shows what the lag adds.
    for (const hove of [true, false]) {
      for (const mode of ['heading', 'north']) {
        state.camera.mode = mode;
        for (const hdgDeg of [0, 45, 90, 180, 270]) {
          const bt = state.boats[0];
          for (let i = 0; i < 400; i++) {
            bt.heading = hdgDeg * Math.PI / 180;
            if (hove) { bt.speed = 0; bt.velocity.x = 0; bt.velocity.y = 0; }
            update(1 / 60);
            if (hove) { bt.speed = 0; bt.velocity.x = 0; bt.velocity.y = 0; }
          }
          const s = screenOf(bt.x, bt.y);
          out.push({ hove, mode, hdg: hdgDeg, sx: +s.x.toFixed(3), sy: +s.y.toFixed(3),
                     want: +wantHeading.toFixed(3), kn: +(bt.speed * 4).toFixed(1) });
        }
      }
    }
    return out;
  });

  console.log('  boat position as a fraction of the frame (0.5,0.5 = centre)');
  let bad = 0;
  for (const o of r) {
    const want = o.mode === 'heading' ? o.want : 0.5;
    // Hove-to must be exact; under way is allowed the follow lag, which is bounded by what
    // `north` mode shows in the same run.
    const tol = o.hove ? 0.01 : 0.04;
    const ok = Math.abs(o.sy - want) < tol && Math.abs(o.sx - 0.5) < tol;
    if (!ok) bad++;
    console.log(`    ${(o.hove ? 'hove-to' : 'under way').padEnd(10)} ${o.mode.padEnd(8)} hdg ${String(o.hdg).padStart(3)}°` +
      `   x ${o.sx.toFixed(3)}  y ${o.sy.toFixed(3)}   want y=${want} ±${tol}  ${ok ? 'ok' : 'OFF'}`);
  }
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  console.log(bad === 0 ? `  PASS — pinned at ${r[0].want} down in heading mode, centred in north`
                        : `  FAIL — ${bad} case(s) off`);
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();

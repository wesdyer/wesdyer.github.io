// DOES THE BOAT HOLD ITS PLACE ON SCREEN THROUGH A TURN?
//
// The reported symptom was that it "rocks and then comes back" after turning — which is what
// a look-ahead offset does when the camera LERPS toward it: rotating the camera swings that
// target through an arc a quarter of the screen in radius, and the follow cannot keep up.
//
// So: tack the boat 90 degrees and sample its screen position every frame through the turn
// and the settle. What matters is the EXCURSION — how far it wanders from its resting spot —
// not where it ends up.
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
    settings.venue = 'ocean'; settings.cameraMode = 'heading';
    resetGame(); startRace();
    for (const bt of state.boats) bt.isPlayer = false;
    state.camera.mode = 'heading';
    for (let i = 0; i < 1800; i++) update(1 / 60);
    const bt = state.boats[0];
    const screenYFrom = (cx, cy) => {
      const rot = -state.camera.rotation;
      const dx = bt.x - cx, dy = bt.y - cy;
      return (canvas.height / 2 + dx * Math.sin(rot) + dy * Math.cos(rot)) / canvas.height;
    };
    const screenY = () => screenYFrom(state.camera.x, state.camera.y);
    // ⚠️ THE OLD RULE, RUN ALONGSIDE THE NEW ONE ON THE SAME TRAJECTORY. Both cameras see
    // identical boat motion and identical rotation, so the difference between them is the
    // rule and nothing else — which a before/after across two runs could not promise, since
    // the boat would not sail the same water twice.
    const LOOK = canvas.height * 0.25;
    let oldX = state.camera.x, oldY = state.camera.y;
    const stepOld = () => {
      const tx = bt.x + Math.sin(state.camera.rotation) * LOOK;
      const ty = bt.y - Math.cos(state.camera.rotation) * LOOK;
      oldX += (tx - oldX) * 0.1; oldY += (ty - oldY) * 0.1;
    };
    const hold = (deg, n) => { const t = deg * Math.PI / 180; for (let i = 0; i < n; i++) { bt.heading = t; update(1 / 60); stepOld(); } };
    hold(0, 400);                                   // settle on one heading
    const rest = screenY(), restOld = screenYFrom(oldX, oldY);
    const trace = [], traceOld = [];
    // A 90-degree turn at roughly a real tack rate, then let it settle.
    for (let i = 0; i < 60; i++) { bt.heading = (i / 60) * Math.PI / 2; update(1 / 60); stepOld(); trace.push(screenY()); traceOld.push(screenYFrom(oldX, oldY)); }
    for (let i = 0; i < 240; i++) { bt.heading = Math.PI / 2; update(1 / 60); stepOld(); trace.push(screenY()); traceOld.push(screenYFrom(oldX, oldY)); }
    return { rest: +rest.toFixed(4), restOld: +restOld.toFixed(4),
             trace: trace.map(v => +v.toFixed(4)), traceOld: traceOld.map(v => +v.toFixed(4)),
             end: +trace[trace.length - 1].toFixed(4) };
  });
  const dev = r.trace.map(v => Math.abs(v - r.rest));
  const devOld = r.traceOld.map(v => Math.abs(v - r.restOld));
  const maxDev = Math.max(...dev), maxOld = Math.max(...devOld);
  console.log(`  resting screen-y      ${r.rest}   (old rule ${r.restOld})`);
  console.log(`  worst excursion       OLD ${maxOld.toFixed(4)} = ${(maxOld * 1000).toFixed(0)} px on a 1000px frame`);
  console.log(`                        NEW ${maxDev.toFixed(4)} = ${(maxDev * 1000).toFixed(0)} px`);
  console.log(`  frames beyond 1% off  OLD ${devOld.filter(d => d > 0.01).length} / ${devOld.length}` +
              `      NEW ${dev.filter(d => d > 0.01).length} / ${dev.length}`);
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  console.log(maxDev < 0.02 ? '  PASS — holds its place through the turn' : '  ROCKS — excursion is visible');
  await b.close();
})();

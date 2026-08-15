// THE EDIT'S ONE HARD CONSTRAINT: nine venues must come out of it unchanged.
//
// surfSeaAt forked the surf layer into a swell branch and a wind branch, and the wind branch
// is meant to hand back exactly the constants the code used inline before — same ramp, same
// hard lee cutoff, same two crests, same clock, same crest style. "Meant to" is not a test.
//
// ⚠️ IT COMPARES DRAW CALLS, NOT PIXELS, and that is forced rather than chosen. A canvas
// hash is unstable between two runs of the SAME tree: `fxRand` is deliberately not reseeded
// per race, the rAF loop draws from it for an arbitrary number of wall-clock frames before a
// harness can get in, and the foam blobs on screen are therefore different every run. That
// is working as designed (see the fxRand note in script.js) — but it means the pixels can
// never be byte-compared. Everything the sim owns IS deterministic (measured: boats, wind,
// gusts and the clock all match exactly), so wrapping the context and recording what
// drawSurf actually asks for is both stable and a tighter test than pixels would have been.
//
// Usage:
//   mkdir -p /tmp/surfbase && cp -R regatta /tmp/surfbase/
//   git -C . show <pre-change-rev>:regatta/js/script.js > /tmp/surfbase/regatta/js/script.js
//   node eval/_surf_identity.js /tmp/surfbase
//
// <baseTreeDir> is any tree containing a `regatta/` with the OLD script.js in it.
const { chromium } = require('playwright');
const path = require('path');
const crypto = require('crypto');
const BASE = process.argv[2];
const VENUES = ['bay','lake','lagoon','swamp','river','redrock','glowtide','arctic','seatrials','ocean'];

async function trace(page, root, venue) {
  await page.goto('file://' + path.resolve(root, 'regatta/index.html'));
  await page.waitForTimeout(1100);
  return page.evaluate((v) => {
    state.paused = true;                 // before anything else: the loop steps on wall clock
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    settings.venue = v; resetGame(); startRace();
    state.time = 0;
    for (let i = 0; i < 1500; i++) update(1 / 60);
    // Park where there is the most coast, so the trace is ABOUT the surf.
    let best = null;
    for (const isl of (state.course.islands || [])) {
      if (isl.hidden || isl.awash || !isl.vertices || isl.vertices.length < 3) continue;
      const wet = surfDryEdges(isl).filter(d => !d).length;
      if (!best || wet > best.wet) best = { x: isl.x, y: isl.y, wet };
    }
    // ⚠️ RE-PARKED BEFORE EVERY DRAW, not once at the top. The loop below advances the
    // world between traces, and update() moves the camera — so a camera set once drifts back
    // onto the player after the first drawSurf and the remaining traces are taken from
    // somewhere else entirely. That is what made this report six false regressions the day
    // the follow camera changed: drawSurf was identical, the VIEW was not.
    const park = () => {
      if (best) { state.camera.x = best.x; state.camera.y = best.y; }
      state.camera.rotation = 0;
    };
    park();

    // Record every path primitive drawSurf issues, at four points in the wave cycle so the
    // whole animation is covered rather than one instant of it.
    const ctx = canvas.getContext('2d');
    const log = [];
    const keep = {};
    for (const m of ['moveTo', 'lineTo', 'stroke', 'beginPath']) {
      keep[m] = ctx[m];
      ctx[m] = function (...a) { log.push(m + a.map(z => (+z).toFixed(3)).join(',')); return keep[m].apply(ctx, a); };
    }
    const sd = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'strokeStyle');
    const lw = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'lineWidth');
    Object.defineProperty(ctx, 'strokeStyle', { set(x) { log.push('S' + x); sd.set.call(ctx, x); }, get() { return sd.get.call(ctx); } });
    Object.defineProperty(ctx, 'lineWidth', { set(x) { log.push('W' + (+x).toFixed(3)); lw.set.call(ctx, x); }, get() { return lw.get.call(ctx); } });
    for (let k = 0; k < 4; k++) { park(); drawSurf(ctx); for (let i = 0; i < 20; i++) update(1 / 60); }
    for (const m of Object.keys(keep)) ctx[m] = keep[m];
    return log.join(';');
  }, venue);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const h = (x) => crypto.createHash('sha1').update(x).digest('hex').slice(0, 12);

  // Control: the same tree twice. If this moves, the instrument is broken, not the code.
  const c1 = await trace(p, BASE, 'bay'), c2 = await trace(p, BASE, 'bay');
  console.log(`  ${'CONTROL'.padEnd(10)} base vs base on bay: ${h(c1) === h(c2) ? 'stable' : 'UNSTABLE — cannot compare'} (${c1.length} calls)`);
  if (h(c1) !== h(c2)) { await b.close(); process.exit(2); }

  let bad = 0;
  for (const v of VENUES) {
    const a = await trace(p, BASE, v);
    const c = await trace(p, '.', v);
    const same = h(a) === h(c);
    if (!same && v !== 'ocean') bad++;
    const verdict = v === 'ocean' ? (same ? 'UNCHANGED (expected a change!)' : 'CHANGED (expected)')
                                  : (same ? 'identical' : 'DIFFERS — REGRESSION');
    console.log(`  ${v.padEnd(10)} ${h(a)} vs ${h(c)}  n=${String(a.length).padEnd(7)} ${verdict}`);
  }
  console.log('errors', errs.length ? errs.slice(0, 4) : 'none');
  console.log(bad === 0 ? 'PASS — the wind venues draw exactly what they drew before'
                        : `FAIL — ${bad} venue(s) changed`);
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();

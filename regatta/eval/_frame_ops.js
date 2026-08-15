// WHAT DOES ONE FRAME ASK THE CANVAS FOR?
//
// Timing in headless tells you about a software rasteriser. Some operations are cheap there
// and expensive on a real GPU — a fresh gradient object every frame, a shadowBlur, a
// getImageData that forces a readback, a canvas allocated inside the draw path. Those are
// invisible to a headless stopwatch and are the classic causes of real-browser jank, so
// count them instead of timing them.
//
// Usage: node eval/_frame_ops.js [venue] [state]      state = downwind|upwind|free
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'ocean';
const mode = process.argv[3] || 'free';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);

  const res = await p.evaluate(({ v, m }) => {
    state.paused = true;
    settings.venue = v; resetGame(); startRace();
    for (const bt of state.boats) bt.isPlayer = false;
    for (let i = 0; i < 1500; i++) update(1 / 60);
    state.race.status = 'racing';

    const C = {};
    const bump = (k) => { C[k] = (C[k] || 0) + 1; };
    const P = CanvasRenderingContext2D.prototype;
    const wrap = (name) => { const o = P[name]; P[name] = function (...a) { bump(name); return o.apply(this, a); }; return () => { P[name] = o; }; };
    // `filter` is an accessor, not a method — mapping it through the method wrapper is what
    // threw "Illegal invocation". It is handled below with the other setters.
    const undo = ['createRadialGradient', 'createLinearGradient', 'createPattern',
                  'getImageData', 'putImageData', 'drawImage', 'fill', 'stroke',
                  'fillRect', 'arc', 'ellipse', 'save', 'setTransform']
                 .filter(k => typeof P[k] === 'function').map(wrap);
    const oc = document.createElement.bind(document);
    document.createElement = function (t, ...r) { if (t === 'canvas') bump('newCanvas'); return oc(t, ...r); };
    // shadowBlur is a setter, and a non-zero one is the expensive case.
    const sd = Object.getOwnPropertyDescriptor(P, 'shadowBlur');
    Object.defineProperty(P, 'shadowBlur', { set(x) { if (x) bump('shadowBlur>0'); sd.set.call(this, x); }, get() { return sd.get.call(this); } });
    const fd = Object.getOwnPropertyDescriptor(P, 'filter');
    if (fd && fd.set) Object.defineProperty(P, 'filter', { set(x) { if (x && x !== 'none') bump('filter'); fd.set.call(this, x); }, get() { return fd.get.call(this); } });

    const FRAMES = 60;
    for (let i = 0; i < FRAMES; i++) {
      if (m !== 'free') {
        const twa = m === 'downwind' ? 150 : 40;
        for (const bt of state.boats) { const w = getWindAt(bt.x, bt.y); bt.heading = w.direction + twa * Math.PI / 180; }
      }
      update(1 / 60);
      draw();
    }
    for (const u of undo) u();
    document.createElement = oc;
    const out = {};
    for (const k of Object.keys(C)) out[k] = +(C[k] / FRAMES).toFixed(1);
    return { perFrame: out, boats: state.boats.length, caps: window.SeaFX.debug().caps,
             spray: window.SeaFX.debug().spray, parts: state.particles.length };
  }, { v: venue, m: mode });

  console.log(`venue ${venue}  state ${mode}   caps ${res.caps} spray ${res.spray} particles ${res.parts}`);
  console.log('  per frame:');
  for (const [k, n] of Object.entries(res.perFrame).sort((a, c) => c[1] - a[1]))
    console.log(`    ${k.padEnd(22)} ${n}`);
  console.log('errors', errs.length ? errs.slice(0, 4) : 'none');
  await b.close();
})();

// WHO ISSUES THE 4,000 PATH OPERATIONS?
//
// A 2D canvas frame is priced in draw calls and in state changes between them, not in the
// wall time a software rasteriser takes. This wraps every draw entry point AND the canvas
// primitives, and attributes each primitive to whichever function is on top of the stack —
// so the output is a bill, per function, per frame.
//
// Usage: node eval/_frame_attrib.js [venue] [downwind|upwind|free]
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

    const stack = ['(top)'];
    const bill = {};                                  // fn -> {op -> count}
    const charge = (op) => { const f = stack[stack.length - 1]; (bill[f] = bill[f] || {})[op] = ((bill[f] || {})[op] || 0) + 1; };
    const P = CanvasRenderingContext2D.prototype;
    for (const op of ['fill', 'stroke', 'fillRect', 'drawImage', 'arc', 'ellipse',
                      'createRadialGradient', 'createLinearGradient']) {
      const o = P[op]; if (typeof o !== 'function') continue;
      P[op] = function (...a) { charge(op); return o.apply(this, a); };
    }
    const sd = Object.getOwnPropertyDescriptor(P, 'shadowBlur');
    Object.defineProperty(P, 'shadowBlur', { set(x) { if (x) charge('shadowBlur'); sd.set.call(this, x); }, get() { return sd.get.call(this); } });

    const names = Object.keys(window).filter(k => /^draw/.test(k) && typeof window[k] === 'function' && k !== 'draw');
    for (const nm of names) { const o = window[nm]; window[nm] = function (...a) { stack.push(nm); try { return o.apply(this, a); } finally { stack.pop(); } }; }
    for (const [ob, key] of [['WaterRenderer','draw'], ['Swell','draw'], ['SeaFX','draw']]) {
      const o = window[ob]; if (!o || typeof o[key] !== 'function') continue;
      const nm = ob + '.' + key, orig = o[key];
      o[key] = function (...a) { stack.push(nm); try { return orig.apply(this, a); } finally { stack.pop(); } };
    }

    const F = 60;
    for (let i = 0; i < F; i++) {
      if (m !== 'free') {
        const twa = m === 'upwind' ? 40 : 150;
        for (const bt of state.boats) {
          const w = getWindAt(bt.x, bt.y);
          bt.heading = w.direction + twa * Math.PI / 180;
          // ⚠️ `surf` FLOORS THE SPEED. Pinning a heading is not enough to reach the state
          // this is meant to price: held on a broad reach the fleet settles at 5-9 kt, below
          // the gates for planing and for the spray sheet, so "downwind" measured a slow
          // boat pointing the right way. The reported symptom is about being FAST.
          if (m === 'surf') { bt.speed = Math.max(bt.speed, 15 / 4); bt.raceState.isPlaning = true; }
        }
      }
      update(1 / 60); draw();
    }
    const rows = Object.entries(bill).map(([fn, ops]) => {
      const total = Object.values(ops).reduce((s, x) => s + x, 0);
      return { fn, perFrame: +(total / F).toFixed(1),
               ops: Object.fromEntries(Object.entries(ops).map(([k, n]) => [k, +(n / F).toFixed(1)])) };
    }).sort((a, c) => c.perFrame - a.perFrame);
    const d = window.SeaFX.debug();
    return { rows, caps: d.caps, spray: d.spray, parts: state.particles.length,
             kn: +(state.boats[0].speed * 4).toFixed(1) };
  }, { v: venue, m: mode });

  console.log(`venue ${venue}  state ${mode}   kn ${res.kn}  caps ${res.caps} spray ${res.spray} particles ${res.parts}`);
  const grand = res.rows.reduce((s, r) => s + r.perFrame, 0);
  console.log(`  TOTAL canvas ops/frame: ${grand.toFixed(0)}`);
  for (const r of res.rows.slice(0, 12))
    console.log(`    ${r.fn.padEnd(24)} ${String(r.perFrame).padEnd(8)} ${JSON.stringify(r.ops)}`);
  console.log('errors', errs.length ? errs.slice(0, 4) : 'none');
  await b.close();
})();

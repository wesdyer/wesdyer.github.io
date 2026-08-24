// DOES draw() TOUCH Math.random()?
//
// It must not. script.js's fxRand note records why: the render is camera-dependent, so any
// draw of the seeded stream makes the SIMULATION depend on where the player is looking.
// This counts calls attributable to draw() alone, with update() held still.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  const r = await p.evaluate(() => {
    state.paused = true; settings.venue = 'lake'; resetGame(); startRace();
    for (let i = 0; i < 2400; i++) update(1/60);
    let n = 0;
    const real = Math.random;
    Math.random = function () { n++; return real(); };
    n = 0; draw(); const perDraw = n;
    n = 0; update(1/60); const perUpdate = n;
    // Which functions inside draw are responsible?
    const bill = {};
    const stack = ['(draw)'];
    Math.random = function () { bill[stack[stack.length-1]] = (bill[stack[stack.length-1]]||0)+1; n++; return real(); };
    for (const k of Object.keys(window)) {
      if (!/^draw/.test(k) || typeof window[k] !== 'function' || k === 'draw') continue;
      const o = window[k];
      window[k] = function (...a) { stack.push(k); try { return o.apply(this, a); } finally { stack.pop(); } };
    }
    for (const [ob, key] of [['WaterRenderer','draw'], ['Swell','draw'], ['SeaFX','draw']]) {
      const oo = window[ob]; if (!oo || typeof oo[key] !== 'function') continue;
      const nm = ob + '.' + key, orig = oo[key];
      oo[key] = function (...a) { stack.push(nm); try { return orig.apply(this, a); } finally { stack.pop(); } };
    }
    n = 0; for (const k of Object.keys(bill)) delete bill[k];
    draw();
    Math.random = real;
    return { perDraw, perUpdate, bill };
  });
  console.log(`  Math.random() calls in one draw()   : ${r.perDraw}`);
  console.log(`  Math.random() calls in one update() : ${r.perUpdate}`);
  const rows = Object.entries(r.bill).sort((a,c)=>c[1]-a[1]);
  if (rows.length) { console.log('  attributed to:'); for (const [k,v] of rows) console.log(`    ${k.padEnd(26)} ${v}`); }
  console.log(r.perDraw === 0 ? '  PASS — the render does not touch the seeded stream'
                              : '  FAIL — the render draws from the simulation RNG');
  await b.close();
})();

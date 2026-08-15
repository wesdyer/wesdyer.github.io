// WHICH CALL OWNS THE FRAME-TIME TAIL?
//
// The existing ablation harness (_perf.js) reports a MEAN over a frozen world with the game
// paused — draw() called repeatedly with no update() between. That is the right instrument
// for steady-state paint cost and it is blind to this: a hitch that only happens when the
// world CHANGES, because something in the draw path caches and update() invalidates it.
//
// So: run the real loop, wrap every draw entry point, and report the TAIL per function.
// A mean would hide a 1-in-20 stall inside a small average; p99 and max are the whole point.
//
// Usage: node eval/_frame_spikes.js [venue] [frames]
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'ocean';
const FRAMES = parseInt(process.argv[3] || '900', 10);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);

  const res = await p.evaluate(({ v, n }) => {
    state.paused = true;
    settings.venue = v; resetGame(); startRace();
    state.boats[0].isPlayer = false;
    for (let i = 0; i < 1800; i++) update(1 / 60);

    const NAMES = Object.keys(window).filter(k =>
      /^(draw|update|bake|refresh|compute|build)/.test(k) && typeof window[k] === 'function');
    const stats = {};
    for (const nm of NAMES) {
      if (nm === 'draw' || nm === 'update') continue;      // the two we time from outside
      const orig = window[nm];
      stats[nm] = [];
      window[nm] = function (...a) {
        const t = performance.now();
        const r = orig.apply(this, a);
        stats[nm].push(performance.now() - t);
        return r;
      };
    }
    // Module methods too — they are not globals and would otherwise be invisible.
    for (const [obj, key] of [['WaterRenderer','draw'], ['Swell','draw'], ['SeaFX','draw'],
                              ['SeaFX','update'], ['Rules','update'], ['Traffic','update']]) {
      const o = window[obj]; if (!o || typeof o[key] !== 'function') continue;
      const nm = obj + '.' + key, orig = o[key]; stats[nm] = [];
      o[key] = function (...a) { const t = performance.now(); const r = orig.apply(this, a);
                                 stats[nm].push(performance.now() - t); return r; };
    }

    const frames = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      update(1 / 60); draw();
      frames.push(performance.now() - t0);
    }
    const out = {};
    for (const k of Object.keys(stats)) {
      const a = stats[k];
      if (!a.length) continue;
      a.sort((x, y) => x - y);
      const mx = a[a.length - 1];
      if (mx < 2) continue;                                 // nothing worth reporting
      out[k] = { n: a.length, p50: +a[Math.floor(a.length * .5)].toFixed(2),
                 p99: +a[Math.floor(a.length * .99)].toFixed(2), max: +mx.toFixed(2),
                 total: +a.reduce((s, x) => s + x, 0).toFixed(0) };
    }
    frames.sort((x, y) => x - y);
    return { out, frame: { p50: +frames[Math.floor(frames.length*.5)].toFixed(2),
                           p95: +frames[Math.floor(frames.length*.95)].toFixed(2),
                           p99: +frames[Math.floor(frames.length*.99)].toFixed(2),
                           max: +frames[frames.length-1].toFixed(2) } };
  }, { v: venue, n: FRAMES });

  console.log(`venue ${venue}  frame  p50 ${res.frame.p50}  p95 ${res.frame.p95}  p99 ${res.frame.p99}  max ${res.frame.max}`);
  const rows = Object.entries(res.out).sort((a, c) => c[1].max - a[1].max).slice(0, 14);
  console.log('  function                     calls   p50     p99     max     total ms');
  for (const [k, s] of rows)
    console.log(`  ${k.padEnd(28)} ${String(s.n).padEnd(7)} ${String(s.p50).padEnd(7)} ${String(s.p99).padEnd(7)} ${String(s.max).padEnd(7)} ${s.total}`);
  console.log('errors', errs.length ? errs.slice(0, 4) : 'none');
  await b.close();
})();

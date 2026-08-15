// WHY DOES BLUEWATER GO CHOPPY WHEN YOU TURN DOWNWIND AND START SURFING?
//
// Drives the real race loop by hand at a fixed step so scheduling noise is out of the
// picture, and times update() and draw() SEPARATELY on every frame. A hitch is a frame that
// does far more work than its neighbours, so what matters is the tail (p99 / max), not the
// mean — and which state the boat was in when it happened.
//
// ⚠️ HEADLESS IS SOFTWARE RASTER, so absolute ms are far above a real machine's. Treat this
// as a RELATIVE instrument: it ranks costs and measures ablation deltas honestly.
//
// Usage: node eval/_ocean_perf.js [venue] [frames]
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'ocean';
const FRAMES = parseInt(process.argv[3] || '2600', 10);

const pct = (a, q) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))] : 0;
const fmt = (a) => `p50 ${pct(a,.5).toFixed(2)}  p95 ${pct(a,.95).toFixed(2)}  p99 ${pct(a,.99).toFixed(2)}  max ${Math.max(...a).toFixed(2)}`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);

  const ABL = (process.argv[4] || '').split(',').filter(Boolean);
  const rows = await p.evaluate(({ v, n, abl }) => {
    state.paused = true;                       // take the loop off the wall clock
    settings.venue = v; resetGame(); startRace();
    state.boats[0].isPlayer = false;           // a bot sails the camera boat
    for (let i = 0; i < 1800; i++) update(1 / 60);   // through the prestart
    // Ablate AFTER the prestart, so any one-off bake a layer does still happens and only
    // its per-frame cost is removed.
    for (const f of abl) {
      const dot = f.indexOf('.');
      if (dot > 0) { const o = window[f.slice(0, dot)]; if (o) o[f.slice(dot + 1)] = () => {}; }
      else if (typeof window[f] === 'function') window[f] = () => {};
    }
    const ctx = canvas.getContext('2d');
    const out = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      update(1 / 60);
      const t1 = performance.now();
      draw();
      const t2 = performance.now();
      const bt = state.boats[0], sw = bt.swell;
      const d = window.SeaFX ? window.SeaFX.debug() : { caps: 0, spray: 0 };
      out.push([+(t1 - t0).toFixed(3), +(t2 - t1).toFixed(3),
                +(bt.speed * 4).toFixed(1), bt.raceState.isPlaning ? 1 : 0,
                sw ? +sw.surf01.toFixed(2) : 0, sw ? +sw.cosPsi.toFixed(2) : 0,
                d.caps, d.spray, state.particles.length]);
    }
    return out;
  }, { v: venue, n: FRAMES, abl: ABL });

  const U = rows.map(r => r[0]), D = rows.map(r => r[1]);
  console.log(`  update  ${fmt(U)}`);
  console.log(`  draw    ${fmt(D)}`);
  // ⚠️ COMPARE MEDIANS ACROSS STATES, NOT MEANS. Headless is a software rasteriser and
  // stalls for ~250 ms on roughly one paint in twelve — on a FROZEN world, with the game
  // paused, so it is the rasteriser and not the game. Those stalls swamp any mean; the
  // median is immune to them and is what answers "does this state cost more to draw".
  const band = (name, f) => {
    const g = rows.filter(f);
    if (g.length < 20) return `  ${name.padEnd(10)} n=${g.length} (too few)`;
    const d = g.map(r => r[1]), u = g.map(r => r[0]);
    return `  ${name.padEnd(10)} n=${String(g.length).padEnd(5)} draw p50 ${pct(d,.5).toFixed(2)} p90 ${pct(d,.9).toFixed(2)}` +
           `   update p50 ${pct(u,.5).toFixed(2)}   spray ${pct(g.map(r=>r[7]),.5)}  parts ${pct(g.map(r=>r[8]),.5)}  caps ${pct(g.map(r=>r[6]),.5)}`;
  };
  console.log(band('surfing', r => r[5] > 0.3 && r[4] > 0.35));
  console.log(band('planing', r => r[3] === 1));
  console.log(band('downwind', r => r[5] > 0.3));
  console.log(band('upwind', r => r[5] < -0.3));
  console.log(band('slow<5kt', r => r[2] < 5));
  console.log(band('fast>12kt', r => r[2] > 12));
  console.log('  caps  max', Math.max(...rows.map(r => r[6])), ' spray max', Math.max(...rows.map(r => r[7])), ' particles max', Math.max(...rows.map(r => r[8])));
  console.log('errors', errs.length ? errs.slice(0, 4) : 'none');
  await b.close();
})();

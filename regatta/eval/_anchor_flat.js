// CLUBHOUSE POINT IS UNIFORM ON PURPOSE, and this asserts that the renderer handles that
// cleanly rather than by luck.
//
// A venue with `speedVar: 0`, no gust cells and no squalls gives the pressure ramp a ZERO
// span, which is a division waiting to happen: `pressureAt` would be 0/0 and every
// per-streak channel derived from it would be NaN. Two guards stop that — PRESSURE_MIN_SPAN
// forces a minimum ramp of +/-18% about the median, and pressureAt floors the divisor — so
// every comet lands at exactly mid-ramp and the layer draws a uniform field for a uniform
// wind. That is the correct picture, not a missing feature.
//
// ⚠️ DO NOT "FIX" A FLAT READING ON THIS VENUE. It is the eval anchor; a spatially uniform
// breeze is what makes its races comparable across the regression history.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1300);
  const r = await p.evaluate(() => {
    state.paused = true; settings.venue = 'seatrials'; resetGame(); startRace();
    for (let i = 0; i < 2400; i++) { update(1 / 60); if (i % 20 === 0) draw(); }
    const bnd = state.course.boundary;
    const ext = Arena.extent(bnd);
    const ts = [], chs = [], ws = [], as = [], ls = [];
    for (let i = 0; i < 20000 && ts.length < 4000; i++) {
      const x = ext.minX + Math.random() * (ext.maxX - ext.minX);
      const y = ext.minY + Math.random() * (ext.maxY - ext.minY);
      if (!Arena.contains(bnd, x, y, 0) || !inMaskWater(x, y)) continue;
      const spd = getWindAt(x, y).speed;
      const t = pressureAt(spd);
      const c = cometCfg();
      const windiness = Math.max(0, Math.min(1, (spd - _streakRef.floor) / _streakRef.span));
      const ch = Math.min(STREAK_MAX_SPAWN, c.dens0 + c.dens1 * windiness * (0.18 + 0.82 * t * t));
      const k = streakChannels(t, 0.5, spd);
      ts.push(t); chs.push(ch); ws.push(k.halfWidth); as.push(k.alpha); ls.push(spd);
    }
    const stat = (a) => ({ min: +Math.min(...a).toFixed(4), max: +Math.max(...a).toFixed(4),
                           nan: a.filter(Number.isNaN).length });
    return { n: ts.length, pressure: state.wind.pressure, spd: stat(ls),
             t: stat(ts), chance: stat(chs), halfWidth: stat(ws), alpha: stat(as),
             onScreen: state.particles.filter(x => x.type === 'wind').length };
  });
  console.log(`  seatrials, ${r.n} water samples`);
  console.log(`    ramp: lo ${r.pressure.lo.toFixed(2)}  med ${r.pressure.med.toFixed(2)}  hi ${r.pressure.hi.toFixed(2)}   (span forced by PRESSURE_MIN_SPAN)`);
  for (const k of ['spd', 't', 'chance', 'halfWidth', 'alpha'])
    console.log(`    ${k.padEnd(10)} min ${String(r[k].min).padStart(8)}   max ${String(r[k].max).padStart(8)}   NaN ${r[k].nan}`);
  const clean = ['spd','t','chance','halfWidth','alpha'].every(k => r[k].nan === 0 && r[k].min === r[k].max);
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  console.log(clean ? '  PASS — uniform field renders uniformly, no NaN, no degenerate ramp'
                    : '  CHECK — the field is not uniform, or a channel went NaN');
  await b.close();
})();

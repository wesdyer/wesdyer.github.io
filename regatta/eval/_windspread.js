// IS THERE ANY PRESSURE INFORMATION TO SHOW?
//
// The comet layer can only report what the field contains. This samples getWindAt over each
// venue's sailable water and reports the spread — because a venue whose wind is spatially
// uniform has no pressure to read, and no amount of tuning the renderer will invent any.
//
// ⚠️ IT REPORTS THE TAILS, NOT JUST p10-p90, AND IT SAMPLES THE ARENA'S OWN BOUNDS. The first
// version did neither, and between them the two mistakes made Pearl Lagoon look FLAT when it
// is not: its puffs cover about 4% of the water, so p10 and p90 both read the background and
// the span came out 0.1 kt — while the real field runs 7.7 to 24.3 kt, a 6 kt gust over the
// median sitting in the tail. A percentile band cannot see a feature smaller than the band,
// and sampling a box around the origin misses an arena that is not centred there.
//
// `in cells` is the fraction of water inside a gust or lull, which is what separates the two
// failure modes worth telling apart: no variation at all, versus variation nobody is
// standing in.
//
// ⚠️ A NARROW READING IS NOT AUTOMATICALLY A GAP — read the table with the venue's intent in
// hand, and prefer eval/_wind_decomp.js, which says what KIND of variation a venue has:
//   Clubhouse Point  uniform ON PURPOSE. It is the eval anchor, and a spatially flat breeze
//                    is what keeps its races comparable across the regression history.
//                    eval/_anchor_flat.js asserts the renderer handles the zero-span ramp
//                    cleanly. Do not "fix" it.
//   Pearl Lagoon     Caribbean trade winds: flat to a tenth of a knot by design, with the
//                    whole 7.7-24.3 kt range coming from SQUALLS. Its p10-p90 band is
//                    meaningless on its own, which is why the tails are printed.
const { chromium } = require('playwright');
const path = require('path');
const VENUES = ['bay','lake','lagoon','swamp','river','ocean','redrock','glowtide','arctic','seatrials'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  console.log('  venue      cells  in     WIND OVER THE SAILABLE WATER (kt)          comets');
  console.log('                    cells   min   p10   p50   p90   p99   max     alive  onscreen');
  for (const v of VENUES) {
    const r = await p.evaluate((vv) => {
      state.paused = true; settings.venue = vv; resetGame(); startRace();
      for (let i = 0; i < 2400; i++) { update(1/60); if (i % 8 === 0) draw(); }
      const q = (a, f) => a.sort((x,y)=>x-y)[Math.floor(a.length*f)];
      // The arena's own bounds, so nothing is missed by guessing where the course sits.
      const bnd = state.course.boundary;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const pt of (bnd && bnd.poly ? bnd.poly : [])) {
        x0 = Math.min(x0, pt[0]); y0 = Math.min(y0, pt[1]);
        x1 = Math.max(x1, pt[0]); y1 = Math.max(y1, pt[1]);
      }
      if (x0 > x1) { x0 = y0 = -8000; x1 = y1 = 8000; }
      let inCell = 0, nWater = 0;
      const wide = [];
      for (let i = 0; i < 40000; i++) {
        const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
        if (!Arena.contains(bnd, x, y, 0) || !inMaskWater(x, y)) continue;
        nWater++;
        wide.push(getWindAt(x, y).speed);
        for (const g of state.gusts) {
          const dx = x - g.x, dy = y - g.y;
          const c = Math.cos(-g.rotation), s2 = Math.sin(-g.rotation);
          const rx0 = dx * c - dy * s2, ry = dx * s2 + dy * c;
          const rx = rx0 >= 0 ? rx0 / PUFF_NOSE : rx0 / PUFF_TAIL;
          if ((rx * rx) / (g.radiusX * g.radiusX) + (ry * ry) / (g.radiusY * g.radiusY) <= 1) { inCell++; break; }
        }
      }
      const f = (a) => a && a.length > 50 ? { p10:+q(a,.1).toFixed(1), p50:+q(a,.5).toFixed(1),
                             p90:+q(a,.9).toFixed(1), p99:+q(a,.99).toFixed(1),
                             max:+q(a,.999).toFixed(1), min:+q(a,.001).toFixed(1) } : null;
      return { cells: (state.gusts||[]).length, base: +state.wind.baseSpeed.toFixed(1),
               wide: f(wide), inCell: +(100 * inCell / Math.max(1, nWater)).toFixed(0),
               comets: state.particles.filter(x=>x.type==='wind').length,
               // ⚠️ ON SCREEN is the number a player can actually read a gradient off.
               // The alive count is inflated by the spawn box, which is 1.35x the frame on
               // each axis and so holds about three times the area of the view.
               onScreen: state.particles.filter(x => x.type === 'wind'
                 && Math.abs(x.x - state.camera.x) < canvas.width / 2
                 && Math.abs(x.y - state.camera.y) < canvas.height / 2).length };
    }, v);
    const F = (o) => o ? [o.min, o.p10, o.p50, o.p90, o.p99, o.max].map(x => String(x).padStart(5)).join(' ')
                       : '    —     —     —     —     —     —';
    console.log(`  ${v.padEnd(10)} ${String(r.cells).padStart(4)} ${String(r.inCell + '%').padStart(5)}  ${F(r.wide)}  ${String(r.comets).padStart(6)} ${String(r.onScreen).padStart(8)}`);
  }
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();

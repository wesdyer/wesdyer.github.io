// WHAT IS THE WIND FIELD ON THIS VENUE, REALLY?
//
// Percentiles alone can hide a feature that covers little area: if 99% of the water sits at
// one speed and 1% is inside a puff, p10/p90 both read the background and the venue looks
// flat when it is not. So this reports the full tail (min/p1/p99/max), the AREA FRACTION
// inside cells, and what the venue actually authored — regions and gust sources — so the
// answer to "is there anything to see" separates "no variation" from "variation nobody is
// standing in".
//
// Usage: node eval/_windfield.js [venue...]
const { chromium } = require('playwright');
const path = require('path');
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['lagoon', 'seatrials', 'lake', 'bay'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1300);
  for (const v of VENUES) {
    const r = await p.evaluate((vv) => {
      let sd = 90210;
      Math.random = () => { let t = sd += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      state.paused = true; settings.venue = vv; resetGame(); startRace();
      for (let i = 0; i < 3000; i++) update(1 / 60);
      const doc = state.course.doc || {};
      // Sample the SAILABLE water, using the arena's own bounds rather than a guess at origin.
      const bnd = state.course.boundary;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const pt of (bnd && bnd.poly ? bnd.poly : [])) {
        x0 = Math.min(x0, pt[0]); y0 = Math.min(y0, pt[1]);
        x1 = Math.max(x1, pt[0]); y1 = Math.max(y1, pt[1]);
      }
      if (x0 > x1) { x0 = y0 = -8000; x1 = y1 = 8000; }
      const spds = []; let inCell = 0, n = 0;
      for (let i = 0; i < 60000; i++) {
        const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
        if (!Arena.contains(bnd, x, y, 0) || !inMaskWater(x, y)) continue;
        n++;
        spds.push(getWindAt(x, y).speed);
        for (const g of state.gusts) {
          const dx = x - g.x, dy = y - g.y;
          const c = Math.cos(-g.rotation), s2 = Math.sin(-g.rotation);
          const rx0 = dx * c - dy * s2, ry = dx * s2 + dy * c;
          const rx = rx0 >= 0 ? rx0 / PUFF_NOSE : rx0 / PUFF_TAIL;
          if ((rx * rx) / (g.radiusX * g.radiusX) + (ry * ry) / (g.radiusY * g.radiusY) <= 1) { inCell++; break; }
        }
      }
      spds.sort((a, c) => a - c);
      const q = (f) => spds.length ? +spds[Math.min(spds.length - 1, Math.floor(spds.length * f))].toFixed(2) : null;
      return {
        n, inCellPct: +(100 * inCell / Math.max(1, n)).toFixed(1),
        min: q(0), p1: q(.01), p10: q(.1), p50: q(.5), p90: q(.9), p99: q(.99), max: q(0.999),
        regions: (doc.wind && doc.wind.regions ? doc.wind.regions : []).map(x => ({
          speed: x.speed, var: x.speedVar, dir: +(x.direction * 180 / Math.PI).toFixed(0), dirVar: +((x.dirVar || 0) * 180 / Math.PI).toFixed(0) })),
        gustSrc: (doc.gusts && doc.gusts.regions ? doc.gusts.regions : doc.gusts ? [doc.gusts] : []).length,
        cells: state.gusts.map(g => ({ t: g.type, d: +g.speedDelta.toFixed(1),
          rx: Math.round(g.radiusX), ry: Math.round(g.radiusY) })),
        arena: [Math.round(x1 - x0), Math.round(y1 - y0)]
      };
    }, v);
    console.log(`\n  ${v}  (arena ${r.arena[0]}x${r.arena[1]}u, ${r.n} water samples)`);
    console.log(`    wind kt   min ${r.min}  p1 ${r.p1}  p10 ${r.p10}  p50 ${r.p50}  p90 ${r.p90}  p99 ${r.p99}  max ${r.max}`);
    console.log(`    water inside a gust/lull cell: ${r.inCellPct}%`);
    console.log(`    authored wind regions: ${JSON.stringify(r.regions)}`);
    console.log(`    live cells: ${JSON.stringify(r.cells)}`);
  }
  console.log('\nerrors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();

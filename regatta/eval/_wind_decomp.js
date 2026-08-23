// WHERE DOES A VENUE'S WIND VARIATION COME FROM?
//
// A single spread number cannot tell a steady trade wind with squalls in it apart from a
// venue with no weather at all — both look flat in the middle of the distribution. This
// decomposes the field by silencing one source at a time: regions, gust/lull cells, squalls.
// What it answers is not "how much variation" but "what KIND", which is what decides which
// layer has to carry the information to the player.
//
// Usage: node eval/_wind_decomp.js [venue...]
const { chromium } = require('playwright');
const path = require('path');
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['lagoon', 'lake', 'ocean'];
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
      const bnd = state.course.boundary;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const pt of (bnd && bnd.poly ? bnd.poly : [])) {
        x0 = Math.min(x0, pt[0]); y0 = Math.min(y0, pt[1]);
        x1 = Math.max(x1, pt[0]); y1 = Math.max(y1, pt[1]);
      }
      // One fixed set of sample points, reused for every condition, so the conditions differ
      // only by what is switched off.
      const pts = [];
      for (let i = 0; i < 60000 && pts.length < 12000; i++) {
        const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
        if (Arena.contains(bnd, x, y, 0) && inMaskWater(x, y)) pts.push([x, y]);
      }
      const q = (a, f) => a.length ? +a[Math.min(a.length - 1, Math.floor(a.length * f))].toFixed(1) : null;
      const measure = () => {
        const s = pts.map(([x, y]) => getWindAt(x, y).speed).sort((a, c) => a - c);
        return { min: q(s, .001), p10: q(s, .1), p50: q(s, .5), p90: q(s, .9), p99: q(s, .99), max: q(s, .999) };
      };
      const gusts = state.gusts, squalls = state.squalls || [];
      const out = { all: measure(), nSq: squalls.length, nCell: gusts.length };
      state.squalls = [];                 out.noSqualls = measure();
      state.gusts = [];                   out.regionsOnly = measure();
      state.squalls = squalls;            out.noCells = measure();
      state.gusts = gusts;
      // Squall footprint, as a share of the water.
      let inSq = 0;
      for (const [x, y] of pts) {
        for (const s of squalls) {
          const dx = x - s.x, dy = y - s.y;
          const ux = -Math.sin(s.course), uy = Math.cos(s.course);
          const along = dx * ux + dy * uy, across = dx * uy - dy * ux;
          if ((along * along) / (s.ry * s.ry) + (across * across) / (s.rx * s.rx) < 1) { inSq++; break; }
        }
      }
      out.inSqualls = +(100 * inSq / Math.max(1, pts.length)).toFixed(1);
      return out;
    }, v);
    const F = (o) => [o.min, o.p10, o.p50, o.p90, o.p99, o.max].map(x => String(x).padStart(6)).join('');
    console.log(`\n  ${v}   ${r.nCell} gust/lull cells, ${r.nSq} squalls covering ${r.inSqualls}% of the water`);
    console.log('                     min   p10   p50   p90   p99   max');
    console.log(`    everything  ${F(r.all)}`);
    console.log(`    no squalls  ${F(r.noSqualls)}`);
    console.log(`    no cells    ${F(r.noCells)}`);
    console.log(`    regions only${F(r.regionsOnly)}`);
  }
  console.log('\nerrors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();

// Check which crowns the water gate lets fade, and prove the land test is not degenerate.
//   node regatta/art/_canopyprobe.js lake
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'lake';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(1500);
  await p.evaluate(v => { settings.venue = v; resetGame(); startRace(); }, venue);
  await p.waitForTimeout(9000);

  const out = await p.evaluate(() => {
    const props = state.course.props || [];
    const reg = window.VenueDoc.PROP_KINDS;
    const res = { total: props.length, byPlane: {}, canopy: 0, overWater: 0, byKind: {}, sanity: {} };
    for (const pr of props) {
      // A TWO-PLANE KIND draws in the canopy pass too, from one placement, via `parts` —
      // so it is subject to the water gate even though it declares itself `surface`.
      const k0 = reg[pr.kind] || {};
      const plane = (k0.parts && k0.parts.canopy) ? 'canopy' : (k0.plane || 'surface');
      res.byPlane[plane] = (res.byPlane[plane] || 0) + 1;
      if (plane !== 'canopy') continue;
      res.canopy++;
      const w = ((reg[pr.kind] || {}).world || 0) * (pr.scale || 1);
      const ow = crownOverWater(pr, w);
      const k = res.byKind[pr.kind] || (res.byKind[pr.kind] = { n: 0, over: 0 });
      k.n++; if (ow) { k.over++; res.overWater++; }
    }
    // SANITY: the land test must not be degenerate in either direction.
    // Sample the arena on a grid and report the land fraction; then check known points.
    const B = state.course.bounds || null;
    let land = 0, tot = 0;
    const xs = [], ys = [];
    for (const isl of state.course.islands) { xs.push(isl.x); ys.push(isl.y); }
    const x0 = Math.min(...xs) - 800, x1 = Math.max(...xs) + 800;
    const y0 = Math.min(...ys) - 800, y1 = Math.max(...ys) + 800;
    for (let i = 0; i < 60; i++) for (let j = 0; j < 60; j++) {
      const x = x0 + (x1 - x0) * i / 59, y = y0 + (y1 - y0) * j / 59;
      tot++; if (pointOnLand(x, y)) land++;
    }
    res.sanity.gridLandFraction = (land / tot).toFixed(3);
    // a point far outside every island must be water
    res.sanity.farOutsideIsLand = pointOnLand(x0 - 5000, y0 - 5000);
    // the centroid of the biggest non-awash island must be land
    const big = state.course.islands.filter(z => !z.awash && z.vertices)
      .sort((a, b) => b.radius - a.radius)[0];
    res.sanity.bigIslandCentreIsLand = big ? pointOnLand(big.x, big.y) : null;
    // THE DECISIVE ONE: the planter only ever plants on land, so a prop's own stem must be
    // on land. If this is not ~100% the land test is broken, whatever the other numbers say.
    let stemLand = 0;
    for (const pr of props) if (pointOnLand(pr.x, pr.y)) stemLand++;
    res.sanity.propStemsOnLand = (stemLand / props.length).toFixed(4);
    // and a vertex of the big island, nudged inward toward its centre, must be land
    if (big) {
      const v = big.vertices[0];
      res.sanity.bigIslandEdgeInwardIsLand =
        pointOnLand(v.x + (big.x - v.x) * 0.15, v.y + (big.y - v.y) * 0.15);
      res.sanity.bigIslandRadius = Math.round(big.radius);
      res.sanity.bigIslandVerts = big.vertices.length;
    }
    return res;
  });

  console.log(`${venue}: ${out.total} props`, out.byPlane);
  console.log(`  canopy plane: ${out.canopy}; overhanging water: ${out.overWater}` +
              ` (${(100 * out.overWater / Math.max(out.canopy, 1)).toFixed(1)}%)`);
  const rows = Object.entries(out.byKind).sort((a, b) => b[1].n - a[1].n);
  for (const [k, v] of rows)
    console.log(`    ${k.padEnd(26)} ${String(v.n).padStart(5)}  over water ${String(v.over).padStart(5)}` +
                `  ${(100 * v.over / v.n).toFixed(1)}%`);
  console.log('  SANITY', out.sanity);
  console.log('  errors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();

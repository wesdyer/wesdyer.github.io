// Map Stillwater Lake's mean wind field: coverage, speed, direction, and where the holes are.
//
//   node regatta/eval/_lakewind.js [venue]
//
// Samples regionWindAt (the MEAN field — no puffs, no lees) on a grid over sailable water
// and dumps both a PNG and the numbers. `wsum` is the thing to watch: regionWindAt gives
// the leftover weight (1 - wsum) to CALM, so anywhere the regions do not add up to 1 the
// speed is dragged toward zero even though a region is nominally overhead.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.SHOT_OUT || require('os').tmpdir();
const VENUE = process.argv[2] || 'lake';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1400);
  await page.evaluate((v) => { settings.venue = v; resetGame(); }, VENUE);
  await page.waitForTimeout(600);

  const data = await page.evaluate(() => {
    // THE MEAN FIELD, not this instant. Every region carries an oscillator, so a
    // single-instant sample reports the phase rather than the design — the first
    // run of this probe read a flat 7.8 kt everywhere because both sides happened
    // to sit near the bottom of their swing.
    WIND_MEAN_FIELD = true;
    const b = state.course.boundary || state.course.arena;
    const pts = (b && (b.poly || b.vertices || b)) || [];
    const P = pts.map(p => (Array.isArray(p) ? { x: p[0], y: p[1] } : p));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of P) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const inArena = (x, y) => {
      let inside = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        if ((P[i].y > y) !== (P[j].y > y) &&
            x < ((P[j].x - P[i].x) * (y - P[i].y)) / ((P[j].y - P[i].y) || 1e-9) + P[i].x) inside = !inside;
      }
      return inside;
    };
    const onLand = (x, y) => {
      for (const isl of (state.course.islands || [])) {
        if (isl.awash || !isl.vertices) continue;
        const dx = x - isl.x, dy = y - isl.y;
        if (dx * dx + dy * dy > isl.radius * isl.radius) continue;
        if (pointInPoly(x, y, isl.vertices)) return true;
      }
      return false;
    };
    // Region weight sum at a point — the coverage figure regionWindAt hides.
    const cover = (x, y) => {
      let wsum = 0;
      for (const r of (state.course.windRegions || [])) {
        const bb = r.bb, pad = (r.falloff || 0) / 2 + 1;
        if (x < bb.minX - pad || x > bb.maxX + pad || y < bb.minY - pad || y > bb.maxY + pad) continue;
        const w = VenueDoc.regionWeight(Arena.signedDist(r, x, y), r.falloff);
        if (w > 0) wsum += w;
      }
      return wsum;
    };
    const STEP = 40;
    const rows = [];
    for (let y = y0; y <= y1; y += STEP) {
      const row = [];
      for (let x = x0; x <= x1; x += STEP) {
        if (!inArena(x, y) || onLand(x, y)) { row.push(null); continue; }
        const w = regionWindAt(x, y);
        row.push([+w.speed.toFixed(3), +w.direction.toFixed(4), +cover(x, y).toFixed(3)]);
      }
      rows.push(row);
    }
    const R = {
      x0, y0, x1, y1, STEP, rows,
      regions: (state.course.windRegions || []).map(r => ({
        id: r.id, speed: r.speed, speedVar: r.speedVar, direction: r.direction,
        dirVar: r.dirVar, falloff: r.falloff, period: r.period,
        bb: { minX: Math.round(r.bb.minX), minY: Math.round(r.bb.minY), maxX: Math.round(r.bb.maxX), maxY: Math.round(r.bb.maxY) }
      })),
      marks: (state.course.marks || []).map(m => ({ id: m.id, x: Math.round(m.x), y: Math.round(m.y) })),
      baseSpeed: state.wind.speed, baseDir: state.wind.direction,
    };
    WIND_MEAN_FIELD = false;
    return R;
  });

  fs.writeFileSync(`${OUT}/lakewind.json`, JSON.stringify(data));
  const flat = data.rows.flat().filter(Boolean);
  const sp = flat.map(v => v[0]).sort((a, b) => a - b);
  const cv = flat.map(v => v[2]).sort((a, b) => a - b);
  const q = (a, p) => a[Math.floor(p * (a.length - 1))];
  console.log(`${VENUE}: ${flat.length} sailable samples, base wind ${data.baseSpeed.toFixed(1)} kt`);
  console.log(`  speed   min ${sp[0].toFixed(2)}  p05 ${q(sp,.05).toFixed(2)}  p50 ${q(sp,.5).toFixed(2)}  p95 ${q(sp,.95).toFixed(2)}  max ${sp[sp.length-1].toFixed(2)}`);
  console.log(`  cover   min ${cv[0].toFixed(2)}  p05 ${q(cv,.05).toFixed(2)}  p50 ${q(cv,.5).toFixed(2)}  p95 ${q(cv,.95).toFixed(2)}  max ${cv[cv.length-1].toFixed(2)}`);
  for (const t of [0.5, 1, 2, 3]) {
    const n = sp.filter(s => s < t).length;
    console.log(`  under ${t} kt: ${(100 * n / sp.length).toFixed(1)}% of sailable water`);
  }
  console.log('ERRORS', errs.length ? errs.slice(0, 4).join(' | ') : 'none');
  await browser.close();
})();

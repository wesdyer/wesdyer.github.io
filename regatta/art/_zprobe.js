// Verify at RUNTIME that vegetation paints tallest-last. Scratch tool.
//   node regatta/art/_zprobe.js lake
// Checks the compiled course's prop array (what drawProps walks) rather than the document,
// so it catches anything compileVenueDoc or the spatial index does to the order.
const { chromium } = require('playwright');
const path = require('path');

const venue = process.argv[2] || 'lake';
const HEIGHT = {
  'lake-pine-white': 32.0, 'lake-pine-red': 27.0, 'lake-aspen-quaking': 19.0,
  'lake-birch-paper': 17.0, 'lake-fir-balsam': 15.0, 'lake-alder-speckled': 4.0,
  'lake-fern-bracken': 1.2, 'lake-blueberry-lowbush': 0.4,
  'ocean-palm-coconut': 26.0, 'ocean-almond-tropical': 16.0, 'ocean-pandanus': 6.0,
  'ocean-naupaka': 2.4, 'ocean-grass-coastal': 0.9, 'ocean-morning-glory': 0.15,
  'bay-cove-oak-black': 20.0, 'bay-cove-pine-pitch': 14.0, 'bay-cove-cedar-red': 9.0,
  'bay-cove-oak-scrub': 4.5, 'bay-cove-bayberry-northern': 2.5, 'bay-cove-plum-beach': 2.0,
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(v => { settings.venue = v; resetGame(); startRace(); }, venue);
  await page.waitForTimeout(8000);

  const out = await page.evaluate((H) => {
    const props = state.course.props;
    const reg = window.VenueDoc.PROP_KINDS;
    const planes = {};
    for (const p of props) (planes[(reg[p.kind] || {}).plane || '?'] ||= []).push(p);
    const res = { total: props.length, planes: {}, unknown: [] };
    for (const [plane, list] of Object.entries(planes)) {
      let bad = 0, prev = -Infinity, seen = 0;
      for (const p of list) {
        const h = H[p.kind];
        if (h === undefined) { if (!res.unknown.includes(p.kind)) res.unknown.push(p.kind); continue; }
        seen++;
        const k = h * (p.scale || 1);
        if (k < prev - 1e-9) bad++;
        prev = k;
      }
      res.planes[plane] = { count: list.length, heightChecked: seen, violations: bad };
    }
    // and the actual paint order the renderer will use for the on-screen set
    const cam = state.camera, R = 900;
    const near = props.filter(p => (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 < R * R);
    res.onScreen = near.length;
    let bad2 = 0, prev2 = -Infinity;
    for (const p of near) {
      const h = H[p.kind]; if (h === undefined) continue;
      const k = h * (p.scale || 1);
      if (k < prev2 - 1e-9) bad2++;
      prev2 = k;
    }
    res.onScreenViolations = bad2;
    return res;
  }, HEIGHT);

  console.log(`${venue}: ${out.total} compiled props`);
  for (const [plane, v] of Object.entries(out.planes))
    console.log(`  plane ${plane.padEnd(8)} ${String(v.count).padStart(5)} props, ` +
                `${v.heightChecked} height-ranked, ${v.violations} out of order`);
  console.log(`  in view: ${out.onScreen} props, ${out.onScreenViolations} out of order`);
  if (out.unknown.length) console.log('  NO HEIGHT ENTRY:', out.unknown.join(', '));
  console.log('  page errors:', errs.length ? errs.slice(0, 3) : 'none');
  await browser.close();
})();

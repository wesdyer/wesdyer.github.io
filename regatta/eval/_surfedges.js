// How much of each venue's drawn "coastline" is actually an inland boundary between two
// kinds of ground? Guards surfDryEdges against silencing surf where it belongs.
const { chromium } = require('playwright');
const path = require('path');
const VENUES = ['bay', 'lagoon', 'arctic', 'swamp', 'river', 'lake', 'redrock', 'glowtide', 'ocean', 'seatrials'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1400);

  console.log('venue       shapes  edges  inland  %   (inland = edge whose outward probe lands in other drawn ground)');
  for (const v of VENUES) {
    await page.evaluate((vv) => { settings.venue = vv; resetGame(); }, v);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      let shapes = 0, edges = 0, dry = 0;
      for (const isl of (state.course.islands || [])) {
        if (isl.hidden || isl.isFloe || isl.awash || !isl.vertices || isl.vertices.length < 3) continue;
        shapes++; edges += isl.vertices.length;
        dry += surfDryEdges(isl).filter(Boolean).length;
      }
      return { shapes, edges, dry };
    });
    const pct = r.edges ? (100 * r.dry / r.edges).toFixed(1) : '0.0';
    console.log(`${v.padEnd(11)} ${String(r.shapes).padStart(5)} ${String(r.edges).padStart(6)} ${String(r.dry).padStart(6)}  ${pct}%`);
  }
  console.log('ERRORS', errs.length ? errs.slice(0, 4).join(' | ') : 'none');
  await browser.close();
})();

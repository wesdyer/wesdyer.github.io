// What does the canopy water gate cost? Times crownOverWater over EVERY prop with a cold
// cache — the worst case the game can ever pay, all at once, versus what it really pays
// (a couple of hundred props entering view, once each, spread over a race).
const { chromium } = require('playwright');
const path = require('path');
const venue = process.argv[2] || 'lake';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(1500);
  await p.evaluate(v => { settings.venue = v; resetGame(); startRace(); }, venue);
  await p.waitForTimeout(9000);

  const out = await p.evaluate(() => {
    const props = state.course.props || [];
    const reg = window.VenueDoc.PROP_KINDS;
    const w = pr => ((reg[pr.kind] || {}).world || 0) * (pr.scale || 1);
    for (const pr of props) delete pr._overWater;          // cold cache
    const t0 = performance.now();
    for (const pr of props) crownOverWater(pr, w(pr));
    const cold = performance.now() - t0;
    const t1 = performance.now();                           // warm: pure cache hit
    for (const pr of props) crownOverWater(pr, w(pr));
    const warm = performance.now() - t1;
    // and the realistic slice: props within one view radius, cold
    const cam = state.camera, R = Math.hypot(1400, 900) * 0.5;
    const near = props.filter(pr => (pr.x - cam.x) ** 2 + (pr.y - cam.y) ** 2 < R * R);
    for (const pr of near) delete pr._overWater;
    const t2 = performance.now();
    for (const pr of near) crownOverWater(pr, w(pr));
    const view = performance.now() - t2;
    return { n: props.length, cold, warm, nearN: near.length, view,
             islands: state.course.islands.length,
             maxVerts: Math.max(...state.course.islands.map(z => (z.vertices || []).length)) };
  });

  const fps = await p.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; performance.now() - t0 < 5000 ? requestAnimationFrame(tick)
                                                            : res(n / ((performance.now() - t0) / 1000)); };
    requestAnimationFrame(tick);
  }));

  console.log(`${venue}: ${out.n} props, ${out.islands} islands, biggest ring ${out.maxVerts} verts`);
  console.log(`  cold, ALL props at once : ${out.cold.toFixed(1)} ms   (never happens in play)`);
  console.log(`  cold, one viewport      : ${out.view.toFixed(2)} ms over ${out.nearN} props`);
  console.log(`  warm (cache hit), all   : ${out.warm.toFixed(2)} ms`);
  console.log(`  steady-state            : ${fps.toFixed(1)} fps`);
  await b.close();
})();

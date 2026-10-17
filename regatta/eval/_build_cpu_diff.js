// Race build (selectVenue + resetGame + startRace) CPU profile on two trees, diffed by function.
//   OLD=<old repo root> node regatta/eval/_build_cpu_diff.js venue [runs]
const { chromium } = require('playwright'); const path = require('path');
const V = process.argv[2] || 'bay', RUNS = +(process.argv[3] || 2);
const roots = { old: process.env.OLD, new: path.resolve('.') };
(async () => {
  const browser = await chromium.launch(); const agg = { old: {}, new: {} }, wall = { old: 0, new: 0 };
  for (let r = 0; r < RUNS; r++) for (const k of ['old', 'new']) {
    const page = await browser.newPage();
    await page.goto('file://' + path.join(roots[k], 'regatta/index.html')); await page.waitForFunction(() => window.state && typeof selectVenue === 'function');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
    wall[k] += await page.evaluate(v => { const t = performance.now(); settings.venue = v; selectVenue(v); resetGame(); startRace(); for (let i = 0; i < 3; i++) draw(); return performance.now() - t; }, V);
    const { profile } = await cdp.send('Profiler.stop');
    const dt = {}; for (let i = 0; i < profile.samples.length; i++) dt[profile.samples[i]] = (dt[profile.samples[i]] || 0) + (profile.timeDeltas[i] || 0);
    for (const n of profile.nodes) { const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}`; agg[k][key] = (agg[k][key] || 0) + (dt[n.id] || 0) / 1000 / RUNS; }
    await page.close();
  }
  console.log(`${V}: build wall ${ (wall.old / RUNS).toFixed(0)} -> ${(wall.new / RUNS).toFixed(0)} ms`);
  const keys = new Set([...Object.keys(agg.old), ...Object.keys(agg.new)]);
  [...keys].map(k => [k, agg.old[k] || 0, agg.new[k] || 0]).sort((a, b) => (b[2] - b[1]) - (a[2] - a[1])).slice(0, 12)
    .forEach(([k, a, b]) => console.log(`${a.toFixed(0).padStart(6)} -> ${b.toFixed(0).padStart(6)} ms  ${k}`));
  await browser.close(); })();

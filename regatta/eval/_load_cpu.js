// CPU profile of page load (to the clubhouse) and optionally of a venue select + race start.
//   ROOT=<repo root> node regatta/eval/_load_cpu.js [venue]
const { chromium } = require('playwright'); const path = require('path');
const ROOT = process.env.ROOT || path.resolve('.'); const V = process.argv[2];
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  const t0 = Date.now();
  await page.goto('file://' + path.join(ROOT, 'regatta/index.html'));
  await page.waitForFunction(() => window.state && typeof selectVenue === 'function');
  const loadMs = Date.now() - t0;
  let phase = '';
  if (V) { await page.evaluate(v => { settings.venue = v; selectVenue(v); resetGame(); startRace(); }, V); phase = ` + select/start ${V}`; }
  const { profile } = await cdp.send('Profiler.stop');
  const dt = {}; for (let i = 0; i < profile.samples.length; i++) dt[profile.samples[i]] = (dt[profile.samples[i]] || 0) + (profile.timeDeltas[i] || 0);
  const self = {}; let tot = 0; for (const n of profile.nodes) { const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; const v = (dt[n.id] || 0) / 1000; self[k] = (self[k] || 0) + v; tot += v; }
  console.log(`page ready ${loadMs} ms; profiled${phase}: ${tot.toFixed(0)} ms`);
  Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, v]) => console.log(v.toFixed(0).padStart(7), 'ms', k));
  await browser.close(); })();

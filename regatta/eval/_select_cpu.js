// CPU profile of a venue tile click (selectVenue) alone.   ROOT=<repo root> node regatta/eval/_select_cpu.js venue
const { chromium } = require('playwright'); const path = require('path');
const ROOT = process.env.ROOT || path.resolve('.'); const V = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(ROOT, 'regatta/index.html')); await p.waitForFunction(() => window.state && typeof selectVenue === 'function');
  const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
  const ms = await p.evaluate(v => { const t = performance.now(); settings.venue = v; selectVenue(v); return performance.now() - t; }, V);
  const { profile } = await cdp.send('Profiler.stop');
  const dt = {}; for (let i = 0; i < profile.samples.length; i++) dt[profile.samples[i]] = (dt[profile.samples[i]] || 0) + (profile.timeDeltas[i] || 0);
  const self = {}; for (const n of profile.nodes) { const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; self[k] = (self[k] || 0) + (dt[n.id] || 0) / 1000; }
  console.log(`selectVenue ${ms.toFixed(0)} ms`); Object.entries(self).sort((a, c) => c[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(v.toFixed(1).padStart(7), 'ms', k));
  await b.close(); })();

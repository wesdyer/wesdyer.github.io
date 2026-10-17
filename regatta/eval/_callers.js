// Who calls FN (in FILE) during a venue's race build, by call chain.   node regatta/eval/_callers.js venue FN FILE
const { chromium } = require('playwright'); const path = require('path');
const [V, FN, FILE] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto('file://' + path.resolve('regatta/index.html')); await page.waitForFunction(() => window.state && typeof selectVenue === 'function');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await page.evaluate(v => { settings.venue = v; selectVenue(v); resetGame(); startRace(); for (let i = 0; i < 3; i++) draw(); }, V);
  const { profile } = await cdp.send('Profiler.stop');
  const dt = {}; for (let i = 0; i < profile.samples.length; i++) dt[profile.samples[i]] = (dt[profile.samples[i]] || 0) + (profile.timeDeltas[i] || 0);
  const byId = {}, parent = {}; for (const n of profile.nodes) { byId[n.id] = n; for (const c of (n.children || [])) parent[c] = n.id; }
  const sub = (n) => (dt[n.id] || 0) + (n.children || []).reduce((a, c) => a + sub(byId[c]), 0);
  const callers = {};
  for (const n of profile.nodes) if (n.callFrame.functionName === FN && n.callFrame.url.includes(FILE)) {
    let chain = [], p = byId[parent[n.id]]; for (let i = 0; i < 4 && p; i++) { chain.push(`${p.callFrame.functionName || 'anon'}:${p.callFrame.url.split('/').pop()}:${p.callFrame.lineNumber + 1}`); p = byId[parent[p.id]]; }
    const k = chain.join(' < '); callers[k] = (callers[k] || 0) + sub(n) / 1000; }
  Object.entries(callers).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, v]) => console.log(v.toFixed(0).padStart(6), 'ms', k));
  await browser.close(); })();

// In-race CPU (update + draw, 60 s of a race with the player on autopilot) on two trees, diffed by function.
//   OLD=<old repo root> node regatta/eval/_sim_cpu_diff.js venue [seconds]
const { chromium } = require('playwright'); const path = require('path');
const V = process.argv[2] || 'bay', SECS = +(process.argv[3] || 60);
const roots = { old: process.env.OLD, new: path.resolve('.') };
(async () => {
  const browser = await chromium.launch(); const agg = {}, frame = {};
  for (const k of ['old', 'new']) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.goto('file://' + path.join(roots[k], 'regatta/index.html')); await page.waitForFunction(() => window.state && typeof selectVenue === 'function');
    await page.evaluate(v => { settings.venue = v; selectVenue(v); resetGame(); startRace(); const me = state.boats[0]; me.controller = new BotController(me); window.__me = me;
      for (let i = 0; i < 60 * 5; i++) { update(1 / 60); } }, V);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start');
    frame[k] = await page.evaluate((S) => { const me = window.__me; let tu = 0, td = 0, n = 0;
      for (let i = 0; i < 60 * S; i++) { me.controller.update(1 / 60); const d = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
        let t = performance.now(); update(1 / 60); tu += performance.now() - t; t = performance.now(); draw(); td += performance.now() - t; n++; }
      return { upd: tu / n, draw: td / n }; }, SECS);
    const { profile } = await cdp.send('Profiler.stop');
    const dt = {}; for (let i = 0; i < profile.samples.length; i++) dt[profile.samples[i]] = (dt[profile.samples[i]] || 0) + (profile.timeDeltas[i] || 0);
    agg[k] = {}; for (const n of profile.nodes) { const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}`; agg[k][key] = (agg[k][key] || 0) + (dt[n.id] || 0) / 1000; }
    await page.close();
  }
  console.log(`${V}: update ${frame.old.upd.toFixed(2)} -> ${frame.new.upd.toFixed(2)} ms/frame, draw ${frame.old.draw.toFixed(2)} -> ${frame.new.draw.toFixed(2)} ms/frame`);
  const keys = new Set([...Object.keys(agg.old), ...Object.keys(agg.new)]);
  [...keys].map(k => [k, agg.old[k] || 0, agg.new[k] || 0]).sort((a, b) => (b[2] - b[1]) - (a[2] - a[1])).slice(0, 14)
    .forEach(([k, a, b]) => console.log(`   ${a.toFixed(0).padStart(6)} -> ${b.toFixed(0).padStart(6)} ms  ${k}`));
  await browser.close(); })();

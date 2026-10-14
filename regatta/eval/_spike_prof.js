// What runs inside a venue's slowest in-race frames, and what the steady frames cost, by function.
//   ROOT=<repo root> node regatta/eval/_spike_prof.js venue [seconds]
const { chromium } = require('playwright'); const path = require('path');
const ROOT = process.env.ROOT || path.resolve('.'); const V = process.argv[2], SECS = +(process.argv[3] || 35);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('file://' + path.join(ROOT, 'regatta/index.html')); await p.waitForFunction(() => window.state && typeof selectVenue === 'function');
  await p.evaluate(v => { settings.venue = v; selectVenue(v); resetGame(); startRace(); window.__me = state.boats[0]; window.__me.controller = new BotController(window.__me); }, V);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start');
  const spikes = await p.evaluate((S) => { const me = window.__me, out = []; const t00 = performance.now();
    for (let i = 0; i < 60 * S; i++) { me.controller.update(1 / 60); const d = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
      let a = performance.now(); update(1 / 60); const u = performance.now() - a; a = performance.now(); draw(); const dr = performance.now() - a;
      if (u + dr > 80) out.push({ i, t: Math.round(a - t00), u: Math.round(u), d: Math.round(dr), race: +(state.race.timer || 0).toFixed(1) }); }
    return out; }, SECS);
  const { profile } = await cdp.send('Profiler.stop');
  console.log('frames over 80 ms:', JSON.stringify(spikes.slice(0, 12)));
  // samples inside the spike windows vs all
  const byId = {}; for (const n of profile.nodes) byId[n.id] = n;
  let t = profile.startTime; const inSpike = {}, all = {};
  const t0 = profile.startTime;
  for (let i = 0; i < profile.samples.length; i++) { t += profile.timeDeltas[i]; const n = byId[profile.samples[i]]; const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
    all[k] = (all[k] || 0) + (profile.timeDeltas[i] || 0) / 1000; }
  console.log('top self time over the run:'); Object.entries(all).sort((a, c) => c[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log(v.toFixed(0).padStart(7), 'ms', k));
  await b.close(); })();

// Frame rate on the REAL GPU (headless=new + Metal), the game's own rAF loop, uncapped.
//   ROOT=<site root> node regatta/eval/_perf_gpu_frames.js [venue ...]     env: FRAMES (600), WARM (sim seconds, 40), SEED, PROF=1 [SELF=1] [CALLERS=<fn>] (CPU profile of the measured frames)
// Per venue: page load over http, select + build + start, the player on autopilot, WARM s of sim
// stepped headless, then FRAMES real loop frames with update()/draw() CPU timed and one readback at
// the end (a per-frame readback flips the canvas to software raster).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.ROOT || path.resolve(__dirname, '../..');
const FRAMES = +process.env.FRAMES || 600, WARM = +(process.env.WARM || 40);
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'otter', 'flats', 'volcanic', 'seatrials', 'pond'];
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webp': 'image/webp' };
const srv = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.stat(f, (e, st) => { if (e || !st.isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'content-length': st.size }); fs.createReadStream(f).pipe(res); }); });
const GPU = ['--headless=new', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--autoplay-policy=no-user-gesture-required'];
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const b = await chromium.launch({ headless: true, args: GPU });
  const out = [];
  for (const v of VENUES) {
    const p = await b.newPage({ viewport: { width: 1584, height: 906 } });
    p.on('pageerror', e => console.log('  pageerror', v, e.message));
    await p.goto(`http://127.0.0.1:${port}/regatta/index.html`); await p.waitForFunction(() => window.state && typeof selectVenue === 'function');
    await p.evaluate(({ v, warm, seed }) => { let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      if (v === 'pond') { if (window.School) School.start && School.start(); } else { settings.venue = v; selectVenue(v); }
      resetGame(); loadVenueWorld && state.course.loadState !== 'full' && loadVenueWorld(); beginRace();
      const me = state.boats[0]; me.controller = new BotController(me);
      const steer = () => { me.controller.update(1 / 60); const d = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; };
      const U = window.update, D = window.draw; window.__T = { u: [], d: [], f: [] };
      for (let i = 0; i < warm * 60; i++) { steer(); U(1 / 60); }
      window.update = function (dt) { steer(); const a = performance.now(); U(dt); __T.u.push(performance.now() - a); };
      window.draw = function () { const a = performance.now(); D(); __T.d.push(performance.now() - a); };
    }, { v, warm: WARM, seed: +(process.env.SEED || 90210) });
    await p.waitForTimeout(500);   // first frames: bakes
    let cdp = null; if (process.env.PROF) { cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start'); }
    const r = await p.evaluate(async (N) => { __T.u.length = 0; __T.d.length = 0;
      const ts = await new Promise(res => { const a = []; const f = (t) => { a.push(performance.now()); if (a.length > N) res(a); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
      const t0 = performance.now(); document.getElementById('gameCanvas').getContext('2d').getImageData(0, 0, 1, 1); const flush = performance.now() - t0;
      const iv = []; for (let i = 1; i < ts.length; i++) iv.push(ts[i] - ts[i - 1]);
      const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
      const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      return { wall: (ts[ts.length - 1] - ts[0] + flush) / (ts.length - 1), p50: q(iv, 0.5), p95: q(iv, 0.95), p99: q(iv, 0.99), max: Math.max(...iv), over16: iv.filter(x => x > 16.7).length,
        upd: mean(__T.u), drw: mean(__T.d), drw95: q(__T.d, 0.95), status: state.race.status, boats: state.boats.length }; }, FRAMES);
    if (cdp) { const { profile } = await cdp.send('Profiler.stop');
      const byId = new Map(profile.nodes.map(n => [n.id, n])); const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
      const incl = {}, self = {}; let tot = 0;
      for (let i = 0; i < profile.samples.length; i++) { const dt = (profile.timeDeltas[i] || 0) / 1000; tot += dt; let id = profile.samples[i]; const seen = new Set(); let first = true;
        while (id) { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; if (first) { self[k] = (self[k] || 0) + dt; first = false; } if (!seen.has(k)) { seen.add(k); incl[k] = (incl[k] || 0) + dt; } id = parent.get(id); } }
      if (process.env.CALLERS) { const want = process.env.CALLERS, cal = {};
        for (let i = 0; i < profile.samples.length; i++) { const dt = (profile.timeDeltas[i] || 0) / 1000; let id = profile.samples[i], chain = [];
          while (id) { const n = byId.get(id); chain.push(`${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`); id = parent.get(id); }
          let top = -1; for (let j = chain.length - 1; j >= 0; j--) if (chain[j].startsWith(want + ' ')) { top = j; break; }
          if (top >= 0) { const k = (chain[top + 1] || '?') + ' <- ' + (chain[top + 2] || '?'); cal[k] = (cal[k] || 0) + dt; } }
        console.log('  callers of', want); Object.entries(cal).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log('   ', (v / FRAMES).toFixed(3), k)); }
      const per = 1 / (FRAMES); console.log(`  profile: ${tot.toFixed(0)} ms total; ms/frame inclusive, self`);
      Object.entries(process.env.SELF ? self : incl).sort((a, b) => b[1] - a[1]).filter(([k]) => !/^\(root\)|^\(idle\)/.test(k)).slice(0, +(process.env.N || 40)).forEach(([k, v]) => console.log('  ', (v * per).toFixed(3).padStart(7), ((self[k] || 0) * per).toFixed(3).padStart(7), k)); }
    out.push([v, r]);
    console.log(v.padEnd(10), `wall ${r.wall.toFixed(2)} ms/f (${(1000 / r.wall).toFixed(0)} fps)  iv p50 ${r.p50.toFixed(1)} p95 ${r.p95.toFixed(1)} p99 ${r.p99.toFixed(1)} max ${r.max.toFixed(0)} >16.7:${r.over16}  | update ${r.upd.toFixed(2)} draw ${r.drw.toFixed(2)} (p95 ${r.drw95.toFixed(1)}) ${r.status}/${r.boats}`);
    await p.close();
  }
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(out));
  await b.close(); srv.close(); })();

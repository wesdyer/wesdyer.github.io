// Hitch hunter: the real loop on the GPU, every top-level sim/draw function wrapped and timed per frame.
// Windows of WIN real frames spread across the race (JUMP sim seconds stepped headless between them).
//   node regatta/eval/_perf_spikes.js [venue ...]   env: WIN (300) JUMP (40) WINS (10) TH (ms CPU threshold, 12) CAP=1 (vsync on; uncapped turns GPU backpressure into fake CPU hitches) DISSECT=<fn> DMS=<ms> (what is inside its long calls)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.ROOT || path.resolve(__dirname, '../..');
const WIN = +process.env.WIN || 300, JUMP = +(process.env.JUMP || 40), WINS = +process.env.WINS || 10, TH = +(process.env.TH || 12);
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'otter', 'flats', 'volcanic', 'seatrials'];
const srv = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.stat(f, (e, st) => { if (e || !st.isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'application/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream', 'content-length': st.size }); fs.createReadStream(f).pipe(res); }); });
const GPU = ['--headless=new', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'].concat(process.env.CAP ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit']);
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const b = await chromium.launch({ headless: true, args: GPU });
  for (const v of VENUES) {
    const p = await b.newPage({ viewport: { width: 1584, height: 906 } });
    p.on('pageerror', e => console.log('  pageerror', v, e.message));
    await p.goto(`http://127.0.0.1:${port}/regatta/index.html`); await p.waitForFunction(() => window.state && typeof selectVenue === 'function');
    await p.evaluate(({ v }) => { let s = 90210; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      settings.venue = v; selectVenue(v); resetGame(); loadVenueWorld(); beginRace();
      const me = state.boats[0]; me.controller = new BotController(me);
      window.__steer = () => { me.controller.update(1 / 60); const d = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; };
      // wrap: globals named update*/check*/draw*/spawn*/bake*, and the modules' update/draw methods
      const T = window.__T = { cur: {}, frames: [] };
      const wrap = (obj, k, label) => { const f = obj[k]; if (typeof f !== 'function' || f.__w) return; const w = function () { const a = performance.now(); try { return f.apply(this, arguments); } finally { const d = performance.now() - a; T.cur[label] = (T.cur[label] || 0) + d; } }; w.__w = 1; obj[k] = w; };
      for (const k of Object.keys(window)) if (/^(update|check|draw|spawn|bake|ensure|blit|adaptive|render|goalChip|leeWarm|repos)/.test(k) && typeof window[k] === 'function' && k !== 'update' && k !== 'draw') wrap(window, k, k);
      for (const m of ['Wildlife', 'SeaFX', 'Swell', 'Tide', 'Volcano', 'IceFX', 'WaterRenderer', 'Rules', 'Traffic', 'School', 'TimeTrial', 'RaceLog', 'Unlocks', 'Sound'])
        if (window[m]) for (const k of Object.keys(window[m])) if (typeof window[m][k] === 'function' && /^(update|draw|step|tick|poll|flush)/.test(k)) wrap(window[m], k, m + '.' + k);
      const U = window.update, D = window.draw;
      window.__U = U;
      window.update = function (dt) { __steer(); const a = performance.now(); U(dt); T.cur.__u = (T.cur.__u || 0) + performance.now() - a; };
      window.draw = function () { const a = performance.now(); D(); T.cur.__d = (T.cur.__d || 0) + performance.now() - a; };
      window.__frame = () => { const c = T.cur; T.cur = {}; return c; };
    }, { v });
    const all = [];
    let cdp = null; if (process.env.DISSECT) { cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 50 }); await cdp.send('Profiler.start'); }
    for (let w = 0; w < WINS; w++) {
      const r = await p.evaluate(async (N) => {
        if (state.race.status === 'finished' || !state.boats[0] || state.boats[0].raceState.finished) return null;
        const out = []; await new Promise(res => { let n = 0, last = performance.now(); const f = () => { const now = performance.now(); const c = __frame(); c.__iv = now - last; c.__t = Math.round(state.time); last = now; if (n++ > 0) out.push(c); if (n > N) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
        return out; }, WIN);
      if (!r) break;
      all.push(...r.slice(20).map(x => Object.assign(x, { __w: w })));
      await p.evaluate((J) => { const U = window.__U; for (let i = 0; i < J * 60; i++) { __steer(); U(1 / 60); if (state.race.status === 'finished' || state.boats[0].raceState.finished) break; } __frame(); }, JUMP);
    }
    if (cdp) { // invocations of DISSECT longer than DMS: contiguous samples with it on the stack; their leaf self time
      const { profile } = await cdp.send('Profiler.stop'); const want = process.env.DISSECT, DMS = +(process.env.DMS || 8);
      const byId = new Map(profile.nodes.map(n => [n.id, n])); const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
      const nm = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
      let run = null; const runs = [];
      for (let i = 0; i < profile.samples.length; i++) { const dt = (profile.timeDeltas[i] || 0) / 1000; let id = profile.samples[i], on = false, chain = [];
        while (id) { const n = byId.get(id); const k = nm(n); chain.push(k); if (k.startsWith(want + ' ')) on = true; id = parent.get(id); }
        if (on) { if (!run) run = { t: 0, leaves: {} }; run.t += dt; const idx = chain.findIndex(k => k.startsWith(want + ' ')); const key = chain.slice(0, Math.min(idx, 3)).reverse().join(' > ') || '(self)'; run.leaves[key] = (run.leaves[key] || 0) + dt; }
        else if (run) { runs.push(run); run = null; } }
      const long = runs.filter(r => r.t > DMS); const agg = {}; for (const r of long) for (const k in r.leaves) agg[k] = (agg[k] || 0) + r.leaves[k];
      console.log(`  ${want}: ${runs.length} runs, ${long.length} over ${DMS} ms (max ${Math.max(0, ...runs.map(r => r.t)).toFixed(1)}); inside them:`);
      Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log('    ', v.toFixed(1).padStart(7), k)); }
    const cpu = all.map(f => (f.__u || 0) + (f.__d || 0)).sort((a, b) => a - b);
    const q = (a, x) => a[Math.min(a.length - 1, Math.floor(x * a.length))];
    const iv = all.map(f => f.__iv).sort((a, b) => a - b);
    const sp = all.filter(f => (f.__u || 0) + (f.__d || 0) > TH);
    console.log(`${v.padEnd(10)} frames ${all.length}  cpu p50 ${q(cpu, .5).toFixed(1)} p99 ${q(cpu, .99).toFixed(1)} max ${cpu[cpu.length - 1].toFixed(0)} | iv p50 ${q(iv, .5).toFixed(1)} p99 ${q(iv, .99).toFixed(1)} | cpu>${TH}ms: ${sp.length}`);
    // who owns the spikes: per function, summed over spike frames, and the worst frames
    const own = {}; for (const f of sp) for (const k in f) if (!k.startsWith('__')) { own[k] = own[k] || { n: 0, t: 0, max: 0 }; own[k].t += f[k]; if (f[k] > 3) own[k].n++; own[k].max = Math.max(own[k].max, f[k]); }
    Object.entries(own).sort((a, b) => b[1].max - a[1].max).slice(0, 8).forEach(([k, o]) => console.log(`     ${k.padEnd(28)} max ${o.max.toFixed(1).padStart(6)}  >3ms in ${o.n} spike frames`));
    await p.close();
  }
  await b.close(); srv.close(); })();

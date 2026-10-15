// Click-to-water latency as a person meets it: cold cache over a throttled link, hub, open the board on a
// venue, linger THINK ms, press Start (the UI path: navigator.webdriver forced false), time until the
// prestart is up and the loading card gone; then how long until the venue's terrain/props have all landed.
//   ROOT=<site> node regatta/eval/_perf_start.js [venue ...]   env THINK (ms, 3000) NET (cable|fast)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = process.env.ROOT || path.resolve(__dirname, '../..');
const THINK = +(process.env.THINK || 3000), NET = process.env.NET || 'cable';
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay', 'otter', 'river', 'volcanic'];
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const gz = new Map();
const srv = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.stat(f, (e, st) => { if (e || !st.isFile()) { res.writeHead(404); return res.end(); }
    const type = TYPES[path.extname(f)] || 'application/octet-stream';
    if (/html|javascript|css|json/.test(type)) { let z = gz.get(f); if (!z) { z = zlib.gzipSync(fs.readFileSync(f)); gz.set(f, z); } res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'content-length': z.length }); return res.end(z); }
    res.writeHead(200, { 'content-type': type, 'content-length': st.size }); fs.createReadStream(f).pipe(res); }); });
const NETS = { cable: { latency: 30, downloadThroughput: 50e6 / 8, uploadThroughput: 10e6 / 8 }, fast: { latency: 10, downloadThroughput: 200e6 / 8, uploadThroughput: 50e6 / 8 } };
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const b = await chromium.launch({ args: ['--headless=new', '--use-angle=metal', '--enable-gpu'] });
  for (const v of VENUES) {
    const ctx = await b.newContext({ viewport: { width: 1584, height: 906 } }); const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETS[NET] });
    await p.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
    const t0 = Date.now();
    await p.goto(`http://127.0.0.1:${port}/regatta/index.html`); await p.waitForFunction(() => window.state && typeof selectVenue === 'function' && clubhouseUp());
    const hub = Date.now() - t0;
    await p.evaluate(v => { showRaceBoard(); selectVenue(v); }, v);
    await p.waitForTimeout(THINK);
    const r = await p.evaluate(async () => {
      const t = performance.now(); startRace();
      const card = () => { const el = document.getElementById('venue-loading'); return el && el.style.display !== 'none'; };
      while (!(state.race.status === 'prestart' && !card())) await new Promise(res => setTimeout(res, 10));
      const go = performance.now() - t;
      const imgs = []; for (const isl of state.course.islands || []) { const t = LAND_TEXTURES[isl.style]; if (t) imgs.push(t.img); }
      for (const pr of state.course.props || []) { const s = propSprite(pr.kind); if (s && s.img) imgs.push(s.img); }
      while (imgs.some(i => !i.complete)) await new Promise(res => setTimeout(res, 20));
      const art = performance.now() - t;
      return { go, art, n: imgs.length }; });
    console.log(`${v.padEnd(9)} hub ${String(hub).padStart(5)} ms | Start -> racing ${r.go.toFixed(0).padStart(5)} ms | all venue art in ${r.art.toFixed(0).padStart(5)} ms (${r.n} images)`);
    await ctx.close();
  }
  await b.close(); srv.close(); })();

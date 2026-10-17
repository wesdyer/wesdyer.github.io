// Cold page load over http with gzip (like GitHub Pages), optionally throttled.
//   ROOT=<site root> node regatta/eval/_perf_load.js [reps] [net]   net = fast|cable|none
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = process.env.ROOT || path.resolve(__dirname, '../..');
const REPS = +process.argv[2] || 3, NET = process.argv[3] || 'cable';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.wav': 'audio/wav' };
const gzCache = new Map();
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(ROOT, u);
  if (u.endsWith('/')) f = path.join(f, 'index.html');
  fs.stat(f, (e, st) => { if (e || !st.isFile()) { res.writeHead(404); return res.end(); }
    const ext = path.extname(f), type = TYPES[ext] || 'application/octet-stream';
    const text = /html|javascript|css|json|svg/.test(type);
    if (text && /gzip/.test(req.headers['accept-encoding'] || '')) {
      const k = f + st.mtimeMs; let z = gzCache.get(k); if (!z) { z = zlib.gzipSync(fs.readFileSync(f), { level: 6 }); gzCache.set(k, z); }
      res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'content-length': z.length, 'cache-control': 'max-age=600' }); return res.end(z); }
    res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'cache-control': 'max-age=600' }); fs.createReadStream(f).pipe(res); }); });
const NETS = { cable: { latency: 30, downloadThroughput: 50e6 / 8, uploadThroughput: 10e6 / 8 }, fast: { latency: 10, downloadThroughput: 200e6 / 8, uploadThroughput: 50e6 / 8 } };
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const url = `http://127.0.0.1:${port}/regatta/index.html`;
  const b = await chromium.launch({ args: ['--disable-http-cache=false'] });
  const runs = [];
  for (let r = 0; r < REPS; r++) {
    const ctx = await b.newContext({ viewport: { width: 1584, height: 906 } }); const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable');
    if (NETS[NET]) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETS[NET] });
    let bytes = 0, reqs = 0, imgBytes = 0, jsBytes = 0; const byUrl = {};
    cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; reqs++; byUrl[e.requestId] = Object.assign(byUrl[e.requestId] || {}, { len: e.encodedDataLength }); });
    cdp.on('Network.responseReceived', e => { byUrl[e.requestId] = Object.assign(byUrl[e.requestId] || {}, { url: e.response.url, type: e.type }); });
    await p.addInitScript(() => { window.__lt = { long: 0, n: 0, max: 0 };
      new PerformanceObserver(l => { for (const e of l.getEntries()) { __lt.long += e.duration; __lt.n++; __lt.max = Math.max(__lt.max, e.duration); } }).observe({ type: 'longtask', buffered: true });
      // first moment the clubhouse is on screen and the main thread is free
      window.__hub = 0; const poll = () => { const c = document.getElementById('clubhouse') || document.querySelector('[id*=clubhouse]'); if (window.state && c && !c.classList.contains('hidden') && c.offsetParent !== null) { window.__hub = performance.now(); return; } setTimeout(poll, 5); }; setTimeout(poll, 0); });
    await p.goto(url, { waitUntil: 'load', timeout: 120000 });
    await p.waitForFunction(() => window.__hub > 0, null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    const m = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return { fcp: fcp ? fcp.startTime : -1, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, hub: __hub, long: __lt.long, longN: __lt.n, longMax: __lt.max }; });
    m.mb = bytes / 1e6; m.reqs = reqs;
    const agg = {}; for (const k in byUrl) { const x = byUrl[k]; if (!x.url) continue; const t = x.type || '?'; agg[t] = (agg[t] || 0) + (x.len || 0); }
    m.byType = Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, +(v / 1e6).toFixed(2)]));
    if (r === 0 && process.env.TOP) { console.log(Object.values(byUrl).filter(x => x.url).sort((a, b) => (b.len || 0) - (a.len || 0)).slice(0, +process.env.TOP).map(x => ((x.len || 0) / 1e3).toFixed(0).padStart(7) + ' KB ' + x.url.replace(/^.*?\/\/[^/]+/, '')).join('\n')); }
    runs.push(m); await ctx.close();
  }
  const med = k => { const a = runs.map(r => r[k]).sort((x, y) => x - y); return a[a.length >> 1]; };
  console.log(`net=${NET} reps=${REPS}  FCP ${med('fcp').toFixed(0)}  DCL ${med('dcl').toFixed(0)}  load ${med('load').toFixed(0)}  hub ${med('hub').toFixed(0)} ms | longtasks ${med('long').toFixed(0)} ms (${med('longN')}, max ${med('longMax').toFixed(0)}) | ${med('mb').toFixed(2)} MB in ${med('reqs')} reqs`);
  console.log(JSON.stringify(runs[0].byType));
  await b.close(); srv.close(); })();

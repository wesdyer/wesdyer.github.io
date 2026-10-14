// PT-079: race to the results page (player on the bot, Stillwater), click "Save image" over file:// and
// over http, and keep both downloads.   OUT=dir node eval/rl/_pt079_results.js
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const ROOT = path.resolve('..'), OUT = process.env.OUT;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data); }); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const b = await chromium.launch();
  for (const [name, url] of [['file', 'file://' + path.join(ROOT, 'regatta/index.html')], ['http', `http://127.0.0.1:${server.address().port}/regatta/index.html`]]) {
    const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 950 } }); const p = await ctx.newPage();
    const logs = []; p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text().slice(0, 160)); });
    await p.goto(url); await p.waitForFunction(() => window.state && typeof resetGame === 'function' && typeof saveResultsImage === 'function');
    await p.evaluate(() => { let s = 7;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('lake'); resetGame(); startRace();
      const me = state.boats[0]; me.controller = new BotController(me);
      for (let i = 0; i < 30 * 600 && !me.raceState.finished; i++) { me.controller.update(1 / 30); const dd = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); }
      for (let i = 0; i < 30 * 30; i++) update(1 / 30);
      showResults(); });
    await p.waitForTimeout(2500);
    const shown = await p.evaluate(() => !document.getElementById('results-overlay').classList.contains('hidden'));
    const dl = p.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await p.click('#results-save-button');
    const d = await dl; await p.waitForTimeout(400);
    const toast = await p.evaluate(() => { const t = [...document.querySelectorAll('div')].find(e => /Results saved|Results image failed|needs the online game/.test(e.textContent) && e.children.length === 0); return t ? t.textContent : '?'; });
    if (d) await d.saveAs(`${OUT}/pt079_${name}.png`);
    console.log(name.padEnd(5), 'results shown', shown, '| download', d ? d.suggestedFilename() : 'none', '| toast', toast, '|', logs.filter(l => /Results|taint/i.test(l)).join(' || ') || '-');
    await ctx.close();
  }
  await b.close(); server.close(); })();

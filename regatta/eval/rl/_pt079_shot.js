// PT-079: does F12's saveScreenshot work over file:// and over http? Runs a race a few seconds in,
// calls saveScreenshot(), and reports the toast and any console warning (and the download).
//   node eval/rl/_pt079_shot.js
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const ROOT = path.resolve('..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data); }); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const b = await chromium.launch();
  for (const [name, url] of [['file', 'file://' + path.join(ROOT, 'regatta/index.html')], ['http', `http://127.0.0.1:${server.address().port}/regatta/index.html`]]) {
    const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage();
    const logs = []; p.on('console', m => { if (/Screenshot|taint|Security/i.test(m.text())) logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
    p.on('pageerror', e => logs.push('pageerror: ' + e.message.slice(0, 200)));
    await p.goto(url); await p.waitForFunction(() => window.state && typeof resetGame === 'function' && typeof saveScreenshot === 'function');
    await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('arctic'); resetGame(); startRace(); });
    await p.waitForTimeout(1500);
    const dl = p.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await p.evaluate(() => saveScreenshot());
    const d = await dl;
    await p.waitForTimeout(500);
    const toast = await p.evaluate(() => { const t = document.querySelector('#toast, .toast'); return t ? t.textContent.trim() : '?'; });
    console.log(name.padEnd(5), 'download:', d ? d.suggestedFilename() : 'none', '| toast:', toast, '|', logs.join(' || ') || '-');
    await ctx.close();
  }
  await b.close(); server.close(); })();

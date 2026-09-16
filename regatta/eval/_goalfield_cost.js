// GOAL FIELD COST — time GoalField.playerAim (forced fresh every frame) along a bot track on Otter and
// screenshot the routed chip. Run from the REPO ROOT:
//   NODE_PATH=node_modules node regatta/eval/_goalfield_cost.js out.png
// Cost of the new chip path (GoalField.playerAim + lineClear) along a bot track, and a screenshot with the chip routed.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve('.'); const OUT = process.argv[2];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data); }); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
  await page.goto(`http://127.0.0.1:${server.address().port}/regatta/index.html`);
  await page.waitForFunction(() => typeof state !== 'undefined' && state.boats && state.boats.length > 0, null, { timeout: 30000 });
  const res = await page.evaluate(() => {
    let s = 100; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    selectVenue('otter'); resetGame(); startRace();
    const me = state.boats[0]; me.controller = new BotController(me);
    const times = []; let t = 0, tick = 0, routedFrames = 0, samples = 0, shotAt = null;
    while (t < 200 && state.race.status !== 'finished') {
      me.controller.update(1 / 30); const d = normalizeAngle(me.controller.targetHeading - me.heading);
      state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(1 / 30); t += 1 / 30; tick++;
      if (state.race.status !== 'racing') continue;
      me._gfAim = null; me._aimClear = null;   // force a fresh computation to time the worst case
      const t0 = performance.now();
      const A = GoalField.playerAim(me, routeLeg(Math.min(me.raceState.leg, state.race.totalLegs)), me.raceState.leg);
      times.push(performance.now() - t0); samples++;
      if (A && !A.direct) { routedFrames++; if (!shotAt && t > 20) { draw(); shotAt = { t: Math.round(t), leg: me.raceState.leg, dist: Math.round(A.dist), aim: A.aim, boat: [Math.round(me.x), Math.round(me.y)] }; } }
    }
    const q = (a, f) => { const b = a.slice().sort((x, y) => x - y); return +b[Math.min(b.length - 1, Math.floor(b.length * f))].toFixed(3); };
    return { samples, routedPct: Math.round(100 * routedFrames / samples), ms: { p50: q(times, .5), p99: q(times, .99), max: q(times, 1) }, shotAt };
  });
  console.log(JSON.stringify(res));
  if (res.shotAt) { await page.evaluate(() => draw()); await page.screenshot({ path: OUT }); console.log('shot', OUT); }
  await browser.close(); server.close();
})();

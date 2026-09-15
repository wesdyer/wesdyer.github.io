// VENUE BOT RACE — time a course with the AI fleet, headless, over http.
//   VENUE=otter NODE_PATH=node_modules node regatta/eval/_venue_race.js <outdir> [seed]
// Hands the player to BotController, steps the sim at 30 Hz to the finish or 600 s, and
// prints every boat's finish time, penalties, the player's wind/speed trace and the positions
// of every penalty — which is what found the Otter Point finish line sitting on the shore.
// Calibration (2026-09-13): Lighthouse Cove est 3:16 -> bots 4:06..4:53; Otter Point est
// 3:05 -> bots 3:20..4:01. Wes's rule of thumb: bots median ~1.15x his own time, so the
// editor estimate is the human number.
// Headless bot race on the Otter venue: the player is handed to BotController like the rest
// of the fleet, the sim is stepped at 30 Hz until everyone finishes or the cap, and every
// boat's finish time is reported. Also screenshots the headland rounding and the bay.
//   NODE_PATH=<repo>/node_modules node otter_race.js <outdir> [seed]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve('.'); const OUT = process.argv[2]; const SEED = +(process.argv[3] || 100);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data); }); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/AudioContext|favicon/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
  await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
  await page.goto(`http://127.0.0.1:${server.address().port}/regatta/index.html`);
  await page.waitForFunction(() => typeof state !== 'undefined' && state.boats && state.boats.length > 0, null, { timeout: 30000 });
  const VENUE = process.env.VENUE || 'otter';
  const res = await page.evaluate(([seed, venue]) => {
    let s = seed;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    selectVenue(venue); resetGame(); startRace();
    const me = state.boats[0]; me.controller = new BotController(me);
    let t = 0; const cap = 600; const snaps = []; let sampled = 0; const track = []; const penAt = []; let lastPen = 0; let tick = 0;
    const windSamples = [];
    while (t < cap && state.race.status !== 'finished') {
      me.controller.update(1 / 30);
      const d = normalizeAngle(me.controller.targetHeading - me.heading);
      state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
      update(1 / 30); t += 1 / 30; tick++;
      if (tick % 90 === 0) track.push([Math.round(me.x), Math.round(me.y), Math.round(t)]);
      for (const b of state.boats) { const pn = (b.raceState && b.raceState.totalPenalties) || 0; if (pn > (b._penSeen || 0)) { b._penSeen = pn; penAt.push([Math.round(b.x), Math.round(b.y), Math.round(t), b.name]); } }
      if (Math.floor(t) > sampled) { sampled = Math.floor(t);
        if (sampled % 15 === 0) windSamples.push({ t: sampled, x: Math.round(me.x), y: Math.round(me.y), leg: me.raceState && me.raceState.leg, wind: +(typeof getWindAt === 'function' ? getWindAt(me.x, me.y).speed : NaN).toFixed(1), shoal: +(me.shoalMul == null ? 1 : me.shoalMul).toFixed(2), spd: +(me.speed || 0).toFixed(1), pen: me.raceState && me.raceState.totalPenalties, penT: me.raceState && +(me.raceState.penaltyTimer || 0).toFixed(1) }); }
    }
    const boats = state.boats.map(b => ({ name: b.name || b.id, finished: !!(b.raceState && b.raceState.finished), time: b.raceState && b.raceState.finishTime != null ? +b.raceState.finishTime.toFixed(1) : null, leg: b.raceState && b.raceState.leg, pen: b.raceState && b.raceState.totalPenalties, status: b.raceState && b.raceState.resultStatus }));
    const est = (window.VenueDoc && window.VENUE_DOC[venue]) ? window.VenueDoc.compile(window.VENUE_DOC[venue]).estSecs : null;
    const finals = state.boats.map(b => [Math.round(b.x), Math.round(b.y)]);
    return { t: +t.toFixed(1), status: state.race.status, est, boats, windSamples, track, penAt, finals };
  }, [SEED, VENUE]);
  console.log(JSON.stringify(res, null, 1));
  console.log('ERRORS', errors.length ? errors.slice(0, 6).join('\n') : 'none');
  await browser.close(); server.close();
})();

// OTTER WIND BOT RACE — the whole fleet sails a strategy's route line (swapped into the DMG legs after the
// full build) in the real physics with a candidate wind; prints per-strategy finish times. Run from the REPO ROOT.
//   CAND=<doc> STRATS=default,hug,smart,offshore SEEDS=100,101 OUT=bots.json NODE_PATH=node_modules node regatta/eval/_otter_wind_bots.js
// REAL-BOT STRATEGY RACE — the whole fleet follows a strategy's route line (swapped into the DMG legs),
// in the real physics, with the candidate wind. Prints the fleet's finish times per strategy/seed.
//   CAND=<doc.js> STRATS=default,hug,smart,offshore SEEDS=100,101 NODE_PATH=node_modules node botrace.js
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve('.');
const CAND = process.env.CAND ? (() => { const t = fs.readFileSync(process.env.CAND, 'utf8'); const k = 'window.VENUE_DOC["otter"] = '; return JSON.parse(t.slice(t.indexOf(k) + k.length).trim().slice(0, -1)).wind; })() : null;
const STRATS = (process.env.STRATS || 'default,hug,smart,offshore').split(',');
const SEEDS = (process.env.SEEDS || '100,101').split(',').map(Number);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data); }); });
// strategy lines: leg 1 = start → mark (beat), leg 2 = mark → finish (reach + bay)
const LINES = {
  hug: { beat: [[712, 2692], [-400, 2100], [-800, 900], [-1300, -300], [-1900, -1500], [-2600, -2200], [-3000, -2900], [-3025, -3548]],
         reach: [[-3025, -3548], [-2700, -4300], [-1900, -5000], [-1000, -4700], [-300, -4500], [400, -4750], [1000, -4550], [1600, -4900], [2500, -4950], [3300, -5300], [3700, -5250], [4500, -4950], [5100, -5150], [5600, -5050], [6100, -4500], [6700, -4200], [7100, -4250], [7400, -4000], [8270, -3560], [8120, -3000], [8060, -2500], [8375, -2356]] },
  smart: { beat: [[712, 2692], [-900, 2000], [-2300, 800], [-2200, -300], [-3100, -1400], [-3353, -2131], [-2903, -3281], [-3025, -3548]],
           reach: [[-3025, -3548], [-2650, -4500], [-1900, -5450], [-800, -5350], [400, -5250], [1600, -5350], [2500, -5400], [3500, -5650], [4500, -5450], [5100, -5600], [5700, -5550], [6500, -5300], [7300, -4800], [7400, -4000], [8270, -3560], [8520, -3100], [8620, -2600], [8600, -2320], [8375, -2356]] },
  offshore: { beat: [[712, 2692], [-1500, 2400], [-3300, 1200], [-4700, 200], [-4300, -1200], [-3800, -2500], [-3300, -3300], [-3025, -3548]],
              reach: [[-3025, -3548], [-2600, -4600], [-2000, -6100], [0, -6300], [2500, -6400], [5000, -6300], [7300, -5800], [8300, -4800], [8600, -4150], [9300, -3550], [9200, -2900], [8800, -2350], [8375, -2356]] }
};
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
  await page.goto(`http://127.0.0.1:${server.address().port}/regatta/index.html`);
  await page.waitForFunction(() => typeof state !== 'undefined' && state.boats && state.boats.length > 0, null, { timeout: 30000 });
  const results = [];
  for (const strat of STRATS) for (const seed of SEEDS) {
    const res = await page.evaluate(([seed, cand, line]) => {
      if (cand) window.VENUE_DOC.otter.wind = cand;
      let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      selectVenue('otter'); resetGame(); startRace();
      for (let i = 0; i < 5; i++) update(1 / 30);
      if (line) {
        const legs = state.course.dmc.legs;
        const swap = (i, pts) => { const m = CoursePath._measure(pts.map(p => ({ x: p[0], y: p[1] }))); legs[i] = Object.assign({}, legs[i], m); };
        swap(1, line.beat); swap(2, line.reach);
      }
      const me = state.boats[0]; me.controller = new BotController(me);
      let t = 0; const cap = 480; let tick = 0; const track = [];
      while (t < cap && state.race.status !== 'finished') {
        me.controller.update(1 / 30);
        const d = normalizeAngle(me.controller.targetHeading - me.heading);
        state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
        update(1 / 30); t += 1 / 30; tick++;
        if (tick % 60 === 0) track.push([Math.round(me.x), Math.round(me.y)]);
      }
      const times = state.boats.map(b => b.raceState && b.raceState.finished ? +b.raceState.finishTime.toFixed(1) : null);
      const pens = state.boats.map(b => (b.raceState && b.raceState.totalPenalties) || 0);
      const fin = times.filter(x => x != null).sort((a, b) => a - b);
      const l1 = state.course.dmc && state.course.dmc.legs[1]; const swapOk = line ? (l1 && l1.pts.length === line.beat.length) : null;
      return { swapOk, loadState: state.course.loadState, t: +t.toFixed(0), finished: fin.length, best: fin[0], median: fin[Math.floor(fin.length / 2)], worst: fin[fin.length - 1], pens: pens.reduce((a, b) => a + b, 0), me: times[0], track };
    }, [seed, CAND, LINES[strat] || null]);
    results.push({ strat, seed, ...res });
    console.log(`${strat.padEnd(9)} seed ${seed}: swap ${res.swapOk} (${res.loadState}) finished ${res.finished}/10  best ${res.best}  median ${res.median}  worst ${res.worst}  me ${res.me}  penalties ${res.pens}  (sim ${res.t}s)`);
  }
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(results));
  console.log('ERRORS', errors.length ? errors.slice(0, 6).join('\n') : 'none');
  await browser.close(); server.close();
})();

// PT-005 — one contact, second by second: the boat in the ship's frame (along: + toward the bow; lat: + to
// starboard of the ship), the heading the boat wanted (h0) and took, and what the planner's fan said about
// sailing straight and about its best candidate (sc = it saw a static/ship collision).
//   node regatta/eval/rl/_pt005_trace.js <seed> <boat> <shipId> <tFrom> <tTo>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [SEED, NAME, SHIP, TF, TT] = [+process.argv[2], process.argv[3], process.argv[4], +process.argv[5], +process.argv[6]];
const ROOT = path.resolve(__dirname, '../../..');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })); });
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  const rows = await p.evaluate(({ SEED, NAME, SHIP, TF, TT }) => {
    window.evalHarness.seed = SEED; resetGame(); startRace(); state.course.cutoff = 900;
    const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
    const bt = state.boats.find(x => x.name === NAME); const out = [];
    let hit = false; const prev = window.onRaceEvent;
    window.onRaceEvent = (ty, d) => { if (ty === 'collision_traffic' && d.boat === bt) hit = true; return prev && prev(ty, d); };
    for (let it = 0; it < 60 * 400; it++) {
      const t = state.race.status === 'racing' ? state.race.timer : -1;
      const rec = t >= TF && t <= TT;
      window.__AVDBG = rec ? { name: NAME, full: true } : null; window.__AVLOG = [];
      hit = false; update(1 / 60);
      if (!rec || it % 15) continue;
      const v = state.traffic.find(s => s.id === SHIP); if (!v || !v.active) { out.push({ t: t.toFixed(2), ship: 'inactive' }); continue; }
      const fx = Math.sin(v.heading), fy = -Math.cos(v.heading);
      const dx = bt.x - v.x, dy = bt.y - v.y;
      const L = window.__AVLOG.filter(r => r.n === NAME).pop();
      const deg = (a) => Math.round(a * 180 / Math.PI);
      out.push({ t: t.toFixed(2), along: Math.round(dx * fx + dy * fy), lat: Math.round(dx * -fy + dy * fx), relH: deg(normalizeAngle(bt.heading - v.heading)),
        kt: +(bt.speed * 4).toFixed(1), hit: hit ? 'HIT' : '', leg: bt.raceState.leg,
        h0: L ? deg(normalizeAngle(L.h0 - v.heading)) : null, dev: L ? L.dev : null,
        zero: L && L.zero ? `sc${L.zero.sc} c${Math.round(L.zero.cost)}` : null, best: L && L.best ? `off${(L.best.off || 0).toFixed(2)} sc${L.best.sc} c${Math.round(L.best.cost)}` : null,
        nsc: L && L.full ? L.full.filter(r => r.sc).length + '/' + L.full.length : null, esc: bt.controller && bt.controller.escActive ? 'ESC' : '',
        ctl: bt.controller ? (bt.controller.livenessState || '') + (bt.controller.recoveryMode ? ' REC' : '') : '' });
      if (t > TT) break;
    }
    return out;
  }, { SEED, NAME, SHIP, TF, TT });
  console.log(`ship frame: along + = ahead of the ship's centre (bow at +len/2), lat + = ship's starboard; relH = boat heading - ship heading; h0 = wanted heading in ship frame`);
  for (const r of rows) console.log(Object.entries(r).map(([k, v]) => `${k} ${v}`).join('  '));
  await b.close(); })();

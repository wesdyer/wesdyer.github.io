// ROUTE-DECISION TRACE (flats push): wraps SailCheck.pathSailable in a ten-bot race and
// logs, for every replan made on leg 2 from south of the traverse (y > 1500), which way
// the router sent the boat round the first loop — WANTIJ (the path's crossing of y=2000
// is at x > 0), GAMBLE (x < -900) or CHANNEL (between) — with the clock, the boat's
// rounding time, the path's own arrival estimate at the sill and the level then.
//   node _fl_route.js <seed> <tree>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SEED = +(process.argv[2] || 9405); const ROOT = path.join(__dirname, process.argv[3] || 'treeFLN3');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message.slice(0, 200)));
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', character: AI_CONFIG[0].name })); });
  const r = await page.evaluate(async (seed) => {
    window.evalHarness.seed = seed; resetGame(); startRace(); state.course.cutoff = 900;
    const pl = state.boats.find(b => b.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
    const nine = state.boats.filter(b => b !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.9, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300;
    const bots = state.boats.filter(b => !b.isPlayer);
    const log = [];
    const orig = window.SailCheck.pathSailable;
    window.SailCheck.pathSailable = function (grid, from, to) {
      const out = orig.apply(this, arguments);
      try {
        if (state.race.status === 'racing' && from[1] > 1500 && from[1] < 7300 && !window.__cf && (bots.some(b => b.raceState.leg >= 2 && Math.hypot(b.x - from[0], b.y - from[1]) < 30))) {
          let bb = null, bd = 1e9; for (const b of bots) { const d = Math.hypot(b.x - from[0], b.y - from[1]); if (d < bd) { bd = d; bb = b; } }
          const t = state.race.timer;
          let via = 'none', xAt = null, tSill = null, LSill = null, len = 0;
          if (out && out.length > 1) {
            for (let i = 1; i < out.length; i++) { len += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]); if (xAt == null && out[i - 1][1] > 2000 && out[i][1] <= 2000) { xAt = Math.round(out[i][0]); if (out.times) { tSill = +(t + out.times[i]).toFixed(1); LSill = +Tide.levelAt(t + out.times[i]).toFixed(2); } } }
            via = xAt == null ? 'none' : xAt > 1500 ? 'CHANNEL' : xAt > -400 ? 'WANTIJ' : 'GAMBLE';
          }
          let cf = null;
          if (via !== 'WANTIJ') { window.__cf = 1; try { const o2 = orig.call(this, grid, from, [560, 700]); cf = o2 ? { ok: 1, tArr: +(t + o2.times[o2.times.length - 1]).toFixed(1), L: +Tide.levelAt(t + o2.times[o2.times.length - 1]).toFixed(2) } : { ok: 0 }; } finally { window.__cf = 0; } }
          log.push({ to: [Math.round(to[0]), Math.round(to[1])], cf, t: +t.toFixed(1), name: bb.name, nerve: bb.traits.nerve, leg: bb.raceState.leg, r2: bb.__r2, y: Math.round(from[1]), via, xAt, tSill, LSill, len: Math.round(len), wait: out && out.wait ? 1 : 0, L: +Tide.levelAt(t).toFixed(2) });
        }
      } catch (e) { log.push({ err: String(e) }); }
      return out;
    };
    const dt = 1 / 60;
    for (let it = 0; it < 60 * 400; it++) {
      update(dt);
      if (state.race.status === 'finished') break;
      if (state.race.status !== 'racing') continue;
      for (const b of bots) if (b.__r2 == null && b.raceState.leg >= 2) b.__r2 = +state.race.timer.toFixed(1);
      if (state.race.timer > 130) break;
    }
    return { log, fins: bots.map(b => ({ name: b.name, r2: b.__r2 })) };
  }, SEED);
  const byBoat = {};
  for (const l of r.log) { if (l.err) { console.log(l.err); continue; } (byBoat[l.name] = byBoat[l.name] || []).push(l); }
  for (const [name, L] of Object.entries(byBoat)) {
    const f = r.fins.find(x => x.name === name);
    console.log(`${name.padEnd(9)} n${L[0].nerve} r2 ${f && f.r2}:  ` + L.map(l => `${l.t}s@y${l.y}->(${l.to}) ${l.via}${l.xAt != null ? '(x' + l.xAt + (l.tSill ? ' sill@' + l.tSill + 's L' + l.LSill : '') + ')' : ''}${l.wait ? ' WAIT' : ''} len${l.len}${l.cf ? ' cf:' + (l.cf.ok ? 'sill@' + l.cf.tArr + 'L' + l.cf.L : 'NOPATH') : ''}`).join(' | '));
  }
  await browser.close();
})();

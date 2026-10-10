// PT-051 — THE START: when does every bot get across, and what holds back the ones that don't?
// Ten bots (ocean_bench's construction, late venue write), each race sailed only until the whole
// fleet has started (or gun + 120 s). Per venue: crossing-time percentiles after the gun, boats
// later than 15/30/60 s, OCS returns, and for each late boat where it sat at gun + 10 s, what it
// was doing (liveness, speed, nearest boat), so the late class can be named.
//   node _pt051_starts.js <trials> <seed0> venue[,venue...]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TRIALS = +process.argv[2] || 8, SEED0 = +process.argv[3] || 9400;
const VENUES = (process.argv[4] || 'bay,lake,lagoon,swamp,river,ocean,redrock,glowtide,arctic,otter,flats,volcanic,seatrials').split(',');
const ROOT = path.resolve(__dirname, '../../..');
(async () => { const b = await chromium.launch(); const all = {};
  for (const venue of VENUES) {
    const page = await b.newPage();
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), venue);
    const races = [];
    for (let i = 0; i < TRIALS; i++) races.push(await page.evaluate((seed) => {
      window.evalHarness.seed = seed; window.resetGame(); window.startRace(); state.course.cutoff = 900;
      const pl = state.boats.find(b => b.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
      const nine = state.boats.filter(b => b !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300;
      const snap = {}, ocs = new Set(), rot = new Map();   // net heading rotation on the start leg after the gun

      for (let it = 0; it < 60 * 160; it++) {
        window.update(1 / 60);
        if (state.race.status !== 'racing') continue;
        const t = state.race.timer;
        for (const bt of state.boats) if (bt.raceState.ocs) ocs.add(bt.name);
        for (const bt of state.boats) { if (bt.raceState.leg >= 1) continue; const R = rot.get(bt) || { h: bt.heading, net: 0, max: 0, abs: 0 };
          const dh = normalizeAngle(bt.heading - R.h); R.net += dh; R.abs += Math.abs(dh); R.max = Math.max(R.max, Math.abs(R.net)); R.h = bt.heading; rot.set(bt, R); }
        if (!snap.t10 && t >= 10) { snap.t10 = true;
          for (const bt of state.boats) if (bt.raceState.leg === 0) { const c = bt.controller || {}; let nd = 1e9; for (const o of state.boats) if (o !== bt) nd = Math.min(nd, Math.hypot(o.x - bt.x, o.y - bt.y));
            const dl = typeof c.getLineDistance === 'function' ? c.getLineDistance() : null;
            snap[bt.name] = { x: Math.round(bt.x), y: Math.round(bt.y), kt: +(bt.speed * 4).toFixed(1), live: c.livenessState, near: Math.round(nd), lineD: dl == null ? null : Math.round(dl), ocs: !!bt.raceState.ocs, pen: !!bt.raceState.penalty }; } }
        if (t > 120 || state.boats.every(bt => bt.raceState.leg >= 1)) break;
      }
      return state.boats.map(bt => ({ name: bt.name, cross: bt.raceState.leg >= 1 ? +(bt.raceState.startTimeDisplay || 0).toFixed(1) : null, ocs: ocs.has(bt.name), at10: snap[bt.name] || null, turns: rot.get(bt) ? +(rot.get(bt).max / (2 * Math.PI)).toFixed(1) : 0, turnsAbs: rot.get(bt) ? +(rot.get(bt).abs / (2 * Math.PI)).toFixed(1) : 0 }));
    }, SEED0 + i));
    all[venue] = races;
    const C = races.flat(), ts = C.map(c => c.cross == null ? 999 : c.cross).sort((a, b) => a - b), q = (f) => ts[Math.min(ts.length - 1, Math.floor(f * ts.length))];
    const late = C.filter(c => c.cross == null || c.cross > 15);
    console.log(`${venue.padEnd(9)} n ${C.length}  med ${q(0.5)}  p90 ${q(0.9)}  max ${ts[ts.length - 1] === 999 ? '>120' : ts[ts.length - 1]}  >15s ${C.filter(c => c.cross == null || c.cross > 15).length}  >30s ${C.filter(c => c.cross == null || c.cross > 30).length}  >60s ${C.filter(c => c.cross == null || c.cross > 60).length}  OCS ${C.filter(c => c.ocs).length}`);
    console.log(`          circling: ${C.filter(c => c.turns >= 1).length} bots >= 1 net turn, ${C.filter(c => c.turns >= 2).length} >= 2, max ${Math.max(0, ...C.map(c => c.turns))}` + C.filter(c => c.turns >= 2).map(c => ` | ${c.name} ${c.turns}t crossed ${c.cross}`).join(''));
    for (const c of late.filter(c => c.cross == null || c.cross > 30)) console.log(`     late: ${c.name} crossed ${c.cross ?? '>120'}  ocs ${c.ocs}  at+10s ${JSON.stringify(c.at10)}`);
    await page.close();
  }
  fs.writeFileSync(path.join(__dirname, `_pt051_starts_${SEED0}.json`), JSON.stringify(all));
  await b.close(); })();

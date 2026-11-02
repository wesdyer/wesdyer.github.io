// WIND EVENTS PROBE — do the step shifts (sim/wind.js windEventsInit) change how the fleet races?
//
// Races the bots (player on the autopilot) per seed and reports, per venue:
//   race   = median bot finish time (s), and the p10–p90 spread of the finishing fleet,
//   tacks  = tacks per boat on upwind sections (heading crosses the wind with TWA < 70 either side),
//   onHdr  = share of those tacks made while the boat was HEADED by > 4 deg against its own
//            60 s mean wind (the tack-on-the-header rhythm),
//   shiftSd= sd of the live wind direction at the boats against the mean field (deg) — how much
//            weather there was to read,
//   events = event starts during the race (all regions' own schedules).
//
//   NODE_PATH=node_modules node regatta/eval/_wind_events.js lake ...        (from repo root)
//   PATCH=patch.json — { "<venue>": { "<region id>": { field: value, ... } } } merged into
//   window.VENUE_DOC[venue].wind.regions before the venue is built (null deletes the field).
//   SEEDS=21,22,23,24 (default).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PATCH = process.env.PATCH ? JSON.parse(fs.readFileSync(process.env.PATCH, 'utf8')) : {};
const SEEDS = (process.env.SEEDS || '21,22,23,24').split(',').map(Number);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.error('PAGEERROR', e.message));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') }); await p.waitForTimeout(400);
  for (const v of process.argv.slice(2)) {
    const rows = [];
    for (const seed of SEEDS) {
      const r = await p.evaluate(([v, seed, patch]) => { try {
        if (patch) for (const reg of window.VENUE_DOC[v].wind.regions) {
          const pr = patch[reg.id]; if (!pr) continue;
          for (const [k, val] of Object.entries(pr)) { if (val === null) delete reg[k]; else reg[k] = val; }
        }
        window.evalHarness.seed = seed; localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
        selectVenue(v); resetGame(); startRace();
        const pl = state.boats.find(x => x.isPlayer); if (pl) pl.controller = new BotController(pl);
        const D = 180 / Math.PI;
        const side = state.boats.map(() => ({ off: 0, n: 0, t: null })); let side0 = null;
        const prev = state.boats.map(() => null), ema = state.boats.map(() => null), hdr = state.boats.map(() => null); let hOn = 0, hResp = 0;
        let tacks = 0, onHdr = 0, ss = 0, sn = 0; const fin = [];
        for (let it = 0; it < 900 * 30; it++) {
          if (pl && !pl.raceState.finished) { const d = normalizeAngle(pl.controller.targetHeading - pl.heading); pl.controller.update(1 / 30); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; }
          update(1 / 30);
          if (state.race.status !== 'racing' && state.race.status !== 'finished') continue;
          if (state.boats.every(bt => bt.raceState.finished)) break;
          if (it % 3) continue;   // 10 Hz
          if (!side0) { const sx = state.boats.reduce((a, q) => a + q.x, 0) / state.boats.length, sy = state.boats.reduce((a, q) => a + q.y, 0) / state.boats.length;
            const wd0 = (WIND_MEAN_FIELD = true, regionWindAt(sx, sy).direction); WIND_MEAN_FIELD = false; side0 = { x: sx, y: sy, rx: Math.cos(wd0), ry: Math.sin(wd0) }; }
          state.boats.forEach((bt, k) => {
            if (bt.raceState.finished) { if (bt.raceState.finishTime != null && !bt._ff) { bt._ff = 1; fin.push(bt.raceState.finishTime); } return; }
            const w = getWindAt(bt.x, bt.y);
            const a = 0.00167 * 3; // 60 s EMA at 10 Hz
            if (ema[k] == null) ema[k] = { s: Math.sin(w.direction), c: Math.cos(w.direction) };
            else { ema[k].s += a * (Math.sin(w.direction) - ema[k].s); ema[k].c += a * (Math.cos(w.direction) - ema[k].c); }
            const mean = Math.atan2(ema[k].s, ema[k].c);
            const rel = normalizeAngle(bt.heading - w.direction);     // + = starboard tack side
            if (prev[k] != null && Math.abs(rel) < 70 / D && Math.abs(prev[k].rel) < 70 / D && Math.sign(rel) !== Math.sign(prev[k].rel)) {
              tacks++;
              const shift = normalizeAngle(prev[k].wd - prev[k].mean);
              const side = prev[k].rel > 0 ? 1 : -1;                  // old tack
              if (-side * shift < -4 / D) onHdr++;                    // it was a header on the old tack
            }
            // HEADER RESPONSE: a beating boat newly headed by > 8 deg against its 60 s mean — did it
            // tack within 8 s?
            if (Math.abs(rel) < 70 / D) {
              const lift = -(rel > 0 ? 1 : -1) * normalizeAngle(w.direction - mean);
              const hd = hdr[k];
              if (hd && hd.open && Math.sign(rel) !== Math.sign(hd.rel0)) { hResp++; hd.open = false; }
              if (hd && hd.open && state.race.timer - hd.t > 8) hd.open = false;
              if (lift < -8 / D && !(hd && hd.on)) { hOn++; hdr[k] = { on: true, open: true, t: state.race.timer, rel0: rel }; }
              else if (lift > -4 / D && hd) hd.on = false;
            }
            prev[k] = { rel, wd: w.direction, mean };
            // SIDE: how far right (looking upwind at the gun's wind) the boat sat on leg 1, and when
            // it finished leg 1.
            if (bt.raceState.leg === 1) { const sd = side[k]; sd.off += (bt.x - side0.x) * side0.rx + (bt.y - side0.y) * side0.ry; sd.n++; }
            else if (bt.raceState.leg > 1 && side[k].t == null) side[k].t = state.race.timer;
          });
          if (it % 30 === 0) {
            for (const bt of state.boats) if (!bt.raceState.finished) {
              const live = regionWindAt(bt.x, bt.y).direction;
              WIND_MEAN_FIELD = true; const mf = regionWindAt(bt.x, bt.y).direction; WIND_MEAN_FIELD = false;
              const d = normalizeAngle(live - mf) * D; ss += d * d; sn++;
            }
          }
        }
        for (const bt of state.boats) if (bt.raceState.finished && !bt._ff && bt.raceState.finishTime != null) fin.push(bt.raceState.finishTime);
        let ne = 0; for (const rg of state.course.windRegions) for (const sch of (rg._evOwn || [])) for (const e of sch.evs) if (e.t < (fin.length ? Math.max(...fin) : 300)) ne++;
        // The day's way: + = veered (right) over the race, from the live minus mean wind at the centre.
        const cxm = state.course.marks.reduce((a, m) => a + m.x, 0) / state.course.marks.length, cym = state.course.marks.reduce((a, m) => a + m.y, 0) / state.course.marks.length;
        WIND_MEAN_FIELD = true; const mm = regionWindAt(cxm, cym).direction; WIND_MEAN_FIELD = false;
        const dayWay = normalizeAngle(regionWindAt(cxm, cym).direction - mm) * D;
        const sp = side.filter(q => q.n && q.t != null).map(q => [q.off / q.n, q.t]);
        let corr = null; if (sp.length > 3) { const ma = sp.reduce((a, q) => a + q[0], 0) / sp.length, mb = sp.reduce((a, q) => a + q[1], 0) / sp.length;
          let c = 0, va = 0, vb = 0; for (const [a1, b1] of sp) { c += (a1 - ma) * (b1 - mb); va += (a1 - ma) ** 2; vb += (b1 - mb) ** 2; } corr = c / Math.sqrt(va * vb);
          // seconds of leg-1 time per 100 u further right
          var slope = c / va * 100; }
        fin.sort((x, y) => x - y);
        const q = f => fin[Math.min(fin.length - 1, Math.floor(f * fin.length))];
        return { med: q(0.5), p10: q(0.1), p90: q(0.9), n: fin.length, tacks: tacks / state.boats.length, onHdr: tacks ? onHdr / tacks : 0, sd: Math.sqrt(ss / Math.max(1, sn)), ne, hOn: hOn / state.boats.length, hResp: hOn ? hResp / hOn : 0, dayWay, corr, slope: slope || 0, leg1: sp.length ? sp.reduce((a, q) => a + q[1], 0) / sp.length : 0, offSd: sp.length ? Math.sqrt(sp.reduce((a, q) => a + q[0] ** 2, 0) / sp.length - (sp.reduce((a, q) => a + q[0], 0) / sp.length) ** 2) : 0 };
      } catch (e) { return { err: e.stack }; } }, [v, seed, PATCH[v] || null]);
      if (r.err) { console.error(v, r.err); continue; }
      rows.push(r);
      console.log(`  ${v} seed ${seed}: race ${r.med.toFixed(0)} s (p10–p90 ${r.p10.toFixed(0)}–${r.p90.toFixed(0)}, ${r.n} fin)  tacks ${r.tacks.toFixed(1)}  onHdr ${(100 * r.onHdr).toFixed(0)}%  shiftSd ${r.sd.toFixed(1)}°  events ${r.ne}  headers ${r.hOn.toFixed(1)}/boat, tacked on ${(100 * r.hResp).toFixed(0)}%\n      day ${r.dayWay.toFixed(0)}°  leg1 ${r.leg1.toFixed(0)} s  side spread ${r.offSd.toFixed(0)} u  right→leg1 corr ${r.corr == null ? '-' : r.corr.toFixed(2)}  ${r.slope.toFixed(2)} s per 100 u right`);
    }
    const avg = k => rows.reduce((a, r) => a + r[k], 0) / rows.length;
    console.log(`${v.padEnd(8)} race ${avg('med').toFixed(0)} s  spread ${(avg('p90') - avg('p10')).toFixed(0)} s  tacks ${avg('tacks').toFixed(1)}  onHdr ${(100 * avg('onHdr')).toFixed(0)}%  shiftSd ${avg('sd').toFixed(1)}°  events ${avg('ne').toFixed(1)}  headers ${avg('hOn').toFixed(1)}/boat tacked ${(100 * avg('hResp')).toFixed(0)}%${PATCH[v] ? '  [PATCH]' : ''}`);
  }
  await b.close();
})();

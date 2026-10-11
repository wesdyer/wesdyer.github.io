// PT-005 — WHY DO BOTS SAIL INTO THE SHIPS? (Oct 10 2026)
// Ten-bot Lighthouse Cove races (player parked far away). Every contact EPISODE (a boat touching a vessel;
// gaps < 0.5 s merge) is classified from the frames before it:
//   geometry  — who ran into whom: the ship's bow (hit by the stem), the side (boat sailed into it or was
//               swept), the stern; the angle between headings
//   forecast  — the planner projects the ship in a straight line at its current heading and speed over its 4 s
//               lookahead. How far was the ship's TRUE position (the rails, exact) at contact from where that
//               straight line put it 4 s and 2 s before? Big = the ship turned or changed speed
//   seen      — did the boat's planner flag a staticCollision against this vessel in the 4 s before
//   cost      — duration, and distance not made good at the boat's own settled speed
//   node regatta/eval/rl/_pt005_census.js <races> <seed0> [tree]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const N = +process.argv[2] || 6, SEED0 = +process.argv[3] || 9400;
const ROOT = process.argv[4] ? path.join(__dirname, process.argv[4]) : path.resolve(__dirname, '../../..');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })); });
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  const all = [];
  for (let k = 0; k < N; k++) all.push(...await p.evaluate((seed) => {
    window.evalHarness.seed = seed; resetGame(); startRace(); state.course.cutoff = 900;
    const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
    const hits = new Map(); const prev = window.onRaceEvent;
    window.onRaceEvent = (ty, d) => { if (ty === 'collision_traffic' && d && d.boat && !d.boat.isPlayer) hits.set(d.boat, d.id); return prev && prev(ty, d); };
    const hist = new Map();   // boat -> ring of { t, x, y, h, sp, ships: [{id,x,y,h,speed}] }
    const ep = [], open = new Map();
    for (let it = 0; it < 60 * 700 && state.boats.some(b => !b.isPlayer && !b.raceState.finished); it++) {
      hits.clear(); update(1 / 60);
      if (state.race.status !== 'racing') continue;
      const t = state.race.timer;
      const ships = state.traffic.filter(v => v.active).map(v => ({ id: v.id, kind: v.kind, x: v.x, y: v.y, h: v.heading, speed: v.speed, len: v.hullLen, beam: v.hullBeam }));
      for (const bt of state.boats) { if (bt.isPlayer || bt.raceState.finished) continue;
        const H = hist.get(bt) || []; H.push({ t, x: bt.x, y: bt.y, h: bt.heading, sp: bt.speed, live: bt.ai && bt.ai.livenessState, ships }); if (H.length > 360) H.shift(); hist.set(bt, H);
        const id = hits.get(bt), o = open.get(bt);
        if (id != null) {
          if (o && o.id === id && t - o.t1 < 0.5) { o.t1 = t; o.minSp = Math.min(o.minSp, bt.speed); continue; }
          // new episode: geometry + forecast error from the history
          const v = ships.find(s => s.id === id);
          const fx = Math.sin(v.h), fy = -Math.cos(v.h);
          const along = (bt.x - v.x) * fx + (bt.y - v.y) * fy;              // + toward the bow
          const where = along > v.len * 0.3 ? 'bow' : along < -v.len * 0.3 ? 'stern' : 'side';
          let rel = Math.abs(normalizeAngle(bt.heading - v.h)) * 180 / Math.PI;
          const fc = {};
          for (const back of [2, 4]) {
            const f = H[H.length - 1 - back * 60]; if (!f) continue; const s0 = f.ships.find(s => s.id === id); if (!s0) { fc[back] = 'spawned'; continue; }
            const px = s0.x + Math.sin(s0.h) * s0.speed * back, py = s0.y - Math.cos(s0.h) * s0.speed * back;
            fc[back] = Math.round(Math.hypot(px - v.x, py - v.y));
          }
          const f4 = H[H.length - 1 - 240]; const settled = f4 ? f4.sp : bt.speed;
          const ne = { boat: bt.name, id, kind: v.kind.replace(/^bay-cove-/, ''), t0: t, t1: t, where, rel: Math.round(rel), err2: fc[2], err4: fc[4], shipKt: +(v.speed / 15).toFixed(1), settled, minSp: bt.speed, live: (H[H.length - 2] || {}).live, leg: bt.raceState.leg };
          open.set(bt, ne); ep.push(ne);
        }
      }
    }
    window.onRaceEvent = prev;
    return ep.map(e => ({ ...e, seed, dur: +(e.t1 - e.t0 + 1 / 60).toFixed(2), t0: +e.t0.toFixed(1), settled: +(e.settled * 4).toFixed(1), minSp: +(e.minSp * 4).toFixed(1) }));
  }, SEED0 + k));
  fs.writeFileSync(path.join(__dirname, '_pt005_census.json'), JSON.stringify(all, null, 1));
  const by = (f) => { const m = {}; for (const e of all) { const k = f(e); (m[k] = m[k] || []).push(e); } return Object.entries(m).map(([k, a]) => `${k}: ${a.length} ep, ${a.reduce((s, e) => s + e.dur, 0).toFixed(0)} s`).join(' | '); };
  console.log(`${N} races, ${all.length} episodes, ${all.reduce((s, e) => s + e.dur, 0).toFixed(0)} boat-s in contact (${(all.reduce((s, e) => s + e.dur, 0) / N / 9).toFixed(1)} s/boat)`);
  console.log('by vessel   ', by(e => e.kind));
  console.log('by where    ', by(e => e.where));
  console.log('by forecast ', by(e => e.err4 === 'spawned' ? 'spawned<4s' : e.err4 == null ? '?' : e.err4 > 150 ? 'straight-line wrong >150u @4s' : e.err4 > 50 ? 'off 50-150u' : 'straight-line right'));
  console.log('by liveness ', by(e => e.live || 'none'));
  console.log('longest     ', all.sort((a, b) => b.dur - a.dur).slice(0, 8).map(e => `${e.boat}@${e.seed} ${e.kind} ${e.where} rel${e.rel} ${e.dur}s err4=${e.err4} live=${e.live} t${e.t0}`).join('\n             '));
  await b.close(); })();

// START + BEAT PROBE (flats push): per bot, ten-bot protocol — x at the gun (the line runs
// x -80 pin .. 920 boat), speed at the gun (kt), line-crossing time, tacks on leg 1, time
// the rounding banks (leg 2 start), OCS, penalties in the first 40 s, and boat contacts in
// the first 40 s. His laps for comparison from traj/.
//   node _fl_start.js <trials> <seed0> <tree>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TRIALS = +(process.argv[2] || 8), SEED0 = +(process.argv[3] || 9400), ROOT = path.join(__dirname, process.argv[4] || 'treeFL0');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message.slice(0, 200)));
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', character: AI_CONFIG[0].name })); });
  const all = [];
  for (let i = 0; i < TRIALS; i++) {
    const seed = SEED0 + i;
    const r = await page.evaluate(async (seed) => {
      window.evalHarness.seed = seed; resetGame(); startRace(); state.course.cutoff = 900;
      const pl = state.boats.find(b => b.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
      const nine = state.boats.filter(b => b !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.9, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300;
      const bots = state.boats.filter(b => !b.isPlayer);
      const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      const info = bots.map(b => ({ name: b.name, pct: +b.ai.startLinePct.toFixed(2), gunX: null, gunY: null, gunKt: null, line: null, r2: null, tacks: 0, last: 0, lastT: -9, ocs: 0, pen: 0, con: 0, minSpdBeat: 99, ringIn: null, irons: 0, band: 0, reach: 0, run: 0, avoidS: 0 }));
      let gunDone = false;
      const cc = {}; const inner = window.onRaceEvent;
      window.onRaceEvent = (ty, d) => { try { if (ty === 'collision_boat' && d && d.boat && state.race.status === 'racing' && state.race.timer < 40) cc[d.boat.name] = (cc[d.boat.name] || 0) + 1; } catch (e) {} return inner && inner(ty, d); };
      const dt = 1 / 60;
      for (let it = 0; it < 60 * 200; it++) {
        update(dt);
        if (state.race.status !== 'racing') continue;
        const t = state.race.timer;
        if (!gunDone) { gunDone = true; bots.forEach((b, k) => { info[k].gunX = Math.round(b.x); info[k].gunY = Math.round(b.y); info[k].gunKt = +(b.speed * 4).toFixed(1); }); }
        for (let k = 0; k < bots.length; k++) {
          const b = bots[k], f = info[k];
          if (b.raceState.ocs) f.ocs = 1;
          if (f.line == null && b.raceState.leg >= 1) f.line = +t.toFixed(1);
          if (f.r2 == null && b.raceState.leg >= 2) { f.r2 = +t.toFixed(1); f.pen = b.raceState.totalPenalties || 0; }
          if (f.line != null && f.r2 == null) {
            const wd = getWindAt(b.x, b.y).direction; const twa = norm(b.heading - wd); const tk = twa > 0 ? 1 : -1;
            if (f.last && tk !== f.last && t - f.lastT > 2) { f.tacks++; f.lastT = t; } if (tk !== f.last) f.last = tk;
            if (b.speed * 4 < f.minSpdBeat) f.minSpdBeat = +(b.speed * 4).toFixed(1);
            const at = Math.abs(twa) * 57.3; if (at < 25) f.irons += dt; else if (at < 52) f.band += dt; else if (at < 95) f.reach += dt; else f.run += dt;
            const c = b.controller; if (c && Math.abs(c.lastAvoidDeviation || 0) > 0.3) f.avoidS += dt;
          }
        }
        if (info.every(f => f.r2 != null) || t > 120) break;
      }
      window.onRaceEvent = inner;
      return info.map(f => ({ ...f, con: cc[f.name] || 0, last: undefined, lastT: undefined }));
    }, seed);
    for (const f of r) all.push({ seed, ...f });
    console.log(`seed ${seed}: ` + r.sort((a, b) => (a.r2 || 999) - (b.r2 || 999)).map(f => `${f.name}[pct${f.pct} gunX${f.gunX} ${f.gunKt}kt line${f.line} r2:${f.r2} T${f.tacks} min${f.minSpdBeat}${f.ocs ? ' OCS' : ''}${f.pen ? ' PEN' + f.pen : ''}${f.con ? ' con' + f.con : ''}]`).join(' '));
  }
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; }; const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const F = all.filter(f => f.r2 != null);
  for (const f of all) { f.irons = +f.irons.toFixed(1); f.band = +f.band.toFixed(1); f.reach = +f.reach.toFixed(1); f.run = +f.run.toFixed(1); f.avoidS = +f.avoidS.toFixed(1); }
  console.log(`  BEAT TIME-IN-BAND (s/boat, mean): irons(<25°) ${mean(F.map(f => f.irons)).toFixed(1)}  close-hauled(25-52) ${mean(F.map(f => f.band)).toFixed(1)}  reach(52-95) ${mean(F.map(f => f.reach)).toFixed(1)}  run(>95) ${mean(F.map(f => f.run)).toFixed(1)}  under avoidance dev>0.3 ${mean(F.map(f => f.avoidS)).toFixed(1)}`);
  console.log(`\n${all.length} boats: line med ${med(F.map(f => f.line))} mean ${mean(F.map(f => f.line)).toFixed(1)}; r2 med ${med(F.map(f => f.r2))} mean ${mean(F.map(f => f.r2)).toFixed(1)}; beat (r2-line) med ${med(F.map(f => f.r2 - f.line)).toFixed(1)} mean ${mean(F.map(f => f.r2 - f.line)).toFixed(1)}; gun kt med ${med(F.map(f => f.gunKt))}; tacks mean ${mean(F.map(f => f.tacks)).toFixed(2)}; OCS ${(100 * mean(all.map(f => f.ocs))).toFixed(0)}%; pen-by-r2 ${mean(all.map(f => f.pen)).toFixed(2)}; contacts<40s ${mean(all.map(f => f.con)).toFixed(2)}`);
  for (const [lo, hi, lab] of [[-200, 250, 'pin third'], [250, 600, 'middle'], [600, 1100, 'boat third']]) { const S = F.filter(f => f.gunX >= lo && f.gunX < hi); if (S.length) console.log(`  gunX ${lab}: n ${S.length}, r2 med ${med(S.map(f => f.r2))}, beat med ${med(S.map(f => f.r2 - f.line)).toFixed(1)}, tacks ${mean(S.map(f => f.tacks)).toFixed(2)}, line med ${med(S.map(f => f.line))}`); }
  for (const [lo, hi, lab] of [[0, 1, 'T0-1'], [2, 3, 'T2-3'], [4, 99, 'T4+']]) { const S = F.filter(f => f.tacks >= lo && f.tacks <= hi); if (S.length) console.log(`  tacks ${lab}: n ${S.length}, beat med ${med(S.map(f => f.r2 - f.line)).toFixed(1)}`); }
  fs.writeFileSync(path.join(__dirname, '_fl_start.json'), JSON.stringify(all));
  await browser.close();
})();

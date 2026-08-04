// Who actually gets on a plane at Clubhouse Point, and why?
//
// The planing gate is speed-based (boatKnots > 8.5 sustained 1.5s, TWA 100-170,
// effective wind > 12). Clubhouse Point blows a steady 13 kt, and the J/111 polar
// at 13 kt with the kite up peaks at 8.97 kt — 0.47 kt of margin. The AI's flat
// +4 reach/downwind is worth ~6-7%, which is larger than that margin. This probe
// measures the consequence: planing seconds per boat, against a stat-zeroed
// control boat (the player's stat line) sailing the same course.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  const out = await p.evaluate(async () => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
    const rows = {};
    const races = [];
    for (let race = 0; race < 3; race++) {
      let s = 100 + race * 6151;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame();
      // Zero the stats of one AI boat: the player's stat line, sailed by the same brain.
      const control = state.boats.find(x => !x.isPlayer);
      for (const k of Object.keys(control.stats)) control.stats[k] = 0;
      control.__control = true;
      races.push({ base: +state.wind.baseSpeed.toFixed(1), control: control.name });
      state.race.status = 'racing';
      const dt = 1 / 60;
      for (let f = 0; f < 60 * 260; f++) {
        update(dt);
        for (const bt of state.boats) {
          if (bt.isPlayer || bt.raceState.finished) continue;
          const key = bt.__control ? `${bt.name} (STATS ZEROED)` : bt.name;
          const r = rows[key] || (rows[key] = {
            dw: 0, plane: 0, peak: 0, reach: bt.stats.reach, down: bt.stats.downwind,
            accel: bt.stats.acceleration });
          const wind = (typeof getWindAt === 'function') ? getWindAt(bt.x, bt.y) : state.wind;
          let twa = Math.abs(((bt.heading - wind.direction + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const twaDeg = twa * 180 / Math.PI;
          if (twaDeg > 100 && twaDeg < 170) {
            r.dw += dt;
            r.peak = Math.max(r.peak, bt.speed * 4);
            if (bt.raceState.isPlaning) r.plane += dt;
          }
        }
      }
      if (state.boats.every(x => x.isPlayer || x.raceState.finished)) { /* done */ }
    }
    return { rows, races };
  });
  console.log('Clubhouse Point, 3 races, wind ' + out.races.map(r => r.base).join('/') + ' kt\n');
  const list = Object.entries(out.rows).map(([name, r]) => ({
    name, ...r, pct: r.dw > 0 ? 100 * r.plane / r.dw : 0 }));
  list.sort((a, b) => b.pct - a.pct);
  console.log('boat                       reach down accel   TWA100-170 s   planing s    %   peak kt');
  for (const r of list) {
    console.log(
      r.name.padEnd(26),
      String(r.reach).padStart(5), String(r.down).padStart(5), String(r.accel).padStart(5),
      r.dw.toFixed(1).padStart(14), r.plane.toFixed(1).padStart(11),
      r.pct.toFixed(1).padStart(6), r.peak.toFixed(2).padStart(9));
  }
  await b.close();
})();

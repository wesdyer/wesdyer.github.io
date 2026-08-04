// What the gust source actually produces: population, where cells live, how big, how strong,
// how long they last, and how much of that ever touches the racecourse.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(2500);
  await p.evaluate(() => {
    if (typeof startRace === 'function') startRace();
    window.__log = { born: [], samples: [] };
    const seen = new WeakSet();
    const tick = () => {
      const bnd = state.course.boundary;
      let inArena = 0, onCourse = 0;
      // "on course": within 900u of the start->mark corridor
      const marks = (Array.isArray(state.course.marks) ? state.course.marks : Object.values(state.course.marks || {})).filter(m => m && m.x !== undefined);
      const A = marks[1] || marks[0], B = marks[marks.length - 1];
      for (const g of state.gusts) {
        if (!seen.has(g)) { seen.add(g); window.__log.born.push({
          type: g.type, rx: g.maxRadiusX, ry: g.maxRadiusY, dur: g.duration,
          dSpd: g.speedDelta, dDir: g.dirDelta * 180 / Math.PI,
          inArena: Arena.contains(bnd, g.x, g.y, 0) }); }
        if (Arena.contains(bnd, g.x, g.y, 0)) inArena++;
        // distance to the segment A-B
        const vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy;
        let t = ((g.x - A.x) * vx + (g.y - A.y) * vy) / L2; t = Math.max(0, Math.min(1, t));
        const dx = g.x - (A.x + vx * t), dy = g.y - (A.y + vy * t);
        if (Math.hypot(dx, dy) < 900) onCourse++;
      }
      window.__log.samples.push({ total: state.gusts.length, inArena, onCourse });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await p.waitForTimeout(60000);
  console.log(JSON.stringify(await p.evaluate(() => {
    const L = window.__log, s = L.samples, born = L.born;
    const avg = k => +(s.reduce((a, x) => a + x[k], 0) / s.length).toFixed(2);
    const med = a => { a = a.slice().sort((x, y) => x - y); return a.length ? +a[a.length >> 1].toFixed(1) : null; };
    const rng = a => a.length ? [+Math.min(...a).toFixed(1), +Math.max(...a).toFixed(1)] : null;
    return {
      baseWindKt: +state.wind.speed.toFixed(1),
      pressureScale: state.wind.pressure && { lo: +state.wind.pressure.lo.toFixed(1), hi: +state.wind.pressure.hi.toFixed(1) },
      population: { target: state.course.gustRegions.reduce((a, r) => a + r.count, 0),
                    avgAlive: avg('total'), avgInsideArena: avg('inArena'), avgNearCourse: avg('onCourse') },
      cellsBorn: born.length,
      bornInsideArena: born.filter(x => x.inArena).length,
      gustVsLull: { gust: born.filter(x => x.type === 'gust').length, lull: born.filter(x => x.type === 'lull').length },
      radiusX_units: rng(born.map(x => x.rx)), radiusY_units: rng(born.map(x => x.ry)),
      durationSec: rng(born.map(x => x.dur)),
      speedDeltaKt: rng(born.map(x => x.dSpd)), medSpeedDelta: med(born.map(x => x.dSpd)),
      dirDeltaDeg: rng(born.map(x => x.dDir))
    };
  }), null, 1));
  await b.close();
})();

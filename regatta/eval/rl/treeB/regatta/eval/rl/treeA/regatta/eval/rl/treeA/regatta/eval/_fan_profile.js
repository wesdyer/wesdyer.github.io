// How big is the fan a boat actually feels, across a puff?
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  const rows = await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
    let s = 4242;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame();
    const bd = state.course.boundary, R = 800;
    state.gusts = [{ type:'gust', x:bd.x, y:bd.y, vx:0, vy:0, moveSpeedFactor:0, moveDirOffset:0,
      maxRadiusX:R, maxRadiusY:R/2, radiusX:R, radiusY:R/2,
      rotation: state.wind.direction + Math.PI/2, speedDelta:4, dirDelta:0, duration:200, age:100 }];
    const saved = state.gusts; state.gusts = [];
    const base = getWindAt(bd.x, bd.y); state.gusts = saved;
    const wd = state.wind.direction, cx = Math.cos(wd), cy = Math.sin(wd);
    const ad = (a2,a1) => (((a2-a1+Math.PI*3)%(Math.PI*2))-Math.PI)*180/Math.PI;
    const out = [];
    for (let f = 0; f <= 1.0001; f += 0.1) {
      const w = getWindAt(bd.x + cx*(R/2)*f, bd.y + cy*(R/2)*f);
      out.push({ f:+f.toFixed(1), shift:+ad(w.direction, base.direction).toFixed(2),
                 boost:+(w.speed-base.speed).toFixed(2) });
    }
    return { base:+base.speed.toFixed(2), out };
  });
  console.log(`base wind ${rows.base} kt · one +4kt puff, half-width 400u\n`);
  console.log(' across  shift   boost');
  for (const r of rows.out) console.log(`  ${String(r.f).padEnd(6)} ${String(r.shift).padStart(6)}  ${String(r.boost).padStart(6)}`);
  const peak = rows.out.reduce((a,b)=>Math.abs(b.shift)>Math.abs(a.shift)?b:a);
  console.log(`\npeak felt shift ${peak.shift} deg at ${peak.f} of the way to the flank`);
  await b.close();
})();

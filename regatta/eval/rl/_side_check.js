const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', String(e).slice(0,150)));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);
  for (const v of ['bay','arctic','ocean','redrock']) {
    const r = await p.evaluate((v) => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
      window.resetGame();
      const marks = state.course.marks, route = state.course.route;
      const out = [];
      for (let i = 0; i < route.length; i++) {
        const e = route[i];
        if (e.kind !== 'round' || !e.mark) continue;
        const from = CoursePath.anchor(route[i-1], marks);
        const to = CoursePath.anchor(route[i+1], marks) || from;
        const m = e.mark;
        const bF = Math.atan2(from.y - m.y, from.x - m.x);
        const bT = Math.atan2(to.y - m.y, to.x - m.x);
        const sgn = m.side === 'port' ? -1 : 1;
        // the winding the authored side demands, and the winding the OTHER side would
        let need = (bT - bF) * sgn; while (need <= 0) need += Math.PI*2; while (need > Math.PI*2) need -= Math.PI*2;
        let alt  = (bT - bF) * -sgn; while (alt <= 0) alt += Math.PI*2; while (alt > Math.PI*2) alt -= Math.PI*2;
        out.push({ leg: i, side: m.side, r: Math.round(m.radius), zone: Math.round(m.zone),
                   reqSweep: +(m.reqSweep||0).toFixed(2),
                   windingAuthored: +(need*180/Math.PI).toFixed(0),
                   windingOther: +(alt*180/Math.PI).toFixed(0) });
      }
      return out;
    }, v);
    console.log(`\n${v}`);
    console.log('  leg side      markR zone  reqSweep  winding(authored side)  winding(other side)');
    for (const m of r) console.log(`  ${String(m.leg).padEnd(4)}${m.side.padEnd(10)}${String(m.r).padEnd(6)}${String(m.zone).padEnd(6)}${String(m.reqSweep).padEnd(10)}${String(m.windingAuthored+'deg').padEnd(24)}${m.windingOther}deg`);
  }
  await b.close();
})();

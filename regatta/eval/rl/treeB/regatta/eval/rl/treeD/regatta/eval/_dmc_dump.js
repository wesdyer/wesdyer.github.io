const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(2500);
  console.log(JSON.stringify(await p.evaluate(() => {
    const d = state.course.dmc;
    const r = state.course.route;
    return {
      routeKinds: r.map(e => ({ kind: e.kind, role: e.role, hasMark: !!e.mark, marks: e.marks || null })),
      marks: state.course.marks.map(m => ({ n: m.name || m.kind, x: Math.round(m.x), y: Math.round(m.y) })),
      roundMark: r[1] && r[1].mark ? { x: Math.round(r[1].mark.x), y: Math.round(r[1].mark.y), zone: Math.round(r[1].mark.zone), side: r[1].mark.side } : null,
      staticLandCount: CoursePath.staticLand(state.course.islands || []).length,
      totalIslands: (state.course.islands || []).length,
      dmc: d ? { total: Math.round(d.total), legs: d.legs.map(l => ({ n: l.pts.length, len: Math.round(l.length), base: Math.round(l.base),
                  first: l.pts[0] && { x: Math.round(l.pts[0].x), y: Math.round(l.pts[0].y) },
                  last: l.pts[l.pts.length-1] && { x: Math.round(l.pts[l.pts.length-1].x), y: Math.round(l.pts[l.pts.length-1].y) } })) } : null
    };
  }), null, 1));
  await b.close();
})();

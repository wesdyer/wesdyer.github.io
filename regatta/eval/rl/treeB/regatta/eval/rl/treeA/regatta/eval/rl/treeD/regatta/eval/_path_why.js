const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(2400);
  console.log(JSON.stringify(await p.evaluate(() => {
    const L = state.course.dmc.legs[1];
    const A = L.pts[0], B = L.pts[L.pts.length - 1];
    const land = CoursePath.staticLand(state.course.islands || []);
    const pl = state._dmcPlanner;
    // Which shapes does the straight line actually pass through?
    const hits = [];
    for (const l of land) {
      let inside = 0;
      for (let k = 0; k <= 200; k++) {
        const x = A.x + (B.x - A.x) * k / 200, y = A.y + (B.y - A.y) * k / 200;
        if (pointInPoly(x, y, l.vertices)) inside++;
      }
      if (inside) hits.push({ style: l.style, verts: l.vertices.length, r: Math.round(l.radius),
                              cx: Math.round(l.x), cy: Math.round(l.y), pctOfLine: Math.round(inside / 2) });
    }
    pl.updateIslands(land);
    return {
      from: { x: Math.round(A.x), y: Math.round(A.y) }, to: { x: Math.round(B.x), y: Math.round(B.y) },
      plannerSaysLineSafe: pl.isLineSafe(A, B),
      shapesTheLineCrosses: hits,
      inflatedCount: pl.inflatedIslands.length,
      inflatedVerts: pl.inflatedIslands.map(i => i.vertices.length),
      // Does the game's own water test agree the line is over land?
      inMaskWaterAtMid: inMaskWater((A.x + B.x) / 2, (A.y + B.y) / 2),
      landShapesUsedByGame: (state.course.landShapes || []).length
    };
  }), null, 1));
  await b.close();
})();

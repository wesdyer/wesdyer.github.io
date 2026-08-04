const { chromium } = require('playwright');
const path = require('path');
const OUT='/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d4fb1166-2abc-4e3b-a981-fea7ac01df07/scratchpad/';
(async () => {
  const b = await chromium.launch();
  for (const v of (process.env.V || 'arctic').split(',')) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2500);
    const info = await p.evaluate(() => {
      if (typeof startRace === 'function') startRace();
      for (let i = 0; i < 60 * 8; i++) update(1 / 60);
      // Park the camera on a shoreline that faces the seas.
      const w = regionWindAt(0, 0);
      const tx = -Math.sin(w.direction), ty = Math.cos(w.direction);
      let best = null, bs = -1;
      for (const isl of state.course.islands) {
        if (isl.hidden || !isl.vertices || isl.radius < 200) continue;
        const sgn = surfOutwardSign(isl);
        for (let i = 0, j = isl.vertices.length - 1; i < isl.vertices.length; j = i++) {
          const a = isl.vertices[j], c = isl.vertices[i];
          const ex = c.x - a.x, ey = c.y - a.y, L = Math.hypot(ex, ey); if (L < 40) continue;
          const nx = (ey / L) * sgn, ny = (-ex / L) * sgn;
          const f = -(nx * tx + ny * ty) * L;
          if (f > bs) { bs = f; best = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }; }
        }
      }
      if (best) { state.camera.target = 'free'; state.camera.x = best.x; state.camera.y = best.y; }
      let strokes=0; const rs=ctx.stroke; ctx.stroke=function(){strokes++;return rs.apply(this,arguments);};
       const t0 = performance.now(); for (let k = 0; k < 30; k++) drawSurf(ctx); const ms = (performance.now() - t0) / 30;
       ctx.stroke=rs;
      draw();
      return { windFrom: Math.round(w.direction * 180 / Math.PI), kt: +w.speed.toFixed(1),
               surfMsPerFrame: +ms.toFixed(2), strokesPerFrame: Math.round(strokes/30), shapes: state.course.islands.length };
    });
    console.log(v, JSON.stringify(info), errs.slice(0, 2));
    await p.screenshot({ path: OUT + 'surf_' + v + '.png' });
    await p.close();
  }
  await b.close();
})();

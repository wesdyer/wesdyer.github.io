const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1400,height:900}, deviceScaleFactor:1 });
  const errs=[]; p.on('pageerror',e=>errs.push('ERR '+e.message));
  p.on('requestfailed',r=>errs.push('404 '+r.url().split('/').slice(-2).join('/')));
  await p.goto('file://'+path.resolve(__dirname,'..','index.html'));
  await p.waitForTimeout(1200);
  await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{ settings.venue='arctic'; resetGame(); startRace(); });
  await p.waitForTimeout(50000);
  const d = await p.evaluate(() => {
    const b = state.course.boundary;
    const out = { venue: settings.venue, loaded: orcaLoaded, active: orcaActive(),
      time: +state.time.toFixed(1),
      boundary: b ? {x:Math.round(b.x), y:Math.round(b.y), r:Math.round(b.radius)} : null,
      cam: {x:Math.round(state.camera.x), y:Math.round(state.camera.y)},
      centres: [], culled: 0, visible: 0 };
    for (let pi=0; pi<ORCA.pods; pi++) {
      const c = orcaPodCentre(pi, state.time);
      out.centres.push({pi, x:Math.round(c.x), y:Math.round(c.y),
        distFromCam: Math.round(Math.hypot(c.x-state.camera.x, c.y-state.camera.y))});
    }
    const A = orcaCourseArea();
    out.courseArea = {x:Math.round(A.x), y:Math.round(A.y), r:Math.round(A.r)};
    const pop = orcaPopulation(state.time);
    out.visible = pop.length;
    const hw=700, hh=450;
    out.onScreen = pop.filter(e=>Math.abs(e.x-state.camera.x)<hw && Math.abs(e.y-state.camera.y)<hh).length;
    out.depths = pop.map(e=>+e.d.toFixed(2));
    out.culled = ORCA.pods*ORCA.podSize - out.visible;
    return out;
  });
  console.log(JSON.stringify(d,null,1));
  console.log('ERRORS', errs.length?errs.slice(0,4).join(' | '):'none');
  await b.close();
})();

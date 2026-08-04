const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1400,height:900}, deviceScaleFactor:1 });
  const errs=[]; p.on('pageerror',e=>errs.push('ERR '+e.message));
  await p.goto('file://'+path.resolve(__dirname,'..','index.html'));
  await p.waitForTimeout(1200);
  await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{ settings.venue='arctic'; resetGame(); startRace(); });
  await p.waitForTimeout(50000);
  console.log(JSON.stringify(await p.evaluate(() => {
    orcaFrameAt = -1;                                   // bypass the per-frame cache
    const A = orcaCourseArea();
    const c0 = orcaPodCentre(0, state.time);
    const members = [];
    for (let k=0;k<ORCA.podSize;k++){
      const i = 0*13+k, o = orcaIndividual(i,k,0), q = orcaPos(i,o,state.time,0);
      members.push({k, kind:o.kind, size:Math.round(o.size),
        dx:Math.round(q.x-c0.x), dy:Math.round(q.y-c0.y),
        d:+orcaDepthAt(((state.time/ORCA.cycleSec)+o.uph)%1).toFixed(2)});
    }
    return { active: orcaActive(), loaded: orcaLoaded,
      marks: state.course.marks.length,
      area: {x:Math.round(A.x), y:Math.round(A.y), r:Math.round(A.r)},
      pod0: {x:Math.round(c0.x), y:Math.round(c0.y)},
      cam: {x:Math.round(state.camera.x), y:Math.round(state.camera.y)},
      distPod0FromCam: Math.round(Math.hypot(c0.x-state.camera.x, c0.y-state.camera.y)),
      cullRadius: Math.round(Math.sqrt(canvas.width**2+canvas.height**2)*0.6+160),
      popNow: orcaPopulation(state.time).length,
      members };
  }),null,1));
  console.log('ERRORS', errs.length?errs.join(' | '):'none');
  await b.close();
})();

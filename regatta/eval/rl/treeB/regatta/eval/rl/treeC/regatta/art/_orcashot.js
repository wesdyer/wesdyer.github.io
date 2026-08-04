// Park the camera on a pod and capture, so the orcas can be judged in the real
// venue with real water, waves and boats. Scratch tool.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1500,height:940}, deviceScaleFactor:1 });
  const errs=[]; p.on('pageerror',e=>errs.push('ERR '+e.message));
  await p.goto('file://'+path.resolve(__dirname,'..','index.html'));
  await p.waitForTimeout(1200);
  await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{ settings.venue='arctic'; resetGame(); startRace(); });
  await p.waitForTimeout(52000);
  const info = await p.evaluate(() => {
    orcaFrameAt = -1;   // the render loop already cached this frame
    Object.defineProperty(state.camera,'x',{get:()=>orcaPodCentre(0,state.time).x, set:()=>{}});
    Object.defineProperty(state.camera,'y',{get:()=>orcaPodCentre(0,state.time).y, set:()=>{}});
    for (const el of document.body.children) if (el.tagName!=='CANVAS') el.style.visibility='hidden';
    return { visible: orcaPopulation(state.time).length,
             depths: orcaPopulation(state.time).map(e=>+e.d.toFixed(2)) };
  });
  await p.waitForTimeout(700);
  console.log('POD', JSON.stringify(info));
  for (let i=0;i<3;i++){ await p.screenshot({path:path.join(__dirname,'sheets',`orca-ingame-${i}.png`)}); await p.waitForTimeout(2600); }
  console.log('ERRORS', errs.length?errs.slice(0,4).join(' | '):'none');
  await b.close();
})();

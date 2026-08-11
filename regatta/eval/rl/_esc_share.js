// Does the wake-retracing ESCAPE (escActive) ever run on this venue? An inert
// crumb-trail change is only meaningful if the consumer of the trail fires.
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname, process.argv[2]||'treeHD12');
const VENUES=process.argv.slice(3).length?process.argv.slice(3):['swamp','river','redrock'];
(async()=>{
  const b=await chromium.launch();const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGE ERROR:',String(e).slice(0,200)));
  for(const v of VENUES){
    await p.addInitScript((vv)=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:vv}))},v);
    await p.goto('file://'+path.resolve(ROOT,'regatta/index.html'));
    await p.addScriptTag({content:fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8')});
    const r=await p.evaluate(()=>{
      window.evalHarness.seed=4300;window.resetGame();window.startRace();
      state.course.cutoff=900;
      const pl=state.boats.find(x=>x.isPlayer); if(pl){pl.x=1e6;pl.y=1e6;}
      const DT=1/60; let t=0,esc=0,wig=0,crumbs=0,n=0;
      for(let it=0;it<60*900;it++){
        window.update(DT);
        if(state.race.status!=='racing'){if(state.race.status==='finished')break;continue;}
        for(const bo of state.boats){
          if(bo.isPlayer||bo.raceState.finished||bo.raceState.leg<1)continue;
          const c=bo.controller; if(!c)continue;
          t+=DT; if(c.escActive)esc+=DT; if(c.wiggleActive)wig+=DT;
        }
      }
      for(const bo of state.boats){const c=bo.controller; if(c&&c.escCrumbs){crumbs+=c.escCrumbs.length;n++;}}
      return {t,esc,wig,crumbs,n};
    });
    console.log(v.padEnd(9),'racing '+r.t.toFixed(0)+' boat-s   escActive '+(100*r.esc/r.t).toFixed(2)+'%   wiggle '+(100*r.wig/r.t).toFixed(1)+'%   crumbs/boat '+(r.crumbs/(r.n||1)).toFixed(0));
  }
  await b.close();
})();

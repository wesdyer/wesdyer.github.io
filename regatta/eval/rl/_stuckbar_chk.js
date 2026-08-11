// What reset bar does the DAY-median rule produce per venue, and is it the old one?
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'treeSTK4');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGE ERROR:',String(e).slice(0,200)));
  console.log('venue      dayMedWind(kt)  nominal(kt)  resetBar(game/kt)   vs old 0.625/2.5kt');
  for(const v of ['swamp','redrock','lake','bay','river','lagoon','arctic','ocean','seatrials']){
    await p.addInitScript((vv)=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:vv}))},v);
    await p.goto('file://'+path.resolve(ROOT,'regatta/index.html'));
    await p.addScriptTag({content:fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8')});
    const r=await p.evaluate(()=>{
      window.evalHarness.seed=4300;window.resetGame();window.startRace();
      for(let i=0;i<60*120;i++)window.update(1/60);
      const w=(state.wind&&state.wind.spread&&state.wind.spread.med)||null;
      const nom=w?getTargetSpeed(0.7,false,w)*0.25:null;
      return {w,nom,bar:state.course._stuckResetBar,st:state.race.status};
    });
    const same = r.bar!=null && Math.abs(r.bar-0.625)<1e-9;
    console.log(v.padEnd(10), String(r.w==null?'-':r.w.toFixed(2)).padStart(12),
      String(r.nom==null?'-':(r.nom*4).toFixed(2)).padStart(12),
      String(r.bar==null?'-':(r.bar.toFixed(3)+'/'+(r.bar*4).toFixed(2))).padStart(18),
      '  ', same?'UNCHANGED (byte-inert)':'*** LOWERED ***');
  }
  await b.close();
})();

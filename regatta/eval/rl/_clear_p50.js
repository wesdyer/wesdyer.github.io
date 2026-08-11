// Does the PRECEDENTED venue-class scope (navigable-clearance p50, rule 11) separate
// the commitment-clamp winners from the losers? The losers are exactly the two venues
// with hard prop colliders (swamp 2051, lagoon 37); everything else has none. But a
// prop count is a correlate, not a mechanism — clearance is the mechanism, and rule 11
// already landed a scope on it ("navigable-clearance p50 >= 10, same shape as noSubsample").
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname, process.argv[2]||'treeDB3');
const VENUES=process.argv.slice(3).length?process.argv.slice(3):['redrock','arctic','bay','lake','river','ocean','lagoon','swamp'];
(async()=>{
  const b=await chromium.launch();const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGE ERROR:',String(e).slice(0,200)));
  console.log('venue      clear p10  p25  p50  p75 | open cells | verdict for the clamp');
  const V={redrock:'WIN -16.0',arctic:'WIN -18.0',bay:'win -3.0',lake:'win -3.0',river:'neutral +4',ocean:'(untested)',lagoon:'LOSS +6.0',swamp:'LOSS +14.2 mean'};
  for(const v of VENUES){
    await p.addInitScript((vv)=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:vv}))},v);
    await p.goto('file://'+path.resolve(ROOT,'regatta/index.html'));
    await p.addScriptTag({content:fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8')});
    const r=await p.evaluate(()=>{
      window.evalHarness.seed=9400;window.resetGame();window.startRace();
      for(let i=0;i<60*120;i++)window.update(1/60);
      const g=state.course.botGrid; if(!g||!g._clear) return null;
      const cl=[]; let open=0;
      for(let j=0;j<g.n;j++)for(let i=0;i<g.n;i++){ if(!g.at(i,j))continue; open++; cl.push(g._clear[j*g.n+i]); }
      cl.sort((a,b)=>a-b);
      const q=p=>cl.length?cl[Math.floor(p*(cl.length-1))]:NaN;
      return {p10:q(0.10),p25:q(0.25),p50:q(0.50),p75:q(0.75),open};
    });
    if(!r){console.log(v.padEnd(10)+'  (no _clear grid)'); continue;}
    console.log(v.padEnd(10)+String(r.p10).padStart(8)+String(r.p25).padStart(5)+String(r.p50).padStart(5)+String(r.p75).padStart(5)+
      ' |'+String(r.open).padStart(11)+' | '+(V[v]||''));
  }
  await b.close();
})();

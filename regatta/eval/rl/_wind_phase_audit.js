const { chromium } = require('playwright');
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'treeNOW2');   // post-merge code
(async()=>{const b=await chromium.launch();const p=await b.newPage();
 await p.addInitScript(()=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:'bay'}))});
 await p.goto('file://'+path.resolve(ROOT,'regatta/index.html'));
 await p.addScriptTag({content:fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8')});
 const r=await p.evaluate(async()=>{
   const out=[];
   for(let k=0;k<3;k++){
     window.evalHarness.seed=7700; window.resetGame(); window.startRace();
     out.push({seedAtRace: state.race.seed,
               phases:(state.course.windRegions||[]).map(r=>+r.phase.toFixed(4)),
               periods:(state.course.windRegions||[]).map(r=>r.period)});
   }
   return out;
 });
 r.forEach((x,i)=>console.log(`reset ${i+1}: seed=${x.seedAtRace} periods=${JSON.stringify(x.periods)} phases=${JSON.stringify(x.phases)}`));
 await b.close();})();

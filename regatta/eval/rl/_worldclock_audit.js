const { chromium } = require('playwright');
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'treeNOW2');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
 await p.addInitScript(()=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:'bay'}))});
 await p.goto('file://'+path.resolve(ROOT,'regatta/index.html'));
 await p.addScriptTag({content:fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8')});
 const r=await p.evaluate(async()=>{
   window.evalHarness.seed=7700; window.resetGame(); window.startRace();
   const t0=state.time;
   await new Promise(r=>setTimeout(r,400));        // no update() calls from us
   const t1=state.time;
   for(let i=0;i<60;i++) window.update(1/60);       // exactly 1 second of sim
   const t2=state.time;
   await new Promise(r=>setTimeout(r,400));
   const t3=state.time;
   return {t0,t1,t2,t3};
 });
 console.log('state.time right after startRace :', r.t0);
 console.log('after 400ms of NO update() calls  :', r.t1, r.t1!==r.t0 ? '  <<< ADVANCED ON ITS OWN (wall-clock frames drive the sim clock)' : '  (stable)');
 console.log('after 60 explicit update(1/60)    :', r.t2);
 console.log('after another 400ms idle          :', r.t3, r.t3!==r.t2 ? '  <<< ADVANCED AGAIN' : '  (stable)');
 await b.close();})();

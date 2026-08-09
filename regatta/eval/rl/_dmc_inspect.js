const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'treeCP1');
(async()=>{const b=await chromium.launch();
for(const v of ['lake','lagoon','arctic','redrock']){
 const p=await b.newPage();
 await p.addInitScript(vv=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:vv}))},v);
 await p.goto('file://'+path.resolve(ROOT,'regatta/index.html'));
 await p.addScriptTag({content:fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8')});
 const r=await p.evaluate(async()=>{window.evalHarness.seed=9100;window.resetGame();window.startRace();window.update(1/60);
   const L=(state.course.dmc&&state.course.dmc.legs)||[];
   return {n:L.length, legs:L.map((l,i)=>({i, keys:Object.keys(l).slice(0,10),
     from:l.from?[Math.round(l.from.x),Math.round(l.from.y)]:null,
     to:l.to?[Math.round(l.to.x),Math.round(l.to.y)]:null,
     len:l.length!=null?Math.round(l.length):null}))};});
 console.log(v, JSON.stringify(r).slice(0,700)); await p.close();}
await b.close();})();

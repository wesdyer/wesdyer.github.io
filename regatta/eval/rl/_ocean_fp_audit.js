const { chromium } = require('playwright');
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'treeNOW');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
 await p.addInitScript(()=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:'ocean'}))});
 await p.goto('file://'+path.resolve(ROOT,'regatta/index.html'));
 await p.addScriptTag({content:fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8')});
 const r=await p.evaluate(async()=>{
   const djb=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h*33)^s.charCodeAt(i))>>>0;return h.toString(16)+":"+s.length;};
   const before=JSON.stringify(window.VENUE_DOC.ocean);
   window.evalHarness.seed=9300;window.resetGame();window.startRace();window.update(1/60);
   const after=JSON.stringify(window.VENUE_DOC.ocean);
   // find the first differing region
   let i=0; while(i<Math.min(before.length,after.length)&&before[i]===after[i])i++;
   return {before:djb(before), after:djb(after), same:before===after,
           ctxBefore:before.slice(Math.max(0,i-60),i+80), ctxAfter:after.slice(Math.max(0,i-60),i+80)};
 });
 console.log('doc fp at load :',r.before);
 console.log('doc fp at race :',r.after, r.same?'(unchanged)':'(MUTATED by resetGame/startRace)');
 if(!r.same){console.log('  before:',r.ctxBefore);console.log('  after :',r.ctxAfter);}
 await b.close();})();

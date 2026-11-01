const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.addInitScript(()=>localStorage.setItem('regatta_settings',JSON.stringify({venue:'bay'})));
await p.goto('file://'+path.resolve('regatta/index.html'));
await p.addScriptTag({content:fs.readFileSync('regatta/eval/eval_harness.js','utf8')});await p.waitForTimeout(400);
for(const v of process.argv.slice(2)){const r=await p.evaluate(([v])=>{try{
 window.evalHarness.seed=11;localStorage.setItem('regatta_settings',JSON.stringify({venue:v}));selectVenue(v);resetGame();startRace();
 for(let k=0;k<200*30&&state.race.status!=='racing';k++)update(1/30);
 const legs=state.course.dmc.legs.filter(L=>L&&L.pts&&L.pts.length>1);
 const dseg=(x,y,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy||1;let t=((x-a.x)*dx+(y-a.y)*dy)/l;t=Math.max(0,Math.min(1,t));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)};
 const dcourse=(x,y)=>{let m=1e9;for(const L of legs)for(let i=1;i<L.pts.length;i++)m=Math.min(m,dseg(x,y,L.pts[i-1],L.pts[i]));return m};
 let n=0,on=0,inArena=0,ry=0,rx=0,kt=0,cells=0;const life=[];
 for(let it=0;it<180*30;it++){update(1/30);if(it%30)continue;for(const g of state.gusts){cells++;rx+=g.radiusX;ry+=g.radiusY;kt+=Math.abs(g.speedDelta);
   if(Arena.contains(state.course.boundary,g.x,g.y,0))inArena++; if(dcourse(g.x,g.y)<g.radiusY+300)on++;}n++}
 return {cellsAvg:+(cells/n).toFixed(1),onCourseFrac:+(on/cells).toFixed(2),inArenaFrac:+(inArena/cells).toFixed(2),meanRx_m:+(rx/cells/10).toFixed(0),meanRy_m:+(ry/cells/10).toFixed(0),meanAbsKt:+(kt/cells).toFixed(1)}}catch(e){return e.stack}},[v]);
 console.log(v,JSON.stringify(r));}
await b.close()})();

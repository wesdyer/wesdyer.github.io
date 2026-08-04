const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A=process.argv.slice(2); const NUM=parseInt(A[0])||4, BASE=parseInt(A[1])||100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js','utf8') });
  const out = await page.evaluate(({NUM,BASE})=>{
    const h=window.evalHarness; const recs=[];
    for(let i=0;i<NUM;i++){
      const seed=BASE+i; h.seed=seed; window.resetGame(); window.startRace();
      const marks=state.course.marks, m0=marks[0],m1=marks[1];
      const lineDx=m1.x-m0.x,lineDy=m1.y-m0.y,lineLen=Math.hypot(lineDx,lineDy)||1;
      const perp=(b)=>((b.x-m0.x)*lineDy-(b.y-m0.y)*lineDx)/lineLen;
      const along=(b)=>(((b.x-m0.x)*lineDx+(b.y-m0.y)*lineDy)/(lineLen*lineLen));
      const startT={}; const oh=window.onRaceEvent;
      window.onRaceEvent=(t,d)=>{ if(t==='leg_complete'&&d.leg===0&&startT[d.boat.id]==null) startT[d.boat.id]=state.race.timer; if(oh)oh(t,d); };
      const dt=1/60; let it=0; let last=-1;
      // pick 2 boats to track
      const trackIds = state.boats.filter(b=>!b.isPlayer).slice(0,2).map(b=>b.id);
      const logs={};
      while(it<(120)*60){ // only first 120s
        const ph=state.race.status;
        const t = ph==='prestart' ? -state.race.timer : state.race.timer; // negative before gun
        if((ph==='prestart'||ph==='racing') && t-last>=1){ last=t;
          trackIds.forEach(id=>{ const b=state.boats.find(x=>x.id===id); if(!b)return;
            if(b.raceState.leg>0) return;
            if(!logs[id])logs[id]=[];
            const c=b.controller;
            const twaDeg=Math.round(Math.abs(((b.heading-state.wind.direction)+Math.PI*3)%(Math.PI*2)-Math.PI)*180/Math.PI);
            logs[id].push({t:Math.round(t),ph:ph[0],perp:Math.round(perp(b)),al:+along(b).toFixed(2),spd:+(b.speed).toFixed(2),sl:+(c.speedLimit||0).toFixed(2),twa:twaDeg,cm:+(c.startCommitted||false),risk:(c.riskState||'?')[0]});
          });
        }
        if(state.race.status==='racing' && state.race.timer>120) break;
        window.update(dt); it++;
      }
      window.onRaceEvent=oh;
      trackIds.forEach(id=>{ const b=state.boats.find(x=>x.id===id);
        recs.push({seed, name:b.name, start: startT[id]!=null?+startT[id].toFixed(1):null, log:logs[id]||[]}); });
    }
    return recs;
  },{NUM,BASE});
  out.forEach(r=>{
    console.log(`\nseed ${r.seed} ${r.name} START=${r.start}s`);
    r.log.forEach(p=>console.log(`  t=${p.t}${p.ph} perp=${p.perp} al=${p.al} spd=${p.spd} sl=${p.sl} twa=${p.twa} cm=${p.cm} risk=${p.risk}`));
  });
}) ();

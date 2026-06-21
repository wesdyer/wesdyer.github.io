const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A=process.argv.slice(2); const NUM=parseInt(A[0])||15, BASE=parseInt(A[1])||100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js','utf8') });
  const data = await page.evaluate(({NUM,BASE})=>{
    const h=window.evalHarness; const recs=[];
    for(let i=0;i<NUM;i++){
      const seed=BASE+i; h.seed=seed; window.resetGame(); window.startRace();
      const marks=state.course.marks; const m0=marks[0],m1=marks[1];
      const lineDx=m1.x-m0.x, lineDy=m1.y-m0.y, lineLen=Math.hypot(lineDx,lineDy)||1;
      const perp=(b)=>((b.x-m0.x)*lineDy-(b.y-m0.y)*lineDx)/lineLen;
      const startT={}; const oh=window.onRaceEvent;
      window.onRaceEvent=(t,d)=>{ if(t==='leg_complete'&&d.leg===0&&startT[d.boat.name]==null) startT[d.boat.name]=state.race.timer; if(oh)oh(t,d); };
      const dt=1/60; let it=0; let last=-1;
      const tracks={};
      while(it<(600+50)*60){
        const racing=state.race.status==='racing';
        if(racing){ if(state.race.timer>600)break; if(state.boats.every(b=>b.raceState.finished))break;
          const t=state.race.timer;
          if(t-last>=1){ last=t;
            state.boats.forEach(b=>{ if(b.isPlayer)return; if(b.raceState.leg>0)return;
              if(!tracks[b.name])tracks[b.name]=[];
              if(t<=25) tracks[b.name].push({t:Math.round(t),p:Math.round(perp(b)),s:Math.round(b.speed*100)/100,sl:b.controller?Math.round((b.controller.speedLimit||0)*100)/100:0,risk:b.controller?b.controller.riskState:'?'});
            });
          }
        }
        window.update(dt); it++;
      }
      window.onRaceEvent=oh;
      // pick one representative boat that started between 12-22s
      for(const nm in tracks){ const st=startT[nm]; if(st!=null && st>=12 && st<=22 && recs.length<8) recs.push({seed,nm,start:Math.round(st*10)/10,track:tracks[nm]}); }
    }
    return recs;
  },{NUM,BASE});
  data.forEach(r=>{
    console.log(`\nseed ${r.seed} ${r.nm} start=${r.start}s`);
    r.track.forEach(p=>console.log(`  t=${p.t} perp=${p.p} spd=${p.s} spdLim=${p.sl} risk=${p.risk}`));
  });
}) ();

const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A=process.argv.slice(2); const NUM=parseInt(A[0])||20, BASE=parseInt(A[1])||100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js','utf8') });
  const out = await page.evaluate(({NUM,BASE})=>{
    const h=window.evalHarness; const recs=[];
    for(let i=0;i<NUM && recs.length<6;i++){
      const seed=BASE+i; h.seed=seed; window.resetGame(); window.startRace();
      const marks=state.course.marks, m0=marks[0],m1=marks[1];
      const lineDx=m1.x-m0.x,lineDy=m1.y-m0.y,lineLen=Math.hypot(lineDx,lineDy)||1;
      const perp=(b)=>((b.x-m0.x)*lineDy-(b.y-m0.y)*lineDx)/lineLen;
      const along=(b)=>(((b.x-m0.x)*lineDx+(b.y-m0.y)*lineDy)/(lineLen*lineLen));
      const startT={}; const oh=window.onRaceEvent;
      window.onRaceEvent=(t,d)=>{ if(t==='leg_complete'&&d.leg===0&&startT[d.boat.id]==null) startT[d.boat.id]=state.race.timer; if(oh)oh(t,d); };
      const dt=1/60; let it=0; const logs={}; let last=-1;
      while(it<(150)*60){ const racing=state.race.status==='racing';
        if(racing){ if(state.race.timer>150)break; if(state.boats.every(b=>b.raceState.finished))break;
          const t=state.race.timer;
          if(t-last>=2){ last=t;
            state.boats.forEach(b=>{ if(b.isPlayer)return; if(b.raceState.leg>0)return;
              if(!logs[b.id])logs[b.id]=[];
              logs[b.id].push({t:Math.round(t),p:Math.round(perp(b)),al:+along(b).toFixed(2),s:+b.speed.toFixed(2),twa:Math.round(Math.abs(((b.heading-state.wind.direction)+Math.PI*3)%(Math.PI*2)-Math.PI)*180/Math.PI),r:(b.controller.riskState||'?')[0]});
            });
          }
        }
        window.update(dt); it++;
      }
      window.onRaceEvent=oh;
      // pick the slowest starter in this trial
      let worst=null;
      state.boats.forEach(b=>{ if(b.isPlayer)return; const st=startT[b.id]; const v=st==null?999:st; if(!worst||v>worst.v) worst={id:b.id,name:b.name,v,st}; });
      if(worst && worst.v>18) recs.push({seed, name:worst.name, start: worst.st!=null?+worst.st.toFixed(1):null, log:(logs[worst.id]||[]).slice(0,40)});
    }
    return recs;
  },{NUM,BASE});
  out.forEach(r=>{ console.log(`\nseed ${r.seed} ${r.name} START=${r.start}`);
    r.log.forEach(p=>console.log(`  t=${p.t} perp=${p.p} al=${p.al} spd=${p.s} twa=${p.twa} risk=${p.r}`)); });
}) ();

const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A=process.argv.slice(2); const NUM=parseInt(A[0])||40, BASE=parseInt(A[1])||100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js','utf8') });
  const r = await page.evaluate(({NUM,BASE})=>{
    const h=window.evalHarness; const gaps=[]; const reachT=[]; const startT_=[]; let offseg=0, n=0;
    for(let i=0;i<NUM;i++){
      const seed=BASE+i; h.seed=seed; window.resetGame(); window.startRace();
      const marks=state.course.marks, m0=marks[0],m1=marks[1];
      const lineDx=m1.x-m0.x,lineDy=m1.y-m0.y,lineLen=Math.hypot(lineDx,lineDy)||1;
      const perp=(b)=>((b.x-m0.x)*lineDy-(b.y-m0.y)*lineDx)/lineLen;
      // lateral position along line: fraction 0..1 between m0,m1
      const along=(b)=>(((b.x-m0.x)*lineDx+(b.y-m0.y)*lineDy)/(lineLen*lineLen));
      const reached={}, started={}, crossOff={};
      const oh=window.onRaceEvent;
      window.onRaceEvent=(t,d)=>{ if(t==='leg_complete'&&d.leg===0&&started[d.boat.id]==null) started[d.boat.id]=state.race.timer; if(oh)oh(t,d); };
      const dt=1/60; let it=0;
      while(it<(600+50)*60){ const racing=state.race.status==='racing';
        if(racing){ if(state.race.timer>600)break; if(state.boats.every(b=>b.raceState.finished))break;
          const t=state.race.timer;
          state.boats.forEach(b=>{ if(b.isPlayer)return; if(b.raceState.leg>0)return;
            const p=perp(b), a=along(b);
            // "reached" = first time within 30u below line AND within segment laterally
            if(reached[b.id]==null && p>=-35 && p<=5 && a>=0 && a<=1) reached[b.id]=t;
          });
        }
        window.update(dt); it++;
      }
      window.onRaceEvent=oh;
      state.boats.forEach(b=>{ if(b.isPlayer)return; n++;
        const rt=reached[b.id], st=started[b.id];
        if(st!=null) startT_.push(st);
        if(rt!=null) reachT.push(rt);
        if(rt!=null && st!=null) gaps.push(st-rt);
      });
    }
    const f=(arr)=>{arr=arr.slice().sort((a,b)=>a-b); if(!arr.length)return{};const m=arr.reduce((a,b)=>a+b,0)/arr.length;const q=x=>arr[Math.min(arr.length-1,Math.floor(x*arr.length))];return{n:arr.length,mean:+m.toFixed(2),median:+q(.5).toFixed(2),p90:+q(.9).toFixed(2),max:+arr[arr.length-1].toFixed(1)};};
    return {n, reach:f(reachT), start:f(startT_), gap:f(gaps)};
  },{NUM,BASE});
  console.log("AI boats:", r.n);
  console.log("time to REACH line (within 35u, in segment):", JSON.stringify(r.reach));
  console.log("time to START (cross segment):", JSON.stringify(r.start));
  console.log("GAP (start - reach) = time lost crossing:", JSON.stringify(r.gap));
}) ();

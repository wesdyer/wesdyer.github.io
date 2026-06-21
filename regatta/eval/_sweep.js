const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A=process.argv.slice(2); const NUM=parseInt(A[0])||30, BASE=parseInt(A[1])||100;
const CONFIGS = JSON.parse(A[2] || '[{"veff":0.42}]');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js','utf8') });
  for (const cfg of CONFIGS) {
    const res = await page.evaluate(({NUM,BASE,cfg})=>{
      window.__START = cfg;
      const h=window.evalHarness; const starts=[]; let over=0, dns=0, n=0;
      for(let i=0;i<NUM;i++){
        const seed=BASE+i; h.seed=seed; window.resetGame(); window.startRace();
        const marks=state.course.marks, m0=marks[0],m1=marks[1];
        const lineDx=m1.x-m0.x,lineDy=m1.y-m0.y,lineLen=Math.hypot(lineDx,lineDy)||1;
        const perp=(b)=>((b.x-m0.x)*lineDy-(b.y-m0.y)*lineDx)/lineLen;
        const startT={}; const oh=window.onRaceEvent;
        window.onRaceEvent=(t,d)=>{ if(t==='leg_complete'&&d.leg===0&&startT[d.boat.id]==null) startT[d.boat.id]=state.race.timer; if(oh)oh(t,d); };
        const dt=1/60; let it=0; let gun=null;
        while(it<(600+50)*60){ const racing=state.race.status==='racing';
          if(racing){ if(state.race.timer>600)break; if(state.boats.every(b=>b.raceState.finished))break;
            if(!gun){ gun={}; state.boats.forEach(b=>{ if(!b.isPlayer) gun[b.id]=perp(b); }); }
          }
          window.update(dt); it++;
        }
        window.onRaceEvent=oh;
        state.boats.forEach(b=>{ if(b.isPlayer)return; n++;
          if(gun && gun[b.id]>0) over++;
          if(startT[b.id]!=null) starts.push(startT[b.id]); else dns++;
        });
      }
      starts.sort((a,b)=>a-b);
      const mean=starts.reduce((a,b)=>a+b,0)/starts.length;
      const pct=q=>starts[Math.min(starts.length-1,Math.floor(q*starts.length))];
      return {cfg, n, dns, overPct:+(over/n*100).toFixed(1), mean:+mean.toFixed(2), median:+pct(0.5).toFixed(2), p75:+pct(0.75).toFixed(2), p90:+pct(0.9).toFixed(2), max:+starts[starts.length-1].toFixed(1)};
    },{NUM,BASE,cfg});
    console.log(JSON.stringify(res));
  }
  await browser.close();
}) ();

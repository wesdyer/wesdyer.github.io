// Measure AI boat state AT THE GUN (prestart->racing transition) and correlate
// with eventual start time, to see why starts are late.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A=process.argv.slice(2); const NUM=parseInt(A[0])||60, BASE=parseInt(A[1])||100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js','utf8') });
  const rows = await page.evaluate(({NUM,BASE})=>{
    const h=window.evalHarness; const out=[];
    for(let i=0;i<NUM;i++){
      const seed=BASE+i; h.seed=seed; window.resetGame(); window.startRace();
      const marks=state.course.marks; const m0=marks[0],m1=marks[1];
      const lineDx=m1.x-m0.x, lineDy=m1.y-m0.y, lineLen=Math.hypot(lineDx,lineDy)||1;
      const wd0=state.wind.direction;
      const perp=(b)=>((b.x-m0.x)*lineDy-(b.y-m0.y)*lineDx)/lineLen; // >0 = OCS side
      const dt=1/60; let it=0; let gun=null; const startT={};
      // hook start_cross
      const events=[];
      const oh=window.onRaceEvent; window.onRaceEvent=(t,d)=>{ if(t==='leg_complete'&&d.leg===0) startT[d.boat.name]=state.race.timer; if(oh)oh(t,d); };
      while(it<(600+50)*60){
        const racing=state.race.status==='racing';
        if(racing){ if(state.race.timer>600)break; if(state.boats.every(b=>b.raceState.finished))break; }
        // capture gun state on first racing frame
        if(racing && !gun){
          gun=state.boats.filter(b=>!b.isPlayer).map(b=>({name:b.name, perp:Math.round(perp(b)), spd:Math.round(b.speed*100)/100,
            twa:Math.round(Math.abs(((b.heading-state.wind.direction)+Math.PI*3)%(Math.PI*2)-Math.PI)*100)/100}));
        }
        window.update(dt); it++;
      }
      window.onRaceEvent=oh;
      gun.forEach(g=>{ g.startT = startT[g.name]!=null?Math.round(startT[g.name]*100)/100:null; out.push(g); });
    }
    return out;
  },{NUM,BASE});
  // analyze
  const started=rows.filter(r=>r.startT!=null);
  const perpAtGun=rows.map(r=>r.perp);
  const f=(arr)=>{arr=arr.slice().sort((a,b)=>a-b); const m=arr.reduce((a,b)=>a+b,0)/arr.length; return {mean:+m.toFixed(1),median:+arr[Math.floor(arr.length/2)].toFixed(1),p10:+arr[Math.floor(arr.length*.1)].toFixed(1),p90:+arr[Math.floor(arr.length*.9)].toFixed(1),min:+arr[0].toFixed(1),max:+arr[arr.length-1].toFixed(1)};};
  console.log("AI boats:",rows.length,"started:",started.length,"DNS:",rows.length-started.length);
  console.log("perpDist at gun (>0=OCS/over, <0=behind):", JSON.stringify(f(perpAtGun)));
  console.log("speed at gun:", JSON.stringify(f(rows.map(r=>r.spd))));
  console.log("|TWA| at gun (rad, 0=head-to-wind):", JSON.stringify(f(rows.map(r=>r.twa))));
  console.log("start time:", JSON.stringify(f(started.map(r=>r.startT))));
  // correlation: boats behind line at gun -> late start?
  const behind=started.filter(r=>r.perp< -20), near=started.filter(r=>Math.abs(r.perp)<=20), over=started.filter(r=>r.perp>20);
  const avg=a=>a.length?(a.reduce((x,r)=>x+r.startT,0)/a.length).toFixed(1):'-';
  console.log(`behind line(<-20): n=${behind.length} avgStart=${avg(behind)} | near(±20): n=${near.length} avgStart=${avg(near)} | over(>20): n=${over.length} avgStart=${avg(over)}`);
}) ();

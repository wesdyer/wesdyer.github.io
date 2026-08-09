// Bay leg-1 ODOMETER: bots vs her. The subsection table shows the fleet FASTER
// through the water in 7 of 10 subsections yet slower to the mark, with 0.8 s/boat
// of stalling — which can only be extra distance. This measures it directly.
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname, process.argv[4]||'treeNOW');
const TRIALS=parseInt(process.argv[2])||6, SEED0=parseInt(process.argv[3])||9100;
// her leg-1 odometer, from the stamped laps
const H=[];
for(const f of fs.readdirSync(path.join(__dirname,'traj')).filter(x=>x.startsWith('traj_bay_'))){
  const j=JSON.parse(fs.readFileSync(path.join(__dirname,'traj',f),'utf8'));
  if(j.venueFingerprint!=='a331fe02:13481') continue;
  const F=j.format,gi=(s,k)=>s[F.indexOf(k)];
  const S=j.samples.filter(s=>gi(s,'phase')===1&&gi(s,'leg')===1);
  let odo=0,tk=0,last=null;
  for(let i=1;i<S.length;i++){const d=Math.hypot(gi(S[i],'x')-gi(S[i-1],'x'),gi(S[i],'y')-gi(S[i-1],'y')); if(d<200)odo+=d;
    const t=gi(S[i],'playerTack'); if(last!=null&&t!==last&&t!==0)tk++; last=t;}
  H.push([Math.round(odo),tk]);
}
(async()=>{const b=await chromium.launch();const p=await b.newPage();
 await p.addInitScript(()=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:'bay'}))});
 await p.goto('file://'+path.resolve(ROOT,'regatta/index.html'));
 await p.addScriptTag({content:fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8')});
 const all=[];
 for(let i=0;i<TRIALS;i++){
  const r=await p.evaluate(async(seed)=>{window.evalHarness.seed=seed;window.resetGame();window.startRace();
    state.course.cutoff=900; const pl=state.boats.find(b=>b.isPlayer); pl.x=1e6;pl.y=1e6;
    const odo={},prev={},dt=1/60;
    for(let it=0;it<60*900;it++){window.update(dt);
      if(state.race.status==='racing') for(const b of state.boats){ if(b.isPlayer||b.raceState.finished)continue;
        if(b.raceState.leg!==1){prev[b.name]=null;continue;}
        const q=prev[b.name]; if(q){const d=Math.hypot(b.x-q[0],b.y-q[1]); if(d<200) odo[b.name]=(odo[b.name]||0)+d;}
        prev[b.name]=[b.x,b.y];}
      if(state.race.status==='finished')break;
      if(state.race.status==='racing'&&state.race.timer>880)break;}
    return Object.values(odo).map(Math.round);},SEED0+i);
  all.push(...r);
 }
 await b.close();
 const q=(a,pp)=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(pp*(s.length-1))];};
 console.log('leg length (straight) 2943u');
 console.log('HER  leg-1 odometer:',H.map(h=>h[0]).join(', '),' tacks:',H.map(h=>h[1]).join(', '));
 console.log(`     med ${q(H.map(h=>h[0]),0.5)}  = ${(q(H.map(h=>h[0]),0.5)/2943).toFixed(2)}x the straight line`);
 console.log(`BOT  leg-1 odometer: n=${all.length}  med ${q(all,0.5)}  p25 ${q(all,0.25)}  p75 ${q(all,0.75)}`);
 console.log(`     med = ${(q(all,0.5)/2943).toFixed(2)}x the straight line   EXCESS vs her: ${q(all,0.5)-q(H.map(h=>h[0]),0.5)}u`);
})();

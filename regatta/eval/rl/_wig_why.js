// WHY IS WIGGLE STILL FIRING? (2026-08-10, after the day-scaled stuck bars landed)
//
// The bars are now accelBar/resetBar (race constants from the day's median wind).
// A boat's speed therefore sits in one of three regimes each frame:
//   under accelBar  -> the timer ACCUMULATES (genuinely slow)
//   over  resetBar  -> the timer CLEARS
//   between         -> the DEAD BAND: it holds whatever it had, which is how a
//                      timer ratchets to 3 s without the boat ever being stopped.
// If the surviving wiggles are fed by the dead band, there is more to win by
// narrowing it. If they are fed by genuine sub-accelBar time, the trigger is
// right and the remaining cost is wiggle's ACTION, not its threshold.
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname, process.argv[2]||'treeHD12');
const V=process.argv[3]||'swamp';
(async()=>{
  const b=await chromium.launch();const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGE ERROR:',String(e).slice(0,200)));
  await p.addInitScript((vv)=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:vv}))},V);
  await p.goto('file://'+path.resolve(ROOT,'regatta/index.html'));
  await p.addScriptTag({content:fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8')});
  const r=await p.evaluate(()=>{
    const acc={t:0,below:0,dead:0,above:0,wig:0,wigEntries:0,entryBelow:0,entryDead:0,spd:0};
    for(let s=0;s<4;s++){
      window.evalHarness.seed=4300+s;window.resetGame();window.startRace();
      state.course.cutoff=900;
      const pl=state.boats.find(x=>x.isPlayer); if(pl){pl.x=1e6;pl.y=1e6;}
      const DT=1/60; const wasWig={};
      for(let it=0;it<60*900;it++){
        window.update(DT);
        if(state.race.status!=='racing'){if(state.race.status==='finished')break;continue;}
        const aB=state.course._stuckAccelBar!=null?state.course._stuckAccelBar:0.25;
        const rB=state.course._stuckResetBar!=null?state.course._stuckResetBar:0.625;
        for(const bo of state.boats){
          if(bo.isPlayer||bo.raceState.finished||bo.raceState.leg<1)continue;
          const c=bo.controller; if(!c)continue;
          const v=bo.speed||0;
          acc.t+=DT; acc.spd+=v*4*DT;
          if(v<aB)acc.below+=DT; else if(v>rB)acc.above+=DT; else acc.dead+=DT;
          if(c.wiggleActive)acc.wig+=DT;
          const k=bo.name;
          if(c.wiggleActive&&!wasWig[k]){acc.wigEntries++; if(v<aB)acc.entryBelow++; else if(v<=rB)acc.entryDead++;}
          wasWig[k]=c.wiggleActive;
        }
      }
    }
    return {...acc, aB:state.course._stuckAccelBar, rB:state.course._stuckResetBar};
  });
  const P=x=>(100*x/r.t).toFixed(1)+'%';
  console.log('\n=== '+V.toUpperCase()+' WIGGLE REGIME (4 seeds, '+path.basename(ROOT)+') ===');
  console.log('bars: accelBar '+(r.aB*4).toFixed(2)+' kt   resetBar '+(r.rB*4).toFixed(2)+' kt   fleet mean '+(r.spd/r.t).toFixed(2)+' kt');
  console.log('time below accelBar (accumulating) '+P(r.below));
  console.log('time in the DEAD BAND (holding)    '+P(r.dead));
  console.log('time above resetBar (clearing)     '+P(r.above));
  console.log('wiggle active                      '+P(r.wig));
  console.log('wiggle ENTRIES '+r.wigEntries+'   at entry: below accelBar '+r.entryBelow+'   in dead band '+r.entryDead+
              '   ('+(100*r.entryDead/(r.wigEntries||1)).toFixed(0)+'% of entries were NOT actually slow)');
  await b.close();
})();

// Sailed-track point-of-sail probe: races the bots on each venue and logs every bot's TWA/TWS along its
// track, then draws tracks coloured by point of sail over the mean wind map.
//   NODE_PATH=node_modules node regatta/guidelines/wind/probe/tracks.js venue...   (from repo root)
const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
const OUT=path.resolve('regatta/guidelines/wind/probe'); fs.mkdirSync(OUT+'/tracks',{recursive:true});
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.addInitScript(()=>localStorage.setItem('regatta_settings',JSON.stringify({venue:'bay'})));
await p.goto('file://'+path.resolve('regatta/index.html'));
await p.addScriptTag({content:fs.readFileSync('regatta/eval/eval_harness.js','utf8')});await p.waitForTimeout(400);
const all=fs.existsSync(OUT+'/tracks.json')?JSON.parse(fs.readFileSync(OUT+'/tracks.json')):{};
for(const v of process.argv.slice(2)){const r=await p.evaluate(([v])=>{try{
 const D=Math.PI/180,nd=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
 window.evalHarness.seed=21;localStorage.setItem('regatta_settings',JSON.stringify({venue:v}));selectVenue(v);resetGame();startRace();
 const pl=state.boats.find(x=>x.isPlayer); if(pl){pl.controller=new BotController(pl);}
 const boats=state.boats; const tr=boats.map(()=>[]); let t=0;
 for(let it=0;it<1100*30;it++){ if(pl){const d=normalizeAngle(pl.controller.targetHeading-pl.heading);pl.controller.update(1/30);state.keys.ArrowLeft=d<-0.02;state.keys.ArrowRight=d>0.02;}
   update(1/30); if(state.race.status!=='racing'){if(state.race.status==='finished')break; else continue;}
   t+=1/30; if(it%15)continue;
   boats.forEach((bt,k)=>{if(bt.raceState.finished)return;const w=getWindAt(bt.x,bt.y);const m=regionWindAt(bt.x,bt.y);
     tr[k].push([Math.round(bt.x),Math.round(bt.y),Math.round(nd(bt.heading-w.direction)/D),+w.speed.toFixed(1),+m.speed.toFixed(1),Math.round(nd(w.direction-state.wind.baseDirection)/D),bt.raceState.leg,+(bt.speed*4).toFixed(1)]);});
   if(boats.every(x=>x.raceState.finished))break;}
 const fin=boats.map(x=>x.raceState.finished?+x.raceState.finishTime.toFixed(1):null);
 return {fin,tr};}catch(e){return {err:e.stack}}},[v]);
 if(r.err){console.error(v,r.err);continue}
 all[v]=r; fs.writeFileSync(OUT+'/tracks.json',JSON.stringify(all)); console.error('tracks',v,r.fin.filter(x=>x).length,'finished');}
await b.close()})();

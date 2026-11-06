// Per-venue wind character probe. Run from repo root: NODE_PATH=node_modules node probe.js venue...
const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
const SP=process.env.SP; const VENUES=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.error('ERR',e.message));
await p.addInitScript(()=>localStorage.setItem('regatta_settings',JSON.stringify({venue:'bay'})));
await p.goto('file://'+path.resolve('regatta/index.html'));
await p.addScriptTag({content:fs.readFileSync('regatta/eval/eval_harness.js','utf8')});await p.waitForTimeout(400);
const all={};
for(const v of VENUES){
 const res=await p.evaluate(([v])=>{try{
  const D=Math.PI/180, nd=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
  window.evalHarness.seed=11;localStorage.setItem('regatta_settings',JSON.stringify({venue:v}));selectVenue(v);resetGame();startRace();for(let i=0;i<3;i++)update(1/30);
  const legs=state.course.dmc.legs, bnd=state.course.boundary;
  const wet=(x,y)=>Arena.contains(bnd,x,y,0)&&inMaskWater(x,y);
  const meanAt=(x,y)=>{WIND_MEAN_FIELD=true;const w=regionWindAt(x,y);WIND_MEAN_FIELD=false;return w};
  const regs=state.course.windRegions||[];
  const savedPh=regs.map(r=>r.phase);
  // ---- polar helpers
  const bestUp=(ws)=>{let bv=0,ba=40;for(let a=30;a<=60;a++){const s=getTargetSpeed(a*D,false,ws)*Math.cos(a*D);if(s>bv){bv=s;ba=a}}return ba*D};
  const bestDn=(ws)=>{let bv=0,ba=150;for(let a=120;a<=180;a++){const s=Math.max(getTargetSpeed(a*D,true,ws),getTargetSpeed(a*D,false,ws))*-Math.cos(a*D);if(s>bv){bv=s;ba=a}}return ba*D};
  const spd=(twa,ws)=>Math.max(getTargetSpeed(twa,false,ws),Math.abs(twa)>90*D?getTargetSpeed(twa,true,ws):0);
  const out={venue:v,legs:[]};
  // legs (skip leg 0 = start approach when tiny)
  for(let li=0;li<legs.length;li++){const L=legs[li];if(!L||!L.pts||L.pts.length<2)continue;const a=L.pts[0],e=L.pts[L.pts.length-1];
   const dx=e.x-a.x,dy=e.y-a.y,len=Math.hypot(dx,dy); if(len<300)continue;
   const ux=dx/len,uy=dy/len,lx=uy,ly=-ux; // left when facing the mark
   const brg=Math.atan2(ux,-uy);
   const mid=meanAt(a.x+dx/2,a.y+dy/2); const twa=Math.abs(nd(brg-mid.direction))/D;
   const type=twa<55?'beat':twa>135?'run':'reach';
   // lateral profile: offsets in fractions of leg length
   const offs=[-0.4,-0.2,0,0.2,0.4]; const prof=offs.map(o=>{let s=0,dir=0,c=0,n=0;const dirs=[];
     for(const f of [0.15,0.35,0.5,0.65,0.85]){const x=a.x+dx*f+lx*o*len,y=a.y+dy*f+ly*o*len;if(!wet(x,y))continue;const w=meanAt(x,y);s+=w.speed;dirs.push(nd(w.direction-mid.direction));n++}
     return n?{o,n,kt:+(s/n).toFixed(1),ddeg:+(dirs.reduce((p,q)=>p+q,0)/n/D).toFixed(1)}:{o,n:0}});
   // temporal: oscillation only (regionWindAt), 3 points: mid, left 0.25, right 0.25
   const pts=[[0,0],[-0.25,0],[0.25,0],[0,-0.4],[0,0.4]].map(([o,f])=>[a.x+dx*(0.5+f)+lx*o*len,a.y+dy*(0.5+f)+ly*o*len]);
   const series=pts.map(([x,y])=>{const d=[],s=[];if(!wet(x,y))return null;const t0=state.time;for(let t=0;t<=600;t+=2){state.time=t;const w=regionWindAt(x,y);d.push(nd(w.direction-mid.direction)/D);s.push(w.speed)}state.time=t0;return {d,s}});
   const stat=(arr)=>{const m=arr.reduce((p,q)=>p+q,0)/arr.length;const sd=Math.sqrt(arr.reduce((p,q)=>p+(q-m)**2,0)/arr.length);const so=[...arr].sort((p,q)=>p-q);
     let zc=0;for(let i=1;i<arr.length;i++)if((arr[i-1]-m)*(arr[i]-m)<0)zc++;return {m:+m.toFixed(1),sd:+sd.toFixed(1),p5:+so[Math.floor(.05*so.length)].toFixed(1),p95:+so[Math.floor(.95*so.length)].toFixed(1),halfPeriod:zc?+(600/zc).toFixed(0):null}};
   const corr=(A,B)=>{if(!A||!B)return null;const n=A.length,ma=A.reduce((p,q)=>p+q,0)/n,mb=B.reduce((p,q)=>p+q,0)/n;let c=0,va=0,vb=0;for(let i=0;i<n;i++){c+=(A[i]-ma)*(B[i]-mb);va+=(A[i]-ma)**2;vb+=(B[i]-mb)**2}return va&&vb?+(c/Math.sqrt(va*vb)).toFixed(2):null};
   const T=series[0]?{dir:stat(series[0].d),spd:stat(series[0].s)}:null;
   const lr=series[1]&&series[2]?{corrDirLR:corr(series[1].d,series[2].d),corrDirFB:corr(series[3]&&series[3].d,series[4]&&series[4].d)}:null;
   out.legs.push({li,lenM:+(len/10).toFixed(0),twa:+twa.toFixed(0),type,mid:{kt:+mid.speed.toFixed(1)},prof,T,lr,a:[a.x,a.y],e:[e.x,e.y]});
  }
  // ---- tacking pricer over regionWindAt (oscillating, no puffs) with land avoidance
  const price=(L,mode,strat,t0)=>{const a=L.a,e=L.e;let x=a[0],y=a[1],t=t0,dt=0.5,tack=null,last=-99,tacks=0,len=Math.hypot(e[0]-a[0],e[1]-a[1]);
    const ux=(e[0]-a[0])/len,uy=(e[1]-a[1])/len;
    for(let k=0;k<4000;k++){state.time=t;const w=regionWindAt(x,y);const ws=Math.max(0.3,w.speed);const bx=e[0]-x,by=e[1]-y,dist=Math.hypot(bx,by);if(dist<60)return {t:t-t0,tacks};
     const brg=Math.atan2(bx,-by);const rel=nd(brg-w.direction); // 0 = mark dead upwind
     const opt=mode==='beat'?bestUp(ws):bestDn(ws);
     const fetchable=mode==='beat'?Math.abs(rel)>=opt:Math.abs(rel)<=opt;
     let h;
     if(fetchable){h=brg}else{
      const hS=w.direction+opt,hP=w.direction-opt; // two tacks
      if(tack===null){tack=strat==='L'?(mode==='beat'?'P':'S'):strat==='R'?(mode==='beat'?'S':'P'):(rel>0?'S':'P');}
      // signed cross-track (left +)
      const xt=((x-a[0])*uy-(y-a[1])*ux)/len; // left positive
      const vm=(hh)=>spd(nd(hh-w.direction),ws)*(Math.sin(hh)*bx/dist+(-Math.cos(hh))*by/dist);
      let want=tack;
      // layline: if the other tack now fetches, switch
      const other=tack==='S'?hP:hS; const relO=nd(brg-other);
      if(strat==='L'||strat==='R'){ if(Math.abs(relO)<0.03||Math.sign(nd(brg-(tack==='S'?hS:hP)))!==Math.sign(relO)) {} ;
        // switch when the other tack's VMG toward mark beats current by 0 and we've overstood (bearing passes other heading)

      } else if(strat==='M'){ if(Math.abs(xt)>0.1&&t-last>4){ const goLeft=xt<0; want=goLeft?(mode==='beat'?'P':'S'):(mode==='beat'?'S':'P'); } }
      else if(strat==='H'){ // tack on headers: pick the tack with better VMG to the mark, hysteresis, stay within 30%
        const va=(hh)=>spd(nd(hh-w.direction),ws)*(Math.sin(hh)*ux-Math.cos(hh)*uy);const vc=va(tack==='S'?hS:hP),vo=va(other); if(vo>vc*1.08&&t-last>8) want=tack==='S'?'P':'S'; if(Math.abs(xt)>0.3&&t-last>4){want=xt<0?(mode==='beat'?'P':'S'):(mode==='beat'?'S':'P')} }
      if(want!==tack){tack=want;tacks++;last=t;t+=3;} // 3 s per tack/gybe
      h=tack==='S'?hS:hP;
      // land/boundary look-ahead
      const sp=spd(nd(h-w.direction),ws)*15;const nx=x+Math.sin(h)*sp*3,ny=y-Math.cos(h)*sp*3;
      if(!wet(nx,ny)){tack=tack==='S'?'P':'S';tacks++;last=t;t+=3;h=tack==='S'?hS:hP;}
     }
     const sp=spd(nd(h-w.direction),ws)*15;x+=Math.sin(h)*sp*dt;y+=-Math.cos(h)*sp*dt;t+=dt;if(window.__TR&&k%10==0)window.__TR.push([strat,+(t-t0).toFixed(1),Math.round(x),Math.round(y),tack,fetchable?1:0,+(nd(h-w.direction)/D).toFixed(0)]);
    } return {t:null,tacks};
  };
  out.price=[];if(window.__TRACE){window.__TR=[];price(out.legs[0],out.legs[0].type,'L',0);price(out.legs[0],out.legs[0].type,'M',0);out.trace=window.__TR;window.__TR=null;}
  for(const L of out.legs){ if(L.type==='reach')continue; const row={li:L.li,type:L.type,res:{}};
    for(const strat of ['L','R','M','H']){const ts=[];for(const t0 of [0,40,80,120,160,200,240,280]){const r=price(L,L.type,strat,t0);ts.push(r.t)}
      const ok=ts.filter(x=>x!=null);row.res[strat]={mean:ok.length?+(ok.reduce((p,q)=>p+q,0)/ok.length).toFixed(1):null,min:ok.length?+Math.min(...ok).toFixed(1):null,max:ok.length?+Math.max(...ok).toFixed(1):null,fail:ts.length-ok.length,ts}}
    out.price.push(row);}
  state.time=0;
  // ---- live sim: puffs, lees, squalls, plume — sample along legs every 1 s for 240 s
  const samp=[];for(const L of out.legs){for(const f of [0.2,0.4,0.6,0.8])for(const o of [-0.25,0,0.25]){const [ax,ay]=L.a,[ex,ey]=L.e;const dx=ex-ax,dy=ey-ay,len=Math.hypot(dx,dy);const x=ax+dx*f+dy/len*o*len,y=ay+dy*f-dx/len*o*len;if(wet(x,y))samp.push([x,y])}}
  const dS=[],dD=[],lee=[],ratio=[],perPt=samp.map(()=>[]);let gusts=0,n=0,sq=0;
  for(let k=0;k<200*30&&state.race.status!=='racing';k++)update(1/30);
  for(let it=0;it<240*30;it++){update(1/30); if(it%30)continue; n++;gusts+=state.gusts.length;sq+=(state.squalls||[]).length;
    samp.forEach(([x,y],k)=>{const m=regionWindAt(x,y),w=getWindAt(x,y);const sh=shadowAt(x,y,m.direction,'wind');lee.push(sh);
     // isolate puff effect: compare w (with lee) to m*sh
     dS.push(w.speed-m.speed*sh);dD.push(nd(w.direction-m.direction)/D);perPt[k].push(w.speed);});}
  const q=(arr,f)=>{const s=[...arr].sort((a,b)=>a-b);return +s[Math.floor(f*(s.length-1))].toFixed(2)};
  const frac=(arr,fn)=>+(arr.filter(fn).length/arr.length).toFixed(3);
  const gf=perPt.map(a=>{const m=a.reduce((p,q)=>p+q,0)/a.length;return m>0.5?Math.max(...a)/m:null}).filter(x=>x);
  out.live={samples:dS.length,meanGusts:+(gusts/n).toFixed(1),meanSqualls:+(sq/n).toFixed(1),puffFrac:frac(dS,x=>x>1.5),lullFrac:frac(dS,x=>x<-1.5),dS_p5:q(dS,0.05),dS_p95:q(dS,0.95),dS_p99:q(dS,0.99),dD_p5:q(dD,0.05),dD_p95:q(dD,0.95),
    leeFrac80:frac(lee,x=>x<0.8),leeFrac95:frac(lee,x=>x<0.95),gustFactorMaxOverMean_med:gf.length?q(gf,0.5):null,gustFactor_p90:gf.length?q(gf,0.9):null};
  out.spread=state.wind.spread;
  return out;}catch(e){return {err:String(e.stack)}}},[v]); if(res.err){console.error(res.err);continue}
 all[v]=res; console.error('done',v);
}
fs.writeFileSync(SP+'/probe_out.json',JSON.stringify(all,null,1));await b.close()})();

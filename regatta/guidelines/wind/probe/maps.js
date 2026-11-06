const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
const SP=process.env.SP; const VENUES=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.error('ERR',e.message));
await p.addInitScript(()=>localStorage.setItem('regatta_settings',JSON.stringify({venue:'bay'})));
await p.goto('file://'+path.resolve('regatta/index.html'));
await p.addScriptTag({content:fs.readFileSync('regatta/eval/eval_harness.js','utf8')});await p.waitForTimeout(400);
for(const v of VENUES){
 const url=await p.evaluate(([v])=>{try{
  window.evalHarness.seed=11;localStorage.setItem('regatta_settings',JSON.stringify({venue:v}));selectVenue(v);resetGame();startRace();update(1/30);
  const bnd=state.course.boundary;const legs=state.course.dmc.legs.filter(L=>L&&L.pts&&L.pts.length>1);
  // extent: legs padded
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const L of legs)for(const q of L.pts){x0=Math.min(x0,q.x);x1=Math.max(x1,q.x);y0=Math.min(y0,q.y);y1=Math.max(y1,q.y)}
  const pad=Math.max(600,0.3*Math.max(x1-x0,y1-y0));x0-=pad;x1+=pad;y0-=pad;y1+=pad;
  const W=700,H=Math.round(700*(y1-y0)/(x1-x0));const c=document.createElement('canvas');c.width=W;c.height=Math.min(H,1400);const g=c.getContext('2d');
  const sx=W/(x1-x0),sy=c.height/(y1-y0);const s=Math.min(sx,sy);
  const P=(x,y)=>[(x-x0)*s,(y-y0)*s];
  WIND_MEAN_FIELD=true;let lo=1e9,hi=0;const cell=6;const grid=[];
  for(let py=0;py<c.height;py+=cell)for(let px=0;px<W;px+=cell){const x=x0+px/s,y=y0+py/s;const wet=Arena.contains(bnd,x,y,0)&&inMaskWater(x,y);
    if(!wet){grid.push([px,py,null]);continue}const w=regionWindAt(x,y);const sh=shadowAt(x,y,w.direction,'wind');const k=w.speed*sh;grid.push([px,py,k,w.direction]);lo=Math.min(lo,k);hi=Math.max(hi,k)}
  for(const [px,py,k] of grid){if(k==null){g.fillStyle='#5a5244'}else{const t=(k-lo)/Math.max(0.1,hi-lo);g.fillStyle=`hsl(${240-220*t},70%,${30+30*t}%)`}g.fillRect(px,py,cell,cell)}
  // arrows
  g.strokeStyle='rgba(255,255,255,0.8)';g.lineWidth=1;
  for(let py=20;py<c.height;py+=40)for(let px=20;px<W;px+=40){const x=x0+px/s,y=y0+py/s;if(!(Arena.contains(bnd,x,y,0)&&inMaskWater(x,y)))continue;const w=regionWindAt(x,y);
    const ux=-Math.sin(w.direction),uy=Math.cos(w.direction);const L=8+w.speed*0.6;g.beginPath();g.moveTo(px-ux*L/2,py-uy*L/2);g.lineTo(px+ux*L/2,py+uy*L/2);g.stroke();
    g.beginPath();g.arc(px+ux*L/2,py+uy*L/2,1.8,0,7);g.fillStyle='#fff';g.fill();}
  WIND_MEAN_FIELD=false;
  g.strokeStyle='#ff0';g.lineWidth=2;for(const L of legs){g.beginPath();L.pts.forEach((q,i)=>{const [a,b2]=P(q.x,q.y);i?g.lineTo(a,b2):g.moveTo(a,b2)});g.stroke()}
  g.fillStyle='#fff';g.font='14px sans-serif';g.fillText(`${v}  mean speed x lee: ${lo.toFixed(1)}-${hi.toFixed(1)} kt (blue->red); 100m = ${(1000*s).toFixed(0)}px; arrows point downwind`,8,16);
  return c.toDataURL('image/png');}catch(e){return 'ERR'+e.stack}},[v]);
 if(url.startsWith('ERR')){console.error(url);continue}
 fs.writeFileSync(SP+'/maps/'+v+'.png',Buffer.from(url.split(',')[1],'base64'));console.error('map',v);
}
await b.close()})();

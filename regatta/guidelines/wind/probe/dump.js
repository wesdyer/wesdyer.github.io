const fs=require('fs');global.window={};
const dir=process.argv[2];
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.venue.js'))){
  eval(fs.readFileSync(dir+'/'+f,'utf8'));
}
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const[x1,y1]=p[i],[x2,y2]=p[(i+1)%p.length];a+=x1*y2-x2*y1}return Math.abs(a/2)};
const bb=p=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const[x,y]of p){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}return [Math.round(x0),Math.round(y0),Math.round(x1),Math.round(y1)]};
for(const [k,d] of Object.entries(window.VENUE_DOC)){
  console.log('\n=== '+k+' : '+(d.card&&d.card.name));
  console.log('note:',d.note);
  if(d.card) console.log('card:',JSON.stringify(d.card).slice(0,600));
  const w=d.wind||{};
  const {regions,...rest}=w; console.log('wind:',JSON.stringify(rest));
  for(const r of (regions||[])){const {poly,...o}=r;console.log('  WR',JSON.stringify(o),'n',poly.length,'area_km2',(area(poly)/1e8).toFixed(3),'bb',bb(poly).join(','))}
  const g=d.gusts||{};const {regions:gr,...grest}=g;console.log('gusts:',JSON.stringify(grest));
  for(const r of (gr||[])){const {poly,...o}=r;console.log('  GR',JSON.stringify(o),'area_km2',(area(poly)/1e8).toFixed(3),'bb',bb(poly).join(','))}
  for(const key of ['squalls','weather','conditions','tide','current','volcano','race','course']){ if(d[key]) console.log(key+':',JSON.stringify(d[key]).slice(0,500)); }
  console.log('keys:',Object.keys(d).join(' '));
}

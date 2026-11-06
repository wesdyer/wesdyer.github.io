// Dump every venue's wind + gust region polygons and marks to regions.json (for tracks_regions.py).
const fs=require('fs');global.window={};const dir=process.argv[2];
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.venue.js')))eval(fs.readFileSync(dir+'/'+f,'utf8'));
const out={};for(const[k,d]of Object.entries(window.VENUE_DOC)){out[k]={wind:(d.wind&&d.wind.regions||[]).map(r=>({id:r.id,name:r.name,poly:r.poly,dir:Math.round(r.direction*180/Math.PI),kt:r.speed,dv:Math.round((r.dirVar||0)*180/Math.PI),sv:r.speedVar,per:r.period,fo:r.falloff})),
 gusts:(d.gusts&&d.gusts.regions||[]).map(r=>({id:r.id,poly:r.poly,count:r.count,kt:r.gustKt,size:r.sizeM})),marks:(d.course&&d.course.marks||[]).map(m=>({id:m.id,name:m.name,x:Math.round(m.x),y:Math.round(m.y)}))}}
fs.writeFileSync(process.argv[3],JSON.stringify(out));

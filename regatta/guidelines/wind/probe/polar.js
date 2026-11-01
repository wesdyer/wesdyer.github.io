const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+path.resolve('regatta/index.html'));
await p.addScriptTag({content:fs.readFileSync('regatta/eval/eval_harness.js','utf8')});await p.waitForTimeout(400);
const r=await p.evaluate(()=>{const out=[];for(const ws of [2,4,6,8,10,12,14,16,18,20,22,25,28]){let bu=0,bua=0,bd=0,bda=0,reach=0;
for(let a=25;a<=180;a+=1){const r=a*Math.PI/180;const s=getTargetSpeed(r,false,ws),ss=getTargetSpeed(r,true,ws);const sp=Math.max(s,ss);
const vu=s*Math.cos(r);if(vu>bu){bu=vu;bua=a}const vd=-sp*Math.cos(r);if(vd>bd){bd=vd;bda=a}if(a==90)reach=sp}
out.push([ws,+bu.toFixed(2),bua,+bd.toFixed(2),bda,+reach.toFixed(2)])}return out});
console.log('TWS upVMG upTWA downVMG downTWA reach90');r.forEach(x=>console.log(x.join('\t')));await b.close()})();

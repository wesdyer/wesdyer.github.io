// Same as dns_hunt.js but enables the Sayings RNG-leak so the original
// history-dependent deadlock scenarios (seeds 152/154/169/192) still occur.
// Used to verify the OCS position-clear fix resolves real deadlocks.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ARGS = process.argv.slice(2);
const NUM = parseInt(ARGS[0])||100, BASE = parseInt(ARGS[1])||100, LIM = parseInt(ARGS[2])||600;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js','utf8') });
  await page.evaluate(()=> window.__DNS_KEEP_SAYINGS_LEAK = true);
  let total=0, dns=0; const cases=[];
  for (let i=0;i<NUM;i++){
    const seed=BASE+i;
    const r = await page.evaluate(({seed,limit})=>window.evalHarness.runTrial(seed,limit),{seed,limit:LIM});
    r.boats.forEach(b=>{ if(b.name==='Player')return; total++;
      const s=r.events.find(e=>e.boatId===b.id&&e.type==='start_cross');
      if(!s){ dns++; cases.push({seed,name:b.name,finalPos:{x:b.x,y:b.y},ocs:b.ocs}); }
    });
    if((i+1)%25===0) console.log(`  ${i+1}/${NUM} | DNS ${dns}/${total}`);
  }
  await browser.close();
  console.log(`\nLEAK-ON HUNT: DNS ${dns}/${total} (${(dns/total*100).toFixed(3)}%)`);
  cases.forEach(c=>console.log(`  seed ${c.seed} ${c.name} ocs=${c.ocs} pos=(${Math.round(c.finalPos.x)},${Math.round(c.finalPos.y)})`));
})();

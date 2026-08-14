// At the course cutoff script.js marks EVERY unfinished boat finished=true with
// finishTime = the cutoff, and tags resultStatus DNF/DNS. tier_eval.js tests only
// `b.finished`, so a boat that never finished is scored as a finisher whose time is
// exactly the cutoff. How often does that bite?
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUES = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  for (const v of VENUES) {
    const p = await b.newPage();
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({venue: vv})), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(1200);
    await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js','utf8') });
    let real=0, dnf=0, dns=0, tot=0, cutoff=0;
    const N = 4;
    for (let i=0;i<N;i++){
      const r = await p.evaluate(({s}) => { const res = window.evalHarness.runTrial(s,600);
        res.cutoff = state.course.cutoff; return res; }, {s: 9300+i});
      cutoff = r.cutoff;
      for (const x of r.boats) { if (x.isPlayer) continue; tot++;
        if (x.resultStatus === 'DNS') dns++; else if (x.resultStatus === 'DNF') dnf++; else real++; }
    }
    console.log(`${v.padEnd(10)} cutoff ${String(Math.round(cutoff)).padStart(4)}s   真finishers ${String(real).padStart(3)}/${tot}   DNF ${String(dnf).padStart(3)}  DNS ${String(dns).padStart(2)}   -> ${(100*(dnf+dns)/tot).toFixed(0)}% of boats are scored at the cutoff by tier_eval`);
    await p.close();
  }
  await b.close();
})();

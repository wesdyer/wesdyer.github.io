// Compare a COLD run (first race after page load) against a WARM run (second),
// and dump the exact frame where they diverge.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const H = fs.readFileSync('regatta/eval/trace_harness.js','utf8');
const VENUE = process.argv[2] || 'river';
const SEED  = parseInt(process.argv[3] || '90210', 10);
const WARM  = (process.argv[4] || VENUE).split(',');   // venues run before the measured race

(async () => {
  const browser = await chromium.launch();
  async function run(warmups, opts) {
    const p = await browser.newPage();
    p.on('pageerror', e => console.error('ERR', e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.addScriptTag({ content: H });
    if (warmups) for (const wv of WARM) {
      await p.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({venue:v})), wv);
      await p.evaluate(([s]) => window.traceHarness.runTrace(s,{timeLimit:300}), [SEED]);
    }
    await p.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({venue:v})), VENUE);
    const r = await p.evaluate(([s,o]) => window.traceHarness.runTrace(s,o), [SEED, opts]);
    await p.close();
    return r;
  }

  const cold = await run(0, { timeLimit: 300, frameHashes: true });
  const warm = await run(1, { timeLimit: 300, frameHashes: true });
  console.log(`${VENUE}/${SEED}  cold=${cold.behaviorHash}  warm=${warm.behaviorHash}  same=${cold.behaviorHash===warm.behaviorHash}`);
  console.log(`  initHash cold=${cold.initHash} warm=${warm.initHash} same=${cold.initHash===warm.initHash}`);
  console.log(`  courseGeom cold=${cold.courseGeomHash} warm=${warm.courseGeomHash} same=${cold.courseGeomHash===warm.courseGeomHash}`);

  let d = -1;
  const n = Math.min(cold.frameHashes.length, warm.frameHashes.length);
  for (let i=0;i<n;i++) if (cold.frameHashes[i] !== warm.frameHashes[i]) { d = i; break; }
  if (d < 0) { console.log('  no frame divergence'); await browser.close(); return; }
  console.log(`  first divergent frame ${d} (race t=${((d-1800)/60).toFixed(2)}s)`);

  for (const f of [d, d+1]) {
    const a = await run(0, { timeLimit: 300, stopAtFrame: f });
    const c = await run(1, { timeLimit: 300, stopAtFrame: f });
    const out = [];
    a.finalState.forEach((x,i) => {
      const y = c.finalState[i]; const dd = [];
      for (const k of Object.keys(x)) {
        if (k === 'id') continue;
        if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) dd.push(`${k} ${JSON.stringify(x[k])} -> ${JSON.stringify(y[k])}`);
      }
      if (dd.length) out.push(`    boat ${x.id}: ${dd.join(' | ')}`);
    });
    const wd = [];
    if (a.windState) for (const k of Object.keys(a.windState)) {
      if (JSON.stringify(a.windState[k]) !== JSON.stringify(c.windState[k])) wd.push(`${k} ${JSON.stringify(a.windState[k])} -> ${JSON.stringify(c.windState[k])}`);
    }
    if (wd.length) out.unshift(`    WIND: ${wd.join(' | ')}`);
    console.log(`  @frame ${f}: ${out.length ? '\n'+out.join('\n') : 'identical'}`);
  }
  await browser.close();
})();

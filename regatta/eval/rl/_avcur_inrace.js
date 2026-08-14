// What is `_avCurMax` IN RACE (not at page load) in each tree? The gate is what
// matters, so print the scalar the router actually computed and which side of 2.0
// it falls on.  node _avcur_inrace.js <venue> <tree> [tree2 ...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const V = process.argv[2] || 'river';
(async () => {
  const br = await chromium.launch();
  for (const T of process.argv.slice(3)) {
    const ROOT = path.join(__dirname, T);
    const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0,200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, V);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await p.evaluate(() => {
      window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
      const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
      const seen = [];
      for (let i = 0; i < 60 * 60; i++) {
        window.update(1/60);
        if (state.course._avCurMax !== undefined && !seen.length) seen.push({ t: +state.race.timer.toFixed(2), v: state.course._avCurMax });
        if (seen.length && i > 60 * 30) break;
      }
      return { first: seen[0] || null, final: state.course._avCurMax,
               gate: (state.course._avCurMax === undefined || state.course._avCurMax < 2.0) ? 'ON' : 'OFF' };
    });
    await p.close();
    console.log(`${T.padEnd(10)} ${V}: _avCurMax = ${r.final}  (first set at t=${r.first ? r.first.t : '-'})  GATE ${r.gate}`);
  }
  await br.close();
})();

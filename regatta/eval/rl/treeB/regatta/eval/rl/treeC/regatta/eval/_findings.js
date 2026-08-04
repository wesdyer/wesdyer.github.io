// Print every finding, ok included — a passing check that says nothing is
// indistinguishable from one nobody wrote.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1400);
  const out = await p.evaluate(() => {
    const c = window.state.course;
    return {
      findings: (window.EditorApp._state().findings || []).map(f =>
        `${f.level.padEnd(5)} ${f.title}: ${f.detail}`),
      cutoff: c.cutoff, startTimer: window.state.race.startTimerDuration,
      totalLegs: window.state.race.totalLegs,
      est: window.EditorApp._estimate(),
      timePanel: document.getElementById('info-time').innerText
    };
  });
  console.log(out.findings.join('\n'));
  console.log(`\ncutoff ${out.cutoff ? out.cutoff.toFixed(1) + 's' : 'none'} · prestart `
            + `${out.startTimer}s · legs ${out.totalLegs}`);
  console.log('\n--- time panel ---\n' + out.timePanel);
  if (out.est) {
    console.log(`\nestimate: ${out.est.secs.toFixed(0)}s over ${Math.round(out.est.dist/5)}m `
              + `(${out.est.ms}ms, ref ${out.est.refKnots.toFixed(1)}kt)`);
    for (const l of out.est.legs) console.log(`  leg ${l.leg}: ${Math.round(l.dist/5)}m `
      + `at ${l.twaDeg}° TWA, VMG ${l.vmg ? l.vmg.toFixed(2) : '?'}kt -> ${l.secs.toFixed(0)}s`);
  } else console.log('\nestimate: none');
  await b.close();
})();

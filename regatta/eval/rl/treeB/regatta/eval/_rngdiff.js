// Record the CALL SITE of every Math.random() draw for the first N draws of a
// race, cold vs warm, and report the first index where the sequences differ.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const H = fs.readFileSync('regatta/eval/trace_harness.js','utf8');
const VENUE = process.argv[2] || 'river';
const N = parseInt(process.argv[3] || '600', 10);
const WARM = (process.argv[4] || VENUE).split(',');   // venues to run before the measured race

const INSTRUMENT = (n) => `
  window.__sites = [];
  const th = window.traceHarness;
  if (!th.__origRandom) th.__origRandom = th.random;
  th.random = function () {
      const v = th.__origRandom.call(th);
      if (window.__sites.length < ${n}) {
          const st = new Error().stack.split('\\n');
          // frame 0 = Error, 1 = this wrapper, 2 = Math.random arrow, 3 = caller
          window.__sites.push((st[3] || '?').trim().replace(/^at\\s+/, ''));
      }
      return v;
  };
  Math.random = () => th.random();
`;

(async () => {
  const browser = await chromium.launch();
  async function capture(warmups) {
    const p = await browser.newPage();
    p.on('pageerror', e => console.error('ERR', e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.addScriptTag({ content: H });
    await p.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({venue:v})), VENUE);
    if (warmups) for (const wv of WARM) {
      await p.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({venue:v})), wv);
      await p.evaluate(() => window.traceHarness.runTrace(90210,{timeLimit:300}));
    }
    await p.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({venue:v})), VENUE);
    await p.evaluate(INSTRUMENT(N));
    await p.evaluate(() => window.traceHarness.runTrace(90210,{timeLimit:2}));
    const sites = await p.evaluate(() => window.__sites);
    await p.close();
    return sites;
  }
  const cold = await capture(0);
  const warm = await capture(1);
  console.log(`${VENUE}: cold ${cold.length} draws, warm ${warm.length} draws`);
  let d = -1;
  for (let i=0;i<Math.min(cold.length,warm.length);i++) if (cold[i]!==warm[i]) { d=i; break; }
  if (d<0) { console.log('  call-site sequences identical'); }
  else {
    console.log(`  first differing draw at index ${d}`);
    for (let i=Math.max(0,d-3); i<Math.min(cold.length, d+5); i++) {
      const mark = i===d ? ' <<<' : '';
      console.log(`   [${i}] cold: ${cold[i]}`);
      console.log(`   [${i}] warm: ${warm[i]}${mark}`);
    }
  }
  await browser.close();
})();

// FAR-TARGET FIRING PROBE (flats push): on leg 1 how often OTB1's far target is offered,
// admitted, or refused (by distance, off-axis bearing, or the rays) per boat. Needs the
// treeFLB1d instrumentation counters.   node _fl_far.js <seed> <tree>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SEED = +(process.argv[2] || 9405); const ROOT = path.join(__dirname, process.argv[3] || 'treeFLB1d');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message.slice(0, 200)));
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', character: AI_CONFIG[0].name })); });
  const r = await page.evaluate(async (seed) => {
    window.evalHarness.seed = seed; resetGame(); startRace();
    const pl = state.boats.find(b => b.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
    const nine = state.boats.filter(b => b !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.9, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300;
    const bots = state.boats.filter(b => !b.isPlayer); const dt = 1 / 60; const out = [];
    const snap = {};
    for (let it = 0; it < 60 * 80; it++) {
      update(dt); if (state.race.status !== 'racing') continue;
      for (const b of bots) { const c = b.controller; if (!c) continue; if (b.raceState.leg === 1 && !snap[b.name + 'L1']) snap[b.name + 'L1'] = { try: c.__farTry || 0, hit: c.__farHit || 0, ray: c.__farRay || 0, off: c.__farOff || 0, near: c.__farNear || 0 }; if (b.raceState.leg >= 2 && !snap[b.name + 'L2']) { const a = snap[b.name + 'L1'] || { try: 0, hit: 0, ray: 0, off: 0, near: 0 }; snap[b.name + 'L2'] = 1; out.push({ name: b.name, r2: +state.race.timer.toFixed(1), try: (c.__farTry || 0) - a.try, hit: (c.__farHit || 0) - a.hit, ray: (c.__farRay || 0) - a.ray, off: (c.__farOff || 0) - a.off, near: (c.__farNear || 0) - a.near, sEnter: !!c._sEnterPt, offDeg: c.__farOffDeg, optDeg: c.__optDeg }); } }
      if (out.length === bots.length) break;
    }
    return out;
  }, SEED);
  for (const o of r) console.log(`${o.name.padEnd(9)} r2 ${o.r2}: far offered ${o.try} hit ${o.hit} rayRefused ${o.ray} offAxis ${o.off} tooNear ${o.near} sEnterPt ${o.sEnter} lastOff ${o.offDeg}° opt ${o.optDeg}°`);
  await browser.close();
})();

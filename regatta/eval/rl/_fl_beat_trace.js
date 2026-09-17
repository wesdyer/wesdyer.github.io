// BEAT SCORE TRACE (flats push): one bot's scoreTack decomposition through leg 1 at 2 Hz —
// starboard/port totals and their vmg / pressure / shift / land terms, the target, the
// boat's tack and heading — to see WHICH term flips the choice. Needs treeFLB2d.
//   node _fl_beat_trace.js <seed> <name> [tree]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SEED = +(process.argv[2] || 9401); const NAME = process.argv[3] || 'Pebble'; const ROOT = path.join(__dirname, process.argv[4] || 'treeFLB2d');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message.slice(0, 200)));
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', character: AI_CONFIG[0].name })); });
  const r = await page.evaluate(async ({ seed, name }) => {
    window.evalHarness.seed = seed; resetGame(); startRace();
    const pl = state.boats.find(b => b.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
    const nine = state.boats.filter(b => b !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.9, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300;
    const b = state.boats.find(x => x.name === name); if (!b) return ['no boat ' + name + ' in ' + state.boats.map(x => x.name).join(',')];
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const rows = []; const dt = 1 / 60;
    for (let it = 0; it < 60 * 60; it++) {
      update(dt); if (state.race.status !== 'racing') continue;
      if (b.raceState.leg >= 2) break;
      if (b.raceState.leg !== 1 || it % 30 !== 0) continue;
      const c = b.controller; const d = c && c.__dbg; if (!d) continue;
      const wd = getWindAt(b.x, b.y).direction; const twa = norm(b.heading - wd);
      const T = d.terms || {}; const f = (o) => o ? `vmg${o.vmg} pr${o.press} sh${o.shift == null ? '-' : o.shift} ld${o.land == null ? 0 : o.land} off${o.tgtOff}` : '-';
      rows.push(`${state.race.timer.toFixed(1)}s tack ${twa > 0 ? 'S' : 'P'} twa${(Math.abs(twa) * 57.3).toFixed(0)} pos(${Math.round(b.x)},${Math.round(b.y)}) dist${d.dist} tgt(${d.tgt}) S=${d.S} [${f(T.S)}]  P=${d.P} [${f(T.P)}] wind${((wd) * 57.3).toFixed(0)}° dev${(c.lastAvoidDeviation || 0).toFixed(2)}`);
    }
    return rows;
  }, { seed: SEED, name: NAME });
  console.log(r.join('\n'));
  await browser.close();
})();

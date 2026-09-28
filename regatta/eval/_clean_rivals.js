// Probe: how many rivals are penalized in a bot race (rules on) — Bramble's 'Untouchable' needs 5+.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const venues = process.argv.slice(2).length ? process.argv.slice(2) : ['bay', 'seatrials', 'lake'];
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') }); await p.waitForTimeout(400);
  for (const v of venues) { const counts = [];
    for (let seed = 1; seed <= 4; seed++) counts.push(await p.evaluate(([v, seed]) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, penaltiesEnabled: true })); settings.penaltiesEnabled = true; window.evalHarness.seed = seed; resetGame(); startRace();
      for (let it = 0; it < 60 * 400; it++) { update(1 / 60); if (state.boats.every(x => x.raceState.finished || x.isPlayer)) break; }
      return state.boats.filter(x => !x.isPlayer && (x.raceState.totalPenalties || 0) > 0).length; }, [v, seed]));
    console.log(v, 'rivals penalized per race:', counts.join(' ')); }
  await b.close(); })();

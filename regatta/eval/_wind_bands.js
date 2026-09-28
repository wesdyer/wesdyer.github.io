// Probe: the average true wind a boat sails in at each venue (a bot's own position, sampled each second, gun to finish)
// — for the Whisper Wind (<=7 kn), Storm Wall (>=18 kn) and Every Colour bands.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') }); await p.waitForTimeout(400);
  const venues = process.argv.slice(2).length ? process.argv.slice(2) : ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'otter', 'flats', 'volcanic', 'seatrials'];
  for (const v of venues) { const avgs = [];
    for (let seed = 1; seed <= 2; seed++) avgs.push(...await p.evaluate(([v, seed]) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); window.evalHarness.seed = seed; resetGame(); startRace();
      const bots = state.boats.filter(x => !x.isPlayer).slice(0, 4), sum = bots.map(() => [0, 0]); const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
      for (let it = 0; it < 60 * 500; it++) { update(1 / 60); if (state.race.status !== 'racing' || it % 60) continue;
        bots.forEach((bt, k) => { if (bt.raceState.finished) return; const w = getWindAt(bt.x, bt.y); sum[k][0] += w.speed; sum[k][1]++; }); if (bots.every(x => x.raceState.finished)) break; }
      return sum.map(([s, n]) => n ? s / n : 0); }, [v, seed]));
    avgs.sort((a, b) => a - b); console.log(v.padEnd(10), 'avg wind kn:', avgs.map(x => x.toFixed(1)).join(' ')); }
  await b.close(); })();

const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Swell && typeof BotController !== 'undefined');
  const sw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  console.log(await p.evaluate(async (sw) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); VENUE_DOC.ocean.swell = sw;
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 30));
    const bt = state.boats[1]; for (const o of state.boats) if (o !== bt) { o.x = 1e6; o.y = 1e6; o.raceState.finished = true; }
    state.race.status = 'racing'; const m4 = state.course.marks.find(m => m.id === 'mark-4');
    bt.raceState.leg = state.course.route.length - 1; bt.x = m4.x + 300; bt.y = m4.y + 150; bt.speed = 3; bt.heading = Math.PI / 2;
    const P = Swell.primary(); const hist = {}; let t = 0, n = 0, line = '';
    while (t < 400 && !bt.raceState.finished) { update(1 / 30); t += 1 / 30; n++;
      const e = Swell.setAt(P, bt.x, bt.y); const k = (Math.round(e * 10) / 10).toFixed(1); hist[k] = (hist[k] || 0) + 1;
      if (n % 60 === 0) line += `${Math.round(t)}s e${e.toFixed(2)} ${(bt.speed * 4).toFixed(1)}kn | `; }
    return 'set strength met: ' + Object.entries(hist).sort((a, b) => a[0] - b[0]).map(([k, v]) => k + ':' + (100 * v / n).toFixed(0) + '%').join(' ') + '\n' + line; }, sw));
  await b.close(); })();

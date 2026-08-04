// The two records, exercised as a history rather than asserted from one race: a fast race
// off the podium, then a slow win, then a race that beats neither. The fastest time and the
// best finish have to move independently — that is the whole point of splitting them — and
// both older save shapes have to keep reading.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '.';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +(process.env.W || 1500), height: +(process.env.H || 1000) }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);

  // Sail one real race so raceState is genuine, then re-report it as a series of finishes.
  await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', character: 'Muninn', musicEnabled: false, soundEnabled: false }));
    let s = 100;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace();
    const me = state.boats[0];
    me.controller = new BotController(me);
    let t = 0;
    while (t < 900 && state.race.status !== 'finished') {
      me.controller.update(1 / 30);
      const d = normalizeAngle(me.controller.targetHeading - me.heading);
      state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
      update(1 / 30); t += 1 / 30;
    }
    togglePause(true);
    localStorage.removeItem('regatta_bests');
  });

  const report = (seconds, pos) => p.evaluate(([seconds, pos]) => {
    const out = recordVenueBest(seconds, pos);
    return { in: `${seconds}s / ${pos}`, ...out, stored: bestForVenue() };
  }, [seconds, pos]);

  console.log('fast, 6th   ', JSON.stringify(await report(271.743, 6)));
  console.log('slow, 1st   ', JSON.stringify(await report(298.500, 1)));
  console.log('neither     ', JSON.stringify(await report(280.000, 4)));
  console.log('faster, 9th ', JSON.stringify(await report(265.001, 9)));

  // Legacy saves: a bare number, and the { t, pos } shape whose pos WAS the fastest race's
  // place — that place is a finish that happened here, so it seeds the finish record.
  for (const legacy of ['243.1', '{"t":243.1,"pos":3}']) {
    console.log('legacy ' + legacy.padEnd(22), JSON.stringify(await p.evaluate((v) => {
      localStorage.setItem('regatta_bests', `{"lagoon:4":${v}}`);
      return bestForVenue();
    }, legacy)));
  }

  // The race-day board and the results hero, both drawn from a real history.
  await p.evaluate(() => {
    localStorage.setItem('regatta_bests', JSON.stringify({ 'lagoon:4': { t: 271.743, bestPos: 2, bestPosT: 288.02 } }));
    state.race.bestChecked = false;
    delete document.getElementById('res-hero').dataset.sig;
    showResults();
  });
  await p.waitForTimeout(200);
  await p.locator('#res-hero').screenshot({ path: OUT + '/bests_hero.png' });
  console.log('hero:', (await p.evaluate(() => document.getElementById('res-hero').innerText.split('\n').join(' | '))));

  await p.evaluate(() => {
    document.getElementById('results-overlay').classList.add('hidden');
    setupPreRaceOverlay();
    document.getElementById('pre-race-overlay').classList.remove('hidden');
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/bests_board.png' });
  // The header row wraps when it has to, so ask the GEOMETRY whether anything is sticking
  // out — summing chip widths says "overflows" on a row that simply took a second line.
  // `_chipfit.js` runs the same measurement across four window widths.
  console.log('board chips:', await p.evaluate(() => {
    const row = document.querySelector('#venue-detail > div');
    const box = row.getBoundingClientRect();
    const over = [...row.children].flatMap(k => [...k.children]).reduce((m, c) => {
      const r = c.getBoundingClientRect();
      return Math.max(m, Math.round(r.right - box.right), Math.round(box.left - r.left));
    }, 0);
    return `${row.innerText.replace(/\n/g, ' | ')}  [row ${Math.round(box.width)}x${Math.round(box.height)}, `
         + `${over > 0 ? 'OVERFLOWS by ' + over + 'px' : 'fits'}]`;
  }));

  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 5) : 'no page errors');
  await b.close();
})();

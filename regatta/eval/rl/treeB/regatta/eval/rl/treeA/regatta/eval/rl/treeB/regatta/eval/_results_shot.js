// Screenshot the results screen with a fleet that actually raced, so the splits, the
// deltas and the personal-best chip are real numbers rather than stubs.
//
// Three states, because they are the three the screen has to survive:
//   results.png          — everybody home
//   results_racing.png   — you finished, the tail of the fleet has not
//   results_best.png     — you beat the time you had here (and the one where you did not)
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d2838aad-e4a1-4bb9-9da9-9e523f267081/scratchpad';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +(process.env.W||1500), height: +(process.env.H||1000) }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);

  // Sail a whole race headlessly, so every split and rank is genuinely recorded.
  const race = (stopAtPlayerFinish) => p.evaluate((stopEarly) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', character: 'Muninn', musicEnabled: false, soundEnabled: false }));
    let s = 100;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace();
    // Nobody is at the helm in a headless race. Steer the player through the REAL player
    // path — a bot brain deciding a heading, pressed into the arrow keys — so isPlayer
    // stays true the whole way and the split recording is exercised as it ships.
    const me = state.boats[0];
    me.controller = new BotController(me);
    let t = 0;
    const done = () => stopEarly ? me.raceState.finished : state.race.status === 'finished';
    while (t < 900 && !done()) {
      me.controller.update(1 / 30);
      const diff = normalizeAngle(me.controller.targetHeading - me.heading);
      state.keys.ArrowLeft = diff < -0.02;
      state.keys.ArrowRight = diff > 0.02;
      update(1 / 30); t += 1 / 30;
    }
    state.camera.target = 'finish';
    // The page's own loop keeps stepping the sim behind the overlay — which is exactly how
    // rows update as boats finish behind you, and exactly what would erase the state we
    // are trying to photograph. Freeze it.
    if (stopEarly) togglePause(true);
    showResults();
  }, stopAtPlayerFinish);

  const readback = () => p.evaluate(() => ({
    hero: document.getElementById('res-hero').innerText.split('\n'),
    subtitle: document.getElementById('res-subtitle').textContent,
    statusChip: document.getElementById('res-status').textContent,
    splits: document.getElementById('res-splits').innerText.split('\n').filter(Boolean),
    footnote: document.getElementById('res-footnote').textContent,
    rows: document.querySelectorAll('.res-row').length,
    meRow: document.querySelector('.res-me').innerText.split('\n').filter(Boolean),
    legRanks: state.boats.find(b => b.isPlayer).raceState.legRanks,
    bests: localStorage.getItem('regatta_bests'),
  }));

  await race(false);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '/results.png' });
  console.log('ALL HOME:', JSON.stringify(await readback(), null, 1));

  // Same race, rendered the moment the player crossed — the state the overlay actually
  // opens in.
  await race(true);
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '/results_racing.png' });
  console.log('STILL RACING:', JSON.stringify(await readback(), null, 1));

  // Re-render the finished race against a stored best it beats, then one it does not.
  for (const [label, prev, file] of [['BEAT', 999, 'results_best.png'], ['MISSED', 1, 'results_missed.png']]) {
    await p.evaluate((prevBest) => {
      localStorage.setItem('regatta_bests', JSON.stringify({ [`${settings.venue}:${state.race.totalLegs}`]: prevBest }));
      state.race.bestChecked = false;
      delete document.getElementById('res-hero').dataset.sig;
      showResults();
    }, prev);
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '/' + file });
    console.log(label + ':', (await readback()).hero.join(' | '));
  }

  if (errs.length) console.log('ERRORS:', errs.slice(0, 5)); else console.log('no page errors');
  await b.close();
})();

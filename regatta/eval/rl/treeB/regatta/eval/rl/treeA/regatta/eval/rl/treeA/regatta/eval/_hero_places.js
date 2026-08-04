// The hero band at every place it can report: podium metals, off-podium white, DNF red —
// and the avatar glow, which has to be the player's OWN colour whoever they picked.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '.';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);

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
  });

  const shots = [];
  for (const place of [1, 2, 3, 4, 'DNF']) {
    const info = await p.evaluate((place) => {
      const me = state.boats.find(b => b.isPlayer);
      const others = state.boats.filter(b => !b.isPlayer).sort((a, b) => a.raceState.finishTime - b.raceState.finishTime);
      // Put the player at the wanted place by moving their finish time between the boats
      // that would sit either side of it.
      me.raceState.resultStatus = null;
      me.raceState.finished = true;
      if (place === 'DNF') { me.raceState.resultStatus = 'DNF'; }
      else {
        const before = others[place - 2], after = others[place - 1];
        me.raceState.finishTime = before ? (before.raceState.finishTime + after.raceState.finishTime) / 2
                                         : after.raceState.finishTime - 1;
      }
      state.race.bestChecked = false;
      delete document.getElementById('res-hero').dataset.sig;
      showResults();
      const hero = document.getElementById('res-hero');
      return {
        headline: hero.querySelector('.t-display.italic').textContent,
        color: hero.querySelector('.t-display.italic').style.color,
        label: hero.querySelector('.t-label').style.color,
        // The avatar's wrapper, wherever it sits in the hero's tree.
        glow: [...hero.querySelectorAll('*')].map(e => e.style.filter).find(Boolean) || '(none)',
      };
    }, place);
    await p.waitForTimeout(150);
    await p.locator('#res-hero').screenshot({ path: `${OUT}/hero_${place}.png` });
    shots.push(`${place}: ${info.headline}  place=${info.color}  label=${info.label}  glow=${info.glow}`);
  }
  console.log(shots.join('\n'));
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 3) : 'no page errors');
  await b.close();
})();

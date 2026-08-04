// Two things the results page was doing behind the player's back:
//   1. re-inserting all ten rows six times a second (the flicker), and
//   2. opening a Rematch with the camera still parked over the last race's finish.
// Both are measurable, so measure them rather than eyeballing a video.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);

  const out = await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', character: 'Muninn', musicEnabled: false, soundEnabled: false }));
    let s = 100;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace();
    const me = state.boats[0];
    me.controller = new BotController(me);
    let t = 0;
    while (t < 900 && !me.raceState.finished) {
      me.controller.update(1 / 30);
      const d = normalizeAngle(me.controller.targetHeading - me.heading);
      state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
      update(1 / 30); t += 1 / 30;
    }
    showResults();                       // overlay open, boats still racing behind us

    // Count DOM churn over 30 refreshes — the cadence the real page runs at.
    const list = document.getElementById('results-list');
    let adds = 0, removes = 0;
    const obs = new MutationObserver(ms => ms.forEach(m => { adds += m.addedNodes.length; removes += m.removedNodes.length; }));
    obs.observe(list, { childList: true });
    const before = [...list.children].map(r => r.querySelector('.res-name').textContent);
    for (let i = 0; i < 30; i++) { update(1 / 30); showResults(); }
    obs.disconnect();
    const after = [...list.children].map(r => r.querySelector('.res-name').textContent);

    const hoverRule = [...document.styleSheets].some(sh => {
      try { return [...sh.cssRules].some(r => r.selectorText && r.selectorText.includes('.res-row:hover')); }
      catch (e) { return false; }
    });
    const barTransition = getComputedStyle(document.querySelector('.res-bar')).transition;

    // Rematch: the camera must already be on the boat, not travelling to it.
    const finishCam = { x: state.camera.x, y: state.camera.y, rot: state.camera.rotation };
    rematchRace();
    const p0 = state.boats[0];
    const cam = { x: state.camera.x, y: state.camera.y, rot: state.camera.rotation };

    return {
      churn: { adds, removes, rowsStillRacing: after.length },
      orderHeld: before.join() === after.join() || `${before.join()} -> ${after.join()}`,
      hoverRule, barTransition,
      camOffsetAtStart: Math.hypot(cam.x - p0.x, cam.y - p0.y).toFixed(3),
      camTravelledFromLastRace: Math.hypot(cam.x - finishCam.x, cam.y - finishCam.y).toFixed(0),
      camRotVsBoat: Math.abs(normalizeAngle(cam.rot - p0.heading)).toFixed(3),
      status: state.race.status,
    };
  });
  console.log(JSON.stringify(out, null, 1));
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 3) : 'no page errors');
  await b.close();
})();

// Clicking your own face: badge only, no button. Plus a look at the filled fleet discs.
const { chromium } = require('playwright'); const path = require('path');
const OUT = '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d2838aad-e4a1-4bb9-9da9-9e523f267081/scratchpad';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);
  await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', character: 'Muninn' }));
    resetGame();
    // Put some famously dark hulls on the water so the disc fill is actually tested.
    ['Muninn', 'Bruce', 'Pebble', 'Razor'].forEach((n, i) => {
      const cfg = AI_CONFIG.find(c => c.name === n);
      if (cfg && state.boats[i + 1]) applyBoatIdentity(state.boats[i + 1], cfg, false);
    });
    renderCompetitorGrid();
    selectCompetitor(PLAYER_CARD_KEY);
  });
  await p.waitForTimeout(600);
  await p.locator('#pre-race-overlay > div > div:nth-child(2) > div:nth-child(2)').screenshot({ path: OUT + '/fleet_column.png' });
  const info = await p.evaluate(() => {
    const cell = document.querySelector('.pr-fleet-cell img');
    return {
      selfPanel: document.getElementById('competitor-detail').innerText.split('\n').filter(Boolean),
      buttonsInPanel: document.querySelectorAll('#competitor-detail button').length,
      discFills: [...document.querySelectorAll('.pr-fleet-cell img')].map(i => i.style.background).slice(0, 5),
      venueNameItalic: getComputedStyle(document.querySelector('#venue-detail .t-display')).fontStyle,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
  await b.close();
})();

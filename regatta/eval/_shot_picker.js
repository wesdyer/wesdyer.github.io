const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('file://' + __dirname + '/../index.html');
  await p.waitForFunction(() => window.state && typeof openCharacterPicker === 'function');
  await p.evaluate(() => { setupPreRaceOverlay(); });
  await p.waitForTimeout(700);
  await p.evaluate(() => { selectCompetitor(PLAYER_CARD_KEY);
    document.getElementById('pr-competitors-grid').scrollIntoView({block:'center'}); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: __dirname + '/_pk_fleet.png' });
  await p.evaluate(() => document.getElementById('competitor-detail').scrollIntoView({block:'center'}));
  await p.waitForTimeout(400);
  await p.screenshot({ path: __dirname + '/_pk_detail.png' });
  await p.evaluate(() => openCharacterPicker());
  await p.waitForTimeout(900);
  await p.screenshot({ path: __dirname + '/_pk_grid.png' });
  const info = await p.evaluate(() => {
    const g = document.getElementById('character-grid');
    const cells = [...g.children];
    const cs = getComputedStyle(g);
    const c0 = cells[0].getBoundingClientRect();
    return { cells: cells.length,
             cols: cs.gridTemplateColumns.split(' ').length,
             cellW: Math.round(c0.width), cellH: Math.round(c0.height),
             gridH: Math.round(g.getBoundingClientRect().height),
             scrollH: g.scrollHeight };
  });
  console.log(JSON.stringify(info));
  if (errs.length) console.log('ERRORS', errs.slice(0,4));
  await b.close();
})();

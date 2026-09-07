// THE CLUBHOUSE FLOW (Sep 2026): a whole cup, a series abandoned, and a single race, through
// the real screens with each race's finish FABRICATED so the suite stays fast. What it proves:
// the hub is the first screen; a cup locks the fleet and the skipper at the gun and rebuilds
// the same nine for every race; points are 10..1 with DNF 0 and totals are sums; the standings
// and podium screens come up with the right buttons; a trophy is recorded; abandoning a series
// ends it whole; and a single race still lands on Back to Clubhouse / Rematch.
//
//   node regatta/eval/test_series.js [screenshot-dir]
//
// A REAL race inside a cup (player on autopilot for ~4 min of sim) is the slow companion and
// stays out of `npm test`.
const { chromium } = require('playwright'); const path = require('path');
const SHOTS = process.argv[2] || null;
let fails = 0; const check = (name, ok, detail) => { console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name}${ok || !detail ? '' : ' — ' + detail}`); if (!ok) fails++; };
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.goto('file://' + path.resolve('regatta/index.html')); await page.waitForTimeout(2000);
  await page.evaluate(() => { localStorage.removeItem('regatta_trophies'); });
  const vis = (id) => page.evaluate((id) => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden'); }, id);
  // Fabricate a finish: the player wins by `playerPos` (1-based), one boat DNFs, the rest by order.
  const finish = (playerPos, dnfName) => page.evaluate(([playerPos, dnfName]) => {
    const boats = state.boats.slice(); const player = boats.find(b => b.isPlayer); const others = boats.filter(b => !b.isPlayer);
    const order = others.slice(); order.splice(playerPos - 1, 0, player);
    order.forEach((b, i) => { b.raceState.finished = true; b.raceState.finishTime = 200 + i * 3; b.raceState.resultStatus = (b.name === dnfName) ? 'DNF' : null; });
    state.race.status = 'finished';
    showResults();
    return order.map(b => b.name);
  }, [playerPos, dnfName]);

  console.log('skipper badge on the hub');
  const before = await page.evaluate(() => document.getElementById('hub-skipper-name').textContent);
  check('hub badge names the skipper', before === await page.evaluate(() => settings.character), before);
  await page.click('#hub-skipper'); await page.waitForTimeout(500);
  check('badge opens the character picker', await vis('character-picker'));
  const target = await page.evaluate(() => charactersAlphabetical().find(c => c.name !== settings.character).name);
  await page.click(`#character-grid [data-char="${target}"]`); await page.waitForTimeout(500);
  check('picking updates the badge', await page.evaluate(() => document.getElementById('hub-skipper-name').textContent) === target && !(await vis('character-picker')));
  await page.evaluate(() => { settings.character = 'Finley'; saveSettings(); applyPlayerCharacter(); refreshClubhouse(); });
  console.log('cup flow');
  await page.click('#door-cup'); await page.waitForTimeout(300);
  await page.click('.ch-cup.sel .js-cup-start'); await page.waitForTimeout(1500);
  check('cup goes straight to the race 1 briefing', await vis('pre-race-overlay') && !(await vis('fleet-overlay')) && await page.evaluate(() => Series.active && Series.raceNumber() === 1));
  check('no fleet detour on the briefing (the hub owns the skipper)', !(await page.evaluate(() => !!document.getElementById('prerace-fleet-btn'))));
  check('board has no fleet column', await page.evaluate(() => !document.querySelector('#pre-race-overlay #pr-competitors-grid')));
  check('board button is the gun', await page.evaluate(() => /Start Race/.test(document.getElementById('start-race-btn').textContent)));
  let fleet0 = null;
  for (let race = 1; race <= 4; race++) {
    await page.evaluate(() => startRace()); await page.waitForTimeout(2500);
    const st = await page.evaluate(() => ({ status: state.race.status, locked: Series.locked(), fleet: state.boats.filter(b => !b.isPlayer).map(b => b.name), venue: settings.venue, expect: Series.currentVenue() }));
    check(`race ${race}: prestart on ${st.expect}`, st.status === 'prestart' && st.venue === st.expect, JSON.stringify(st));
    check(`race ${race}: fleet locked`, st.locked);
    if (!fleet0) fleet0 = st.fleet; else check(`race ${race}: same nine as race 1`, JSON.stringify(st.fleet) === JSON.stringify(fleet0), st.fleet.join(',') + ' vs ' + fleet0.join(','));
    const dnf = fleet0[race % fleet0.length];
    const order = await finish(race === 2 ? 2 : 1, dnf);
    await page.waitForTimeout(300);
    const labels = await page.evaluate(() => [document.getElementById('results-restart-button').textContent.trim(), document.getElementById('results-rematch-button').textContent.trim()]);
    check(`race ${race}: results buttons are abandon / standings`, /Abandon cup/i.test(labels[0]) && /Standings/i.test(labels[1]), labels.join(' | '));
    await page.click('#results-rematch-button'); await page.waitForTimeout(400);
    check(`race ${race}: standings shown`, await vis('standings-overlay') && !(await vis('results-overlay')));
    const table = await page.evaluate(() => Series.standings().map(r => ({ name: r.name, total: r.total, pts: r.pts, rank: r.rank })));
    const me = table.find(r => r.name === 'Finley');
    const dnfRow = table.find(r => r.name === dnf);
    check(`race ${race}: player scored ${race === 2 ? 9 : 10} this race`, me.pts[race - 1] === (race === 2 ? 9 : 10), JSON.stringify(me));
    check(`race ${race}: DNF scored 0`, dnfRow && dnfRow.pts[race - 1] === 0, JSON.stringify(dnfRow));
    check(`race ${race}: totals are sums`, table.every(r => r.total === r.pts.reduce((a, b) => a + b, 0)));
    check(`race ${race}: ordered by total`, table.every((r, i) => i === 0 || table[i - 1].total >= r.total));
    if (race === 1) if (SHOTS) await page.screenshot({ path: SHOTS + '/standings1.png' });
    const btn = await page.evaluate(() => [document.getElementById('standings-abandon-btn').textContent.trim(), document.getElementById('standings-next-btn').textContent.trim()]);
    if (race < 4) {
      check(`race ${race}: buttons abandon / next`, /Abandon cup/.test(btn[0]) && /Next race/.test(btn[1]), btn.join(' | '));
      await page.click('#standings-next-btn'); await page.waitForTimeout(1500);
      const nb = await page.evaluate(() => ({ board: !document.getElementById('pre-race-overlay').classList.contains('hidden'), chip: document.getElementById('prerace-series-chip').textContent, n: Series.raceNumber(), venue: settings.venue, fleet: state.boats.filter(b => !b.isPlayer).map(b => b.name) }));
      check(`race ${race + 1}: board says race ${race + 1}`, nb.board && nb.n === race + 1 && nb.chip.includes(`Race ${race + 1} of 4`), JSON.stringify(nb));
      check(`race ${race + 1}: no fleet page between races`, !(await vis('fleet-overlay')));
      const lockedPill = await page.evaluate(() => (document.querySelector('#fleet-overlay .pr-fleet-item.me .pr-lock-pill') || {}).textContent);
      check(`race ${race + 1}: skipper locked`, /Locked/.test(lockedPill || ''), lockedPill);
      check(`race ${race + 1}: fleet rebuilt from the lock`, JSON.stringify(nb.fleet) === JSON.stringify(fleet0));
      if (race === 1) if (SHOTS) await page.screenshot({ path: SHOTS + '/board2.png' });
    } else {
      check('final: podium buttons', /Back to clubhouse/.test(btn[0]) && /Sail it again/.test(btn[1]), btn.join(' | '));
      check('final: hero shown', await vis('standings-hero'));
      const troph = await page.evaluate(() => JSON.parse(localStorage.getItem('regatta_trophies') || '{}'));
      check('final: trophy recorded as won', troph.commodore && troph.commodore.won === true && troph.commodore.bestPts === me.total, JSON.stringify(troph));
      if (SHOTS) await page.screenshot({ path: SHOTS + '/podium.png' });
      await page.click('#standings-abandon-btn'); await page.waitForTimeout(800);
      check('final: back to the hub', await vis('clubhouse-overlay') && await page.evaluate(() => Series.active === null));
      const cupState = await page.evaluate(() => document.getElementById('door-cup-state').textContent);
      check('hub shows 1 of 3 won', cupState === '1 of 3 won', cupState);
    }
  }

  console.log('series flow + abandon');
  await page.click('#door-series'); await page.waitForTimeout(300);
  await page.click('#series-lengths .ch-len[data-n="6"]'); await page.waitForTimeout(200);
  const draw1 = await page.evaluate(() => [...document.querySelectorAll('#series-draw .pr-venue-name')].map(e => e.textContent));
  await page.click('#series-redraw-btn'); await page.waitForTimeout(200);
  const draw2 = await page.evaluate(() => [...document.querySelectorAll('#series-draw .pr-venue-name')].map(e => e.textContent));
  check('series: six drawn, no repeats', draw1.length === 6 && new Set(draw1).size === 6, draw1.join(','));
  check('series: redraw changes the draw', JSON.stringify(draw1) !== JSON.stringify(draw2), 'same twice (possible but unlikely)');
  await page.click('#series-start-btn'); await page.waitForTimeout(1500);
  check('series: straight to the race 1 briefing', await vis('pre-race-overlay') && !(await vis('fleet-overlay')));
  const sb = await page.evaluate(() => ({ kind: Series.active && Series.active.kind, n: Series.total(), chip: document.getElementById('prerace-series-chip').textContent, tiles: document.querySelectorAll('#pr-route-grid .pr-route-tile').length }));
  check('series: board for race 1 of 6', sb.kind === 'series' && sb.n === 6 && sb.tiles === 6 && /Race 1 of 6/.test(sb.chip), JSON.stringify(sb));
  await page.evaluate(() => startRace()); await page.waitForTimeout(2500);
  await finish(3, null); await page.waitForTimeout(300);
  await page.click('#results-rematch-button'); await page.waitForTimeout(300);
  await page.click('#standings-abandon-btn'); await page.waitForTimeout(300);
  check('series: abandon confirm up', await vis('abandon-screen'));
  const ctx = await page.evaluate(() => document.getElementById('abandon-context').textContent);
  check('series: abandon copy names the series', /ends the 6-race series after race 1 of 6/.test(ctx), ctx);
  await page.click('#abandon-confirm'); await page.waitForTimeout(800);
  check('series: abandoned to the hub', await vis('clubhouse-overlay') && await page.evaluate(() => Series.active === null));
  const st = await page.evaluate(() => document.getElementById('door-series-state').textContent);
  check('hub: series door still No series yet', st === 'No series yet', st);

  console.log('single race untouched');
  await page.click('#door-race'); await page.waitForTimeout(1200);
  const single = await page.evaluate(() => ({ chipHidden: document.getElementById('prerace-series-chip').classList.contains('hidden'), pickerShown: !document.getElementById('venue-picker').classList.contains('hidden'), tiles: document.querySelectorAll('#venue-picker .pr-venue-tile').length }));
  check('single: picker back, chip gone', single.chipHidden && single.pickerShown && single.tiles === 13, JSON.stringify(single));
  await page.click('#start-race-btn'); await page.waitForTimeout(2500);
  check('single: Start Race goes straight to the water', !(await vis('fleet-overlay')) && await page.evaluate(() => state.race.status === 'prestart'));
  await finish(1, null); await page.waitForTimeout(300);
  const labels = await page.evaluate(() => [document.getElementById('results-restart-button').textContent.trim(), document.getElementById('results-rematch-button').textContent.trim()]);
  check('single: results buttons back to clubhouse / rematch', /Back to Clubhouse/.test(labels[0]) && /Rematch/.test(labels[1]), labels.join(' | '));
  await page.click('#results-restart-button'); await page.waitForTimeout(800);
  check('single: back to clubhouse lands on the hub', await vis('clubhouse-overlay'));
  console.log('page errors:', errs.length ? errs.join('\n') : 'none');
  console.log(fails ? `FAIL — ${fails}` : 'PASS'); await browser.close(); process.exit(fails ? 1 : 0);
})();

// THE RESULTS SCREEN — the one page you only reach by finishing a race.
//
// That makes it the easiest screen in the game to break unnoticed: it renders once, at the
// end, and every unit test that stops at the finish line never draws it. It has already
// taken the whole race down once — `getLuma(settings.hullColor)` threw here after the
// custom-appearance settings were deleted, and it looked seed-dependent because you needed
// a full race to reach it.
//
// So this drives the real showResults() with a finished fleet and asserts what is ON the
// page, not what the model says.
const { chromium } = require('playwright'); const path=require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:1500,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);
  // Finish everyone instantly rather than sailing a whole race.
  await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({venue:'seatrials'}));
    localStorage.removeItem('regatta_bests');   // a stored best would change which chip shows
    resetGame(); startRace();
    state.race.status = 'racing'; state.race.timer = 260;
    state.boats.forEach((bt, i) => {
      bt.raceState.finished = true;
      // player (i=0) deliberately mid-pack, so the highlight is checked off the podium
      bt.raceState.finishTime = 200 + ((i === 0 ? 5.5 : (i < 6 ? i - 1 : i)) * 7.5);
      bt.raceState.leg = state.race.totalLegs + 1;
      bt.raceState.penalties = i % 3 === 0 ? 1 : 0;
      bt.raceState.topSpeed = 7.5 - i * 0.1;
      bt.raceState.distance = 4200 + i * 60;
    });
    // The player's own race, which is what the hero and the splits are made of.
    const me = state.boats[0].raceState;
    me.startTimeDisplay = 3.2; me.startRank = 6;
    me.legTimes = [61.5, 58.25, 60.0, 59.75];
    me.legRanks = [4, 5, 5, 5];
    state.race.status = 'finished';
    showResults();
  });
  await p.waitForTimeout(900);
  const info = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.res-row')];
    const me = rows.filter(r => r.classList.contains('res-me'));
    return {
      rows: rows.length,
      meRows: me.length,
      mePos: rows.findIndex(r => r.classList.contains('res-me')),
      meName: me[0] ? me[0].querySelector('.res-name').textContent : null,
      playerName: settings.character,
      everyRowHasPortrait: rows.every(r => {
        const im = r.querySelector('img');
        return im && /competitors\//.test(im.getAttribute('src'));
      }),
      strayStars: document.querySelectorAll('.res-row svg').length,
      emptyBoxes: rows.filter(r => [...r.querySelectorAll('.w-12.h-12')].some(x => !x.children.length)).length,
      meRingColor: me[0] ? getComputedStyle(me[0].querySelector('.res-bar')).boxShadow : null,
      meNameColor: me[0] ? getComputedStyle(me[0].querySelector('.res-name')).color : null,
      // --- "Finish Line": you are the headline, and a single race carries no series ---
      hero: document.getElementById('res-hero').innerText,
      splitTiles: document.getElementById('res-splits').children.length,
      subtitle: document.getElementById('res-subtitle').textContent,
      footnote: document.getElementById('res-footnote').textContent,
      // Series furniture must not have crept back in.
      pageText: document.getElementById('results-overlay').innerText,
      buttons: [...document.querySelectorAll('#results-overlay button')].map(b => b.id),
    };
  });
  let bad = 0;
  const ok = (m, c, d) => { if (!c) bad++; console.log(`  ${c ? 'ok   ' : 'FAIL '} ${m}${c || !d ? '' : ' — ' + d}`); };
  console.log('the results screen renders a finished fleet\n');
  ok('a row per boat', info.rows === 10, `${info.rows} rows`);
  ok('every row shows a portrait, the player included', info.everyRowHasPortrait);
  ok('the player no longer gets a star instead of a face', info.strayStars === 0, `${info.strayStars} svg`);
  ok('no stray empty avatar boxes', info.emptyBoxes === 0, `${info.emptyBoxes} rows`);
  ok('exactly one row is marked as the player', info.meRows === 1, `${info.meRows}`);
  ok('it is the player\'s row', info.meName === info.playerName, `${info.meName} vs ${info.playerName}`);
  ok('the player row is highlighted off the podium too', info.mePos > 2, `position index ${info.mePos}`);
  ok('the highlight is the gold ring', /251, 191, 36/.test(info.meRingColor || ''), info.meRingColor);
  ok('the player name is gold', /252, 211, 77/.test(info.meNameColor || ''), info.meNameColor);

  console.log('\nyour finish is the headline');
  ok('the hero names your place', /\b6TH\b/.test(info.hero), info.hero.split('\n').slice(0, 3).join(' / '));
  ok('...and who you sailed as', info.hero.includes(info.playerName.toUpperCase()));
  ok('...and the gap that decided it', /behind /.test(info.hero), info.hero);
  ok('a split tile per leg, plus the start', info.splitTiles === 5, `${info.splitTiles} tiles`);
  ok('the header states the venue', /CLUBHOUSE POINT/i.test(info.subtitle), info.subtitle);
  ok('the footnote names the winner', /takes/.test(info.footnote), info.footnote);

  // ⚠️ A single race has no series, so any of these on the page is a bug, not a feature:
  // points are the position column doing arithmetic and "next race" has nowhere to go.
  console.log('\nno series furniture on a single race');
  ok('no points column', !/\bPTS\b|\bPOINTS\b/i.test(info.pageText));
  ok('no standings or next race', !/NEXT RACE|STANDINGS|SERIES/i.test(info.pageText));
  ok('two ways off the page', info.buttons.length === 2, info.buttons.join(', '));

  // The primary button has to actually start a race — it is the one control on this
  // screen a player will press without reading.
  const after = await p.evaluate(async () => {
    document.getElementById('results-rematch-button').click();
    return { status: state.race.status, hidden: document.getElementById('results-overlay').classList.contains('hidden') };
  });
  ok('rematch starts another race', after.status === 'prestart', after.status);
  ok('...and closes the results', after.hidden);

  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n${bad ? 'FAIL' : 'PASS'} — ${bad} failure(s)`);
  await b.close();
  process.exitCode = bad ? 1 : 0;
})();
